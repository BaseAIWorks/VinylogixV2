import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { authErrorResponse } from '@/lib/auth-helpers';
import { rateLimit } from '@/lib/rate-limit';
import { requireOrderAccess } from '@/lib/order-access';
import { createPaymentSessionForOrder } from '@/lib/stripe-order-session';
import { recalcOrderReverseCharge } from '@/services/server-order-service';
import type { Order } from '@/types';

// Convert admin Firestore Timestamp fields to ISO strings so email-service
// (which types order as Order) can read them without special-casing.
function hydrateTimestamps<T extends Record<string, any>>(data: T, fields: string[]): T {
  const copy: Record<string, any> = { ...data };
  for (const field of fields) {
    const v = copy[field];
    if (v && typeof v.toDate === 'function') {
      copy[field] = v.toDate().toISOString();
    }
  }
  return copy as T;
}

export async function POST(req: NextRequest) {
  const rateLimited = rateLimit(req, { limit: 10, windowMs: 60_000, prefix: 'regenerate-payment-link' });
  if (rateLimited) return rateLimited;

  try {
    const body = await req.json().catch(() => ({}));
    const { orderId, notifyCustomer } = body as { orderId?: string; notifyCustomer?: boolean };
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required.' }, { status: 400 });
    }

    const access = await requireOrderAccess(req, orderId);
    const { orderRef } = access;
    let orderData = access.orderData;

    if (orderData.paymentStatus === 'paid') {
      return NextResponse.json({ error: 'Order is already paid.' }, { status: 400 });
    }
    if (orderData.status !== 'awaiting_payment' && orderData.status !== 'awaiting_approval') {
      return NextResponse.json(
        { error: 'Order is not in a state that accepts a payment link.' },
        { status: 400 }
      );
    }

    // Re-evaluate reverse charge against the customer's current vatValidated
    // flag so the regenerated session bakes in the correct amount.
    const recalc = await recalcOrderReverseCharge(orderId);
    if (!recalc.distributor) {
      return NextResponse.json({ error: 'Distributor not found.' }, { status: 404 });
    }
    if (recalc.changed) {
      orderData = recalc.order;
    }
    const distributor = recalc.distributor;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vinylogix.com';

    const result = await createPaymentSessionForOrder({
      order: orderData,
      orderId,
      distributor,
      siteUrl,
    });

    await orderRef.update({
      paymentLink: result.sessionUrl,
      paymentLinkExpiresAt: new Date(result.expiresAt * 1000).toISOString(),
      paymentLinkCreatedAt: Timestamp.now(),
      stripeCheckoutSessionId: result.sessionId,
      platformFeeAmount: result.platformFeeAmount,
      appliedFeePercentage: result.appliedFeePercentage,
      updatedAt: Timestamp.now(),
      // Clear any previous mismatch flag — this is a fresh link, reconciled.
      paymentAmountMismatch: FieldValue.delete(),
    });

    if (notifyCustomer) {
      try {
        const { sendUpdatedPaymentLinkEmail } = await import('@/services/email-service');
        const { getInvoicePdfBase64 } = await import('@/lib/invoice-utils');
        const order = hydrateTimestamps(orderData, [
          'createdAt', 'updatedAt', 'paidAt', 'shippedAt', 'approvedAt',
          'paymentLinkCreatedAt', 'paymentLinkExpiresAt',
          'itemChangesNotifiedAt', 'invoiceEmailedAt',
        ]) as Order;
        const hydratedDistributor = hydrateTimestamps(distributor as any, ['createdAt', 'updatedAt']) as any;

        // Attach the up-to-date invoice PDF so the customer has a copy of
        // what the new link charges for — matches the approve+pay email.
        let invoicePdf: { base64: string; filename: string } | undefined;
        try {
          invoicePdf = await getInvoicePdfBase64(order, hydratedDistributor);
        } catch (pdfErr) {
          console.error('[regenerate] Invoice PDF generation failed (sending email without attachment):', pdfErr);
        }

        await sendUpdatedPaymentLinkEmail(order, result.sessionUrl, hydratedDistributor, invoicePdf);
      } catch (err) {
        // Email failure shouldn't invalidate the regeneration — link is already created/stored.
        console.error('Failed to send updated payment link email:', err);
      }
    }

    return NextResponse.json({
      paymentLink: result.sessionUrl,
      expiresAt: new Date(result.expiresAt * 1000).toISOString(),
      expiredPreviousSessionId: result.expiredPreviousSessionId,
    });
  } catch (error: any) {
    if (error?.status) return authErrorResponse(error);
    console.error('Regenerate payment link error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to regenerate payment link.' },
      { status: 500 }
    );
  }
}
