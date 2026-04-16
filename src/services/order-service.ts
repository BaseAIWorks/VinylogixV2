
"use client";

import type { Order, OrderStatus, OrderItemStatus, User, CartItem, OrderItem } from '@/types';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, limit, Timestamp } from 'firebase/firestore';
import {
  deductStockForOrder,
  deductReservedStockForOrder,
  releaseStockForOrder,
  restoreStockForOrder,
  getRecordById,
} from './record-service';
import { getDistributorById, updateDistributor } from './distributor-service';
import { logger } from '@/lib/logger';

const ORDERS_COLLECTION = 'orders';

const processOrderTimestamps = (orderData: any): Order => {
  const processed = { ...orderData };
  const tsFields = [
    'createdAt',
    'updatedAt',
    'itemChangesNotifiedAt',
    'invoiceEmailedAt',
    'paymentLinkCreatedAt',
  ] as const;
  for (const field of tsFields) {
    if (processed[field] && processed[field] instanceof Timestamp) {
      processed[field] = processed[field].toDate().toISOString();
    }
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
    const currentStockState: Order['stockState'] = orderData.stockState || 'none';
    let nextStockState: Order['stockState'] = currentStockState;

    // Only items the customer is actually paying for should affect physical stock.
    // Anything the distributor marked not_available / out_of_stock should have its
    // earlier reservation released instead.
    const isBillable = (i: OrderItem) => {
        const s = i.itemStatus || 'available';
        return s === 'available' || s === 'back_order';
    };
    const billableItems = orderData.items.filter(isBillable);
    const nonBillableItems = orderData.items.filter(i => !isBillable(i));

    // Deduct stock when marking as paid
    if (status === 'paid' && oldStatus !== 'paid') {
        try {
            if (currentStockState === 'reserved') {
                if (nonBillableItems.length > 0) {
                    await releaseStockForOrder(nonBillableItems);
                }
                await deductReservedStockForOrder(billableItems, actingUser.email);
            } else if (currentStockState !== 'deducted') {
                // Legacy order with no reservation — fall back to a direct deduct.
                await deductStockForOrder(billableItems, orderData.distributorId, actingUser);
            }
            nextStockState = 'deducted';
        } catch (error) {
            logger.error(`Failed to deduct stock for order ${orderId}`, error as Error);
            // Re-throw the error to prevent status update if stock deduction fails, and show it to the user.
            throw error;
        }
    }

    // Cancelling clears stock claim: release if only reserved, restore if already deducted.
    if (status === 'cancelled' && oldStatus !== 'cancelled') {
        try {
            if (currentStockState === 'reserved') {
                await releaseStockForOrder(orderData.items);
            } else if (currentStockState === 'deducted') {
                await restoreStockForOrder(orderData.items, actingUser);
            }
            nextStockState = 'none';
        } catch (error) {
            logger.error(`Failed to clear stock claim for cancelled order ${orderId}`, error as Error);
            // Don't re-throw here, as cancelling the order is the primary goal even if stock ops fail.
        }
    }

    const updatePayload: any = {
        status: status,
        updatedAt: Timestamp.now(),
    };

    if (nextStockState !== currentStockState) {
        updatePayload.stockState = nextStockState;
    }

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
  changes: Array<{ recordId: string; itemStatus: OrderItemStatus; quantity?: number }>,
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
  const changeMap = new Map(changes.map(c => [c.recordId, { itemStatus: c.itemStatus, quantity: c.quantity }]));

  // Update item statuses and quantities
  const updatedItems = orderData.items.map(item => {
    const change = changeMap.get(item.recordId);
    if (change) {
      return {
        ...item,
        itemStatus: change.itemStatus,
        ...(change.quantity !== undefined ? { quantity: change.quantity } : {}),
      };
    }
    return item;
  });

  // Sync reservations for orders still in 'reserved' state. An item that
  // becomes unavailable releases its hold; quantity reductions release the
  // delta. Quantity increases or flipping a non-billable item back to
  // billable would need a fresh stock check — which could race with other
  // pending orders — so those are rejected explicitly instead of silently
  // leaving the reservation under-held.
  if ((orderData.stockState || 'none') === 'reserved') {
    const isBillable = (s?: OrderItemStatus) => {
      const v = s || 'available';
      return v === 'available' || v === 'back_order';
    };
    const releases: OrderItem[] = [];
    for (const beforeItem of orderData.items) {
      const change = changeMap.get(beforeItem.recordId);
      if (!change) continue;
      const beforeActive = isBillable(beforeItem.itemStatus);
      const afterActive = isBillable(change.itemStatus);
      const beforeQty = beforeItem.quantity || 0;
      const afterQty = change.quantity !== undefined ? change.quantity : beforeQty;
      const heldBefore = beforeActive ? beforeQty : 0;
      const heldAfter = afterActive ? afterQty : 0;
      const delta = heldBefore - heldAfter;
      if (delta > 0) {
        releases.push({ ...beforeItem, quantity: delta });
      } else if (delta < 0) {
        throw new Error(
          `Cannot increase reserved quantity for "${beforeItem.title}" on an open order. ` +
          `Cancel this order and create a new one if more stock is needed.`
        );
      }
    }
    if (releases.length > 0) {
      try {
        await releaseStockForOrder(releases);
      } catch (err) {
        logger.warn(`Failed to sync reservations for order ${orderId}`, { err: (err as Error).message });
      }
    }
  }

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

  // Add existing shipping cost to total (shipping stays the same when items change,
  // since order items don't carry weight data — recalculation would require fetching records)
  const shippingCost = orderData.shippingCost || 0;
  newTotal = newTotal + shippingCost;

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
  actingUser: User,
  manualShippingCost?: number
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

  // Use manual shipping cost if provided, otherwise preserve existing
  const enteredShipping = manualShippingCost !== undefined ? manualShippingCost : (orderData.shippingCost || 0);

  // Determine reverse charge from stored order data
  const reverseCharge = orderData.isReverseCharge || false;

  const rate = distributor.manualTaxRate;
  const round2 = (n: number) => Math.round(n * 100) / 100;

  // IMPORTANT: shippingCost is stored in the SAME convention as priceAtTimeOfOrder
  // (i.e. inclusive for inclusive distributors, exclusive for exclusive distributors).
  // This makes recalc idempotent — repeated calls produce the same result.
  // Compute products and shipping excl tax + tax + total
  // VAT applies to BOTH products and shipping (EU standard)
  let productsExcl: number;
  let shippingExcl: number;
  let taxAmount: number;
  let totalAmount: number;

  if (taxBehavior === 'inclusive') {
    // Both itemTotal and enteredShipping are inclusive of tax
    productsExcl = round2(itemTotal / (1 + rate / 100));
    shippingExcl = round2(enteredShipping / (1 + rate / 100));
    if (reverseCharge) {
      taxAmount = 0;
      totalAmount = round2(productsExcl + shippingExcl);
    } else {
      taxAmount = round2((itemTotal + enteredShipping) - (productsExcl + shippingExcl));
      totalAmount = round2(itemTotal + enteredShipping);
    }
  } else {
    // exclusive — itemTotal and enteredShipping are excl tax
    productsExcl = itemTotal;
    shippingExcl = enteredShipping;
    if (reverseCharge) {
      taxAmount = 0;
      totalAmount = round2(productsExcl + shippingExcl);
    } else {
      taxAmount = round2((productsExcl + shippingExcl) * (rate / 100));
      totalAmount = round2(productsExcl + shippingExcl + taxAmount);
    }
  }

  const updatePayload: any = {
    subtotalAmount: productsExcl,
    taxAmount,
    totalAmount,
    taxRate: reverseCharge ? 0 : rate,
    taxInclusive: taxBehavior === 'inclusive',
    taxLabel: distributor.manualTaxLabel || 'VAT',
    isReverseCharge: reverseCharge,
    shippingCost: enteredShipping, // Store in same convention as priceAtTimeOfOrder (idempotent)
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
