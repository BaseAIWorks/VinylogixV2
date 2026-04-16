import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { authErrorResponse } from '@/lib/auth-helpers';
import { rateLimit } from '@/lib/rate-limit';
import { requireOrderAccess } from '@/lib/order-access';
import { stripe } from '@/lib/stripe';
import type { Order } from '@/types';

type ManualMethod = 'bank_transfer' | 'cash' | 'paypal_external' | 'stripe_external' | 'other';

const METHOD_LABELS: Record<ManualMethod, string> = {
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
  paypal_external: 'PayPal (direct)',
  stripe_external: 'Stripe (external)',
  other: 'Other',
};

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

// Atomic per-record deduct (converts a reservation, or does direct deduct if legacy).
async function settleStockForOrder(adminDb: FirebaseFirestore.Firestore, orderData: any): Promise<'deducted' | 'skipped'> {
  const items: any[] = orderData.items || [];
  if (items.length === 0) return 'skipped';

  const isBillable = (status: string | undefined) => {
    const s = status || 'available';
    return s === 'available' || s === 'back_order';
  };
  const billable = items.filter(i => isBillable(i.itemStatus));
  const nonBillable = items.filter(i => !isBillable(i.itemStatus));

  const currentState = orderData.stockState || 'none';

  if (currentState === 'reserved') {
    // Release reservations for non-billable items (not_available / out_of_stock)
    for (const item of nonBillable) {
      if (!item.recordId || !item.quantity) continue;
      const ref = adminDb.collection('vinylRecords').doc(item.recordId);
      await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return;
        const d = snap.data()!;
        tx.update(ref, { reserved: Math.max(0, (d.reserved || 0) - item.quantity) });
      });
    }
    // Convert reservations for billable items to real deductions
    for (const item of billable) {
      if (!item.recordId || !item.quantity) continue;
      const ref = adminDb.collection('vinylRecords').doc(item.recordId);
      await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return;
        const d = snap.data()!;
        let qty = item.quantity;
        let shelf = d.stock_shelves || 0;
        let storage = d.stock_storage || 0;
        const fromShelves = Math.min(qty, shelf);
        shelf -= fromShelves;
        qty -= fromShelves;
        if (qty > 0) {
          const fromStorage = Math.min(qty, storage);
          storage -= fromStorage;
        }
        tx.update(ref, {
          stock_shelves: Math.max(0, shelf),
          stock_storage: Math.max(0, storage),
          reserved: Math.max(0, (d.reserved || 0) - item.quantity),
        });
      });
    }
    return 'deducted';
  }

  if (currentState !== 'deducted') {
    // Legacy path: direct atomic deduct on billable items only.
    for (const item of billable) {
      if (!item.recordId || !item.quantity) continue;
      const ref = adminDb.collection('vinylRecords').doc(item.recordId);
      await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return;
        const d = snap.data()!;
        let qty = item.quantity;
        let shelf = d.stock_shelves || 0;
        let storage = d.stock_storage || 0;
        const fromShelves = Math.min(qty, shelf);
        shelf -= fromShelves;
        qty -= fromShelves;
        if (qty > 0) storage -= qty;
        tx.update(ref, {
          stock_shelves: Math.max(0, shelf),
          stock_storage: Math.max(0, storage),
        });
      });
    }
    return 'deducted';
  }

  // Already deducted — idempotent no-op
  return 'skipped';
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimited = rateLimit(req, { limit: 10, windowMs: 60_000, prefix: 'mark-paid' });
  if (rateLimited) return rateLimited;

  try {
    const { id: orderId } = await params;
    const body = await req.json().catch(() => ({}));
    const {
      paymentMethod,
      paymentReference,
      paymentNotes,
      sendConfirmationEmail,
    } = body as {
      paymentMethod: ManualMethod;
      paymentReference?: string;
      paymentNotes?: string;
      sendConfirmationEmail?: boolean;
    };

    if (!paymentMethod || !METHOD_LABELS[paymentMethod]) {
      return NextResponse.json({ error: 'Invalid payment method.' }, { status: 400 });
    }

    const { caller, orderData, orderRef, adminDb } = await requireOrderAccess(req, orderId);

    if (orderData.paymentStatus === 'paid') {
      return NextResponse.json({ error: 'Order is already paid.' }, { status: 400 });
    }
    if (orderData.status === 'cancelled') {
      return NextResponse.json({ error: 'Cancelled orders cannot be marked as paid.' }, { status: 400 });
    }

    // Settle stock first — if this throws, we haven't touched the order doc yet
    const stockAction = await settleStockForOrder(adminDb, orderData);

    // Best-effort: expire any still-open Stripe session so the old link can't
    // charge the customer after they already paid manually. Never block on this.
    if (orderData.stripeCheckoutSessionId) {
      try {
        const session = await stripe.checkout.sessions.retrieve(orderData.stripeCheckoutSessionId);
        if (session.status === 'open') {
          await stripe.checkout.sessions.expire(orderData.stripeCheckoutSessionId);
        }
      } catch (err) {
        console.warn(`[mark-paid] Could not expire Stripe session for order ${orderId}:`, (err as Error).message);
      }
    }

    const updatePayload: any = {
      status: 'paid',
      paymentStatus: 'paid',
      paymentMethod,
      paidAt: Timestamp.now(),
      paidBy: caller.uid,
      updatedAt: Timestamp.now(),
      // Remove payment-link fields so UI doesn't show a dead link next to a paid order
      paymentLink: FieldValue.delete(),
      stripeCheckoutSessionId: FieldValue.delete(),
      paymentLinkExpiresAt: FieldValue.delete(),
      paymentLinkCreatedAt: FieldValue.delete(),
    };
    if (paymentReference && paymentReference.trim()) {
      updatePayload.paymentReference = paymentReference.trim().slice(0, 200);
    }
    if (paymentNotes && paymentNotes.trim()) {
      updatePayload.paymentNotes = paymentNotes.trim().slice(0, 1000);
    }
    if (stockAction === 'deducted') {
      updatePayload.stockState = 'deducted';
    }

    await orderRef.update(updatePayload);

    // Send customer confirmation email
    if (sendConfirmationEmail !== false && orderData.viewerEmail) {
      try {
        const { sendOrderPaidConfirmation } = await import('@/services/email-service');
        const distSnap = await adminDb.collection('distributors').doc(orderData.distributorId).get();
        const distData = distSnap.exists ? distSnap.data() as any : {};
        const distributorName = distData.companyName || distData.name || 'Your distributor';
        const order = hydrateTimestamps(orderData, [
          'createdAt', 'updatedAt', 'paidAt', 'shippedAt', 'approvedAt',
          'paymentLinkCreatedAt', 'itemChangesNotifiedAt', 'invoiceEmailedAt',
        ]) as Order;
        await sendOrderPaidConfirmation(order, distributorName, METHOD_LABELS[paymentMethod]);
      } catch (err) {
        console.error('Failed to send payment confirmation email:', err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.status) return authErrorResponse(error);
    console.error('Error in mark-paid route:', error);
    return NextResponse.json({ error: error?.message || 'Failed to mark order as paid.' }, { status: 500 });
  }
}
