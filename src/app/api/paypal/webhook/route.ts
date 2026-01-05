/**
 * PayPal Webhook Handler
 *
 * Handles events from PayPal for:
 * - Merchant onboarding status updates
 * - Payment captures
 * - Refunds
 * - Disputes
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature, getMerchantStatus } from '@/lib/paypal';
import { updateDistributor } from '@/services/server-distributor-service';
import { getAdminDb } from '@/lib/firebase-admin';

const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const event = JSON.parse(body);

    // Get webhook signature headers
    const transmissionId = req.headers.get('paypal-transmission-id') || '';
    const transmissionTime = req.headers.get('paypal-transmission-time') || '';
    const certUrl = req.headers.get('paypal-cert-url') || '';
    const authAlgo = req.headers.get('paypal-auth-algo') || '';
    const transmissionSig = req.headers.get('paypal-transmission-sig') || '';

    // Verify webhook signature (optional but recommended in production)
    if (PAYPAL_WEBHOOK_ID && transmissionId) {
      try {
        const isValid = await verifyWebhookSignature({
          webhookId: PAYPAL_WEBHOOK_ID,
          transmissionId,
          transmissionTime,
          certUrl,
          authAlgo,
          transmissionSig,
          webhookEvent: event,
        });

        if (!isValid) {
          console.error('PayPal webhook signature verification failed');
          return NextResponse.json(
            { error: 'Invalid webhook signature' },
            { status: 400 }
          );
        }
      } catch (verifyError) {
        console.warn('Could not verify PayPal webhook signature:', verifyError);
        // Continue processing - verification might fail in sandbox
      }
    }

    console.log('PayPal Webhook Received:', event.event_type);

    const adminDb = getAdminDb();

    switch (event.event_type) {
      // ============================================
      // MERCHANT ONBOARDING COMPLETED
      // ============================================
      case 'MERCHANT.ONBOARDING.COMPLETED': {
        const resource = event.resource;
        const merchantId = resource.merchant_id;
        const trackingId = resource.tracking_id; // This is our distributorId

        console.log(`Merchant onboarding completed: ${merchantId}, tracking: ${trackingId}`);

        if (trackingId && merchantId) {
          try {
            // Get merchant status from PayPal
            const status = await getMerchantStatus(merchantId);

            const accountStatus = status.paymentsReceivable && status.primaryEmailConfirmed
              ? 'verified'
              : 'pending';

            await updateDistributor(trackingId, {
              paypalMerchantId: merchantId,
              paypalAccountStatus: accountStatus,
            });

            console.log(`Updated distributor ${trackingId} with PayPal merchant ${merchantId}, status: ${accountStatus}`);
          } catch (updateError) {
            console.error('Failed to update distributor PayPal status:', updateError);
          }
        }
        break;
      }

      // ============================================
      // MERCHANT PARTNER CONSENT REVOKED
      // ============================================
      case 'MERCHANT.PARTNER-CONSENT.REVOKED': {
        const resource = event.resource;
        const merchantId = resource.merchant_id;

        console.log(`Merchant partner consent revoked: ${merchantId}`);

        // Find distributor by PayPal merchant ID and update status
        if (adminDb && merchantId) {
          const distributorsSnap = await adminDb
            .collection('distributors')
            .where('paypalMerchantId', '==', merchantId)
            .limit(1)
            .get();

          if (!distributorsSnap.empty) {
            const distributorId = distributorsSnap.docs[0].id;
            await updateDistributor(distributorId, {
              paypalAccountStatus: 'restricted',
            });
            console.log(`Marked distributor ${distributorId} PayPal as restricted`);
          }
        }
        break;
      }

      // ============================================
      // PAYMENT CAPTURE COMPLETED
      // ============================================
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const capture = event.resource;
        console.log(`Payment capture completed: ${capture.id}, amount: ${capture.amount?.value} ${capture.amount?.currency_code}`);
        // Order is already created via the capture API call
        // This is just for logging/monitoring
        break;
      }

      // ============================================
      // PAYMENT CAPTURE REFUNDED
      // ============================================
      case 'PAYMENT.CAPTURE.REFUNDED': {
        const capture = event.resource;
        const captureId = capture.id;

        console.log(`Payment capture refunded: ${captureId}`);

        // Find order by PayPal capture ID and update status
        if (adminDb && captureId) {
          const ordersSnap = await adminDb
            .collection('orders')
            .where('paypalCaptureId', '==', captureId)
            .limit(1)
            .get();

          if (!ordersSnap.empty) {
            const orderRef = ordersSnap.docs[0].ref;
            await orderRef.update({
              paymentStatus: 'refunded',
              updatedAt: new Date().toISOString(),
            });
            console.log(`Updated order ${ordersSnap.docs[0].id} payment status to refunded`);
          }
        }
        break;
      }

      // ============================================
      // PAYMENT CAPTURE DENIED
      // ============================================
      case 'PAYMENT.CAPTURE.DENIED': {
        const capture = event.resource;
        console.error(`Payment capture denied: ${capture.id}`);

        // Find pending order and clean up if needed
        break;
      }

      // ============================================
      // CUSTOMER DISPUTE CREATED
      // ============================================
      case 'CUSTOMER.DISPUTE.CREATED': {
        const dispute = event.resource;
        console.warn(`PayPal dispute created: ${dispute.dispute_id}, reason: ${dispute.reason}`);
        // TODO: Send notification to distributor about dispute
        break;
      }

      // ============================================
      // CUSTOMER DISPUTE RESOLVED
      // ============================================
      case 'CUSTOMER.DISPUTE.RESOLVED': {
        const dispute = event.resource;
        console.log(`PayPal dispute resolved: ${dispute.dispute_id}, outcome: ${dispute.dispute_outcome?.outcome_code}`);
        break;
      }

      default:
        console.log(`Unhandled PayPal event type: ${event.event_type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('PayPal webhook error:', error);
    return NextResponse.json(
      { error: `Webhook error: ${error.message}` },
      { status: 500 }
    );
  }
}
