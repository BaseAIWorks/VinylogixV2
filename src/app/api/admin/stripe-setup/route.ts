import { NextRequest, NextResponse } from 'next/server';
import { requireRole, authErrorResponse } from '@/lib/auth-helpers';
import { getAdminDb } from '@/lib/firebase-admin';
import { stripe } from '@/lib/stripe';

/**
 * POST /api/admin/stripe-setup
 * Superadmin-only: creates Stripe products and prices, stores IDs in Firestore.
 * Safe to run multiple times — checks for existing products by metadata.
 */
export async function POST(req: NextRequest) {
  try {
    await requireRole(req, ['superadmin']);
  } catch (error) {
    return authErrorResponse(error);
  }

  const adminDb = getAdminDb();
  if (!adminDb) {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 });
  }

  const results: Record<string, any> = {};

  // Define all products and their prices
  const productDefinitions = [
    {
      tier: 'collector',
      name: 'Vinylogix Collector',
      description: 'For serious vinyl collectors who want more.',
      prices: [
        { billing: 'monthly', amount: 499, interval: 'month' as const, intervalCount: 1 },
        { billing: 'yearly', amount: 4900, interval: 'year' as const, intervalCount: 1 },
      ],
    },
    {
      tier: 'essential',
      name: 'Vinylogix Essential',
      description: 'For personal collectors and enthusiasts getting started.',
      prices: [
        { billing: 'monthly', amount: 900, interval: 'month' as const, intervalCount: 1 },
        { billing: 'quarterly', amount: 2500, interval: 'month' as const, intervalCount: 3 },
        { billing: 'yearly', amount: 9000, interval: 'year' as const, intervalCount: 1 },
      ],
    },
    {
      tier: 'growth',
      name: 'Vinylogix Growth',
      description: 'Ideal for small shops and growing businesses.',
      prices: [
        { billing: 'monthly', amount: 2900, interval: 'month' as const, intervalCount: 1 },
        { billing: 'quarterly', amount: 7900, interval: 'month' as const, intervalCount: 3 },
        { billing: 'yearly', amount: 29000, interval: 'year' as const, intervalCount: 1 },
      ],
    },
    {
      tier: 'scale',
      name: 'Vinylogix Scale',
      description: 'For established distributors and power users.',
      prices: [
        { billing: 'monthly', amount: 7900, interval: 'month' as const, intervalCount: 1 },
        { billing: 'quarterly', amount: 22000, interval: 'month' as const, intervalCount: 3 },
        { billing: 'yearly', amount: 79000, interval: 'year' as const, intervalCount: 1 },
      ],
    },
  ];

  const stripePrices: Record<string, Record<string, string>> = {};

  for (const def of productDefinitions) {
    // Check if product already exists by searching metadata
    const existingProducts = await stripe.products.search({
      query: `metadata['tier']:'${def.tier}'`,
    });

    let productId: string;
    if (existingProducts.data.length > 0) {
      productId = existingProducts.data[0].id;
      results[def.tier] = { product: productId, status: 'existing' };
    } else {
      const product = await stripe.products.create({
        name: def.name,
        description: def.description,
        metadata: { tier: def.tier },
      });
      productId = product.id;
      results[def.tier] = { product: productId, status: 'created' };
    }

    // Create prices for this product
    stripePrices[def.tier] = {};
    for (const priceDef of def.prices) {
      // Check if price already exists
      const existingPrices = await stripe.prices.list({
        product: productId,
        active: true,
        limit: 20,
      });

      const matchingPrice = existingPrices.data.find(
        (p) =>
          p.unit_amount === priceDef.amount &&
          p.recurring?.interval === priceDef.interval &&
          p.recurring?.interval_count === priceDef.intervalCount
      );

      if (matchingPrice) {
        stripePrices[def.tier][priceDef.billing] = matchingPrice.id;
      } else {
        const price = await stripe.prices.create({
          product: productId,
          unit_amount: priceDef.amount,
          currency: 'eur',
          recurring: {
            interval: priceDef.interval,
            interval_count: priceDef.intervalCount,
          },
          metadata: { tier: def.tier, billing: priceDef.billing },
        });
        stripePrices[def.tier][priceDef.billing] = price.id;
      }
    }
  }

  // Store price IDs in Firestore
  await adminDb.collection('settings').doc('stripePrices').set(stripePrices, { merge: true });

  // Store platform fee config
  const platformFees = {
    payg: 0.06,
    essential: 0.04,
    growth: 0.03,
    scale: 0.02,
  };
  await adminDb.collection('settings').doc('platformFees').set(platformFees, { merge: true });

  return NextResponse.json({
    success: true,
    products: results,
    priceIds: stripePrices,
    platformFees,
  });
}
