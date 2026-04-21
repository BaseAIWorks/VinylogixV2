import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Public, unauthenticated tracking endpoint.
 * Returns a safe subset of order fields given an unguessable 32-hex-char token.
 * Rate-limited per IP to harden against token brute-force.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const rateLimited = rateLimit(req, { limit: 20, windowMs: 60_000, prefix: 'public-tracking' });
  if (rateLimited) return rateLimited;

  const { token } = await params;

  // Hard-reject anything that's not our token shape so we never hit Firestore with
  // guessed/garbage URLs.
  if (!/^[a-f0-9]{32}$/.test(token)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const adminDb = getAdminDb();
  if (!adminDb) {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 });
  }

  const snap = await adminDb
    .collection('orders')
    .where('trackingToken', '==', token)
    .limit(1)
    .get();

  if (snap.empty) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const doc = snap.docs[0];
  const o = doc.data() as any;

  // Hydrate timestamps so the client doesn't get serialization errors.
  const iso = (v: any) => (v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v);

  // Fetch minimal distributor info for the support line
  let distributorContact: { name?: string; email?: string; phone?: string } = {};
  if (o.distributorId) {
    try {
      const dSnap = await adminDb.collection('distributors').doc(o.distributorId).get();
      if (dSnap.exists) {
        const d = dSnap.data() as any;
        distributorContact = {
          name: d.companyName || d.name,
          email: d.contactEmail,
          phone: d.phoneNumber,
        };
      } else {
        // Helps catch data-integrity issues: an order references a
        // distributor doc that no longer exists. Customer page still renders,
        // just without contact info.
        console.warn(`[public-tracking] Distributor ${o.distributorId} referenced by order ${doc.id} not found`);
      }
    } catch (err) {
      console.warn(`[public-tracking] Failed to load distributor ${o.distributorId}:`, err);
    }
  }

  // Whitelist ONLY what the customer needs to see. No internal notes, no platform fees,
  // no other distributor orders, no refund ledger.
  const safeOrder = {
    id: doc.id,
    orderNumber: o.orderNumber || doc.id.slice(0, 8),
    status: o.status,
    paymentStatus: o.paymentStatus,
    customerName: o.customerName,
    createdAt: iso(o.createdAt),
    paidAt: iso(o.paidAt),
    approvedAt: iso(o.approvedAt),
    shippedAt: iso(o.shippedAt),
    estimatedDeliveryDate: iso(o.estimatedDeliveryDate),
    totalAmount: o.totalAmount,
    subtotalAmount: o.subtotalAmount,
    taxAmount: o.taxAmount,
    shippingCost: o.shippingCost,
    items: (o.items || []).map((item: any) => ({
      title: item.title,
      artist: item.artist,
      cover_url: item.cover_url,
      quantity: item.quantity,
      priceAtTimeOfOrder: item.priceAtTimeOfOrder,
      itemStatus: item.itemStatus,
    })),
    carrier: o.carrier,
    trackingNumber: o.trackingNumber,
    trackingUrl: o.trackingUrl,
    paymentLink: o.status === 'awaiting_payment' || o.status === 'pending' ? o.paymentLink : undefined,
    distributor: distributorContact,
  };

  return NextResponse.json({ order: safeOrder }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
