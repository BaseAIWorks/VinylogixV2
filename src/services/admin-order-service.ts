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
 * Get platform fee statistics.
 * - Refunded orders are excluded from totals (the fee was returned to the
 *   customer, so it should not show up as revenue).
 * - Returns a per-distributor breakdown so the superadmin can see which
 *   distributor contributed how much to platform revenue.
 */
export async function getPlatformFeeStats(): Promise<{
  totalRevenue: number;
  totalPlatformFees: number;
  totalDistributorPayouts: number;
  paidOrderCount: number;
  totalOrderCount: number;
  refundedOrderCount: number;
  byDistributor: Array<{
    distributorId: string;
    revenue: number;
    platformFees: number;
    payout: number;
    paidOrders: number;
    refundedOrders: number;
  }>;
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
    let refundedOrderCount = 0;

    const perDistributor = new Map<string, { revenue: number; platformFees: number; paidOrders: number; refundedOrders: number }>();
    const ensureBucket = (id: string) => {
      let b = perDistributor.get(id);
      if (!b) {
        b = { revenue: 0, platformFees: 0, paidOrders: 0, refundedOrders: 0 };
        perDistributor.set(id, b);
      }
      return b;
    };

    querySnapshot.docs.forEach(doc => {
      const order = doc.data();
      const distributorId = (order.distributorId as string | undefined) || 'unknown';
      const bucket = ensureBucket(distributorId);

      if (order.paymentStatus === 'paid' && order.totalAmount) {
        totalRevenue += order.totalAmount;
        paidOrderCount++;
        bucket.revenue += order.totalAmount;
        bucket.paidOrders += 1;

        if (order.platformFeeAmount) {
          totalPlatformFees += (order.platformFeeAmount / 100);
          bucket.platformFees += (order.platformFeeAmount / 100);
        }
      } else if (order.paymentStatus === 'refunded') {
        refundedOrderCount++;
        bucket.refundedOrders += 1;
      }
    });

    const totalDistributorPayouts = totalRevenue - totalPlatformFees;

    const byDistributor = Array.from(perDistributor.entries())
      .map(([distributorId, b]) => ({
        distributorId,
        revenue: b.revenue,
        platformFees: b.platformFees,
        payout: b.revenue - b.platformFees,
        paidOrders: b.paidOrders,
        refundedOrders: b.refundedOrders,
      }))
      .filter(row => row.paidOrders > 0 || row.refundedOrders > 0)
      .sort((a, b) => b.platformFees - a.platformFees);

    return {
      totalRevenue,
      totalPlatformFees,
      totalDistributorPayouts,
      paidOrderCount,
      totalOrderCount: querySnapshot.size,
      refundedOrderCount,
      byDistributor,
    };
  } catch (error) {
    console.error("AdminOrderService: Error calculating platform fee stats:", error);
    throw error;
  }
}
