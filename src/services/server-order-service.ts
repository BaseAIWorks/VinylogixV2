'use server';

import type { Order, OrderStatus, OrderItem } from '@/types';
import { getAdminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import Stripe from 'stripe';

const ORDERS_COLLECTION = 'orders';

const processOrderTimestampsServer = (orderData: any): Order => {
  const processed = { ...orderData };
  if (processed.createdAt instanceof Timestamp) {
    processed.createdAt = processed.createdAt.toDate().toISOString();
  }
  if (processed.updatedAt instanceof Timestamp) {
    processed.updatedAt = processed.updatedAt.toDate().toISOString();
  }
  if (processed.paidAt instanceof Timestamp) {
    processed.paidAt = processed.paidAt.toDate().toISOString();
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

  // Get distributor to increment order counter
  const distributorDocRef = adminDb.collection('distributors').doc(distributorId);
  const distributorSnap = await distributorDocRef.get();

  if (!distributorSnap.exists) {
    throw new Error(`Distributor with ID ${distributorId} not found`);
  }

  const distributor = distributorSnap.data();
  const prefix = distributor?.orderIdPrefix || 'ORD';
  const counter = (distributor?.orderCounter || 0) + 1;
  const orderNumber = `${prefix}-${counter.toString().padStart(5, '0')}`;

  // Get line items from the session
  const lineItems = session.line_items?.data || [];

  // Convert Stripe line items to order items
  const orderItems: OrderItem[] = lineItems.map((item) => ({
    recordId: item.price?.product as string || 'unknown',
    title: item.description || 'Unknown Record',
    artist: 'Unknown Artist',
    cover_url: undefined,
    priceAtTimeOfOrder: (item.price?.unit_amount || 0) / 100,
    quantity: item.quantity || 1,
  }));

  const now = new Date();
  const totalAmount = (session.amount_total || 0) / 100; // Convert from cents
  const platformFeeAmount = parseInt(session.metadata?.platformFeeAmount || '0', 10);

  // Extract customer details from session
  const customerEmail = session.customer_details?.email || session.customer_email || 'N/A';
  const customerName = session.customer_details?.name || customerEmail;

  const shippingAddress = session.customer_details?.address
    ? [
        session.customer_details.address.line1,
        session.customer_details.address.line2,
        `${session.customer_details.address.postal_code || ''} ${session.customer_details.address.city || ''}`.trim(),
        session.customer_details.address.country,
      ].filter(Boolean).join('\n')
    : 'No shipping address provided';

  const newOrderData: any = {
    distributorId,
    viewerId: 'unknown', // We don't have the user ID from Stripe
    viewerEmail: customerEmail,
    customerName,
    shippingAddress,
    items: orderItems,
    status: 'paid' as OrderStatus, // Payment already completed
    totalAmount,
    totalWeight: 0, // Not available from Stripe session
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
    orderNumber,

    // Payment fields
    paymentStatus: 'paid' as const,
    stripePaymentIntentId: session.payment_intent as string,
    stripeCheckoutSessionId: session.id,
    paidAt: Timestamp.fromDate(now),
    platformFeeAmount,
  };

  // Add phone number if available
  if (session.customer_details?.phone) {
    newOrderData.phoneNumber = session.customer_details.phone;
  }

  // Create the order
  const orderDocRef = await adminDb.collection(ORDERS_COLLECTION).add(newOrderData);

  // Update distributor order counter
  await distributorDocRef.update({ orderCounter: counter });

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

  // Get distributor to increment order counter
  const distributorDocRef = adminDb.collection('distributors').doc(distributorId);
  const distributorSnap = await distributorDocRef.get();

  if (!distributorSnap.exists) {
    throw new Error(`Distributor with ID ${distributorId} not found`);
  }

  const distributor = distributorSnap.data();
  const prefix = distributor?.orderIdPrefix || 'ORD';
  const counter = (distributor?.orderCounter || 0) + 1;
  const orderNumber = `${prefix}-${counter.toString().padStart(5, '0')}`;

  const now = new Date();

  const newOrderData: any = {
    distributorId,
    viewerId: pendingData.viewerId || 'unknown',
    viewerEmail: pendingData.viewerEmail || payerEmail,
    customerName: pendingData.customerName || payerName,
    shippingAddress: pendingData.shippingAddress || 'No shipping address provided',
    billingAddress: pendingData.billingAddress,
    phoneNumber: pendingData.phoneNumber,
    items: pendingData.items,
    status: 'paid' as OrderStatus,
    totalAmount: pendingData.totalAmount,
    totalWeight: pendingData.totalWeight || 0,
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
    orderNumber,

    // Payment fields
    paymentMethod: 'paypal' as const,
    paymentStatus: 'paid' as const,
    paypalOrderId,
    paypalCaptureId,
    paidAt: Timestamp.fromDate(now),
    platformFeeAmount: pendingData.platformFeeAmount,
  };

  // Create the order
  const orderDocRef = await adminDb.collection(ORDERS_COLLECTION).add(newOrderData);

  // Update distributor order counter
  await distributorDocRef.update({ orderCounter: counter });

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
    } else if (paymentStatus === 'failed') {
      updateData.status = 'cancelled';
    }

    await orderDocRef.update(updateData);

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
