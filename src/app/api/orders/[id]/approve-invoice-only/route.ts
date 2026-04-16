import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { authErrorResponse } from '@/lib/auth-helpers';
import { rateLimit } from '@/lib/rate-limit';
import { requireOrderAccess } from '@/lib/order-access';
import { getInvoicePdfBase64 } from '@/lib/invoice-utils';
import type { Order, Distributor } from '@/types';

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

/**
 * Approves a Request Order without generating a Stripe payment link. The
 * customer is expected to pay externally (bank transfer etc.) and the
 * distributor later does Mark as Paid. The invoice PDF is generated server-
 * side and emailed to the customer, along with an explanation that payment
 * should follow the details on the invoice.
 *
 * Allowed when the distributor has paymentLinkMode='optional' or 'never'.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimited = rateLimit(req, { limit: 10, windowMs: 60_000, prefix: 'approve-invoice-only' });
  if (rateLimited) return rateLimited;

  try {
    const { id: orderId } = await params;
    const { orderData, orderRef, adminDb } = await requireOrderAccess(req, orderId);

    if (orderData.status !== 'awaiting_approval') {
      return NextResponse.json(
        { error: `Order is not awaiting approval (current status: ${orderData.status}).` },
        { status: 400 }
      );
    }

    const distSnap = await adminDb.collection('distributors').doc(orderData.distributorId).get();
    if (!distSnap.exists) {
      return NextResponse.json({ error: 'Distributor not found.' }, { status: 404 });
    }
    const distData = { id: distSnap.id, ...distSnap.data() } as any;

    const mode = distData.paymentLinkMode || 'always';
    if (mode === 'always') {
      return NextResponse.json(
        { error: 'Invoice-only approval is not enabled for this distributor.' },
        { status: 400 }
      );
    }

    // Transition the order first so the PDF reflects "Awaiting Payment" status
    await orderRef.update({
      status: 'awaiting_payment',
      approvedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      // Remove any dormant Stripe link fields so the UI doesn't show a dead link
      paymentLink: null,
      stripeCheckoutSessionId: null,
      paymentLinkExpiresAt: null,
      paymentLinkCreatedAt: null,
    });

    const freshSnap = await orderRef.get();
    const freshData = { id: freshSnap.id, ...freshSnap.data() } as any;

    const order = hydrateTimestamps(freshData, [
      'createdAt', 'updatedAt', 'paidAt', 'shippedAt', 'approvedAt',
      'paymentLinkCreatedAt', 'itemChangesNotifiedAt', 'invoiceEmailedAt',
    ]) as Order;
    const distributor = hydrateTimestamps(distData, ['createdAt', 'updatedAt']) as Distributor;

    const { base64, filename } = await getInvoicePdfBase64(order, distributor);

    try {
      const { sendOrderApprovedInvoiceOnlyEmail } = await import('@/services/email-service');
      const distributorName = distributor.companyName || distributor.name || 'Your distributor';
      const replyToEmail = (distData.contactEmail as string | undefined) || undefined;
      await sendOrderApprovedInvoiceOnlyEmail(order, distributorName, base64, filename, replyToEmail);
    } catch (emailErr) {
      console.error('Failed to send invoice-only approval email:', emailErr);
      // Don't fail the approval — order is already transitioned; distributor can resend invoice manually.
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.status) return authErrorResponse(error);
    console.error('Error in approve-invoice-only route:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to approve order.' },
      { status: 500 }
    );
  }
}
