import { stripe } from '@/lib/stripe';
import { NextRequest, NextResponse } from 'next/server';
import { getDistributorById } from '@/services/server-distributor-service';
import type { CartItem, VinylRecord } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { distributorId, items, customerEmail } = await req.json();

    if (!distributorId || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Distributor ID and items are required.' },
        { status: 400 }
      );
    }

    // Get distributor to verify Stripe account
    const distributor = await getDistributorById(distributorId);

    if (!distributor) {
      return NextResponse.json(
        { error: 'Distributor not found.' },
        { status: 404 }
      );
    }

    if (!distributor.stripeAccountId) {
      return NextResponse.json(
        { error: 'This distributor has not connected their Stripe account yet.' },
        { status: 400 }
      );
    }

    if (distributor.stripeAccountStatus !== 'verified') {
      return NextResponse.json(
        { error: 'This distributor\'s Stripe account is not fully verified yet.' },
        { status: 400 }
      );
    }

    // Calculate totals
    const lineItems = items.map((item: CartItem) => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: `${item.record.artist} - ${item.record.title}`,
          description: item.record.formatDetails || 'Vinyl Record',
          images: item.record.cover_url ? [item.record.cover_url] : [],
        },
        unit_amount: Math.round((item.record.sellingPrice || 0) * 100), // Convert to cents
      },
      quantity: item.quantity,
    }));

    // Calculate total amount for platform fee
    const totalAmount = items.reduce((sum: number, item: CartItem) => {
      return sum + (item.record.sellingPrice || 0) * item.quantity;
    }, 0);

    // Calculate 4% platform fee (in cents)
    const platformFeeAmount = Math.round(totalAmount * 100 * 0.04);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vinylogix.com';

    // Create Stripe Checkout Session with Connect
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      customer_email: customerEmail,
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/checkout?cancelled=true`,
      payment_intent_data: {
        application_fee_amount: platformFeeAmount,
        transfer_data: {
          destination: distributor.stripeAccountId,
        },
      },
      metadata: {
        distributorId,
        platformFeeAmount: platformFeeAmount.toString(),
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Stripe Connect Checkout Error:', error);
    return NextResponse.json(
      { error: `Checkout failed: ${error.message}` },
      { status: 500 }
    );
  }
}
