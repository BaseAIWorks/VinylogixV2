import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { requireAuth, authErrorResponse } from '@/lib/auth-helpers';
import { rateLimit } from '@/lib/rate-limit';
import { sendInvoiceToCustomerEmail } from '@/services/email-service';

// Roughly 3 MB of raw PDF bytes → ~4 MB base64. Resend attachment limit is 40 MB total payload.
const MAX_PDF_BASE64_LENGTH = 4 * 1024 * 1024;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const rateLimited = rateLimit(req, { limit: 10, windowMs: 60_000, prefix: 'send-invoice' });
  if (rateLimited) return rateLimited;

  try {
    const caller = await requireAuth(req);
    const orderId = params.id;
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required.' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { pdfBase64, filename } = body as { pdfBase64?: string; filename?: string };
    if (!pdfBase64 || typeof pdfBase64 !== 'string') {
      return NextResponse.json({ error: 'Invoice PDF is missing.' }, { status: 400 });
    }
    if (pdfBase64.length > MAX_PDF_BASE64_LENGTH) {
      return NextResponse.json({ error: 'Invoice PDF is too large.' }, { status: 413 });
    }
    const safeFilename = (filename || `Invoice-${orderId.slice(0, 8)}.pdf`).replace(/[^\w.\-]+/g, '_');

    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Service unavailable.' }, { status: 500 });
    }

    // Verify caller can manage orders for this distributor (master / superadmin / worker with permission)
    const callerSnap = await adminDb.collection('users').doc(caller.uid).get();
    if (!callerSnap.exists) {
      return NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 });
    }
    const callerData = callerSnap.data() as any;

    const orderSnap = await adminDb.collection('orders').doc(orderId).get();
    if (!orderSnap.exists) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }
    const orderData = { id: orderSnap.id, ...orderSnap.data() } as any;

    const isSuperadmin = callerData.role === 'superadmin';
    const isMasterOfDistributor = callerData.role === 'master' && callerData.distributorId === orderData.distributorId;
    const isWorkerWithPermission = callerData.role === 'worker'
      && callerData.distributorId === orderData.distributorId
      && callerData.permissions?.canManageOrders === true;
    if (!isSuperadmin && !isMasterOfDistributor && !isWorkerWithPermission) {
      return NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 });
    }

    if (!orderData.viewerEmail) {
      return NextResponse.json({ error: 'Order has no customer email address.' }, { status: 400 });
    }

    // Load distributor name + contact email for friendly from/reply-to
    const distSnap = await adminDb.collection('distributors').doc(orderData.distributorId).get();
    const distData = distSnap.exists ? (distSnap.data() as any) : {};
    const distributorName = distData.companyName || distData.name || 'Your distributor';
    const replyToEmail = distData.contactEmail || undefined;

    await sendInvoiceToCustomerEmail(orderData, distributorName, pdfBase64, safeFilename, replyToEmail);

    await orderSnap.ref.update({
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
