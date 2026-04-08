import { getAdminDb } from '@/lib/firebase-admin';

/**
 * Resolves a distributor by slug using Admin SDK.
 * Returns the document ID and data, or null if not found.
 */
export async function resolveDistributorBySlug(slug: string) {
  const adminDb = getAdminDb();
  if (!adminDb) return null;

  const snapshot = await adminDb
    .collection('distributors')
    .where('slug', '==', slug)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return { id: doc.id, data: doc.data() };
}

/**
 * Checks if a user has access to a distributor (operator, client, or superadmin).
 */
export async function checkUserAccessToDistributor(
  uid: string,
  distributorId: string
): Promise<boolean> {
  const adminDb = getAdminDb();
  if (!adminDb) return false;

  const userDoc = await adminDb.collection('users').doc(uid).get();
  if (!userDoc.exists) return false;

  const userData = userDoc.data()!;
  // Operators (master/worker) of this distributor
  if (userData.distributorId === distributorId) return true;
  // Clients with access
  if (Array.isArray(userData.accessibleDistributorIds) &&
      userData.accessibleDistributorIds.includes(distributorId)) return true;
  // Superadmins
  if (userData.role === 'superadmin') return true;

  return false;
}
