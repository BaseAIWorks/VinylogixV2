
"use client";

import type { Order, OrderStatus, OrderItemStatus, User, CartItem, OrderItem } from '@/types';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, limit, Timestamp } from 'firebase/firestore';
import { deductStockForOrder, restoreStockForOrder, getRecordById } from './record-service';
import { getDistributorById, updateDistributor } from './distributor-service';
import { logger } from '@/lib/logger';

const ORDERS_COLLECTION = 'orders';

const processOrderTimestamps = (orderData: any): Order => {
  const processed = { ...orderData };
  if (processed.createdAt && processed.createdAt instanceof Timestamp) {
    processed.createdAt = processed.createdAt.toDate().toISOString();
  }
   if (processed.updatedAt && processed.updatedAt instanceof Timestamp) {
    processed.updatedAt = processed.updatedAt.toDate().toISOString();
  }
  return processed as Order;
};


export async function getOrders(user: User): Promise<Order[]> {
  const targetDistributorId = user.distributorId;
  if (!targetDistributorId) {
      logger.warn("OrderService: User has no distributorId, cannot fetch orders");
      return [];
  }
  const ordersCollectionRef = collection(db, ORDERS_COLLECTION);
  try {
      const q = query(ordersCollectionRef, where("distributorId", "==", targetDistributorId));
      const querySnapshot = await getDocs(q);
      const orders = querySnapshot.docs.map(docSnap => processOrderTimestamps({ ...docSnap.data(), id: docSnap.id }));
      return orders.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch(error) {
      logger.error("OrderService: Error fetching orders", error as Error);
      throw error;
  }
}

export async function getOrdersByDistributorId(distributorId: string): Promise<Order[]> {
    if (!distributorId) {
        logger.warn("OrderService: Distributor ID is missing, cannot fetch orders");
        return [];
    }
    const ordersCollectionRef = collection(db, ORDERS_COLLECTION);
    try {
        const q = query(ordersCollectionRef, where("distributorId", "==", distributorId));
        const querySnapshot = await getDocs(q);
        const orders = querySnapshot.docs.map(docSnap => processOrderTimestamps({ ...docSnap.data(), id: docSnap.id }));
        return orders.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch(error) {
        logger.error(`OrderService: Error fetching orders for distributor ${distributorId}`, error as Error);
        throw error;
    }
}


export async function getOrdersByViewerId(viewerId: string): Promise<Order[]> {
  const ordersCollectionRef = collection(db, ORDERS_COLLECTION);
  try {
    const q = query(ordersCollectionRef, where("viewerId", "==", viewerId));
    const querySnapshot = await getDocs(q);
    const orders = querySnapshot.docs.map(docSnap => processOrderTimestamps({ ...docSnap.data(), id: docSnap.id }));
    return orders.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch(error) {
    logger.error(`OrderService: Error fetching orders for viewer ${viewerId}`, error as Error);
    throw error;
  }
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  const orderDocRef = doc(db, ORDERS_COLLECTION, orderId);
  try {
      const docSnap = await getDoc(orderDocRef);
      if (docSnap.exists()) {
          return processOrderTimestamps({ ...docSnap.data(), id: docSnap.id });
      }
      return null;
  } catch (error) {
      logger.error(`OrderService: Error fetching order ${orderId}`, error as Error);
      throw error;
  }
}


export async function updateOrderStatus(orderId: string, status: OrderStatus, actingUser: User): Promise<Order | null> {
    if (!actingUser.distributorId) throw new Error("User has no distributorId.");

    const orderDocRef = doc(db, ORDERS_COLLECTION, orderId);
    const orderSnap = await getDoc(orderDocRef);

    if (!orderSnap.exists() || orderSnap.data().distributorId !== actingUser.distributorId) {
        throw new Error("Permission Denied or Order not found.");
    }
    
    const orderData = orderSnap.data() as Order;
    const oldStatus = orderData.status;

    // Deduct stock when marking as paid
    if (status === 'paid' && oldStatus !== 'paid') {
        try {
            await deductStockForOrder(orderData.items, orderData.distributorId, actingUser);
        } catch (error) {
            logger.error(`Failed to deduct stock for order ${orderId}`, error as Error);
            // Re-throw the error to prevent status update if stock deduction fails, and show it to the user.
            throw error;
        }
    }

    // Restore stock ONLY if a paid order is cancelled
    if (status === 'cancelled' && oldStatus === 'paid') {
        try {
            await restoreStockForOrder(orderData.items, actingUser);
        } catch (error) {
            logger.error(`Failed to restore stock for cancelled order ${orderId}`, error as Error);
            // Don't re-throw here, as cancelling the order is the primary goal even if stock restoration fails.
        }
    }

    const updatePayload: any = {
        status: status,
        updatedAt: Timestamp.now(),
    };

    // Add shippedAt timestamp when marking as shipped
    if (status === 'shipped' && oldStatus !== 'shipped') {
        updatePayload.shippedAt = Timestamp.now();
    }

    await updateDoc(orderDocRef, updatePayload);

    const updatedSnap = await getDoc(orderDocRef);
    const updatedOrder = processOrderTimestamps({ ...updatedSnap.data(), id: updatedSnap.id });

    // Send shipping notification email if status changed to shipped
    if (status === 'shipped' && oldStatus !== 'shipped') {
        try {
            const { sendShippingNotification } = await import('./email-service');
            sendShippingNotification(updatedOrder).catch(err =>
                logger.error('Failed to send shipping notification', err as Error)
            );
        } catch (error) {
            logger.error('Failed to import email service', error as Error);
        }
    }

    return updatedOrder;
}

export async function updateOrderItemStatuses(
  orderId: string,
  changes: Array<{ recordId: string; itemStatus: OrderItemStatus }>,
  actingUser: User
): Promise<Order> {
  if (!actingUser.distributorId) throw new Error("User has no distributorId.");

  const orderDocRef = doc(db, ORDERS_COLLECTION, orderId);
  const orderSnap = await getDoc(orderDocRef);

  if (!orderSnap.exists() || orderSnap.data().distributorId !== actingUser.distributorId) {
    throw new Error("Permission Denied or Order not found.");
  }

  const orderData = orderSnap.data() as Order;

  // Build a lookup for the changes
  const changeMap = new Map(changes.map(c => [c.recordId, c.itemStatus]));

  // Update item statuses
  const updatedItems = orderData.items.map(item => {
    const newStatus = changeMap.get(item.recordId);
    if (newStatus !== undefined) {
      return { ...item, itemStatus: newStatus };
    }
    return item;
  });

  // Preserve original totals on first adjustment
  const originalTotalAmount = orderData.originalTotalAmount ?? orderData.totalAmount;
  const originalSubtotalAmount = orderData.originalSubtotalAmount ?? orderData.subtotalAmount;

  // Recalculate totals — exclude not_available and out_of_stock items
  const activeItems = updatedItems.filter(item => {
    const status = item.itemStatus || 'available';
    return status === 'available' || status === 'back_order';
  });

  const newSubtotal = activeItems.reduce((sum, item) => sum + (item.priceAtTimeOfOrder * item.quantity), 0);

  // Recalculate tax proportionally if tax data exists
  let newTaxAmount = orderData.taxAmount;
  let newTotal = newSubtotal;
  if (originalSubtotalAmount && originalSubtotalAmount > 0 && orderData.taxAmount !== undefined) {
    const ratio = newSubtotal / originalSubtotalAmount;
    newTaxAmount = Math.round(orderData.taxAmount * ratio * 100) / 100;
    newTotal = newSubtotal + newTaxAmount;
  } else {
    newTotal = newSubtotal;
  }

  const updatePayload: any = {
    items: updatedItems,
    totalAmount: newTotal,
    subtotalAmount: newSubtotal,
    originalTotalAmount,
    originalSubtotalAmount,
    updatedAt: Timestamp.now(),
  };
  if (newTaxAmount !== undefined) {
    updatePayload.taxAmount = newTaxAmount;
  }

  await updateDoc(orderDocRef, updatePayload);

  const updatedSnap = await getDoc(orderDocRef);
  return processOrderTimestamps({ ...updatedSnap.data(), id: updatedSnap.id });
}

export async function recalculateOrderTax(
  orderId: string,
  actingUser: User
): Promise<Order> {
  if (!actingUser.distributorId) throw new Error("User has no distributorId.");

  const orderDocRef = doc(db, ORDERS_COLLECTION, orderId);
  const orderSnap = await getDoc(orderDocRef);

  if (!orderSnap.exists() || orderSnap.data().distributorId !== actingUser.distributorId) {
    throw new Error("Permission Denied or Order not found.");
  }

  const orderData = orderSnap.data() as Order;

  // Fetch distributor tax settings
  const distributor = await getDistributorById(actingUser.distributorId);
  if (!distributor) throw new Error("Distributor not found.");

  const taxMode = distributor.taxMode || 'none';
  if (taxMode !== 'manual' || !distributor.manualTaxRate) {
    throw new Error("Tax recalculation is only supported for manual tax mode.");
  }

  const taxBehavior = distributor.taxBehavior || 'inclusive';

  // Calculate item total from active items
  const activeItems = orderData.items.filter(item => {
    const status = item.itemStatus || 'available';
    return status === 'available' || status === 'back_order';
  });
  const itemTotal = activeItems.reduce((sum, item) => sum + (item.priceAtTimeOfOrder * item.quantity), 0);

  // Determine reverse charge from stored order data
  const reverseCharge = orderData.isReverseCharge || false;

  // Recalculate tax with current distributor settings
  const { calculateTax } = await import('@/lib/tax-utils');
  const taxResult = calculateTax(itemTotal, distributor.manualTaxRate, taxBehavior, reverseCharge);

  const updatePayload: any = {
    subtotalAmount: taxResult.subtotal,
    taxAmount: taxResult.taxAmount,
    totalAmount: taxResult.total,
    taxRate: taxResult.taxRate,
    taxInclusive: taxBehavior === 'inclusive',
    taxLabel: distributor.manualTaxLabel || 'VAT',
    isReverseCharge: taxResult.isReverseCharge,
    updatedAt: Timestamp.now(),
  };

  await updateDoc(orderDocRef, updatePayload);

  const updatedSnap = await getDoc(orderDocRef);
  return processOrderTimestamps({ ...updatedSnap.data(), id: updatedSnap.id });
}

export async function createOrder(user: User, cartItems: CartItem[]): Promise<Order> {
    if (cartItems.length === 0) {
        throw new Error("Cannot create an order with an empty cart.");
    }
    const distributorId = cartItems[0].distributorId;

    const distributor = await getDistributorById(distributorId);
    if (!distributor) {
        throw new Error(`Distributor with ID ${distributorId} not found.`);
    }

    const prefix = distributor.orderIdPrefix || 'ORD';
    const counter = (distributor.orderCounter || 0) + 1;
    const orderNumber = `${prefix}-${counter.toString().padStart(5, '0')}`;

    const orderItems: OrderItem[] = cartItems.map(item => ({
        recordId: item.record.id,
        title: item.record.title,
        artist: item.record.artist,
        cover_url: item.record.cover_url,
        priceAtTimeOfOrder: item.record.sellingPrice || 0,
        quantity: item.quantity,
    }));

    const now = new Date();
    const totalAmount = cartItems.reduce((sum, item) => sum + (item.record.sellingPrice || 0) * item.quantity, 0);
    const totalWeight = cartItems.reduce((sum, item) => sum + (item.record.weight || 0) * item.quantity, 0);

    const shippingAddress = [
      user.addressLine1,
      user.addressLine2,
      `${user.postcode || ''} ${user.city || ''}`.trim(),
      user.country
    ].filter(Boolean).join('\n');


    const newOrderData: any = {
        distributorId: distributorId,
        viewerId: user.uid,
        viewerEmail: user.email || 'N/A',
        customerName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'N/A',
        shippingAddress: shippingAddress || 'No shipping address provided',
        items: orderItems,
        status: 'pending' as OrderStatus,
        totalAmount: totalAmount,
        totalWeight: totalWeight,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
        orderNumber: orderNumber,
    };

    // Conditionally add optional fields to avoid writing 'undefined' to Firestore
    if (user.useDifferentBillingAddress && user.billingAddress) {
        newOrderData.billingAddress = user.billingAddress;
    }
    if (user.phoneNumber) {
        newOrderData.phoneNumber = user.phoneNumber;
    }
    if (user.companyName) {
        newOrderData.customerCompanyName = user.companyName;
    }
    if (user.vatNumber) {
        newOrderData.customerVatNumber = user.vatNumber;
    }
    if (user.eoriNumber) {
        newOrderData.customerEoriNumber = user.eoriNumber;
    }
    if (user.chamberOfCommerce) {
        newOrderData.customerChamberOfCommerce = user.chamberOfCommerce;
    }
    
    const orderDocRef = await addDoc(collection(db, ORDERS_COLLECTION), newOrderData);

    await updateDistributor(distributorId, { orderCounter: counter }, user);

     // Create a notification for the new order
    const notificationsCollectionRef = collection(db, 'notifications');
    const newNotificationData = {
        distributorId: distributorId,
        type: 'new_order' as const,
        message: `New order received from ${user.email || 'a client'}.`,
        orderId: orderDocRef.id,
        orderTotal: totalAmount,
        customerEmail: user.email || 'N/A',
        createdAt: Timestamp.fromDate(now),
        isRead: false,
    };
    await addDoc(notificationsCollectionRef, newNotificationData);

    const newDocSnap = await getDoc(orderDocRef);
    return processOrderTimestamps({ ...newDocSnap.data(), id: orderDocRef.id });
}

// createOrderRequest is now server-side only — see server-order-service.ts createOrderRequestServer
