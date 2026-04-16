import { stripe } from '@/lib/stripe';
import { getPlatformFeeRate } from '@/lib/stripe-helpers';

// Items that should appear on the Stripe session — mirrors getInvoiceActiveItems
// and order-service.updateOrderItemStatuses so the customer pays for exactly what
// the invoice lists.
function getBillableItems(order: any) {
  return (order.items || []).filter((item: any) => {
    const status = item.itemStatus || 'available';
    return status === 'available' || status === 'back_order';
  });
}

export interface CreatePaymentSessionResult {
  sessionId: string;
  sessionUrl: string;
  expiresAt: number; // unix seconds
  platformFeeAmount: number; // cents
  appliedFeePercentage: number; // e.g. 0.04 for 4% — persisted on order so admin revenue reporting can reconstruct the rate even if tiers change later
  expiredPreviousSessionId?: string; // id of the session we expired, if any
}

/**
 * Creates a fresh Checkout Session for an order. Expires any existing open
 * session first so the customer can't pay via a stale link. Uses only
 * currently-active items (not_available / out_of_stock are excluded).
 *
 * Returns session info so callers can persist it onto the order doc.
 * Does NOT write to Firestore — caller decides what to store and when to email.
 */
export async function createPaymentSessionForOrder(params: {
  order: any; // admin-Firestore shape (timestamps as Timestamp, items as array)
  orderId: string;
  distributor: any; // admin-Firestore shape
  siteUrl: string;
}): Promise<CreatePaymentSessionResult> {
  const { order, orderId, distributor, siteUrl } = params;

  if (!distributor.stripeAccountId || distributor.stripeAccountStatus !== 'verified') {
    throw Object.assign(new Error('Stripe account not configured.'), { status: 400 });
  }
  if (distributor.stripeCheckoutDisabled === true) {
    throw Object.assign(
      new Error('This distributor has disabled Stripe checkout. Use the invoice-only approval flow instead.'),
      { status: 400 }
    );
  }

  // Expire the previous session (if any) so both links aren't clickable at the same time
  let expiredPreviousSessionId: string | undefined;
  if (order.stripeCheckoutSessionId) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(order.stripeCheckoutSessionId);
      if (existing.status === 'open') {
        await stripe.checkout.sessions.expire(order.stripeCheckoutSessionId);
        expiredPreviousSessionId = order.stripeCheckoutSessionId;
      }
    } catch (err) {
      // If retrieve fails (e.g. session already deleted or wrong account), just continue —
      // we still want to be able to create a new session.
      console.warn('[stripe-order-session] Failed to expire previous session:', (err as Error).message);
    }
  }

  const activeItems = getBillableItems(order);
  if (activeItems.length === 0) {
    throw Object.assign(new Error('Order has no billable items to charge.'), { status: 400 });
  }

  // Tax configuration
  const taxMode = distributor.taxMode || 'none';
  const taxBehavior = distributor.taxBehavior || 'inclusive';

  // Platform fee: prefer the stored value from original creation (so regenerate
  // doesn't accidentally change the fee). Uses typeof === 'number' rather than
  // truthy checks so a legitimate 0% custom override (superadmin-set, valid
  // per customPlatformFeePercent range 0.0–6) isn't treated as "unset" and
  // silently replaced with the tier default on regenerate.
  let platformFeeAmount: number;
  let appliedFeePercentage: number;
  const hasStoredFee =
    typeof order.platformFeeAmount === 'number' &&
    typeof order.appliedFeePercentage === 'number';
  if (hasStoredFee) {
    platformFeeAmount = order.platformFeeAmount;
    appliedFeePercentage = order.appliedFeePercentage;
  } else {
    const feeRate = await getPlatformFeeRate(order.distributorId);
    const itemSubtotal = activeItems.reduce(
      (sum: number, item: any) => sum + (item.priceAtTimeOfOrder || 0) * (item.quantity || 1),
      0
    );
    platformFeeAmount = typeof order.platformFeeAmount === 'number'
      ? order.platformFeeAmount
      : Math.round(itemSubtotal * 100 * feeRate);
    appliedFeePercentage = feeRate;
  }

  const expiresAt = Math.floor(Date.now() / 1000) + 86400;

  // Build product line items, then append a shipping line item when the order
  // has a shipping fee. Previously shipping was only reflected in the stored
  // order.totalAmount but was NOT part of the Stripe session — Stripe only
  // charged the product subtotal, and the webhook's amount-mismatch check
  // would flag the paid order as on_hold. Including shipping here makes the
  // Stripe charge match what the invoice/email promise.
  const productLineItems = activeItems.map((item: any) => ({
    price_data: {
      currency: 'eur' as const,
      product_data: {
        name: `${item.artist} \u2013 ${item.title}`,
        ...(taxMode === 'stripe_tax' && {
          tax_code: distributor.defaultTaxCode || 'txcd_99999999',
        }),
      },
      unit_amount: Math.round((item.priceAtTimeOfOrder || 0) * 100),
      ...(taxMode !== 'none' && { tax_behavior: taxBehavior as 'inclusive' | 'exclusive' }),
    },
    quantity: item.quantity || 1,
  }));

  const shippingCost: number = order.shippingCost || 0;
  const shippingLineItems = shippingCost > 0 ? [{
    price_data: {
      currency: 'eur' as const,
      product_data: {
        name: `Shipping${order.shippingZoneName ? ` (${order.shippingZoneName})` : ''}`,
        // Stripe Tax has a dedicated code for shipping so it uses the
        // jurisdictionally-correct rate instead of the product rate.
        ...(taxMode === 'stripe_tax' && { tax_code: 'txcd_92010001' }),
      },
      unit_amount: Math.round(shippingCost * 100),
      ...(taxMode !== 'none' && { tax_behavior: taxBehavior as 'inclusive' | 'exclusive' }),
    },
    quantity: 1,
  }] : [];

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    expires_at: expiresAt,
    line_items: [...productLineItems, ...shippingLineItems],
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

  if (!session.url) {
    throw new Error('Stripe did not return a session URL.');
  }

  return {
    sessionId: session.id,
    sessionUrl: session.url,
    expiresAt,
    platformFeeAmount,
    appliedFeePercentage,
    expiredPreviousSessionId,
  };
}
