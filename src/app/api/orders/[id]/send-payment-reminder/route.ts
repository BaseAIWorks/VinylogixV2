import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { authErrorResponse } from '@/lib/auth-helpers';
import { rateLimit } from '@/lib/rate-limit';
import { requireOrderAccess } from '@/lib/order-access';
import { sendPaymentReminderEmail } from '@/services/email-service';
import type { Order } from '@/types';

function hydrateTimestamps<T extends Record<string, any>>(data: T, fields: string[]): T {
  const copy: Record<string, any> = { ...data };
  for (const field of fields) {
    const v = copy[field];
    if (v && typeof v.toDate === 'function') copy[field] = v.toDate().toISOString();
  }
  return copy as T;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimited = rateLimit(req, { limit: 5, windowMs: 60_000, prefix: 'send-reminder' });
  if (rateLimited) return rateLimited;

  try {
    const { id: orderId } = await params;
    const { orderData, orderRef } = await requireOrderAccess(req, orderId);

    if (orderData.status !== 'awaiting_payment' && orderData.status !== 'pending') {
      return NextResponse.json(
        { error: 'Reminders only apply to orders awaiting payment.' },
        { status: 400 }
      );
    }
    if (!orderData.viewerEmail) {
      return NextResponse.json({ error: 'Order has no customer email.' }, { status: 400 });
    }

    const order = hydrateTimestamps(orderData, [
      'createdAt', 'updatedAt', 'approvedAt', 'paidAt',
      'paymentLinkCreatedAt', 'paymentLinkExpiresAt', 'lastPaymentReminderAt',
    ]) as Order;

    const reminderCount = orderData.paymentReminderCount || 0;
    await sendPaymentReminderEmail(order, reminderCount + 1);

    await orderRef.update({
      lastPaymentReminderAt: Timestamp.now(),
      paymentReminderCount: reminderCount + 1,
      updatedAt: Timestamp.now(),
    });

    return NextResponse.json({ success: true, reminderCount: reminderCount + 1 });
  } catch (error: any) {
    if (error?.status) return authErrorResponse(error);
    console.error('Error sending payment reminder:', error);
    return NextResponse.json({ error: error?.message || 'Failed to send reminder.' }, { status: 500 });
  }
}
