
import { stripe } from '@/lib/stripe';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { findDistributorByStripeCustomerId, updateDistributor } from '@/services/server-distributor-service'; 
import { getAdminAuth } from '@/lib/firebase-admin';

// This is your Stripe CLI webhook secret for testing your endpoint locally.
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

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
    // --- STRIPE BILLING (DISTRIBUTOR SUBSCRIPTIONS) ---
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      // This is for the initial subscription checkout.
      if (session.mode === 'subscription' && session.subscription && session.customer) {
        
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer.id;
        
        console.log(`Checkout session completed for subscription ${subscriptionId}`);

        try {
            // Find distributor by the customer ID created during checkout
            const distributor = await findDistributorByStripeCustomerId(customerId);

            if (distributor) {
                // Update distributor with subscription details
                await updateDistributor(distributor.id, {
                    subscriptionId: subscriptionId,
                    // The status will be 'trialing' or 'active', which is handled by the subscription.created/updated events.
                });
                console.log(`Updated distributor ${distributor.id} with new subscription ${subscriptionId}`);
            } else {
                 console.warn(`Could not find distributor for Stripe customer ID: ${customerId}`);
            }

        } catch (error) {
             console.error('Error handling checkout.session.completed:', error);
             // Optionally, return a 500 status to have Stripe retry the webhook
             return NextResponse.json({ error: 'Internal server error in webhook handler' }, { status: 500 });
        }
      }
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
        const distributor = await findDistributorByStripeCustomerId(customerId);

        if (distributor) {
            await updateDistributor(distributor.id, {
                subscriptionStatus: subscription.status,
                // You might also want to update the tier if plan changes are allowed
                // 'subscription.items.data[0].price.id' can be used to find the new tier.
            });
             console.log(`Updated subscription status for distributor ${distributor.id} to ${subscription.status} from event ${event.type}`);
        } else {
             console.warn(`Could not find distributor for Stripe customer ID: ${customerId} from event ${event.type}`);
        }
        break;
    }
    
    case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
        const distributor = await findDistributorByStripeCustomerId(customerId);

        if (distributor) {
            await updateDistributor(distributor.id, {
                subscriptionStatus: 'cancelled',
                subscriptionId: undefined,
            });
             console.log(`Cancelled subscription for distributor ${distributor.id}`);
        }
        break;
    }

    // --- STRIPE CONNECT (MARKETPLACE) ---
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
        console.log(`Updated Stripe Connect account status for distributor ${distributorId} to ${status}`);
      } else {
         console.warn(`Received 'account.updated' event for Stripe account ${account.id} but no distributorId was found in metadata.`);
      }
      break;
    }

    // ... handle other event types
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  return NextResponse.json({ received: true });
}
