import { getAdminDb } from '@/lib/firebase-admin';

// Default platform fees by tier (final fallback if nothing else is configured)
const DEFAULT_FEES: Record<string, number> = {
  payg: 0.06,
  essential: 0.04,
  growth: 0.03,
  scale: 0.02,
  collector: 0.04,
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// In-memory cache for platform fees
let cachedFees: Record<string, number> | null = null;
let feeCacheExpiry = 0;

// In-memory cache for subscription tiers doc (shared source of truth for
// both fee rates and Stripe Price IDs — avoids double Firestore reads)
let cachedTiersDoc: Record<string, any> | null = null;
let tiersCacheExpiry = 0;

async function getTiersDoc(): Promise<Record<string, any> | null> {
  if (cachedTiersDoc && Date.now() < tiersCacheExpiry) {
    return cachedTiersDoc;
  }
  const adminDb = getAdminDb();
  if (!adminDb) return null;
  try {
    const doc = await adminDb.collection('settings').doc('subscriptionTiers').get();
    if (doc.exists) {
      cachedTiersDoc = (doc.data() || {}) as Record<string, any>;
      tiersCacheExpiry = Date.now() + CACHE_TTL;
      return cachedTiersDoc;
    }
    return null;
  } catch (error) {
    console.error('[stripe-helpers] Failed to fetch subscriptionTiers doc:', error);
    return null;
  }
}

/**
 * Get platform fees by tier. Triple-fallback read for maximum safety:
 *   1. settings/subscriptionTiers doc — each tier's transactionFeePercent / 100 (new source of truth)
 *   2. settings/platformFees doc (legacy — kept populated via dual-write)
 *   3. DEFAULT_FEES constants (compile-time fallback)
 *
 * Each layer only fills in tiers the layer above did not provide, so a
 * partially-populated tiers doc still works correctly.
 */
async function getPlatformFees(): Promise<Record<string, number>> {
  if (cachedFees && Date.now() < feeCacheExpiry) {
    return cachedFees;
  }

  const merged: Record<string, number> = { ...DEFAULT_FEES };

  const adminDb = getAdminDb();
  if (!adminDb) {
    // No admin SDK available — return defaults without caching
    return merged;
  }

  // Layer 2: legacy platformFees doc (safety net)
  try {
    const legacyDoc = await adminDb.collection('settings').doc('platformFees').get();
    if (legacyDoc.exists) {
      const legacyData = (legacyDoc.data() || {}) as Record<string, number>;
      for (const [tier, rate] of Object.entries(legacyData)) {
        if (typeof rate === 'number' && rate >= 0 && rate <= 1) {
          merged[tier] = rate;
        }
      }
    }
  } catch (error) {
    console.error('[stripe-helpers] Failed to read legacy platformFees doc:', error);
  }

  // Layer 1: subscriptionTiers doc is the new primary source — overrides layer 2
  try {
    const tiersDoc = await getTiersDoc();
    if (tiersDoc) {
      for (const [tier, tierData] of Object.entries(tiersDoc)) {
        const pct = tierData?.transactionFeePercent;
        if (typeof pct === 'number' && pct >= 0 && pct <= 100) {
          merged[tier] = pct / 100;
        }
      }
    }
  } catch (error) {
    console.error('[stripe-helpers] Failed to derive fees from subscriptionTiers:', error);
  }

  cachedFees = merged;
  feeCacheExpiry = Date.now() + CACHE_TTL;
  return merged;
}

/**
 * Get the platform fee rate for a specific distributor based on their subscription tier.
 * Returns the fee as a decimal (e.g., 0.04 for 4%).
 * Falls back to 0.04 (4%) if tier is unknown.
 */
export async function getPlatformFeeRate(distributorId: string): Promise<number> {
  const adminDb = getAdminDb();
  if (!adminDb) return DEFAULT_FEES.essential;

  try {
    const distDoc = await adminDb.collection('distributors').doc(distributorId).get();
    if (!distDoc.exists) return DEFAULT_FEES.essential;

    const data = distDoc.data()!;

    // Superadmin-configured per-distributor override takes precedence over
    // the tier-derived rate. Stored as a percentage (0.0–6), converted to
    // the decimal representation the rest of the system uses.
    const override = data.customPlatformFeePercent;
    if (typeof override === 'number' && override >= 0 && override <= 6) {
      return override / 100;
    }

    const tier = data.subscriptionTier as string | undefined;
    const fees = await getPlatformFees();

    return fees[tier || 'essential'] ?? DEFAULT_FEES.essential;
  } catch (error) {
    console.error('Failed to get platform fee rate, using default:', error);
    return DEFAULT_FEES.essential;
  }
}

// Legacy stripePrices doc cache (layer 2 fallback)
let cachedLegacyPriceIds: Record<string, Record<string, string>> | null = null;
let legacyPriceIdCacheExpiry = 0;

/**
 * Get a Stripe Price ID for a (tier, billing) pair. Triple-fallback:
 *   1. settings/subscriptionTiers → tier.stripePriceId{Monthly,Quarterly,Yearly} (new source of truth)
 *   2. settings/stripePrices doc (legacy)
 *   3. STRIPE_{TIER}_{BILLING}_PRICE_ID env var (original config)
 *
 * Returns null if nothing is configured at any layer.
 */
export async function getStripePriceId(
  tier: string,
  billing: 'monthly' | 'quarterly' | 'yearly'
): Promise<string | null> {
  // Layer 1: new source of truth — per-tier Stripe IDs on subscriptionTiers doc
  try {
    const tiersDoc = await getTiersDoc();
    if (tiersDoc && tiersDoc[tier]) {
      const field =
        billing === 'monthly'
          ? 'stripePriceIdMonthly'
          : billing === 'quarterly'
            ? 'stripePriceIdQuarterly'
            : 'stripePriceIdYearly';
      const priceId = tiersDoc[tier][field];
      if (typeof priceId === 'string' && priceId.length > 0) {
        return priceId;
      }
    }
  } catch (error) {
    console.error('[stripe-helpers] Failed to read price ID from subscriptionTiers:', error);
  }

  // Layer 2: legacy stripePrices doc
  if (!cachedLegacyPriceIds || Date.now() > legacyPriceIdCacheExpiry) {
    const adminDb = getAdminDb();
    if (adminDb) {
      try {
        const doc = await adminDb.collection('settings').doc('stripePrices').get();
        if (doc.exists) {
          cachedLegacyPriceIds = doc.data() as Record<string, Record<string, string>>;
          legacyPriceIdCacheExpiry = Date.now() + CACHE_TTL;
        }
      } catch {
        // Fall through to env var fallback
      }
    }
  }

  if (cachedLegacyPriceIds?.[tier]?.[billing]) {
    return cachedLegacyPriceIds[tier][billing];
  }

  // Layer 3: original env var fallback
  const billingKey = billing === 'quarterly' ? '3MONTHS' : billing.toUpperCase();
  const envVar = `STRIPE_${tier.toUpperCase()}_${billingKey}_PRICE_ID`;
  return process.env[envVar] || null;
}

/**
 * Invalidate the in-memory caches after an admin save so subsequent reads
 * see the fresh data immediately (rather than waiting up to 5 minutes).
 * Called from the admin subscription-tiers sync endpoint.
 */
export function invalidateTierCaches(): void {
  cachedFees = null;
  feeCacheExpiry = 0;
  cachedTiersDoc = null;
  tiersCacheExpiry = 0;
  cachedLegacyPriceIds = null;
  legacyPriceIdCacheExpiry = 0;
}
