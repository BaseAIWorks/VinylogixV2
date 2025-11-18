
'use server';

import type { Distributor } from '@/types';
import { getAdminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

const DISTRIBUTORS_COLLECTION = 'distributors';

// Helper function to process timestamps for consistency on the server
const processDistributorTimestampsServer = (distributorData: any): Distributor => {
  const processed = { ...distributorData };
  if (processed.createdAt && processed.createdAt instanceof Timestamp) {
    processed.createdAt = processed.createdAt.toDate().toISOString();
  }
  if (processed.slugLastUpdatedAt && processed.slugLastUpdatedAt instanceof Timestamp) {
    processed.slugLastUpdatedAt = processed.slugLastUpdatedAt.toDate().toISOString();
  }
  return processed as Distributor;
};

export async function findDistributorByStripeCustomerIdServer(customerId: string): Promise<Distributor | null> {
  const adminDb = getAdminDb();
  if (!adminDb) {
      throw new Error("Admin SDK is not initialized.");
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

export async function updateDistributorServer(
  id: string,
  updatedData: Partial<Omit<Distributor, 'id' | 'createdAt' | 'creatorUid'>>
): Promise<Distributor | null> {
  const adminDb = getAdminDb();
  if (!adminDb) {
      throw new Error("Admin SDK is not initialized.");
  }
  const distributorDocRef = adminDb.collection(DISTRIBUTORS_COLLECTION).doc(id);

  try {
    const dataToUpdate: {[key: string]: any} = { ...updatedData };
    if (updatedData.slugLastUpdatedAt) {
        dataToUpdate.slugLastUpdatedAt = Timestamp.fromDate(new Date(updatedData.slugLastUpdatedAt));
    }
    
    await distributorDocRef.update(dataToUpdate);

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
