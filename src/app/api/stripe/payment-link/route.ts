import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { requireAuth, authErrorResponse } from '@/lib/auth-helpers';
import { getAdminDb } from '@/lib/firebase-admin';
import { createPaymentSessionForOrder } from '@/lib/stripe-order-session';
import { getInvoicePdfBase64 } from '@/lib/invoice-utils';
import type { Order, Distributor } from '@/types';

// Convert admin Firestore Timestamps to ISO strings before handing to
// helpers typed against Order / Distributor (which expect ISO).
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
  try {
    const caller = await requireAuth(req);

    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required.' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Service unavailable.' }, { status: 500 });
    }

    // Fetch order
    const orderSnap = await adminDb.collection('orders').doc(orderId).get();
    if (!orderSnap.exists) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }
    const order = orderSnap.data()!;

    // Only generate payment links for orders awaiting payment
    if (order.status !== 'awaiting_payment' && order.status !== 'awaiting_approval') {
      return NextResponse.json({ error: 'Order is not eligible for a payment link.' }, { status: 400 });
    }
    if (order.paymentStatus === 'paid') {
      return NextResponse.json({ error: 'Order is already paid.' }, { status: 400 });
    }

    // Verify caller is operator of this distributor
    const userSnap = await adminDb.collection('users').doc(caller.uid).get();
    const userData = userSnap.data();
    if (!userData || (userData.role !== 'master' && userData.role !== 'superadmin') || (userData.role === 'master' && userData.distributorId !== order.distributorId)) {
      return NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 });
    }

    // Get distributor for Stripe account
    const distSnap = await adminDb.collection('distributors').doc(order.distributorId).get();
    if (!distSnap.exists) {
      return NextResponse.json({ error: 'Distributor not found.' }, { status: 404 });
    }
    const distributor = distSnap.data()!;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vinylogix.com';

    const result = await createPaymentSessionForOrder({
      order,
      orderId,
      distributor,
      siteUrl,
    });

    // Store payment link on the order
    await orderSnap.ref.update({
      paymentLink: result.sessionUrl,
      paymentLinkExpiresAt: new Date(result.expiresAt * 1000).toISOString(),
      paymentLinkCreatedAt: Timestamp.now(),
      stripeCheckoutSessionId: result.sessionId,
      platformFeeAmount: result.platformFeeAmount,
      appliedFeePercentage: result.appliedFeePercentage,
    });

    // Send approval email with payment link + invoice PDF attached (non-blocking).
    // Hydrate timestamps so the email renderer can do format() on them, and
    // generate the invoice PDF server-side so the customer has a copy for
    // their records regardless of whether they use the Stripe link.
    (async () => {
      try {
        const { sendOrderApprovedEmail } = await import('@/services/email-service');
        const freshSnap = await orderSnap.ref.get();
        const freshData = { id: freshSnap.id, ...freshSnap.data() } as any;
        const hydratedOrder = hydrateTimestamps(freshData, [
          'createdAt', 'updatedAt', 'paidAt', 'shippedAt', 'approvedAt',
          'paymentLinkCreatedAt', 'paymentLinkExpiresAt',
          'itemChangesNotifiedAt', 'invoiceEmailedAt',
        ]) as Order;
        const hydratedDistributor = hydrateTimestamps(distributor as any, ['createdAt', 'updatedAt']) as Distributor;

        let invoicePdf: { base64: string; filename: string } | undefined;
        try {
          invoicePdf = await getInvoicePdfBase64(hydratedOrder, hydratedDistributor);
        } catch (pdfErr) {
          console.error('[payment-link] Invoice PDF generation failed (sending email without attachment):', pdfErr);
        }

        await sendOrderApprovedEmail(
          hydratedOrder,
          result.sessionUrl,
          hydratedDistributor,
          invoicePdf
        );
      } catch (err) {
        console.error('Failed to send order approved email:', err);
      }
    })();

    return NextResponse.json({ paymentLink: result.sessionUrl });
  } catch (error: any) {
    if (error?.status) return authErrorResponse(error);
    console.error('Payment link generation error:', error);
    return NextResponse.json({ error: 'Failed to generate payment link.' }, { status: 500 });
  }
}
