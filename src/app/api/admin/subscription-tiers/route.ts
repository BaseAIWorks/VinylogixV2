import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import Stripe from 'stripe';
import { requireRole, authErrorResponse } from '@/lib/auth-helpers';
import { getAdminDb } from '@/lib/firebase-admin';
import { stripe } from '@/lib/stripe';
import { invalidateTierCaches } from '@/lib/stripe-helpers';
import type { SubscriptionTier } from '@/types';

/**
 * POST /api/admin/subscription-tiers
 *
 * Superadmin-only endpoint that replaces direct client Firestore writes for
 * subscription tier configuration. Does the full save in a single request:
 *
 *  1. Validates the payload with strict Zod bounds (hard caps on prices, fees).
 *  2. On FIRST save (tiers without stripeProductId), runs a READ-ONLY bootstrap
 *     that discovers existing Stripe Products/Prices via metadata search and
 *     seeds Firestore. No Stripe writes happen on bootstrap.
 *  3. On subsequent saves, syncs any actual changes to Stripe: updates Product
 *     description/active flag, creates new Prices when amounts change (Stripe
 *     Prices are immutable), archives replaced Prices. Existing subscribers on
 *     archived prices keep being billed normally per Stripe semantics.
 *  4. Writes the (possibly enriched) tiers doc to Firestore.
 *  5. Dual-writes to settings/platformFees (legacy shape, kept in sync as a
 *     safety net for the triple-fallback read path in stripe-helpers).
 *  6. Invalidates in-memory caches so the next checkout sees fresh data.
 *
 * Safety features:
 *  - DISABLE_TIER_STRIPE_SYNC=true kill switch (Firestore still writes).
 *  - Missing/dummy Stripe key auto-skips Stripe calls (local dev safety).
 *  - Bootstrap is read-only; subsequent writes are minimal (only on change).
 *  - Never archives a Price unless the admin actually changed the euro amount.
 *  - Every Stripe action is logged to stdout with tier + mode (test/live).
 */

// ------------------------- Input validation --------------------------------

const KNOWN_TIERS: SubscriptionTier[] = ['payg', 'essential', 'growth', 'scale', 'collector'];
const MAX_PRICE_EUR = 10_000;
const MAX_RECORDS = 10_000_000;
const MAX_USERS = 10_000;
const MAX_FEE_PERCENT = 50;

const tierSchema = z.object({
  tier: z.enum(['payg', 'essential', 'growth', 'scale', 'collector']),
  status: z.enum(['trialing', 'active', 'past_due', 'canceled', 'incomplete']),
  maxRecords: z.number().int().refine((n) => n === -1 || (n >= 0 && n <= MAX_RECORDS), {
    message: `maxRecords must be -1 or 0..${MAX_RECORDS}`,
  }),
  maxUsers: z.number().int().refine((n) => n === -1 || (n >= 0 && n <= MAX_USERS), {
    message: `maxUsers must be -1 or 0..${MAX_USERS}`,
  }),
  allowOrders: z.boolean(),
  allowAiFeatures: z.boolean(),
  price: z.number().min(0).max(MAX_PRICE_EUR).optional(),
  quarterlyPrice: z.number().min(0).max(MAX_PRICE_EUR * 3).optional(),
  yearlyPrice: z.number().min(0).max(MAX_PRICE_EUR * 12).optional(),
  discountedPrice: z.number().min(0).max(MAX_PRICE_EUR).optional(),
  description: z.string().max(500).optional(),
  features: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
  transactionFeePercent: z.number().min(0).max(MAX_FEE_PERCENT).optional(),
  stripeProductId: z.string().optional(),
  stripePriceIdMonthly: z.string().optional(),
  stripePriceIdQuarterly: z.string().optional(),
  stripePriceIdYearly: z.string().optional(),
});

const payloadSchema = z.object({
  tiers: z.record(z.enum(['payg', 'essential', 'growth', 'scale', 'collector']), tierSchema),
});

type ValidatedTier = z.infer<typeof tierSchema>;

// ------------------------- Stripe sync helpers -----------------------------

type SyncMode = 'live' | 'test' | 'skipped-no-key' | 'skipped-kill-switch';
type SyncAction =
  | { tier: string; action: 'bootstrap-product-found'; productId: string }
  | { tier: string; action: 'bootstrap-product-missing' }
  | { tier: string; action: 'bootstrap-price-seeded'; billing: string; priceId: string }
  | { tier: string; action: 'bootstrap-price-missing'; billing: string }
  | { tier: string; action: 'product-updated'; fields: string[] }
  | { tier: string; action: 'price-created'; billing: string; priceId: string; amount: number }
  | { tier: string; action: 'price-archived'; billing: string; priceId: string }
  | { tier: string; action: 'noop' }
  | { tier: string; action: 'skipped-free-tier' };

function detectSyncMode(): SyncMode {
  if (process.env.DISABLE_TIER_STRIPE_SYNC === 'true') return 'skipped-kill-switch';
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key === 'sk_test_dummy_key_for_build_only' || key.length < 10) {
    return 'skipped-no-key';
  }
  if (key.startsWith('sk_live_')) return 'live';
  if (key.startsWith('sk_test_')) return 'test';
  // Unknown prefix (restricted key?) — treat as live to be safe
  return 'live';
}

/** Billing cycle → Stripe recurring config */
const BILLING_CONFIGS = {
  monthly: { field: 'stripePriceIdMonthly', priceKey: 'price', interval: 'month' as const, intervalCount: 1 },
  quarterly: { field: 'stripePriceIdQuarterly', priceKey: 'quarterlyPrice', interval: 'month' as const, intervalCount: 3 },
  yearly: { field: 'stripePriceIdYearly', priceKey: 'yearlyPrice', interval: 'year' as const, intervalCount: 1 },
} as const;

type BillingCycle = keyof typeof BILLING_CONFIGS;

/** Skip Stripe sync entirely for a tier if every billing-cycle price is 0/undefined. */
function isFreeTier(t: ValidatedTier): boolean {
  const m = t.price ?? 0;
  const q = t.quarterlyPrice ?? 0;
  const y = t.yearlyPrice ?? 0;
  return m === 0 && q === 0 && y === 0;
}

/**
 * Validate a Stripe Price ID by retrieving it. Returns the Price object if
 * valid, null otherwise. Used to avoid seeding Firestore with bogus IDs when
 * env var / legacy Firestore data doesn't match the current Stripe account.
 */
async function safeRetrievePrice(priceId: string): Promise<Stripe.Price | null> {
  try {
    return await stripe.prices.retrieve(priceId);
  } catch (error: any) {
    console.warn(`[tier-sync] Price ${priceId} could not be retrieved: ${error?.message}`);
    return null;
  }
}

/**
 * Read-only bootstrap for a tier that has no stripeProductId yet. Uses metadata
 * search to find the existing Product, then discovers active Prices by listing
 * and matching amount + interval. Records everything into the tier object.
 * Never writes to Stripe.
 */
async function bootstrapTier(
  tierKey: string,
  tier: ValidatedTier,
  legacyPriceIdsDoc: Record<string, Record<string, string>> | null,
  actions: SyncAction[],
): Promise<ValidatedTier> {
  const enriched: ValidatedTier = { ...tier };

  // 1. Find Product by metadata.tier
  let productId: string | null = null;
  try {
    const search = await stripe.products.search({
      query: `metadata['tier']:'${tierKey}'`,
    });
    if (search.data.length > 0) {
      productId = search.data[0].id;
      enriched.stripeProductId = productId;
      actions.push({ tier: tierKey, action: 'bootstrap-product-found', productId });
    } else {
      actions.push({ tier: tierKey, action: 'bootstrap-product-missing' });
      return enriched; // no product → can't discover prices
    }
  } catch (error: any) {
    console.error(`[tier-sync] Product search failed for ${tierKey}:`, error?.message);
    actions.push({ tier: tierKey, action: 'bootstrap-product-missing' });
    return enriched;
  }

  // 2. List active prices for this product
  let productPrices: Stripe.Price[] = [];
  try {
    const list = await stripe.prices.list({ product: productId!, active: true, limit: 50 });
    productPrices = list.data;
  } catch (error: any) {
    console.error(`[tier-sync] Price list failed for ${tierKey}:`, error?.message);
  }

  // 3. For each billing cycle, try to match by amount + interval
  for (const billing of Object.keys(BILLING_CONFIGS) as BillingCycle[]) {
    const cfg = BILLING_CONFIGS[billing];
    const incomingAmount = (tier as any)[cfg.priceKey] as number | undefined;
    if (!incomingAmount || incomingAmount <= 0) {
      continue; // no price configured for this billing cycle, nothing to bootstrap
    }

    const expectedCents = Math.round(incomingAmount * 100);

    // Try Firestore legacy stripePrices doc first (if present)
    const legacyId = legacyPriceIdsDoc?.[tierKey]?.[billing];
    if (legacyId) {
      const validated = await safeRetrievePrice(legacyId);
      if (validated && validated.active && validated.unit_amount === expectedCents) {
        (enriched as any)[cfg.field] = legacyId;
        actions.push({ tier: tierKey, action: 'bootstrap-price-seeded', billing, priceId: legacyId });
        continue;
      }
    }

    // Try env var
    const envVar = `STRIPE_${tierKey.toUpperCase()}_${billing === 'quarterly' ? '3MONTHS' : billing.toUpperCase()}_PRICE_ID`;
    const envId = process.env[envVar];
    if (envId) {
      const validated = await safeRetrievePrice(envId);
      if (validated && validated.active && validated.unit_amount === expectedCents) {
        (enriched as any)[cfg.field] = envId;
        actions.push({ tier: tierKey, action: 'bootstrap-price-seeded', billing, priceId: envId });
        continue;
      }
    }

    // Fall back to matching by amount + interval from the listed prices
    const match = productPrices.find(
      (p) =>
        p.unit_amount === expectedCents &&
        p.recurring?.interval === cfg.interval &&
        p.recurring?.interval_count === cfg.intervalCount,
    );
    if (match) {
      (enriched as any)[cfg.field] = match.id;
      actions.push({ tier: tierKey, action: 'bootstrap-price-seeded', billing, priceId: match.id });
    } else {
      actions.push({ tier: tierKey, action: 'bootstrap-price-missing', billing });
    }
  }

  return enriched;
}

/**
 * Incremental sync for a tier that already has a stripeProductId. Compares the
 * incoming tier against the current Stripe state and applies minimal changes:
 *  - Update Product description/active if changed
 *  - Create new Price + archive old when amount changed (Stripe Prices are immutable)
 *  - Reuse an existing active Price if one already matches the new amount
 *    (handles retry-after-partial-failure without creating orphans)
 */
async function updateTier(
  tierKey: string,
  incoming: ValidatedTier,
  actions: SyncAction[],
): Promise<ValidatedTier> {
  const enriched: ValidatedTier = { ...incoming };
  const productId = incoming.stripeProductId!;

  // 1. Retrieve Product and update description/active if changed
  try {
    const product = await stripe.products.retrieve(productId);
    const updates: Stripe.ProductUpdateParams = {};
    const changedFields: string[] = [];

    // Description: allow clearing (empty/undefined → null on Stripe side).
    const incomingDesc = (incoming.description ?? '').trim();
    const currentDesc = (product.description ?? '').trim();
    if (incomingDesc !== currentDesc) {
      updates.description = incomingDesc.length > 0 ? incomingDesc : null;
      changedFields.push('description');
    }
    const desiredActive = incoming.isActive !== false;
    if (product.active !== desiredActive) {
      updates.active = desiredActive;
      changedFields.push('active');
    }

    if (changedFields.length > 0) {
      await stripe.products.update(productId, updates);
      actions.push({ tier: tierKey, action: 'product-updated', fields: changedFields });
    }
  } catch (error: any) {
    console.error(`[tier-sync] Product update failed for ${tierKey}:`, error?.message);
    throw new Error(`Product update failed for ${tierKey}: ${error?.message}`);
  }

  // 2. List active Prices once for this Product — used for reuse-on-match to
  // avoid creating orphans when a previous save partially succeeded.
  let activePrices: Stripe.Price[] = [];
  try {
    const list = await stripe.prices.list({ product: productId, active: true, limit: 100 });
    activePrices = list.data;
  } catch (error: any) {
    console.warn(`[tier-sync] prices.list failed for ${tierKey} (will proceed):`, error?.message);
  }

  // 3. Reconcile each billing cycle
  let actionRecorded = false;
  for (const billing of Object.keys(BILLING_CONFIGS) as BillingCycle[]) {
    const cfg = BILLING_CONFIGS[billing];
    const incomingAmount = (incoming as any)[cfg.priceKey] as number | undefined;
    const currentPriceId = (incoming as any)[cfg.field] as string | undefined;

    if (!incomingAmount || incomingAmount <= 0) {
      continue;
    }

    const expectedCents = Math.round(incomingAmount * 100);

    // Fast path: stored ID still matches expected amount → noop.
    if (currentPriceId) {
      const currentPrice = await safeRetrievePrice(currentPriceId);
      if (currentPrice && currentPrice.active && currentPrice.unit_amount === expectedCents &&
          currentPrice.recurring?.interval === cfg.interval &&
          currentPrice.recurring?.interval_count === cfg.intervalCount) {
        continue; // already in sync
      }
    }

    // Reuse path: is there ANY active Price on this Product matching the new
    // amount + interval? If so, adopt it instead of creating a fresh one.
    // This is what makes retries idempotent and prevents orphan accumulation.
    const reuseCandidate = activePrices.find(
      (p) =>
        p.unit_amount === expectedCents &&
        p.recurring?.interval === cfg.interval &&
        p.recurring?.interval_count === cfg.intervalCount,
    );

    if (reuseCandidate) {
      (enriched as any)[cfg.field] = reuseCandidate.id;
      actions.push({
        tier: tierKey,
        action: 'price-created',
        billing,
        priceId: reuseCandidate.id,
        amount: expectedCents,
      });
      actionRecorded = true;
      // Archive the previously-stored Price if it's different from the adopted one
      if (currentPriceId && currentPriceId !== reuseCandidate.id) {
        try {
          await stripe.prices.update(currentPriceId, { active: false });
          actions.push({ tier: tierKey, action: 'price-archived', billing, priceId: currentPriceId });
        } catch (error: any) {
          console.error(`[tier-sync] Failed to archive old price ${currentPriceId}:`, error?.message);
        }
      }
      continue;
    }

    // Create path: no existing Price matches — make a fresh one.
    try {
      const newPrice = await stripe.prices.create({
        product: productId,
        unit_amount: expectedCents,
        currency: 'eur',
        recurring: {
          interval: cfg.interval,
          interval_count: cfg.intervalCount,
        },
        metadata: { tier: tierKey, billing },
      });
      (enriched as any)[cfg.field] = newPrice.id;
      actions.push({
        tier: tierKey,
        action: 'price-created',
        billing,
        priceId: newPrice.id,
        amount: expectedCents,
      });
      actionRecorded = true;

      if (currentPriceId && currentPriceId !== newPrice.id) {
        try {
          await stripe.prices.update(currentPriceId, { active: false });
          actions.push({ tier: tierKey, action: 'price-archived', billing, priceId: currentPriceId });
        } catch (error: any) {
          console.error(`[tier-sync] Failed to archive old price ${currentPriceId}:`, error?.message);
          // Non-fatal
        }
      }
    } catch (error: any) {
      console.error(`[tier-sync] Price creation failed for ${tierKey} ${billing}:`, error?.message);
      throw new Error(`Price creation failed for ${tierKey} (${billing}): ${error?.message}`);
    }
  }

  if (!actionRecorded) {
    const hasProductUpdate = actions.some(
      (a) => a.tier === tierKey && a.action === 'product-updated',
    );
    if (!hasProductUpdate) {
      actions.push({ tier: tierKey, action: 'noop' });
    }
  }

  return enriched;
}

// --------------------------- Route handler --------------------------------

export async function POST(req: NextRequest) {
  let caller;
  try {
    caller = await requireRole(req, ['superadmin']);
  } catch (error) {
    return authErrorResponse(error);
  }

  // Parse and validate payload
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed.', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const incomingTiers = parsed.data.tiers as Partial<Record<SubscriptionTier, ValidatedTier>>;

  // Reject unknown tier keys + cross-validate tier.tier === tierKey to prevent
  // scrambling (e.g., {growth: {tier: 'essential', ...}}).
  const tierKeysToProcess: SubscriptionTier[] = [];
  for (const key of Object.keys(incomingTiers)) {
    if (!KNOWN_TIERS.includes(key as SubscriptionTier)) {
      return NextResponse.json({ error: `Unknown tier key: ${key}` }, { status: 400 });
    }
    const entry = incomingTiers[key as SubscriptionTier];
    if (entry !== undefined) {
      if (entry.tier !== key) {
        return NextResponse.json(
          { error: `Tier key mismatch: payload has '${key}' but tier.tier is '${entry.tier}'` },
          { status: 400 },
        );
      }
      tierKeysToProcess.push(key as SubscriptionTier);
    }
  }

  const adminDb = getAdminDb();
  if (!adminDb) {
    return NextResponse.json({ error: 'Admin DB unavailable.' }, { status: 503 });
  }

  // Read current canonical Stripe IDs from Firestore. This is the authoritative
  // source — we IGNORE any Stripe IDs the client tried to send (defence against
  // a compromised superadmin remapping tiers to each other's Stripe Products).
  let currentTiersDoc: Record<string, any> = {};
  try {
    const currentSnap = await adminDb.collection('settings').doc('subscriptionTiers').get();
    if (currentSnap.exists) {
      currentTiersDoc = currentSnap.data() || {};
    }
  } catch (error) {
    console.warn('[tier-sync] Failed to read current subscriptionTiers doc:', error);
  }

  // Override any incoming Stripe IDs with the server-side values.
  for (const tierKey of tierKeysToProcess) {
    const entry = incomingTiers[tierKey]!;
    const current = (currentTiersDoc as any)[tierKey] || {};
    entry.stripeProductId = current.stripeProductId;
    entry.stripePriceIdMonthly = current.stripePriceIdMonthly;
    entry.stripePriceIdQuarterly = current.stripePriceIdQuarterly;
    entry.stripePriceIdYearly = current.stripePriceIdYearly;
  }

  // Read legacy stripePrices doc for bootstrap seeding
  let legacyPriceIdsDoc: Record<string, Record<string, string>> | null = null;
  try {
    const snap = await adminDb.collection('settings').doc('stripePrices').get();
    if (snap.exists) {
      legacyPriceIdsDoc = snap.data() as Record<string, Record<string, string>>;
    }
  } catch (error) {
    console.warn('[tier-sync] Failed to read legacy stripePrices doc:', error);
  }

  const mode = detectSyncMode();
  const actions: SyncAction[] = [];
  const enrichedTiers: Record<string, ValidatedTier> = {};

  console.log(`[tier-sync] Running in mode: ${mode} (superadmin=${caller.email || caller.uid})`);

  // Process each tier
  for (const tierKey of tierKeysToProcess) {
    const tier = incomingTiers[tierKey]!;

    // Skip Stripe sync for free tiers (PAYG with all prices 0)
    if (isFreeTier(tier)) {
      actions.push({ tier: tierKey, action: 'skipped-free-tier' });
      enrichedTiers[tierKey] = tier;
      continue;
    }

    // Skip Stripe calls entirely if mode is skipped
    if (mode === 'skipped-no-key' || mode === 'skipped-kill-switch') {
      enrichedTiers[tierKey] = tier;
      continue;
    }

    try {
      if (!tier.stripeProductId) {
        enrichedTiers[tierKey] = await bootstrapTier(tierKey, tier, legacyPriceIdsDoc, actions);
      } else {
        enrichedTiers[tierKey] = await updateTier(tierKey, tier, actions);
      }
    } catch (error: any) {
      // Abort the entire save on any Stripe write error.
      // Nothing gets written to Firestore so retry is safe.
      console.error(`[tier-sync] ABORTED for ${tierKey}:`, error?.message);
      return NextResponse.json(
        {
          error: `Stripe sync failed for tier '${tierKey}': ${error?.message}`,
          stripeSync: { mode, actions, aborted: true },
        },
        { status: 500 },
      );
    }
  }

  // Strip undefined fields before Firestore write (setDoc with merge rejects undefined)
  const firestoreTiers: Record<string, Record<string, unknown>> = {};
  for (const [key, tier] of Object.entries(enrichedTiers)) {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(tier)) {
      if (v !== undefined) clean[k] = v;
    }
    firestoreTiers[key] = clean;
  }

  // Write the tiers doc. Use mergeFields so each tier sub-object is FULLY
  // REPLACED by the incoming value (rather than deep-merged). This lets the
  // admin clear fields like discountedPrice — with merge:true those would
  // silently persist from the previous write.
  try {
    const mergeFields = Object.keys(firestoreTiers);
    if (mergeFields.length > 0) {
      await adminDb
        .collection('settings')
        .doc('subscriptionTiers')
        .set(firestoreTiers, { mergeFields });
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: `Firestore write failed: ${error?.message}`, stripeSync: { mode, actions } },
      { status: 500 },
    );
  }

  // Dual-write to legacy settings/platformFees as a safety net (ratio shape)
  try {
    const legacyFees: Record<string, number> = {};
    for (const [key, tier] of Object.entries(enrichedTiers)) {
      if (typeof tier.transactionFeePercent === 'number') {
        legacyFees[key] = tier.transactionFeePercent / 100;
      }
    }
    if (Object.keys(legacyFees).length > 0) {
      await adminDb.collection('settings').doc('platformFees').set(legacyFees, { merge: true });
    }
  } catch (error) {
    // Non-fatal: primary source of truth is the tiers doc now
    console.warn('[tier-sync] Dual-write to platformFees failed (non-fatal):', error);
  }

  // Invalidate in-memory caches so next checkout reads fresh data
  invalidateTierCaches();

  // Audit log (non-blocking, fire-and-forget). logSystemEvent swallows its own
  // errors but we still .catch() defensively in case the dynamic import rejects.
  import('@/services/system-log-service')
    .then(({ logSystemEvent }) =>
      logSystemEvent({
        type: 'admin_action',
        source: 'subscription_tiers_sync',
        status: 'success',
        message: `Subscription tiers saved (stripe sync: ${mode})`,
        userId: caller.uid,
        userEmail: caller.email,
        userRole: caller.role,
        page: '/admin/settings',
        metadata: {
          mode,
          actionCount: actions.length,
          tierKeys: Object.keys(enrichedTiers),
        },
      }),
    )
    .catch((error) => console.warn('[tier-sync] Audit log failed (non-fatal):', error));

  return NextResponse.json({
    success: true,
    tiers: enrichedTiers,
    stripeSync: {
      mode,
      actions,
    },
  });
}
