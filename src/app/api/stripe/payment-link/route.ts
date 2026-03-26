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

    // Calculate platform fee (4%)
    const totalAmountCents = Math.round((order.totalAmount || 0) * 100);
    const platformFeeAmount = Math.round(totalAmountCents * 0.04);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vinylogix.com';

    // Create Stripe Checkout Session for this order
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: (order.items || []).map((item: any) => ({
        price_data: {
          currency: 'eur',
          product_data: {
            name: `${item.artist} – ${item.title}`,
          },
          unit_amount: Math.round((item.priceAtTimeOfOrder || 0) * 100),
        },
        quantity: item.quantity || 1,
      })),
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
      stripeCheckoutSessionId: session.id,
      platformFeeAmount,
    });

    return NextResponse.json({ paymentLink: session.url });
  } catch (error: any) {
    if (error.status) return authErrorResponse(error);
    console.error('Payment link generation error:', error);
    return NextResponse.json({ error: 'Failed to generate payment link.' }, { status: 500 });
  }
}
