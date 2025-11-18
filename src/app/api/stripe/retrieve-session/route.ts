import { stripe } from '@/lib/stripe';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import type { SubscriptionTier, SubscriptionStatus } from '@/types';

// Helper: resolve tier from subscription (same idea as in webhook)
function resolveTierFromSubscription(sub: Stripe.Subscription | null): SubscriptionTier | undefined {
  if (!sub) return undefined;

  // 1) Prefer subscription metadata
  const metaTier = sub.metadata?.tier as SubscriptionTier | undefined;
  if (metaTier) return metaTier;

  // 2) Fallback: first subscription item price metadata
  const firstItem = sub.items?.data?.[0];

  const priceMetaTier = firstItem?.price?.metadata?.tier as SubscriptionTier | undefined;
  if (priceMetaTier) return priceMetaTier;

  // 3) Legacy / plan metadata, just in case
  const planMetaTier = (firstItem as any)?.plan?.metadata?.tier as SubscriptionTier | undefined;
  if (planMetaTier) return planMetaTier;

  return undefined;
}

export async function GET(req: NextRequest) {
  // NOTE: caller should use ?session_id=... when calling this endpoint
  const sessionId = req.nextUrl.searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID is required.' }, { status: 400 });
  }

  try {
    // Expand subscription so we can read metadata + status
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    const subscription = session.subscription as Stripe.Subscription | null;

    // Resolve tier from session metadata OR subscription
    const tier: SubscriptionTier | undefined =
      (session.metadata?.tier as SubscriptionTier | undefined) ||
      resolveTierFromSubscription(subscription);

    const subscriptionId = subscription?.id ?? null;
    const subscriptionStatus: SubscriptionStatus | null = subscription
      ? (subscription.status as SubscriptionStatus)
      : null;

    // Optional: billing from metadata if you set it when creating the session
    const billing = (session.metadata?.billing as string | undefined) ?? null;

    // Return relevant, non-sensitive session data to the client
    return NextResponse.json(
      {
        id: session.id,
        customer: session.customer,
        customer_details: session.customer_details,
        // Raw metadata (may contain onboarding references if you store them)
        metadata: session.metadata,
        // Explicit Stripe subscription info
        subscriptionId,
        subscriptionStatus,
        tier: tier ?? null,
        billing,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error(`Stripe Retrieve Session Error (session_id: ${sessionId}):`, error);
    return NextResponse.json(
      { error: `Failed to retrieve Stripe session: ${error.message}` },
      { status: 500 }
    );
  }
}
