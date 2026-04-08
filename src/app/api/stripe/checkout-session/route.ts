import { stripe } from '@/lib/stripe';
import { getSubscriptionTiersOnServer } from '@/services/subscription-service';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { tier, billing, email, onboardingData } = await req.json();

    // 1) Basic validation
    if (
      !tier ||
      !billing ||
      !['monthly', 'quarterly', 'yearly'].includes(billing)
    ) {
      return NextResponse.json(
        { error: 'Missing or invalid parameters.' },
        { status: 400 }
      );
    }

    // 2) Check tier against server-side config
    const tiers = await getSubscriptionTiersOnServer();
    const selectedTier = (tiers as any)[tier];

    if (!selectedTier) {
      return NextResponse.json(
        { error: `Invalid subscription tier '${tier}'.` },
        { status: 400 }
      );
    }

    // 3) Map tier + billing -> Stripe Price ID (Firestore with env var fallback)
    const { getStripePriceId } = await import('@/lib/stripe-helpers');
    const priceId = await getStripePriceId(tier, billing as 'monthly' | 'quarterly' | 'yearly');

    if (!priceId) {
      return NextResponse.json(
        {
          error: `Price ID for tier '${tier}' (${billing}) is not configured.`,
        },
        { status: 500 }
      );
    }

    // 4) URLs
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || 'https://vinylogix.com';

    const successUrl = `${siteUrl}/register?stripe_session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${siteUrl}/pricing`;

    // 5) Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: email,
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          tier: tier,       // tier óók in subscription_data
          billing: billing,
        },
      },
      // 🔥 HIER kijkt finalizeRegistration naar:
      metadata: {
        tier: tier,         // <<<<<<<<<<<<<< DIT ontbrak in jouw log
        billing: billing,
        userEmail: onboardingData.email,
        firstName: onboardingData.firstName,
        lastName: onboardingData.lastName,
        companyName: onboardingData.companyName,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe Checkout Session Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
