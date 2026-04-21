import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { getAdminDb } from '@/lib/firebase-admin';
import { sendWeeklyDigestEmail } from '@/services/email-service';
import {
  summarizePaidOrders,
  summarizeAwaitingPayments,
} from '@/lib/financial-aggregations';
import type { Order } from '@/types';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://vinylogix.com';

function hydrate<T extends Record<string, any>>(data: T, fields: string[]): T {
  const copy: Record<string, any> = { ...data };
  for (const f of fields) {
    const v = copy[f];
    if (v && typeof v.toDate === 'function') copy[f] = v.toDate().toISOString();
  }
  return copy as T;
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'Cron not configured.' }, { status: 503 });
  if (!auth || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const adminDb = getAdminDb();
  if (!adminDb) return NextResponse.json({ error: 'Admin DB unavailable.' }, { status: 503 });

  const distSnap = await adminDb
    .collection('distributors')
    .where('weeklyDigestOptIn', '==', true)
    .get();

  const now = new Date();
  const weekTo = endOfDay(subDays(now, 1)); // yesterday
  const weekFrom = startOfDay(subDays(now, 7));
  const prevFrom = startOfDay(subDays(now, 14));
  const prevTo = endOfDay(subDays(now, 8));
  const periodLabel = `${format(weekFrom, 'MMM d')} – ${format(weekTo, 'MMM d, yyyy')}`;

  let sent = 0;
  let skipped = 0;

  for (const distDoc of distSnap.docs) {
    const dist = distDoc.data() as any;
    if (!dist.contactEmail) { skipped += 1; continue; }

    try {
      const ordersSnap = await adminDb
        .collection('orders')
        .where('distributorId', '==', distDoc.id)
        .get();

      const orders: Order[] = ordersSnap.docs.map(d =>
        hydrate({ id: d.id, ...d.data() } as any, [
          'createdAt', 'updatedAt', 'paidAt', 'approvedAt', 'shippedAt',
          'paymentLinkCreatedAt', 'paymentLinkExpiresAt', 'lastPaymentReminderAt',
        ])
      );

      const thisWeek = summarizePaidOrders(orders, weekFrom, weekTo);
      const lastWeek = summarizePaidOrders(orders, prevFrom, prevTo);
      const awaiting = summarizeAwaitingPayments(orders);

      if (thisWeek.orderCount === 0 && thisWeek.refundCount === 0 && awaiting.count === 0) {
        // Nothing to report — don't spam quiet accounts
        skipped += 1;
        continue;
      }

      await sendWeeklyDigestEmail({
        to: dist.contactEmail,
        distributorName: dist.companyName || dist.name || 'Your shop',
        periodLabel,
        netRevenue: thisWeek.netRevenue,
        vatCollected: thisWeek.vatCollected - thisWeek.vatRefunded,
        shippingCollected: thisWeek.shippingCollected - thisWeek.shippingRefunded,
        netPayout: thisWeek.netPayout,
        orderCount: thisWeek.orderCount,
        refundedRevenue: thisWeek.refundedRevenue,
        refundCount: thisWeek.refundCount,
        awaitingTotal: awaiting.total,
        awaitingCount: awaiting.count,
        prevNetRevenue: lastWeek.netRevenue,
        statsUrl: `${SITE_URL}/stats`,
      });

      await distDoc.ref.update({
        weeklyDigestLastSentAt: Timestamp.now(),
      });
      sent += 1;
    } catch (err) {
      console.error(`[weekly-digest] Failed for distributor ${distDoc.id}:`, err);
    }
  }

  return NextResponse.json({ sent, skipped, total: distSnap.size });
}
