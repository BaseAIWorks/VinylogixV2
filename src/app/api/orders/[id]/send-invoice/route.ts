import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { authErrorResponse } from '@/lib/auth-helpers';
import { rateLimit } from '@/lib/rate-limit';
import { requireOrderAccess } from '@/lib/order-access';
import { getInvoicePdfBase64 } from '@/lib/invoice-utils';
import { sendInvoiceToCustomerEmail } from '@/services/email-service';
import type { Order, Distributor } from '@/types';

// Firestore admin Timestamps can't be passed straight to the PDF builder
// (which calls format(new Date(order.createdAt))). Convert known timestamp
// fields to ISO strings so the shared browser+Node builder stays simple.
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimited = rateLimit(req, { limit: 10, windowMs: 60_000, prefix: 'send-invoice' });
  if (rateLimited) return rateLimited;

  try {
    const { id: orderId } = await params;
    const { orderData, orderRef, adminDb } = await requireOrderAccess(req, orderId);

    if (!orderData.viewerEmail) {
      return NextResponse.json({ error: 'Order has no customer email address.' }, { status: 400 });
    }

    // Load distributor (source of truth) — never trust anything from the client here
    const distSnap = await adminDb.collection('distributors').doc(orderData.distributorId).get();
    if (!distSnap.exists) {
      return NextResponse.json({ error: 'Distributor not found.' }, { status: 404 });
    }
    const distData = { id: distSnap.id, ...distSnap.data() } as any;

    const order = hydrateTimestamps(orderData, [
      'createdAt', 'updatedAt', 'paidAt', 'shippedAt', 'approvedAt',
      'paymentLinkExpiresAt', 'estimatedDeliveryDate',
      'itemChangesNotifiedAt', 'invoiceEmailedAt',
    ]) as Order;
    const distributor = hydrateTimestamps(distData, ['createdAt', 'updatedAt']) as Distributor;

    const { base64, filename } = await getInvoicePdfBase64(order, distributor);

    const distributorName = distributor.companyName || distributor.name || 'Your distributor';
    const replyToEmail = (distData.contactEmail as string | undefined) || undefined;

    await sendInvoiceToCustomerEmail(order, distributorName, base64, filename, replyToEmail);

    await orderRef.update({
      invoiceEmailedAt: Timestamp.now(),
      invoiceEmailedCount: FieldValue.increment(1),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.status) return authErrorResponse(error);
    console.error('Error in send-invoice route:', error);
    return NextResponse.json({ error: 'Failed to send invoice.' }, { status: 500 });
  }
}
