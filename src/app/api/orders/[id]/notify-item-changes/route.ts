import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { requireAuth, authErrorResponse } from '@/lib/auth-helpers';
import { rateLimit } from '@/lib/rate-limit';
import { sendOrderItemChangesEmail } from '@/services/email-service';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const rateLimited = rateLimit(req, { limit: 10, windowMs: 60_000, prefix: 'notify-item-changes' });
  if (rateLimited) return rateLimited;

  try {
    const caller = await requireAuth(req);
    const orderId = params.id;
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required.' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Service unavailable.' }, { status: 500 });
    }

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

    const hasChanges = (orderData.items || []).some((item: any) => item.itemStatus && item.itemStatus !== 'available');
    if (!hasChanges) {
      return NextResponse.json({ error: 'No item status changes to notify about.' }, { status: 400 });
    }

    const distSnap = await adminDb.collection('distributors').doc(orderData.distributorId).get();
    const distData = distSnap.exists ? (distSnap.data() as any) : {};
    const distributorName = distData.companyName || distData.name || 'Your distributor';

    await sendOrderItemChangesEmail(orderData, distributorName);

    await orderSnap.ref.update({
      itemChangesNotifiedAt: Timestamp.now(),
      itemChangesNotifiedCount: FieldValue.increment(1),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.status) return authErrorResponse(error);
    console.error('Error in notify-item-changes route:', error);
    return NextResponse.json({ error: 'Failed to send notification.' }, { status: 500 });
  }
}
