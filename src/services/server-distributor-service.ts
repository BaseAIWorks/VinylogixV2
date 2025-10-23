
'use server';

import type { Distributor } from '@/types';
import { getAdminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

const DISTRIBUTORS_COLLECTION = 'distributors';

// Helper function to process timestamps for consistency (if needed on server)
const processDistributorTimestampsServer = (distributorData: any): Distributor => {
  const processed = { ...distributorData };
  if (processed.createdAt instanceof Timestamp) {
    processed.createdAt = processed.createdAt.toDate().toISOString();
  }
  if (processed.slugLastUpdatedAt instanceof Timestamp) {
    processed.slugLastUpdatedAt = processed.slugLastUpdatedAt.toDate().toISOString();
  }
  // No need to handle subscription status here if it's always a string
  return processed as Distributor;
};

export async function findDistributorByStripeCustomerId(customerId: string): Promise<Distributor | null> {
  const adminDb = getAdminDb();
  if (!adminDb) {
      throw new Error("Admin DB not initialized on server.");
  }
  const distributorsCollectionRef = adminDb.collection(DISTRIBUTORS_COLLECTION);
  try {
    const q = distributorsCollectionRef.where("stripeCustomerId", "==", customerId).limit(1);
    const querySnapshot = await q.get();
    if (querySnapshot.empty) {
      return null;
    }
    const docSnap = querySnapshot.docs[0];
    return processDistributorTimestampsServer({ ...docSnap.data(), id: docSnap.id });
  } catch (error) {
    console.error(`ServerDistributorService: Error fetching distributor by stripeCustomerId "${customerId}":`, error);
    throw error;
  }
}

export async function updateDistributor(
  id: string,
  updatedData: Partial<Omit<Distributor, 'id' | 'createdAt' | 'creatorUid'>>
): Promise<Distributor | null> {
  const adminDb = getAdminDb();
  if (!adminDb) {
      throw new Error("Admin DB not initialized on server.");
  }
  const distributorDocRef = adminDb.collection(DISTRIBUTORS_COLLECTION).doc(id);

  try {
    // Note: The permission checks in your original updateDistributor function are client-side specific.
    // On the server, using the Admin SDK, you generally bypass client-side security rules.
    // Ensure that any necessary permission checks are implemented *before* calling this function
    // or by adding specific server-side authorization logic here.

    await distributorDocRef.update({
      ...updatedData,
      ...(updatedData.slugLastUpdatedAt ? { slugLastUpdatedAt: Timestamp.fromDate(new Date(updatedData.slugLastUpdatedAt)) } : {})
    });

    const updatedDocSnap = await distributorDocRef.get();
    if (updatedDocSnap.exists) {
      return processDistributorTimestampsServer({ ...updatedDocSnap.data(), id: updatedDocSnap.id });
    }
    return null;

  } catch (error) {
    console.error(`ServerDistributorService: Error updating distributor ${id} in Firestore:`, error);
    throw error;
  }
}
