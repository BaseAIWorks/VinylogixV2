import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { sendPaymentReminderEmail } from '@/services/email-service';
import type { Order } from '@/types';

const REMINDER_INTERVAL_DAYS = 7;
const MAX_REMINDERS = 3;

function hydrateTimestamps<T extends Record<string, any>>(data: T, fields: string[]): T {
  const copy: Record<string, any> = { ...data };
  for (const field of fields) {
    const v = copy[field];
    if (v && typeof v.toDate === 'function') copy[field] = v.toDate().toISOString();
  }
  return copy as T;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Cron not configured.' }, { status: 503 });
  }
  if (!auth || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const adminDb = getAdminDb();
  if (!adminDb) return NextResponse.json({ error: 'Admin DB unavailable.' }, { status: 503 });

  const now = new Date();
  const PAGE_SIZE = 500;
  // Cap the whole run so the function can't exceed Cloud Run timeout on a
  // bad day. 10 pages × 500 orders = up to 5000 orders per invocation, which
  // is plenty; anything beyond should be handled by a subsequent invocation.
  const MAX_PAGES = 10;

  let sent = 0;
  let escalated = 0;
  let skipped = 0;
  let total = 0;

  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    let q = adminDb
      .collection('orders')
      .where('status', 'in', ['awaiting_payment', 'pending'])
      .orderBy('createdAt')
      .limit(PAGE_SIZE);
    if (cursor) q = q.startAfter(cursor);

    const snap = await q.get();
    if (snap.empty) break;
    total += snap.size;

    for (const doc of snap.docs) {
      try {
        const data = doc.data() as any;
        const order = hydrateTimestamps(data, [
          'createdAt', 'updatedAt', 'approvedAt', 'paidAt',
          'paymentLinkCreatedAt', 'paymentLinkExpiresAt',
          'lastPaymentReminderAt', 'shippedAt',
        ]) as Order;

        const anchor = order.lastPaymentReminderAt
          ? new Date(order.lastPaymentReminderAt)
          : (order.approvedAt ? new Date(order.approvedAt) : new Date(order.createdAt));
        const ageDays = daysBetween(now, anchor);
        if (ageDays < REMINDER_INTERVAL_DAYS) { skipped += 1; continue; }

        const reminderCount = order.paymentReminderCount || 0;

        // After MAX_REMINDERS, move order to on_hold with a stale-payment flag rather than
        // pinging the customer forever.
        if (reminderCount >= MAX_REMINDERS) {
          await doc.ref.update({
            status: 'on_hold',
            updatedAt: Timestamp.now(),
            stalePaymentFlaggedAt: Timestamp.now(),
          });
          escalated += 1;
          continue;
        }

        if (!order.viewerEmail) { skipped += 1; continue; }

        await sendPaymentReminderEmail(order, reminderCount + 1);
        await doc.ref.update({
          lastPaymentReminderAt: Timestamp.now(),
          paymentReminderCount: reminderCount + 1,
          updatedAt: Timestamp.now(),
        });
        sent += 1;
      } catch (err) {
        console.error(`[payment-reminders] Failed for order ${doc.id}:`, err);
      }
    }

    if (snap.size < PAGE_SIZE) break;
    cursor = snap.docs[snap.docs.length - 1];
  }

  return NextResponse.json({ sent, escalated, skipped, total });
}
