import { stripe } from '@/lib/stripe';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse } from '@/lib/auth-helpers';
import { getAdminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const caller = await requireAuth(req);

    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required.' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Service unavailable.' }, { status: 500 });
    }

    // Fetch order
    const orderSnap = await adminDb.collection('orders').doc(orderId).get();
    if (!orderSnap.exists) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }
    const order = orderSnap.data()!;

    // Only generate payment links for orders awaiting payment
    if (order.status !== 'awaiting_payment' && order.status !== 'awaiting_approval') {
      return NextResponse.json({ error: 'Order is not eligible for a payment link.' }, { status: 400 });
    }
    if (order.paymentStatus === 'paid') {
      return NextResponse.json({ error: 'Order is already paid.' }, { status: 400 });
    }

    // Verify caller is operator of this distributor
    const userSnap = await adminDb.collection('users').doc(caller.uid).get();
    const userData = userSnap.data();
    if (!userData || (userData.role !== 'master' && userData.role !== 'superadmin') || (userData.role === 'master' && userData.distributorId !== order.distributorId)) {
      return NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 });
    }

    // Get distributor for Stripe account
    const distSnap = await adminDb.collection('distributors').doc(order.distributorId).get();
    if (!distSnap.exists) {
      return NextResponse.json({ error: 'Distributor not found.' }, { status: 404 });
    }
    const distributor = distSnap.data()!;

    if (!distributor.stripeAccountId || distributor.stripeAccountStatus !== 'verified') {
      return NextResponse.json({ error: 'Stripe account not configured.' }, { status: 400 });
    }

    // Tax configuration from distributor
    const taxMode = distributor.taxMode || 'none';
    const taxBehavior = distributor.taxBehavior || 'inclusive';

    // Use stored fee from order creation, or calculate based on distributor's tier
    let platformFeeAmount: number;
    if (order.platformFeeAmount) {
      platformFeeAmount = order.platformFeeAmount;
    } else {
      const { getPlatformFeeRate } = await import('@/lib/stripe-helpers');
      const feeRate = await getPlatformFeeRate(order.distributorId);
      const itemSubtotal = (order.items || []).reduce((sum: number, item: any) =>
        sum + (item.priceAtTimeOfOrder || 0) * (item.quantity || 1), 0);
      platformFeeAmount = Math.round(itemSubtotal * 100 * feeRate);
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vinylogix.com';
    const expiresAt = Math.floor(Date.now() / 1000) + 86400;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      expires_at: expiresAt,
      line_items: (order.items || []).map((item: any) => ({
        price_data: {
          currency: 'eur',
          product_data: {
            name: `${item.artist} – ${item.title}`,
            ...(taxMode === 'stripe_tax' && {
              tax_code: distributor.defaultTaxCode || 'txcd_99999999',
            }),
          },
          unit_amount: Math.round((item.priceAtTimeOfOrder || 0) * 100),
          ...(taxMode !== 'none' && { tax_behavior: taxBehavior }),
        },
        quantity: item.quantity || 1,
      })),
      ...(taxMode === 'stripe_tax' && distributor.stripeAccountId && {
        automatic_tax: {
          enabled: true,
          liability: { type: 'account' as const, account: distributor.stripeAccountId },
        },
        tax_id_collection: { enabled: true },
      }),
      payment_intent_data: {
        application_fee_amount: platformFeeAmount,
        transfer_data: {
          destination: distributor.stripeAccountId,
        },
      },
      customer_email: order.viewerEmail,
      success_url: `${siteUrl}/my-orders/${orderId}?payment=success`,
      cancel_url: `${siteUrl}/my-orders/${orderId}`,
      metadata: {
        orderId,
        distributorId: order.distributorId,
        isOrderPayment: 'true',
      },
    });

    // Store payment link on the order
    await orderSnap.ref.update({
      paymentLink: session.url,
      paymentLinkExpiresAt: new Date(expiresAt * 1000).toISOString(),
      stripeCheckoutSessionId: session.id,
      platformFeeAmount,
    });

    // Send approval email with payment link to client (non-blocking)
    try {
      const { sendOrderApprovedEmail } = await import('@/services/email-service');
      const orderData = { ...order, id: orderId, orderNumber: order.orderNumber || orderId.slice(0, 8) };
      sendOrderApprovedEmail(orderData as any, session.url!).catch(err =>
        console.error('Failed to send order approved email:', err)
      );
    } catch {}

    return NextResponse.json({ paymentLink: session.url });
  } catch (error: any) {
    if (error.status) return authErrorResponse(error);
    console.error('Payment link generation error:', error);
    return NextResponse.json({ error: 'Failed to generate payment link.' }, { status: 500 });
  }
}
