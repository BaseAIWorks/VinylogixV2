
import { stripe } from '@/lib/stripe';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { findDistributorByStripeCustomerIdServer, updateDistributorServer } from '@/services/server-distributor-service'; 
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
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === 'subscription' && session.subscription && session.customer) {
        
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer.id;
        
        console.log(`Checkout session completed for subscription ${subscriptionId}`);

        try {
            const distributor = await findDistributorByStripeCustomerIdServer(customerId);

            if (distributor) {
                await updateDistributorServer(distributor.id, {
                    subscriptionId: subscriptionId,
                });
                console.log(`Updated distributor ${distributor.id} with new subscription ${subscriptionId}`);
            } else {
                 console.warn(`Could not find distributor for Stripe customer ID: ${customerId}. This may be expected if the user is being created.`);
            }

        } catch (error) {
             console.error('Error handling checkout.session.completed:', error);
             return NextResponse.json({ error: 'Internal server error in webhook handler' }, { status: 500 });
        }
      }
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
        const distributor = await findDistributorByStripeCustomerIdServer(customerId);

        if (distributor) {
            await updateDistributorServer(distributor.id, {
                subscriptionStatus: subscription.status,
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
        const distributor = await findDistributorByStripeCustomerIdServer(customerId);

        if (distributor) {
            await updateDistributorServer(distributor.id, {
                subscriptionStatus: 'cancelled',
                subscriptionId: undefined,
            });
             console.log(`Cancelled subscription for distributor ${distributor.id}`);
        }
        break;
    }

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
        
        await updateDistributorServer(distributorId, {
            stripeAccountStatus: status,
        });
        console.log(`Updated Stripe Connect account status for distributor ${distributorId} to ${status}`);
      } else {
         console.warn(`Received 'account.updated' event for Stripe account ${account.id} but no distributorId was found in metadata.`);
      }
      break;
    }

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
