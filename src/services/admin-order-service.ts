'use server';

import type { Order } from '@/types';
import { getAdminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

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
  if (processed.shippedAt instanceof Timestamp) {
    processed.shippedAt = processed.shippedAt.toDate().toISOString();
  }
  return processed as Order;
};

/**
 * Fetch a single order by ID (superadmin only)
 */
export async function getOrderById(orderId: string): Promise<Order | null> {
  const adminDb = getAdminDb();
  if (!adminDb) {
    throw new Error("Admin DB not initialized on server.");
  }

  try {
    const orderDocRef = adminDb.collection(ORDERS_COLLECTION).doc(orderId);
    const docSnap = await orderDocRef.get();

    if (docSnap.exists) {
      return processOrderTimestampsServer({ ...docSnap.data(), id: docSnap.id });
    }
    return null;
  } catch (error) {
    console.error(`AdminOrderService: Error fetching order ${orderId}:`, error);
    throw error;
  }
}

/**
 * Fetch all orders across the entire platform (superadmin only)
 */
export async function getAllOrders(): Promise<Order[]> {
  const adminDb = getAdminDb();
  if (!adminDb) {
    throw new Error("Admin DB not initialized on server.");
  }

  try {
    const ordersCollectionRef = adminDb.collection(ORDERS_COLLECTION);
    const querySnapshot = await ordersCollectionRef.get();

    const orders = querySnapshot.docs.map(docSnap =>
      processOrderTimestampsServer({ ...docSnap.data(), id: docSnap.id })
    );

    // Sort by creation date (newest first)
    return orders.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error("AdminOrderService: Error fetching all orders:", error);
    throw error;
  }
}

/**
 * Get platform fee statistics
 */
export async function getPlatformFeeStats(): Promise<{
  totalRevenue: number;
  totalPlatformFees: number;
  totalDistributorPayouts: number;
  paidOrderCount: number;
  totalOrderCount: number;
}> {
  const adminDb = getAdminDb();
  if (!adminDb) {
    throw new Error("Admin DB not initialized on server.");
  }

  try {
    const ordersCollectionRef = adminDb.collection(ORDERS_COLLECTION);
    const querySnapshot = await ordersCollectionRef.get();

    let totalRevenue = 0;
    let totalPlatformFees = 0;
    let paidOrderCount = 0;

    querySnapshot.docs.forEach(doc => {
      const order = doc.data();
      if (order.paymentStatus === 'paid' && order.totalAmount) {
        totalRevenue += order.totalAmount;
        paidOrderCount++;

        // Platform fee is stored in cents
        if (order.platformFeeAmount) {
          totalPlatformFees += (order.platformFeeAmount / 100);
        }
      }
    });

    const totalDistributorPayouts = totalRevenue - totalPlatformFees;

    return {
      totalRevenue,
      totalPlatformFees,
      totalDistributorPayouts,
      paidOrderCount,
      totalOrderCount: querySnapshot.size,
    };
  } catch (error) {
    console.error("AdminOrderService: Error calculating platform fee stats:", error);
    throw error;
  }
}
