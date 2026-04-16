// src/app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import {
  findDistributorByStripeCustomerId,
  updateDistributor,
} from "@/services/server-distributor-service";
import { createOrderFromCheckout } from "@/services/server-order-service";
import type { SubscriptionTier, SubscriptionStatus } from "@/types";
import { logSystemEvent } from "@/services/system-log-service";

// Webhook signing secret
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Resolve subscription tier from Stripe Subscription metadata
function resolveTierFromSubscription(
  sub: Stripe.Subscription
): SubscriptionTier | undefined {
  // 1) Subscription metadata
  const metaTier = sub.metadata?.tier as SubscriptionTier | undefined;
  if (metaTier) return metaTier;

  // 2) First item price metadata
  const firstItem = sub.items?.data?.[0];
  const priceMetaTier = firstItem?.price?.metadata
    ?.tier as SubscriptionTier | undefined;
  if (priceMetaTier) return priceMetaTier;

  // 3) Legacy plan metadata fallback
  const planMetaTier = (firstItem as any)?.plan?.metadata
    ?.tier as SubscriptionTier | undefined;
  if (planMetaTier) return planMetaTier;

  return undefined;
}

// Safely compute ISO string for current_period_end
function getCurrentPeriodEndIso(
  subscription: Stripe.Subscription
): string | undefined {
  const ts = subscription.current_period_end;
  if (typeof ts === "number") {
    const d = new Date(ts * 1000);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString();
    }
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;

  try {
    if (!sig) {
      throw new Error("Missing 'stripe-signature' header");
    }
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    console.error("❌ Webhook signature verification failed:", err.message);
    logSystemEvent({ type: 'webhook_error', source: 'stripe_webhook', status: 'error', message: `Signature verification failed: ${err.message}` });
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  console.log("✅ Stripe Webhook Received:", event.type);

  try {
    switch (event.type) {
      // ============================================
      // PAYMENT INTENT SUCCEEDED (Order Payment)
      // ============================================
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        console.log(
          `Payment succeeded for PaymentIntent ${paymentIntent.id}, amount: ${paymentIntent.amount}`
        );

        // The order will be created when checkout.session.completed fires
        // This event is mainly for logging successful payments
        break;
      }

      // ============================================
      // PAYMENT INTENT FAILED (Order Payment)
      // ============================================
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        console.error(
          `Payment failed for PaymentIntent ${paymentIntent.id}`,
          paymentIntent.last_payment_error
        );

        // Log payment failures for monitoring
        // Could also update order status if order already exists
        break;
      }

      // ============================================
      // CHECKOUT SESSION COMPLETED
      // ============================================
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Handle subscription checkout
        if (session.mode === "subscription" && session.subscription && session.customer) {
          const subscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;

          const customerId =
            typeof session.customer === "string"
              ? session.customer
              : session.customer.id;

          console.log(
            `Checkout session completed for subscription ${subscriptionId}`
          );

          try {
            let subscription: Stripe.Subscription | null = null;

            try {
              subscription = await stripe.subscriptions.retrieve(subscriptionId);
            } catch (subErr) {
              console.error(
                `Error retrieving subscription ${subscriptionId} in checkout.session.completed:`,
                subErr
              );
            }

            // Resolve tier
            const tier = subscription
              ? resolveTierFromSubscription(subscription)
              : (session.metadata?.tier as SubscriptionTier | undefined);

            if (!tier) {
              console.warn(
                `No subscription tier found for session ${session.id} / subscription ${subscriptionId}. ` +
                  `Session metadata: ${JSON.stringify(session.metadata)}`
              );
            }

            const subscriptionStatus: SubscriptionStatus =
              (subscription?.status as SubscriptionStatus) ?? "active";

            const subscriptionCurrentPeriodEnd =
              subscription ? getCurrentPeriodEndIso(subscription) : undefined;

            const distributor =
              await findDistributorByStripeCustomerId(customerId);

            if (distributor) {
              const updatePayload: any = {
                subscriptionId,
                subscriptionStatus,
                subscriptionTier: tier ?? distributor.subscriptionTier ?? undefined,
              };
              if (subscriptionCurrentPeriodEnd) {
                updatePayload.subscriptionCurrentPeriodEnd =
                  subscriptionCurrentPeriodEnd;
              }

              await updateDistributor(distributor.id, updatePayload);
              console.log(
                `Updated distributor ${distributor.id} with subscription ${subscriptionId}, ` +
                  `status=${subscriptionStatus}, tier=${tier}, periodEnd=${subscriptionCurrentPeriodEnd}`
              );
            } else {
              console.warn(
                `Could not find distributor for Stripe customer ID: ${customerId} during checkout.session.completed.`
              );
            }
          } catch (error) {
            console.error("Error handling checkout.session.completed:", error);
            return NextResponse.json(
              { error: "Internal server error in webhook handler" },
              { status: 500 }
            );
          }
        }

        // Handle order payment checkout
        if (session.mode === "payment" && session.metadata?.distributorId) {
          console.log(
            `Order payment checkout completed for session ${session.id}`
          );

          try {
            // Check if this is a payment for an existing order (Request Order flow)
            if (session.metadata?.isOrderPayment === 'true' && session.metadata?.orderId) {
              const orderId = session.metadata.orderId;
              const { getAdminDb } = await import('@/lib/firebase-admin');
              const { Timestamp } = await import('firebase-admin/firestore');
              const adminDb = getAdminDb();

              // Pre-check: if the customer paid via a stale link (e.g. distributor
              // adjusted items after approval) OR the order was already marked
              // paid manually, we must NOT blindly run the paid-transition path
              // — that would double-deduct stock, fire a second confirmation
              // email, or overwrite the manual paymentMethod with 'stripe'.
              // Inspect the order first and decide how to handle.
              let shouldMarkPaid = true;
              let mismatchPayload: any = null;
              let alreadyPaidManually = false;

              if (adminDb) {
                try {
                  const orderSnap = await adminDb.collection('orders').doc(orderId).get();
                  if (orderSnap.exists) {
                    const orderData = orderSnap.data() as any;

                    // Case A: the order is already paid and it was a non-Stripe
                    // manual payment. Treat the Stripe capture as a probable
                    // double-payment that needs manual reconciliation.
                    if (
                      orderData.paymentStatus === 'paid' &&
                      orderData.paymentMethod &&
                      orderData.paymentMethod !== 'stripe'
                    ) {
                      alreadyPaidManually = true;
                      shouldMarkPaid = false;
                      await orderSnap.ref.update({
                        paymentAmountMismatch: {
                          sessionAmountCents: session.amount_total ?? 0,
                          expectedAmountCents: Math.round((orderData.totalAmount || 0) * 100),
                          currency: session.currency || 'eur',
                          stripeSessionId: session.id,
                          detectedAt: Timestamp.now(),
                          reason: 'already_paid_manually',
                        },
                        updatedAt: Timestamp.now(),
                      });
                      console.warn(
                        `[webhook] Order ${orderId} was already paid via ${orderData.paymentMethod}; ` +
                        `Stripe capture for session ${session.id} likely a double payment. Flagged for reconciliation.`
                      );
                    }

                    // Case B: amount mismatch. Stripe charged a different amount
                    // than what the order currently totals (stale link). Record
                    // the discrepancy but still mark paid — money was captured
                    // and we need stock reflected correctly. Reviewer will
                    // reconcile via a refund.
                    if (!alreadyPaidManually) {
                      const expectedCents = Math.round((orderData.totalAmount || 0) * 100);
                      const actualCents = session.amount_total ?? 0;
                      if (Math.abs(actualCents - expectedCents) > 2) {
                        mismatchPayload = {
                          sessionAmountCents: actualCents,
                          expectedAmountCents: expectedCents,
                          currency: session.currency || 'eur',
                          stripeSessionId: session.id,
                          detectedAt: Timestamp.now(),
                        };
                      }
                    }
                  }
                } catch (preCheckErr) {
                  console.error(`[webhook] Pre-check failed for order ${orderId}:`, preCheckErr);
                }
              }

              if (shouldMarkPaid) {
                const { updateOrderPaymentStatus } = await import('@/services/server-order-service');
                await updateOrderPaymentStatus(
                  orderId,
                  'paid',
                  session.payment_intent as string
                );
                console.log(`Updated existing order ${orderId} to paid`);

                // If the amount was mismatched, flag the order on_hold AFTER
                // the paid-transition so stock is reflected but a human still
                // gets alerted.
                if (mismatchPayload && adminDb) {
                  try {
                    await adminDb.collection('orders').doc(orderId).update({
                      status: 'on_hold',
                      paymentAmountMismatch: mismatchPayload,
                      updatedAt: Timestamp.now(),
                    });
                    console.warn(
                      `[webhook] Payment amount mismatch on order ${orderId}: ` +
                      `Stripe ${mismatchPayload.sessionAmountCents}c vs expected ${mismatchPayload.expectedAmountCents}c. ` +
                      `Order moved to on_hold for reconciliation.`
                    );
                  } catch (flagErr) {
                    console.error(`[webhook] Failed to flag mismatch on order ${orderId}:`, flagErr);
                  }
                }
              }
            } else {
              // New order from direct checkout
              const order = await createOrderFromCheckout(session);
              console.log(
                `Created order ${order.id} for distributor ${session.metadata.distributorId}, ` +
                  `total: ${session.amount_total}, platform fee: ${session.metadata.platformFeeAmount}`
              );
            }
          } catch (error) {
            console.error(
              `Error processing checkout session ${session.id}:`,
              error
            );
          }
        }
        break;
      }

      // ============================================
      // SUBSCRIPTION CREATED / UPDATED
      // ============================================
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;

        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;

        const tier = resolveTierFromSubscription(subscription);
        const status = subscription.status as SubscriptionStatus;
        const subscriptionCurrentPeriodEnd = getCurrentPeriodEndIso(
          subscription
        );

        const distributor = await findDistributorByStripeCustomerId(
          customerId
        );

        if (distributor) {
          const updatePayload: any = {
            subscriptionStatus: status,
            subscriptionTier: tier ?? distributor.subscriptionTier ?? undefined,
          };
          if (subscriptionCurrentPeriodEnd) {
            updatePayload.subscriptionCurrentPeriodEnd =
              subscriptionCurrentPeriodEnd;
          }

          await updateDistributor(distributor.id, updatePayload);
          console.log(
            `Updated subscription for distributor ${distributor.id}: ` +
              `status=${status}, tier=${tier}, periodEnd=${subscriptionCurrentPeriodEnd} from event ${event.type}`
          );
        } else {
          console.warn(
            `Could not find distributor for Stripe customer ID: ${customerId} from event ${event.type}`
          );
        }
        break;
      }

      // ============================================
      // SUBSCRIPTION DELETED / CANCELLED
      // ============================================
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;

        const distributor = await findDistributorByStripeCustomerId(
          customerId
        );

        if (distributor) {
          await updateDistributor(distributor.id, {
            subscriptionStatus: "canceled",
            subscriptionId: undefined,
            // optional: also clear tier or period end if you want
            // subscriptionTier: undefined,
            // subscriptionCurrentPeriodEnd: undefined,
          });
          console.log(
            `Cancelled subscription for distributor ${distributor.id}`
          );
        } else {
          console.warn(
            `Received customer.subscription.deleted for customer ${customerId} but no distributor found.`
          );
        }
        break;
      }

      // ============================================
      // STRIPE CONNECT ACCOUNT UPDATED
      // ============================================
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        const distributorId = account.metadata?.distributorId;

        if (distributorId) {
          let status:
            | "pending"
            | "verified"
            | "in_review"
            | "restricted"
            | "details_needed" = "pending";

          // Check requirements for more granular status
          const requirements = account.requirements;
          const hasPendingVerification = requirements?.pending_verification && requirements.pending_verification.length > 0;
          const hasCurrentlyDue = requirements?.currently_due && requirements.currently_due.length > 0;
          const hasPastDue = requirements?.past_due && requirements.past_due.length > 0;
          const hasDisabledReason = requirements?.disabled_reason;

          if (account.charges_enabled && account.payouts_enabled) {
            // Account is fully verified and can accept payments
            status = "verified";
          } else if (hasDisabledReason) {
            // Account has been disabled/restricted
            status = "restricted";
          } else if (hasCurrentlyDue || hasPastDue) {
            // User needs to provide more information
            status = "details_needed";
          } else if (account.details_submitted && hasPendingVerification) {
            // Details submitted, waiting for Stripe to verify
            status = "in_review";
          } else if (account.details_submitted) {
            // Details submitted but no specific pending items - still in review
            status = "in_review";
          }
          // Otherwise stays as "pending" (onboarding not started/completed)

          await updateDistributor(distributorId, {
            stripeAccountStatus: status,
          });
          console.log(
            `Updated Stripe Connect account status for distributor ${distributorId} to ${status}`,
            {
              charges_enabled: account.charges_enabled,
              payouts_enabled: account.payouts_enabled,
              details_submitted: account.details_submitted,
              pending_verification: requirements?.pending_verification,
              currently_due: requirements?.currently_due,
              disabled_reason: requirements?.disabled_reason,
            }
          );
        } else {
          console.warn(
            `Received 'account.updated' event for Stripe account ${account.id} but no distributorId was found in metadata.`
          );
        }
        break;
      }

      default: {
        console.log(`Unhandled event type ${event.type}`);
      }
    }

    logSystemEvent({ type: 'webhook_event', source: 'stripe_webhook', status: 'success', message: `Processed: ${event.type}` });
    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("Unhandled error in webhook handler:", err);
    logSystemEvent({ type: 'webhook_error', source: 'stripe_webhook', status: 'error', message: `Handler error: ${err.message}`, metadata: { errorMessage: err.message } });
    return NextResponse.json(
      { error: "Webhook handler error" },
      { status: 500 }
    );
  }
}
