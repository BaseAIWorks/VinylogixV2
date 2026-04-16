import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { authErrorResponse } from '@/lib/auth-helpers';
import { rateLimit } from '@/lib/rate-limit';
import { requireOrderAccess } from '@/lib/order-access';
import { createPaymentSessionForOrder } from '@/lib/stripe-order-session';
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

    const { orderData, orderRef, adminDb } = await requireOrderAccess(req, orderId);

    if (orderData.paymentStatus === 'paid') {
      return NextResponse.json({ error: 'Order is already paid.' }, { status: 400 });
    }
    if (orderData.status !== 'awaiting_payment' && orderData.status !== 'awaiting_approval') {
      return NextResponse.json(
        { error: 'Order is not in a state that accepts a payment link.' },
        { status: 400 }
      );
    }

    const distSnap = await adminDb.collection('distributors').doc(orderData.distributorId).get();
    if (!distSnap.exists) {
      return NextResponse.json({ error: 'Distributor not found.' }, { status: 404 });
    }
    const distributor = distSnap.data()!;

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
      updatedAt: Timestamp.now(),
      // Clear any previous mismatch flag — this is a fresh link, reconciled.
      paymentAmountMismatch: FieldValue.delete(),
    });

    if (notifyCustomer) {
      try {
        const { sendUpdatedPaymentLinkEmail } = await import('@/services/email-service');
        const order = hydrateTimestamps(orderData, [
          'createdAt', 'updatedAt', 'paidAt', 'shippedAt', 'approvedAt',
          'paymentLinkCreatedAt', 'paymentLinkExpiresAt',
          'itemChangesNotifiedAt', 'invoiceEmailedAt',
        ]) as Order;
        const distributorName = distributor.companyName || distributor.name || 'Your distributor';
        await sendUpdatedPaymentLinkEmail(order, result.sessionUrl, distributorName);
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
