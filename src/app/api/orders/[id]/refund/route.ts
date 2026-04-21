import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { authErrorResponse } from '@/lib/auth-helpers';
import { rateLimit } from '@/lib/rate-limit';
import { requireOrderAccess } from '@/lib/order-access';

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

    const { caller, orderData, orderRef } = await requireOrderAccess(req, orderId);

    if (orderData.paymentStatus !== 'paid' && orderData.paymentStatus !== 'partially_refunded') {
      return NextResponse.json(
        { error: 'Only paid (or partially refunded) orders can be refunded.' },
        { status: 400 }
      );
    }

    const existing: any[] = Array.isArray(orderData.refunds) ? orderData.refunds : [];
    const alreadyRefunded = existing.reduce((sum, r) => sum + (r.amount || 0), 0);
    const remaining = orderData.totalAmount - alreadyRefunded;

    // Allow a small rounding tolerance (1 cent)
    if (amount > remaining + 0.01) {
      return NextResponse.json(
        { error: `Refund exceeds remaining balance. Maximum refundable: €${remaining.toFixed(2)}.` },
        { status: 400 }
      );
    }

    const newRefund = {
      id: crypto.randomBytes(8).toString('hex'),
      amount: Math.round(amount * 100) / 100,
      reason: reason?.trim().slice(0, 500) || undefined,
      method: method || orderData.paymentMethod || 'other',
      refundedAt: new Date().toISOString(),
      refundedBy: caller.uid,
      notes: notes?.trim().slice(0, 1000) || undefined,
    };

    const totalRefunded = alreadyRefunded + newRefund.amount;
    const isFullyRefunded = Math.abs(totalRefunded - orderData.totalAmount) < 0.01;

    await orderRef.update({
      refunds: FieldValue.arrayUnion(newRefund),
      paymentStatus: isFullyRefunded ? 'refunded' : 'partially_refunded',
      updatedAt: Timestamp.now(),
    });

    return NextResponse.json({
      success: true,
      refund: newRefund,
      totalRefunded,
      paymentStatus: isFullyRefunded ? 'refunded' : 'partially_refunded',
    });
  } catch (error: any) {
    if (error?.status) return authErrorResponse(error);
    console.error('Error in refund route:', error);
    return NextResponse.json({ error: error?.message || 'Failed to record refund.' }, { status: 500 });
  }
}
