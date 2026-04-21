import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { authErrorResponse } from '@/lib/auth-helpers';
import { rateLimit } from '@/lib/rate-limit';
import { requireOrderAccess } from '@/lib/order-access';
import { getInvoicePdfBase64 } from '@/lib/invoice-utils';
import { recalcOrderReverseCharge } from '@/services/server-order-service';
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
    const access = await requireOrderAccess(req, orderId);
    const { orderRef } = access;
    let orderData = access.orderData;

    if (orderData.status !== 'awaiting_approval') {
      return NextResponse.json(
        { error: `Order is not awaiting approval (current status: ${orderData.status}).` },
        { status: 400 }
      );
    }

    // If the distributor validated the customer's VAT between order-create
    // and now, the stored totals are stale (reverse charge not applied, or
    // vice-versa). Recalc BEFORE building the PDF so the invoice matches
    // what gets charged.
    const recalc = await recalcOrderReverseCharge(orderId);
    if (!recalc.distributor) {
      return NextResponse.json({ error: 'Distributor not found.' }, { status: 404 });
    }
    if (recalc.changed) {
      orderData = recalc.order;
    }
    const distData = { id: orderData.distributorId, ...recalc.distributor } as any;

    // Effective mode: if Stripe checkout is disabled on this distributor,
    // invoice-only is always allowed regardless of paymentLinkMode setting.
    const mode = distData.paymentLinkMode || 'always';
    const stripeDisabled = distData.stripeCheckoutDisabled === true;
    if (!stripeDisabled && mode === 'always') {
      return NextResponse.json(
        { error: 'Invoice-only approval is not enabled for this distributor.' },
        { status: 400 }
      );
    }

    // Build the PDF BEFORE transitioning the order. If PDF generation fails
    // (bad logo URL, PDF lib error, etc.) the order stays in awaiting_approval
    // so the distributor can retry. The PDF is the point of no return: once
    // we have it, we commit the transition and email in short order.
    const distributor = hydrateTimestamps(distData, ['createdAt', 'updatedAt']) as Distributor;
    const previewOrder = hydrateTimestamps(orderData, [
      'createdAt', 'updatedAt', 'paidAt', 'shippedAt', 'approvedAt',
      'paymentLinkCreatedAt', 'itemChangesNotifiedAt', 'invoiceEmailedAt',
    ]) as Order;
    // Render the PDF showing the order as already approved (what the customer
    // will receive), even though we haven't committed the transition yet.
    const { base64, filename } = await getInvoicePdfBase64(
      { ...previewOrder, status: 'awaiting_payment' },
      distributor
    );

    // Transactional status transition: re-read the order at write time and
    // refuse to transition unless it's still awaiting_approval. Guards
    // against a double-approval race (two operators click at once) or a
    // status change committed during the PDF build above.
    try {
      await orderRef.firestore.runTransaction(async (tx) => {
        const snap = await tx.get(orderRef);
        if (!snap.exists) {
          throw new Error(`Order ${orderId} disappeared before approval write.`);
        }
        const current = snap.data()!;
        if (current.status !== 'awaiting_approval') {
          const err: any = new Error(`Order status changed to "${current.status}" while approving.`);
          err.status = 409;
          throw err;
        }
        tx.update(orderRef, {
          status: 'awaiting_payment',
          approvedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          // Remove any dormant Stripe link fields so the UI doesn't show a dead link
          paymentLink: FieldValue.delete(),
          stripeCheckoutSessionId: FieldValue.delete(),
          paymentLinkExpiresAt: FieldValue.delete(),
          paymentLinkCreatedAt: FieldValue.delete(),
        });
      });
    } catch (err: any) {
      if (err?.status === 409) {
        return NextResponse.json({ error: err.message }, { status: 409 });
      }
      throw err;
    }

    try {
      const { sendOrderApprovedInvoiceOnlyEmail } = await import('@/services/email-service');
      const replyToEmail = (distData.contactEmail as string | undefined) || undefined;
      // Pass the full distributor object so the email template can render
      // the distributor's logo, payment terms, and bank/IBAN directly in
      // the email body (not just a PDF attachment).
      await sendOrderApprovedInvoiceOnlyEmail(
        { ...previewOrder, status: 'awaiting_payment', approvedAt: new Date().toISOString() },
        distributor,
        base64,
        filename,
        replyToEmail
      );
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
