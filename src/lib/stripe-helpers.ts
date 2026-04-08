import { getAdminDb } from '@/lib/firebase-admin';

// Default platform fees by tier (fallback if Firestore settings not found)
const DEFAULT_FEES: Record<string, number> = {
  payg: 0.06,
  essential: 0.04,
  growth: 0.03,
  scale: 0.02,
};

// In-memory cache for platform fees (avoid Firestore read on every checkout)
let cachedFees: Record<string, number> | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get platform fees config from Firestore (with cache and fallback)
 */
async function getPlatformFees(): Promise<Record<string, number>> {
  if (cachedFees && Date.now() < cacheExpiry) {
    return cachedFees;
  }

  const adminDb = getAdminDb();
  if (!adminDb) return DEFAULT_FEES;

  try {
    const doc = await adminDb.collection('settings').doc('platformFees').get();
    if (doc.exists) {
      cachedFees = { ...DEFAULT_FEES, ...doc.data() } as Record<string, number>;
    } else {
      cachedFees = DEFAULT_FEES;
    }
    cacheExpiry = Date.now() + CACHE_TTL;
    return cachedFees;
  } catch (error) {
    console.error('Failed to fetch platform fees, using defaults:', error);
    return DEFAULT_FEES;
  }
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

    const tier = distDoc.data()?.subscriptionTier as string | undefined;
    const fees = await getPlatformFees();

    return fees[tier || 'essential'] ?? DEFAULT_FEES.essential;
  } catch (error) {
    console.error('Failed to get platform fee rate, using default:', error);
    return DEFAULT_FEES.essential;
  }
}

/**
 * Get Stripe price IDs from Firestore (with env var fallback for backward compatibility)
 */
let cachedPriceIds: Record<string, Record<string, string>> | null = null;
let priceIdCacheExpiry = 0;

export async function getStripePriceId(
  tier: string,
  billing: 'monthly' | 'quarterly' | 'yearly'
): Promise<string | null> {
  // Try Firestore first
  if (!cachedPriceIds || Date.now() > priceIdCacheExpiry) {
    const adminDb = getAdminDb();
    if (adminDb) {
      try {
        const doc = await adminDb.collection('settings').doc('stripePrices').get();
        if (doc.exists) {
          cachedPriceIds = doc.data() as Record<string, Record<string, string>>;
          priceIdCacheExpiry = Date.now() + CACHE_TTL;
        }
      } catch {
        // Fall through to env var fallback
      }
    }
  }

  // Check Firestore cache
  if (cachedPriceIds?.[tier]?.[billing]) {
    return cachedPriceIds[tier][billing];
  }

  // Fallback to env vars (backward compatible with existing setup)
  const billingKey = billing === 'quarterly' ? '3MONTHS' : billing.toUpperCase();
  const envVar = `STRIPE_${tier.toUpperCase()}_${billingKey}_PRICE_ID`;
  return process.env[envVar] || null;
}
