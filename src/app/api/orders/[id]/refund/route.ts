import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { authErrorResponse } from '@/lib/auth-helpers';
import { rateLimit } from '@/lib/rate-limit';
import { requireOrderAccess } from '@/lib/order-access';

const REFUND_METHODS = new Set(['stripe', 'paypal', 'bank_transfer', 'cash', 'other']);
type RefundMethod = 'stripe' | 'paypal' | 'bank_transfer' | 'cash' | 'other';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimited = rateLimit(req, { limit: 20, windowMs: 60_000, prefix: 'refund' });
  if (rateLimited) return rateLimited;

  try {
    const { id: orderId } = await params;
    const body = await req.json().catch(() => ({}));
    const { amount, reason, method, notes } = body as {
      amount?: number;
      reason?: string;
      method?: RefundMethod;
      notes?: string;
    };

    if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Refund amount must be a positive number.' }, { status: 400 });
    }
    if (method !== undefined && !REFUND_METHODS.has(method)) {
      return NextResponse.json({ error: 'Invalid refund method.' }, { status: 400 });
    }

    const { caller, orderRef, adminDb } = await requireOrderAccess(req, orderId);

    // Transaction: re-read the order inside the tx so a concurrent refund
    // can't slip past the remaining-balance check. Without this, two parallel
    // requests on a €15 order could each see "€0 already refunded" and both
    // approve a €10 refund, over-refunding the customer.
    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists) {
        throw new HttpError('Order not found.', 404);
      }
      const current = snap.data() as any;

      if (current.paymentStatus !== 'paid' && current.paymentStatus !== 'partially_refunded') {
        throw new HttpError('Only paid (or partially refunded) orders can be refunded.', 400);
      }

      const existing: any[] = Array.isArray(current.refunds) ? current.refunds : [];
      const alreadyRefunded = existing.reduce((sum, r) => sum + (r.amount || 0), 0);
      const remaining = current.totalAmount - alreadyRefunded;
      if (amount > remaining + 0.01) {
        throw new HttpError(
          `Refund exceeds remaining balance. Maximum refundable: €${remaining.toFixed(2)}.`,
          400
        );
      }

      const newRefund = {
        id: crypto.randomBytes(8).toString('hex'),
        amount: Math.round(amount * 100) / 100,
        reason: reason?.trim().slice(0, 500) || undefined,
        method: method || current.paymentMethod || 'other',
        refundedAt: new Date().toISOString(),
        refundedBy: caller.uid,
        notes: notes?.trim().slice(0, 1000) || undefined,
      };

      const totalRefunded = alreadyRefunded + newRefund.amount;
      const isFullyRefunded = Math.abs(totalRefunded - current.totalAmount) < 0.01;

      tx.update(orderRef, {
        refunds: [...existing, newRefund],
        paymentStatus: isFullyRefunded ? 'refunded' : 'partially_refunded',
        updatedAt: Timestamp.now(),
      });

      return { newRefund, totalRefunded, isFullyRefunded };
    });

    return NextResponse.json({
      success: true,
      refund: result.newRefund,
      totalRefunded: result.totalRefunded,
      paymentStatus: result.isFullyRefunded ? 'refunded' : 'partially_refunded',
    });
  } catch (error: any) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error?.status) return authErrorResponse(error);
    console.error('Error in refund route:', error);
    return NextResponse.json({ error: error?.message || 'Failed to record refund.' }, { status: 500 });
  }
}

class HttpError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
