
"use client";

import type { Order, OrderStatus, User, CartItem, OrderItem } from '@/types';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, limit, Timestamp } from 'firebase/firestore';
import { deductStockForOrder, restoreStockForOrder, getRecordById } from './record-service';
import { getDistributorById, updateDistributor } from './distributor-service';

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
      console.error("OrderService: User has no distributorId, cannot fetch orders.");
      return [];
  }
  const ordersCollectionRef = collection(db, ORDERS_COLLECTION);
  try {
      const q = query(ordersCollectionRef, where("distributorId", "==", targetDistributorId));
      const querySnapshot = await getDocs(q);
      const orders = querySnapshot.docs.map(docSnap => processOrderTimestamps({ ...docSnap.data(), id: docSnap.id }));
      return orders.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch(error) {
      console.error("OrderService: Error fetching orders:", error);
      throw error;
  }
}

export async function getOrdersByDistributorId(distributorId: string): Promise<Order[]> {
    if (!distributorId) {
        console.error("OrderService: Distributor ID is missing, cannot fetch orders.");
        return [];
    }
    const ordersCollectionRef = collection(db, ORDERS_COLLECTION);
    try {
        const q = query(ordersCollectionRef, where("distributorId", "==", distributorId));
        const querySnapshot = await getDocs(q);
        const orders = querySnapshot.docs.map(docSnap => processOrderTimestamps({ ...docSnap.data(), id: docSnap.id }));
        return orders.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch(error) {
        console.error(`OrderService: Error fetching orders for distributor ${distributorId}:`, error);
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
    console.error(`OrderService: Error fetching orders for viewer ${viewerId}:`, error);
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
      console.error(`OrderService: Error fetching order ${orderId}:`, error);
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
            console.error(`Failed to deduct stock for order ${orderId}:`, error);
            // Re-throw the error to prevent status update if stock deduction fails, and show it to the user.
            throw error;
        }
    }
    
    // Restore stock ONLY if a paid order is cancelled
    if (status === 'cancelled' && oldStatus === 'paid') {
        try {
            await restoreStockForOrder(orderData.items, actingUser);
        } catch (error) {
            console.error(`Failed to restore stock for cancelled order ${orderId}:`, error);
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
                console.error('Failed to send shipping notification:', err)
            );
        } catch (error) {
            console.error('Failed to import email service:', error);
        }
    }

    return updatedOrder;
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
