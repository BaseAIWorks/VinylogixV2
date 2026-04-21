'use server';

import type { Order, OrderStatus, OrderItem } from '@/types';
import { getAdminDb } from '@/lib/firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { generateTrackingToken } from '@/lib/tracking-token';

const ORDERS_COLLECTION = 'orders';
const RECORDS_COLLECTION = 'vinylRecords';

// Same rationale as record-service.coalesceByRecordId — each admin-SDK stock
// op runs a transaction per recordId. If the same record appears twice in an
// items list the separate transactions would race and double-count.
function coalesceByRecordId<T extends { recordId: string; quantity: number; title?: string }>(items: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of items) {
    if (!item.recordId || !item.quantity || item.quantity <= 0) continue;
    const existing = byId.get(item.recordId);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      byId.set(item.recordId, { ...item });
    }
  }
  return Array.from(byId.values());
}

/**
 * Admin-SDK atomic stock operations. Mirrors the client-side transactional
 * helpers in record-service.ts but uses firebase-admin runTransaction so it
 * works inside webhooks and server actions.
 */
async function reserveStockAdmin(
  items: Array<{ recordId: string; title?: string; quantity: number }>,
  distributorId: string
): Promise<void> {
  const adminDb = getAdminDb();
  if (!adminDb) throw new Error('Admin DB not initialized.');
  const unique = coalesceByRecordId(items);
  for (const item of unique) {
    const ref = adminDb.collection(RECORDS_COLLECTION).doc(item.recordId);
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        throw new Error(`Record "${item.title || item.recordId}" not found.`);
      }
      const data = snap.data()!;
      if (data.distributorId !== distributorId) {
        throw new Error(`Record "${item.title || item.recordId}" does not belong to this distributor.`);
      }
      const total = (data.stock_shelves || 0) + (data.stock_storage || 0);
      const currentReserved = data.reserved || 0;
      const availableForReservation = total - currentReserved;
      if (availableForReservation < item.quantity) {
        throw new Error(`Insufficient stock for "${data.title || item.title}". Available: ${availableForReservation}, requested: ${item.quantity}.`);
      }
      tx.update(ref, { reserved: currentReserved + item.quantity });
    });
  }
}

async function releaseStockAdmin(items: Array<{ recordId: string; quantity: number }>): Promise<void> {
  const adminDb = getAdminDb();
  if (!adminDb) return;
  const unique = coalesceByRecordId(items);
  for (const item of unique) {
    const ref = adminDb.collection(RECORDS_COLLECTION).doc(item.recordId);
    try {
      await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return;
        const data = snap.data()!;
        const next = Math.max(0, (data.reserved || 0) - item.quantity);
        tx.update(ref, { reserved: next });
      });
    } catch (err) {
      console.warn(`[reserve-release-admin] Failed for record ${item.recordId}:`, err);
    }
  }
}

async function deductReservedStockAdmin(items: Array<{ recordId: string; quantity: number }>): Promise<void> {
  const adminDb = getAdminDb();
  if (!adminDb) return;
  const unique = coalesceByRecordId(items);
  for (const item of unique) {
    const ref = adminDb.collection(RECORDS_COLLECTION).doc(item.recordId);
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const data = snap.data()!;
      let qty = item.quantity;
      let shelf = data.stock_shelves || 0;
      let storage = data.stock_storage || 0;
      const fromShelves = Math.min(qty, shelf);
      shelf -= fromShelves;
      qty -= fromShelves;
      if (qty > 0) {
        const fromStorage = Math.min(qty, storage);
        storage -= fromStorage;
        qty -= fromStorage;
      }
      if (qty > 0) {
        console.warn(`[deduct-reserved-admin] Physical stock underran for record ${item.recordId} by ${qty}. Needs reconciliation.`);
      }
      const newReserved = Math.max(0, (data.reserved || 0) - item.quantity);
      tx.update(ref, {
        stock_shelves: shelf,
        stock_storage: storage,
        reserved: newReserved,
      });
    });
  }
}

async function deductStockAdmin(items: Array<{ recordId: string; quantity: number; title?: string }>): Promise<void> {
  const adminDb = getAdminDb();
  if (!adminDb) return;
  const unique = coalesceByRecordId(items);
  for (const item of unique) {
    const ref = adminDb.collection(RECORDS_COLLECTION).doc(item.recordId);
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const data = snap.data()!;
      const total = (data.stock_shelves || 0) + (data.stock_storage || 0);
      if (total < item.quantity) {
        console.warn(`[deduct-stock-admin] Insufficient stock for "${data.title || item.title}". Available: ${total}, requested: ${item.quantity}. Clamping.`);
      }
      let qty = item.quantity;
      let shelf = data.stock_shelves || 0;
      let storage = data.stock_storage || 0;
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
      });
    });
  }
}

const processOrderTimestampsServer = (orderData: any): Order => {
  const processed = { ...orderData };
  const tsFields = [
    'createdAt',
    'updatedAt',
    'paidAt',
    'approvedAt',
    'shippedAt',
    'itemChangesNotifiedAt',
    'invoiceEmailedAt',
    'paymentLinkCreatedAt',
  ] as const;
  for (const field of tsFields) {
    if (processed[field] && processed[field] instanceof Timestamp) {
      processed[field] = processed[field].toDate().toISOString();
    }
  }
  if (processed.paymentAmountMismatch && typeof processed.paymentAmountMismatch === 'object') {
    const m = { ...processed.paymentAmountMismatch };
    if (m.detectedAt && m.detectedAt instanceof Timestamp) {
      m.detectedAt = m.detectedAt.toDate().toISOString();
    }
    processed.paymentAmountMismatch = m;
  }
  return processed as Order;
};

export async function createOrderFromCheckout(session: Stripe.Checkout.Session): Promise<Order> {
  const adminDb = getAdminDb();
  if (!adminDb) {
    throw new Error("Admin DB not initialized on server.");
  }

  const distributorId = session.metadata?.distributorId;
  if (!distributorId) {
    throw new Error("No distributorId found in checkout session metadata");
  }

  // Get distributor and atomically increment order counter via transaction
  const distributorDocRef = adminDb.collection('distributors').doc(distributorId);

  const { distributor, orderNumber } = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(distributorDocRef);
    if (!snap.exists) {
      throw new Error(`Distributor with ID ${distributorId} not found`);
    }
    const dist = snap.data()!;
    const prefix = dist.orderIdPrefix || 'ORD';
    const cnt = (dist.orderCounter || 0) + 1;
    tx.update(distributorDocRef, { orderCounter: cnt });
    return { distributor: dist, orderNumber: `${prefix}-${cnt.toString().padStart(5, '0')}` };
  });

  // Line items are NOT included in webhook events by default
  // We need to retrieve them from Stripe
  let lineItems: Stripe.LineItem[] = [];

  if (session.line_items?.data && session.line_items.data.length > 0) {
    // Line items already expanded (unlikely in webhook)
    lineItems = session.line_items.data;
  } else {
    // Fetch line items from Stripe
    try {
      const lineItemsResponse = await stripe.checkout.sessions.listLineItems(session.id, {
        limit: 100,
      });
      lineItems = lineItemsResponse.data;
    } catch (error) {
      console.error('Failed to retrieve line items from Stripe:', error);
    }
  }

  // Parse cart items from metadata if available (contains record IDs, artists, cover URLs)
  let cartItemsMetadata: Array<{ id: string; artist: string; cover_url?: string; qty: number }> = [];
  try {
    if (session.metadata?.cartItems) {
      cartItemsMetadata = JSON.parse(session.metadata.cartItems);
    }
  } catch (e) {
    console.warn('Failed to parse cartItems metadata:', e);
  }

  // Convert Stripe line items to order items, enriching with metadata
  const orderItems: OrderItem[] = lineItems.map((item, index) => {
    const metaItem = cartItemsMetadata[index];
    return {
      recordId: metaItem?.id || item.price?.product as string || 'unknown',
      title: item.description || 'Unknown Record',
      artist: metaItem?.artist || 'Unknown Artist',
      cover_url: metaItem?.cover_url,
      priceAtTimeOfOrder: (item.price?.unit_amount || 0) / 100,
      quantity: item.quantity || metaItem?.qty || 1,
    };
  });

  const now = new Date();
  const totalAmount = (session.amount_total || 0) / 100; // Convert from cents
  const platformFeeAmount = parseInt(session.metadata?.platformFeeAmount || '0', 10);

  // Extract customer details - prefer metadata (from our app) over Stripe session data
  const customerEmail = session.customer_details?.email || session.customer_email || 'N/A';
  const customerName = session.metadata?.customerName || session.customer_details?.name || customerEmail;

  // Use shipping address from our metadata (formatted by our app) or fall back to Stripe's address
  let shippingAddress = session.metadata?.shippingAddress;
  if (!shippingAddress || shippingAddress === '') {
    shippingAddress = session.customer_details?.address
      ? [
          session.customer_details.address.line1,
          session.customer_details.address.line2,
          `${session.customer_details.address.postal_code || ''} ${session.customer_details.address.city || ''}`.trim(),
          session.customer_details.address.country,
        ].filter(Boolean).join('\n')
      : 'No shipping address provided';
  }

  const billingAddress = session.metadata?.billingAddress || shippingAddress;
  const viewerId = session.metadata?.userId || 'unknown';

  // Fetch client user document for business details (VAT, EORI, CRN, company)
  let clientUser: any = null;
  if (viewerId !== 'unknown') {
    try {
      const userSnap = await adminDb.collection('users').doc(viewerId).get();
      if (userSnap.exists) {
        clientUser = userSnap.data();
      }
    } catch (err) {
      console.warn('Could not fetch client user for order enrichment:', err);
    }
  }

  const newOrderData: any = {
    trackingToken: generateTrackingToken(),
    distributorId,
    viewerId,
    viewerEmail: customerEmail,
    customerName,
    shippingAddress,
    billingAddress,
    items: orderItems,
    status: 'paid' as OrderStatus, // Payment already completed
    totalAmount,
    totalWeight: 0, // Not available from Stripe session
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
    orderNumber,

    // Payment fields
    paymentStatus: 'paid' as const,
    paymentMethod: 'stripe' as const,
    stripePaymentIntentId: session.payment_intent as string,
    stripeCheckoutSessionId: session.id,
    paidAt: Timestamp.fromDate(now),
    platformFeeAmount,
    stockState: 'deducted' as const,
  };

  // Add phone number if available
  if (session.customer_details?.phone) {
    newOrderData.phoneNumber = session.customer_details.phone;
  } else if (clientUser?.phoneNumber) {
    newOrderData.phoneNumber = clientUser.phoneNumber;
  }

  // Add shipping data from session metadata
  const metaShippingCost = parseFloat(session.metadata?.shippingCost || '0');
  if (metaShippingCost > 0 || session.metadata?.freeShippingApplied === 'true' || session.metadata?.shippingMethod === 'pickup') {
    newOrderData.shippingCost = metaShippingCost;
    newOrderData.shippingZoneName = session.metadata?.shippingZoneName || null;
    newOrderData.shippingMethod = session.metadata?.shippingMethod || 'shipping';
    newOrderData.freeShippingApplied = session.metadata?.freeShippingApplied === 'true';
  }

  // Add client business details from user profile
  if (clientUser?.companyName) newOrderData.customerCompanyName = clientUser.companyName;
  if (clientUser?.vatNumber) newOrderData.customerVatNumber = clientUser.vatNumber;
  if (clientUser?.eoriNumber) newOrderData.customerEoriNumber = clientUser.eoriNumber;
  if (clientUser?.chamberOfCommerce) newOrderData.customerChamberOfCommerce = clientUser.chamberOfCommerce;

  // Extract tax data from Stripe session (if Stripe Tax or manual tax was applied)
  try {
    if (session.total_details?.amount_tax && session.total_details.amount_tax > 0) {
      newOrderData.taxAmount = session.total_details.amount_tax / 100;
      newOrderData.subtotalAmount = (session.amount_subtotal || 0) / 100;
      newOrderData.taxInclusive = (distributor.taxBehavior || 'inclusive') === 'inclusive';
      newOrderData.taxLabel = distributor.manualTaxLabel || 'VAT';

      // Retrieve tax breakdown from Stripe for rate details
      try {
        const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ['total_details.breakdown'],
        });
        if (fullSession.total_details?.breakdown?.taxes?.length) {
          newOrderData.taxBreakdown = fullSession.total_details.breakdown.taxes.map((t: any) => ({
            rate: t.rate?.percentage || 0,
            amount: (t.amount || 0) / 100,
            jurisdiction: t.rate?.jurisdiction || t.rate?.country || '',
          }));
          // Set taxRate from first (or only) tax rate
          newOrderData.taxRate = newOrderData.taxBreakdown[0].rate;
        }
      } catch (breakdownErr) {
        console.warn('Could not retrieve Stripe tax breakdown:', breakdownErr);
      }
    } else if (distributor.taxMode === 'manual' && distributor.manualTaxRate) {
      // Manual tax: calculate from total
      const { calculateTax, isReverseChargeApplicable } = await import('@/lib/tax-utils');
      // Legal reverse charge only applies when the customer's VAT number is
      // VIES-verified — mere presence of a VAT number is not enough to shift
      // the liability to the buyer.
      const reverseCharge = isReverseChargeApplicable(
        clientUser?.vatNumber, clientUser?.country, distributor.country,
        { validated: clientUser?.vatValidated === true, requireValidated: true }
      );
      const taxResult = calculateTax(totalAmount, distributor.manualTaxRate, distributor.taxBehavior || 'inclusive', reverseCharge);
      newOrderData.subtotalAmount = taxResult.subtotal;
      newOrderData.taxAmount = taxResult.taxAmount;
      newOrderData.taxRate = taxResult.taxRate;
      newOrderData.taxInclusive = (distributor.taxBehavior || 'inclusive') === 'inclusive';
      newOrderData.taxLabel = distributor.manualTaxLabel || 'VAT';
      newOrderData.isReverseCharge = taxResult.isReverseCharge;
      // Note: for Stripe checkout flow, do NOT adjust totalAmount here.
      // Stripe has already charged the customer. Tax data is for invoice display only.
    }
  } catch (taxError) {
    console.warn('Could not calculate tax for order:', taxError);
  }

  // Create the order
  const orderDocRef = await adminDb.collection(ORDERS_COLLECTION).add(newOrderData);

  // Deduct stock directly (no prior reservation because storefront Stripe
  // checkout creates the order only after payment succeeds). Atomic per record.
  try {
    await deductStockAdmin(orderItems.map(i => ({
      recordId: i.recordId,
      quantity: i.quantity,
      title: i.title,
    })));
  } catch (stockError) {
    console.error(`[createOrderFromCheckout] Failed to deduct stock for order ${orderDocRef.id}:`, stockError);
  }

  // Counter already updated in transaction above

  // Create notification for new order
  const notificationData = {
    distributorId,
    type: 'new_order' as const,
    message: `New paid order received from ${customerEmail}.`,
    orderId: orderDocRef.id,
    orderTotal: totalAmount,
    customerEmail,
    createdAt: Timestamp.fromDate(now),
    isRead: false,
  };
  await adminDb.collection('notifications').add(notificationData);

  // Fetch and return the created order
  const newDocSnap = await orderDocRef.get();
  const order = processOrderTimestampsServer({ ...newDocSnap.data(), id: orderDocRef.id });

  // Send email notifications (non-blocking)
  try {
    const { sendOrderConfirmation, sendNewOrderNotification } = await import('./email-service');

    // Send to client
    sendOrderConfirmation(order).catch(err =>
      console.error('Failed to send order confirmation email:', err)
    );

    // Send to distributor
    if (distributor?.contactEmail) {
      sendNewOrderNotification(order, distributor.contactEmail).catch(err =>
        console.error('Failed to send new order notification:', err)
      );
    }
  } catch (error) {
    console.error('Failed to import email service:', error);
  }

  return order;
}

/**
 * Create an order from a PayPal payment
 * Called after capturing a PayPal order
 */
export async function createOrderFromPayPal(params: {
  pendingOrderId: string;
  paypalOrderId: string;
  paypalCaptureId: string;
  payerEmail: string;
  payerName: string;
}): Promise<Order> {
  const adminDb = getAdminDb();
  if (!adminDb) {
    throw new Error("Admin DB not initialized on server.");
  }

  const { pendingOrderId, paypalOrderId, paypalCaptureId, payerEmail, payerName } = params;

  // Get the pending order data
  const pendingOrderRef = adminDb.collection('pendingOrders').doc(pendingOrderId);
  const pendingOrderSnap = await pendingOrderRef.get();

  if (!pendingOrderSnap.exists) {
    throw new Error(`Pending order ${pendingOrderId} not found`);
  }

  const pendingData = pendingOrderSnap.data() as any;
  const distributorId = pendingData.distributorId;

  // Get distributor and atomically increment order counter via transaction
  const distributorDocRef = adminDb.collection('distributors').doc(distributorId);

  const { distributor: paypalDistributor, orderNumber: paypalOrderNumber } = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(distributorDocRef);
    if (!snap.exists) {
      throw new Error(`Distributor with ID ${distributorId} not found`);
    }
    const dist = snap.data()!;
    const prefix = dist.orderIdPrefix || 'ORD';
    const cnt = (dist.orderCounter || 0) + 1;
    tx.update(distributorDocRef, { orderCounter: cnt });
    return { distributor: dist, orderNumber: `${prefix}-${cnt.toString().padStart(5, '0')}` };
  });

  const now = new Date();

  // Fetch client user document for business details
  const paypalViewerId = pendingData.viewerId || 'unknown';
  let paypalClientUser: any = null;
  if (paypalViewerId !== 'unknown') {
    try {
      const userSnap = await adminDb.collection('users').doc(paypalViewerId).get();
      if (userSnap.exists) {
        paypalClientUser = userSnap.data();
      }
    } catch (err) {
      console.warn('Could not fetch client user for PayPal order enrichment:', err);
    }
  }

  const newOrderData: any = {
    trackingToken: generateTrackingToken(),
    distributorId,
    viewerId: paypalViewerId,
    viewerEmail: pendingData.viewerEmail || payerEmail,
    customerName: pendingData.customerName || payerName,
    shippingAddress: pendingData.shippingAddress || 'No shipping address provided',
    billingAddress: pendingData.billingAddress || pendingData.shippingAddress || 'No shipping address provided',
    phoneNumber: pendingData.phoneNumber,
    items: pendingData.items,
    status: 'paid' as OrderStatus,
    totalAmount: pendingData.totalAmount,
    totalWeight: pendingData.totalWeight || 0,
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
    orderNumber: paypalOrderNumber,

    // Payment fields
    paymentMethod: 'paypal' as const,
    paymentStatus: 'paid' as const,
    paypalOrderId,
    paypalCaptureId,
    paidAt: Timestamp.fromDate(now),
    platformFeeAmount: pendingData.platformFeeAmount,
  };

  // Add client business details from user profile
  if (paypalClientUser?.companyName) newOrderData.customerCompanyName = paypalClientUser.companyName;
  if (paypalClientUser?.vatNumber) newOrderData.customerVatNumber = paypalClientUser.vatNumber;
  if (paypalClientUser?.eoriNumber) newOrderData.customerEoriNumber = paypalClientUser.eoriNumber;
  if (paypalClientUser?.chamberOfCommerce) newOrderData.customerChamberOfCommerce = paypalClientUser.chamberOfCommerce;

  // Create the order
  const orderDocRef = await adminDb.collection(ORDERS_COLLECTION).add(newOrderData);

  // Counter already updated in transaction above

  // Delete the pending order
  await pendingOrderRef.delete();

  // Create notification for new order
  const notificationData = {
    distributorId,
    type: 'new_order' as const,
    message: `New paid order received via PayPal from ${newOrderData.viewerEmail}.`,
    orderId: orderDocRef.id,
    orderTotal: newOrderData.totalAmount,
    customerEmail: newOrderData.viewerEmail,
    createdAt: Timestamp.fromDate(now),
    isRead: false,
  };
  await adminDb.collection('notifications').add(notificationData);

  // Fetch and return the created order
  const newDocSnap = await orderDocRef.get();
  const order = processOrderTimestampsServer({ ...newDocSnap.data(), id: orderDocRef.id });

  // Send email notifications (non-blocking)
  try {
    const { sendOrderConfirmation, sendNewOrderNotification } = await import('./email-service');

    // Send to client
    sendOrderConfirmation(order).catch(err =>
      console.error('Failed to send order confirmation email:', err)
    );

    // Send to distributor
    if (paypalDistributor?.contactEmail) {
      sendNewOrderNotification(order, paypalDistributor.contactEmail).catch(err =>
        console.error('Failed to send new order notification:', err)
      );
    }
  } catch (error) {
    console.error('Failed to import email service:', error);
  }

  return order;
}

export async function updateOrderPaymentStatus(
  orderId: string,
  paymentStatus: 'paid' | 'failed' | 'refunded',
  paymentIntentId?: string
): Promise<Order | null> {
  const adminDb = getAdminDb();
  if (!adminDb) {
    throw new Error("Admin DB not initialized on server.");
  }

  const orderDocRef = adminDb.collection(ORDERS_COLLECTION).doc(orderId);

  try {
    // Idempotency: check current status before updating
    const currentSnap = await orderDocRef.get();
    if (!currentSnap.exists) return null;
    const currentData = currentSnap.data()!;

    // If already paid, don't update again (prevents double stock deduction)
    if (currentData.paymentStatus === 'paid' && paymentStatus === 'paid') {
      console.log(`Order ${orderId} already paid, skipping update.`);
      return processOrderTimestampsServer({ ...currentData, id: orderId });
    }

    const updateData: any = {
      paymentStatus,
      updatedAt: Timestamp.fromDate(new Date()),
    };

    if (paymentIntentId) {
      updateData.stripePaymentIntentId = paymentIntentId;
    }

    if (paymentStatus === 'paid') {
      updateData.paidAt = Timestamp.fromDate(new Date());
      updateData.status = 'paid';
      updateData.paymentMethod = 'stripe';
    } else if (paymentStatus === 'failed') {
      updateData.status = 'cancelled';
    }

    await orderDocRef.update(updateData);

    // Deduct stock for paid orders. If the order had an active reservation
    // (awaiting_payment after a Request Order approval), convert it; otherwise
    // fall back to a direct atomic deduct.
    if (paymentStatus === 'paid' && currentData.items?.length > 0) {
      try {
        const stockState = currentData.stockState || 'none';
        if (stockState === 'reserved') {
          await deductReservedStockAdmin(currentData.items as any);
        } else if (stockState !== 'deducted') {
          await deductStockAdmin(currentData.items as any);
        }
        updateData.stockState = 'deducted';
      } catch (stockError) {
        console.error(`Failed to deduct stock for order ${orderId}:`, stockError);
      }
    }
    // A failed payment releases any held reservation so the stock returns.
    if (paymentStatus === 'failed' && currentData.items?.length > 0) {
      try {
        if ((currentData.stockState || 'none') === 'reserved') {
          await releaseStockAdmin(currentData.items as any);
          updateData.stockState = 'none';
        }
      } catch (stockError) {
        console.error(`Failed to release reservation for failed order ${orderId}:`, stockError);
      }
    }
    // Refund on a paid order restores physical stock.
    if (paymentStatus === 'refunded' && currentData.items?.length > 0) {
      try {
        if ((currentData.stockState || 'none') === 'deducted') {
          for (const item of currentData.items) {
            if (!item.recordId) continue;
            const ref = adminDb.collection(RECORDS_COLLECTION).doc(item.recordId);
            await adminDb.runTransaction(async (tx) => {
              const snap = await tx.get(ref);
              if (!snap.exists) return;
              const d = snap.data()!;
              tx.update(ref, { stock_storage: (d.stock_storage || 0) + (item.quantity || 1) });
            });
          }
          updateData.stockState = 'none';
        }
      } catch (stockError) {
        console.error(`Failed to restore stock for refunded order ${orderId}:`, stockError);
      }
    }

    const updatedDocSnap = await orderDocRef.get();
    if (updatedDocSnap.exists) {
      return processOrderTimestampsServer({ ...updatedDocSnap.data(), id: updatedDocSnap.id });
    }
    return null;
  } catch (error) {
    console.error(`ServerOrderService: Error updating order ${orderId} payment status:`, error);
    throw error;
  }
}

/**
 * Create an order request (awaiting_approval) with atomic counter.
 * Called as a server action from the checkout page.
 */
export async function createOrderRequestServer(params: {
  viewerId: string;
  distributorId: string;
  items: Array<{ recordId: string; title: string; artist: string; cover_url?: string; sellingPrice: number; quantity: number; weight?: number }>;
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  billingAddress?: string;
  phoneNumber?: string;
  customerCompanyName?: string;
  customerVatNumber?: string;
  customerVatValidated?: boolean; // VIES-verified flag from user profile
  customerEoriNumber?: string;
  customerChamberOfCommerce?: string;
  customerCountry?: string;
  shippingMethod?: 'shipping' | 'pickup';
}): Promise<Order> {
  const adminDb = getAdminDb();
  if (!adminDb) throw new Error("Admin DB not initialized.");

  const { distributorId, viewerId } = params;
  const distributorDocRef = adminDb.collection('distributors').doc(distributorId);

  // Atomic order counter via transaction
  const { orderNumber } = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(distributorDocRef);
    if (!snap.exists) throw new Error('Distributor not found.');
    const dist = snap.data()!;
    const prefix = dist.orderIdPrefix || 'ORD';
    const cnt = (dist.orderCounter || 0) + 1;
    tx.update(distributorDocRef, { orderCounter: cnt });
    return { orderNumber: `${prefix}-${cnt.toString().padStart(5, '0')}` };
  });

  const now = new Date();
  const orderItems = params.items.map(item => ({
    recordId: item.recordId,
    title: item.title,
    artist: item.artist,
    cover_url: item.cover_url,
    priceAtTimeOfOrder: item.sellingPrice,
    quantity: item.quantity,
  }));

  const totalAmount = params.items.reduce((sum, i) => sum + i.sellingPrice * i.quantity, 0);
  const totalWeight = params.items.reduce((sum, i) => sum + (i.weight || 0) * i.quantity, 0);

  // Reserve stock atomically BEFORE writing the order. If reservation fails
  // (e.g. another customer just claimed the last copy), we surface the error
  // to the caller without ever creating an order doc or a notification.
  const reservationItems = orderItems.map(i => ({ recordId: i.recordId, title: i.title, quantity: i.quantity }));
  await reserveStockAdmin(reservationItems, distributorId);
  // Track whether we've handed off ownership of the reservation to the created
  // order. Until that point, any error must release the hold so the stock
  // isn't leaked on the records forever.
  let reservationOwned = true;
  const rollbackReservation = async () => {
    if (!reservationOwned) return;
    try {
      await releaseStockAdmin(reservationItems);
      reservationOwned = false;
    } catch (err) {
      console.error('[createOrderRequestServer] Failed to roll back stock reservation:', err);
    }
  };

  const newOrderData: any = {
    trackingToken: generateTrackingToken(),
    distributorId,
    viewerId,
    viewerEmail: params.customerEmail,
    customerName: params.customerName,
    shippingAddress: params.shippingAddress,
    items: orderItems,
    status: 'awaiting_approval',
    paymentMethod: 'pending',
    paymentStatus: 'unpaid',
    stockState: 'reserved',
    totalAmount,
    totalWeight,
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
    orderNumber,
  };

  if (params.billingAddress) newOrderData.billingAddress = params.billingAddress;
  if (params.phoneNumber) newOrderData.phoneNumber = params.phoneNumber;
  if (params.customerCompanyName) newOrderData.customerCompanyName = params.customerCompanyName;
  if (params.customerVatNumber) newOrderData.customerVatNumber = params.customerVatNumber;
  if (params.customerEoriNumber) newOrderData.customerEoriNumber = params.customerEoriNumber;
  if (params.customerChamberOfCommerce) newOrderData.customerChamberOfCommerce = params.customerChamberOfCommerce;

  // Fetch distributor settings for tax + shipping
  const distSnap = await adminDb.collection('distributors').doc(distributorId).get();
  const distData = distSnap.exists ? distSnap.data() : null;

  // Calculate shipping
  if (distData?.shippingConfig?.enabled) {
    try {
      const { calculateShipping } = await import('@/lib/shipping-utils');
      const shippingResult = calculateShipping(
        distData.shippingConfig,
        params.customerCountry,
        totalWeight,
        totalAmount,
        params.shippingMethod || 'shipping'
      );
      if (shippingResult.shippingCost > 0 || shippingResult.freeShippingApplied || shippingResult.method === 'pickup') {
        newOrderData.shippingCost = shippingResult.shippingCost;
        newOrderData.shippingZoneName = shippingResult.zoneName;
        newOrderData.shippingMethod = shippingResult.method;
        newOrderData.freeShippingApplied = shippingResult.freeShippingApplied;
        newOrderData.totalAmount = totalAmount + shippingResult.shippingCost;
      }
    } catch (shipErr) {
      console.warn('Could not calculate shipping for order request:', shipErr);
    }
  }

  // Calculate tax for request orders (manual mode) — tax on product total only
  const productTotal = totalAmount; // Before shipping was added
  if (distData?.taxMode === 'manual' && distData.manualTaxRate) {
    try {
      const { calculateTax, isReverseChargeApplicable } = await import('@/lib/tax-utils');
      // Reverse charge only applies when the customer's VAT number is
      // VIES-verified — unverified numbers cannot legally shift VAT liability.
      const reverseCharge = isReverseChargeApplicable(
        params.customerVatNumber, params.customerCountry, distData.country,
        { validated: params.customerVatValidated === true, requireValidated: true }
      );
      const taxResult = calculateTax(productTotal, distData.manualTaxRate, distData.taxBehavior || 'inclusive', reverseCharge);
      newOrderData.subtotalAmount = taxResult.subtotal;
      newOrderData.taxAmount = taxResult.taxAmount;
      newOrderData.taxRate = taxResult.taxRate;
      newOrderData.taxInclusive = (distData.taxBehavior || 'inclusive') === 'inclusive';
      newOrderData.taxLabel = distData.manualTaxLabel || 'VAT';
      newOrderData.isReverseCharge = taxResult.isReverseCharge;
      // Grand total = tax-adjusted product total + shipping
      // taxResult.total handles all cases: inclusive (unchanged), exclusive (+ tax), reverse charge (- tax)
      newOrderData.totalAmount = taxResult.total + (newOrderData.shippingCost || 0);
    } catch (taxErr) {
      console.warn('Could not calculate tax for order request:', taxErr);
    }
  }

  let orderDocRef: FirebaseFirestore.DocumentReference;
  try {
    orderDocRef = await adminDb.collection(ORDERS_COLLECTION).add(newOrderData);
    // From here on the reservation is owned by the order doc — cancelling the
    // order will release it via the regular order-service flow.
    reservationOwned = false;
  } catch (err) {
    await rollbackReservation();
    throw err;
  }

  // Notification — best-effort; if it fails we don't want to lose the order.
  try {
    await adminDb.collection('notifications').add({
      distributorId,
      type: 'new_order',
      message: `New order request from ${params.customerEmail} awaiting your approval.`,
      orderId: orderDocRef.id,
      orderTotal: totalAmount,
      customerEmail: params.customerEmail,
      createdAt: Timestamp.fromDate(now),
      isRead: false,
    });
  } catch (err) {
    console.error(`[createOrderRequestServer] Notification write failed for order ${orderDocRef.id}:`, err);
  }

  const newDocSnap = await orderDocRef.get();
  const order = processOrderTimestampsServer({ ...newDocSnap.data(), id: orderDocRef.id });

  // Send emails (non-blocking). Fetch the distributor once and pass it to
  // both templates so the client sees distributor branding on their
  // confirmation and the distributor notification is consistent.
  try {
    const { sendOrderRequestConfirmation, sendOrderRequestNotification } = await import('./email-service');
    const distSnap2 = await adminDb.collection('distributors').doc(distributorId).get();
    const distData = distSnap2.exists ? (distSnap2.data() as any) : null;
    const distEmail = distData?.contactEmail;

    sendOrderRequestConfirmation(order, distData).catch(err =>
      console.error('Failed to send order request confirmation:', err)
    );

    if (distEmail) {
      sendOrderRequestNotification(order, distEmail, distData).catch(err =>
        console.error('Failed to send order request notification:', err)
      );
    }
  } catch (err) {
    console.error('Failed to import email service:', err);
  }

  return order;
}
