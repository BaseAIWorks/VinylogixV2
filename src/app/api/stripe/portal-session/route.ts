// src/app/api/stripe/portal-session/route.ts
import { stripe } from '@/lib/stripe';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { stripeCustomerId } = await req.json();

    if (!stripeCustomerId || typeof stripeCustomerId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid stripeCustomerId.' },
        { status: 400 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vinylogix.com';

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${siteUrl}/subscription`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error: any) {
    console.error('Stripe Portal Session Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create billing portal session.' },
      { status: 500 }
    );
  }
}
