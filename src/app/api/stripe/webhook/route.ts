import { stripe } from '@/lib/stripe';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { updateDistributor, findDistributorByStripeCustomerId } from '@/services/server-distributor-service';
import type { SubscriptionTier, SubscriptionStatus } from '@/types';

// This is your Stripe CLI webhook secret for testing your endpoint locally.
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Helper to resolve the subscription tier from a Subscription object
function resolveTierFromSubscription(sub: Stripe.Subscription): SubscriptionTier | undefined {
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

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();

  let event: Stripe.Event;

  try {
    if (!sig) {
      throw new Error("Missing 'stripe-signature' header");
    }
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    console.error(`❌ Webhook signature verification failed:`, err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Successfully constructed event.
  console.log('✅ Stripe Webhook Received:', event.type);

  // Handle the event
  switch (event.type) {
    // ======================================================
    // CHECKOUT SESSION COMPLETED (initial subscription start)
    // ======================================================
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.mode === 'subscription' && session.subscription && session.customer) {
        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;

        const customerId =
          typeof session.customer === 'string'
            ? session.customer
            : session.customer.id;

        console.log(`Checkout session completed for subscription ${subscriptionId}`);

        try {
          // 1) Try to get tier directly from session metadata
          let tier = session.metadata?.tier as SubscriptionTier | undefined;
          const billingCycle = session.metadata?.billing as 'monthly' | 'quarterly' | 'yearly' | undefined;

          // 2) Fetch the subscription from Stripe for status + fallback metadata
          let subscription: Stripe.Subscription | null = null;
          try {
            subscription = await stripe.subscriptions.retrieve(subscriptionId);
          } catch (subErr) {
            console.error(
              `Error retrieving subscription ${subscriptionId} in checkout.session.completed:`,
              subErr
            );
          }

          if (!tier && subscription) {
            tier = resolveTierFromSubscription(subscription);
          }

          if (!tier) {
            console.warn(
              `No subscription tier found for session ${session.id} / subscription ${subscriptionId}. ` +
                `Session metadata: ${JSON.stringify(session.metadata)}`
            );
          }
          
          const periodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : undefined;


          const subscriptionStatus: SubscriptionStatus =
            (subscription?.status as SubscriptionStatus) ?? 'active';

          const distributor = await findDistributorByStripeCustomerId(customerId);

          if (distributor) {
            await updateDistributor(distributor.id, {
              subscriptionId,
              subscriptionStatus,
              subscriptionTier: tier ?? distributor.subscriptionTier ?? undefined,
              billingCycle: billingCycle ?? distributor.billingCycle ?? undefined,
              subscriptionCurrentPeriodEnd: periodEnd,
            });
            console.log(
              `Updated distributor ${distributor.id} with subscription ${subscriptionId}, ` +
                `status=${subscriptionStatus}, tier=${tier}`
            );
          } else {
            console.warn(
              `Could not find distributor for Stripe customer ID: ${customerId} during checkout.session.completed.`
            );
          }
        } catch (error) {
          console.error('Error handling checkout.session.completed:', error);
          return NextResponse.json(
            { error: 'Internal server error in webhook handler' },
            { status: 500 }
          );
        }
      }
      break;
    }

    // ======================================================
    // SUBSCRIPTION CREATED / UPDATED
    // Keep Firestore in sync with Stripe
    // ======================================================
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;

      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id;

      const tier = resolveTierFromSubscription(subscription);
      const status = subscription.status as SubscriptionStatus;
      const billingCycle = subscription.metadata?.billing as 'monthly' | 'quarterly' | 'yearly' | undefined;
      const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();


      const distributor = await findDistributorByStripeCustomerId(customerId);

      if (distributor) {
        await updateDistributor(distributor.id, {
          subscriptionStatus: status,
          subscriptionTier: tier ?? distributor.subscriptionTier ?? undefined,
          billingCycle: billingCycle ?? distributor.billingCycle ?? undefined,
          subscriptionCurrentPeriodEnd: periodEnd,
        });
        console.log(
          `Updated subscription for distributor ${distributor.id}: ` +
            `status=${status}, tier=${tier} from event ${event.type}`
        );
      } else {
        console.warn(
          `Could not find distributor for Stripe customer ID: ${customerId} from event ${event.type}`
        );
      }
      break;
    }

    // ======================================================
    // SUBSCRIPTION DELETED / CANCELLED
    // ======================================================
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id;

      const distributor = await findDistributorByStripeCustomerId(customerId);

      if (distributor) {
        await updateDistributor(distributor.id, {
          subscriptionStatus: 'canceled',
          subscriptionId: undefined,
          subscriptionCurrentPeriodEnd: undefined,
        });
        console.log(`Cancelled subscription for distributor ${distributor.id}`);
      } else {
        console.warn(
          `Received customer.subscription.deleted for customer ${customerId} but no distributor found.`
        );
      }
      break;
    }

    // ======================================================
    // STRIPE CONNECT ACCOUNT UPDATED
    // ======================================================
    case 'account.updated': {
      const account = event.data.object as Stripe.Account;
      const distributorId = account.metadata?.distributorId;

      if (distributorId) {
        let status: 'pending' | 'verified' | 'restricted' | 'details_needed' = 'pending';

        if (account.details_submitted) {
          if (account.charges_enabled && account.payouts_enabled) {
            status = 'verified';
          } else {
            status = 'details_needed';
          }
        }

        await updateDistributor(distributorId, {
          stripeAccountStatus: status,
        });
        console.log(
          `Updated Stripe Connect account status for distributor ${distributorId} to ${status}`
        );
      } else {
        console.warn(
          `Received 'account.updated' event for Stripe account ${account.id} but no distributorId was found in metadata.`
        );
      }
      break;
    }

    // ======================================================
    // DEFAULT
    // ======================================================
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
