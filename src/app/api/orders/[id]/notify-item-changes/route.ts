import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { authErrorResponse } from '@/lib/auth-helpers';
import { rateLimit } from '@/lib/rate-limit';
import { requireOrderAccess } from '@/lib/order-access';
import { sendOrderItemChangesEmail } from '@/services/email-service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimited = rateLimit(req, { limit: 10, windowMs: 60_000, prefix: 'notify-item-changes' });
  if (rateLimited) return rateLimited;

  try {
    const { id: orderId } = await params;
    const { orderData, orderRef, adminDb } = await requireOrderAccess(req, orderId);

    const hasChanges = (orderData.items || []).some(
      (item: any) => item.itemStatus && item.itemStatus !== 'available'
    );
    if (!hasChanges) {
      return NextResponse.json({ error: 'No item status changes to notify about.' }, { status: 400 });
    }

    const distSnap = await adminDb.collection('distributors').doc(orderData.distributorId).get();
    const distData = distSnap.exists ? (distSnap.data() as any) : {};
    const distributorName = distData.companyName || distData.name || 'Your distributor';

    await sendOrderItemChangesEmail(orderData, distributorName);

    await orderRef.update({
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
