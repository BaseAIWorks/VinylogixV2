import type { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { AuthError, requireAuth } from '@/lib/auth-helpers';

/**
 * Verifies the caller is authenticated and can manage the given order.
 * Loads the caller's user document and the order document, and checks that
 * the caller is either a superadmin, the master of the order's distributor,
 * or a worker of that distributor with canManageOrders permission.
 *
 * Throws AuthError with the appropriate status code on any failure, so the
 * caller route can forward it via authErrorResponse.
 */
export async function requireOrderAccess(req: NextRequest, orderId: string) {
  const caller = await requireAuth(req);

  if (!orderId) {
    throw new AuthError('Order ID is required.', 400);
  }

  const adminDb = getAdminDb();
  if (!adminDb) {
    throw new AuthError('Service unavailable.', 500);
  }

  const callerSnap = await adminDb.collection('users').doc(caller.uid).get();
  if (!callerSnap.exists) {
    throw new AuthError('Insufficient permissions.', 403);
  }
  const callerData = callerSnap.data() as any;

  const orderSnap = await adminDb.collection('orders').doc(orderId).get();
  if (!orderSnap.exists) {
    throw new AuthError('Order not found.', 404);
  }
  const orderData = { id: orderSnap.id, ...orderSnap.data() } as any;

  const isSuperadmin = callerData.role === 'superadmin';
  const isMasterOfDistributor = callerData.role === 'master' && callerData.distributorId === orderData.distributorId;
  const isWorkerWithPermission = callerData.role === 'worker'
    && callerData.distributorId === orderData.distributorId
    && callerData.permissions?.canManageOrders === true;
  if (!isSuperadmin && !isMasterOfDistributor && !isWorkerWithPermission) {
    throw new AuthError('Insufficient permissions.', 403);
  }

  return { caller, callerData, orderData, orderRef: orderSnap.ref, adminDb };
}
