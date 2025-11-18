

"use client";

import type { Distributor, User } from '@/types';
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  query,
  where,
  documentId,
  limit,
} from 'firebase/firestore';

const DISTRIBUTORS_COLLECTION = 'distributors';

const processDistributorTimestamps = (distributorData: any): Distributor => {
  const processed = { ...distributorData };
  if (processed.createdAt && processed.createdAt instanceof Timestamp) {
    processed.createdAt = processed.createdAt.toDate().toISOString();
  }
  if (processed.slugLastUpdatedAt && processed.slugLastUpdatedAt instanceof Timestamp) {
    processed.slugLastUpdatedAt = processed.slugLastUpdatedAt.toDate().toISOString();
  }
  if (processed.subscription && processed.subscription.status) {
    // This is just a string, no conversion needed unless it was a timestamp
  }
  return processed as Distributor;
};

// Helper to create a URL-friendly slug
const createSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // remove non-word chars
    .replace(/[\s_-]+/g, '-') // collapse whitespace and replace by -
    .replace(/^-+|-+$/g, ''); // remove leading/trailing dashes
};

// Helper to ensure the slug is unique
async function ensureUniqueSlug(initialSlug: string): Promise<string> {
  let slug = initialSlug;
  let isUnique = false;
  let counter = 1;
  while (!isUnique) {
    const q = query(collection(db, DISTRIBUTORS_COLLECTION), where("slug", "==", slug));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      isUnique = true;
    } else {
      slug = `${initialSlug}-${counter}`;
      counter++;
    }
  }
  return slug;
}

export async function getDistributors(): Promise<Distributor[]> {
  const distributorsCollectionRef = collection(db, DISTRIBUTORS_COLLECTION);
  try {
    const querySnapshot = await getDocs(distributorsCollectionRef);
    const distributors = querySnapshot.docs.map(docSnap => 
      processDistributorTimestamps({ ...docSnap.data(), id: docSnap.id })
    );
    return distributors.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } catch (error) {
    console.error("DistributorService: Error fetching distributors from Firestore:", error);
    throw error;
  }
}

export async function getDistributorsByIds(ids: string[]): Promise<Distributor[]> {
  if (ids.length === 0) return [];
  const distributorsCollectionRef = collection(db, DISTRIBUTORS_COLLECTION);
  try {
    const q = query(distributorsCollectionRef, where(documentId(), 'in', ids));
    const querySnapshot = await getDocs(q);
    const distributors = querySnapshot.docs.map(docSnap => 
      processDistributorTimestamps({ ...docSnap.data(), id: docSnap.id })
    );
    return distributors;
  } catch (error) {
    console.error("DistributorService: Error fetching distributors by IDs:", error);
    throw error;
  }
}


export async function getDistributorById(id: string): Promise<Distributor | null> {
  const distributorDocRef = doc(db, DISTRIBUTORS_COLLECTION, id);
  try {
    const docSnap = await getDoc(distributorDocRef);
    if (docSnap.exists()) {
      return processDistributorTimestamps({ ...docSnap.data(), id: docSnap.id });
    }
    return null;
  } catch (error: any) {
    // The security rules will handle permission enforcement. 
    // The client-side check is removed to prevent false negatives.
    console.error(`DistributorService: Error fetching distributor ${id} from Firestore:`, error);
    const specificError = `Operation: getDoc, Collection: ${DISTRIBUTORS_COLLECTION}, Document: ${id}. Original: ${error.message}`;
    throw new Error(specificError);
  }
}

export async function getDistributorBySlug(slug: string): Promise<Distributor | null> {
    const q = query(collection(db, DISTRIBUTORS_COLLECTION), where("slug", "==", slug), limit(1));
    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            return null;
        }
        const docSnap = querySnapshot.docs[0];
        return processDistributorTimestamps({ ...docSnap.data(), id: docSnap.id });
    } catch (error) {
        console.error(`DistributorService: Error fetching distributor by slug "${slug}":`, error);
        throw error;
    }
}

export async function findDistributorByStripeCustomerId(customerId: string): Promise<Distributor | null> {
    const q = query(collection(db, DISTRIBUTORS_COLLECTION), where("stripeCustomerId", "==", customerId), limit(1));
    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            return null;
        }
        const docSnap = querySnapshot.docs[0];
        return processDistributorTimestamps({ ...docSnap.data(), id: docSnap.id });
    } catch (error) {
        console.error(`DistributorService: Error fetching distributor by stripeCustomerId "${customerId}":`, error);
        throw error;
    }
}


export async function addDistributor(
  distributorData: Partial<Omit<Distributor, 'id' | 'createdAt'>>,
  actingUser?: User,
): Promise<Distributor> {
  const now = new Date();
  const initialSlug = createSlug(distributorData.name || `distributor-${now.getTime()}`);
  const uniqueSlug = await ensureUniqueSlug(initialSlug);

  const dataToSave: any = {
    ...distributorData,
    slug: uniqueSlug,
    createdAt: Timestamp.fromDate(now),
    orderCounter: 0,
    orderIdPrefix: distributorData.name ? distributorData.name.substring(0,3).toUpperCase() : 'ORD',
  };
  
  if (actingUser) {
    dataToSave.creatorUid = actingUser.uid;
  }

  try {
    const distributorsCollectionRef = collection(db, DISTRIBUTORS_COLLECTION);
    const docRef = await addDoc(distributorsCollectionRef, dataToSave);
    const newDocSnap = await getDoc(docRef);
    if (newDocSnap.exists()) {
      return processDistributorTimestamps({ ...newDocSnap.data(), id: newDocSnap.id });
    }
    throw new Error("Failed to retrieve newly added distributor");
  } catch (error) {
    console.error("DistributorService: Error adding distributor to Firestore:", error);
    throw error;
  }
}

export async function updateDistributor(
  id: string,
  updatedData: Partial<Omit<Distributor, 'id' | 'createdAt' | 'creatorUid'>>,
  actingUser?: User
): Promise<Distributor | null> {
  const distributorDocRef = doc(db, DISTRIBUTORS_COLLECTION, id);
  
  try {
    const docSnap = await getDoc(distributorDocRef);
    if (!docSnap.exists()) {
      throw new Error("Distributor document not found.");
    }
    const currentData = docSnap.data() as Distributor;

    // Define allowed update scenarios
    const isSuperAdmin = actingUser?.role === 'superadmin';
    const isCorrectMasterUser = actingUser?.role === 'master' && actingUser.distributorId === id;
    const isServerAction = actingUser?.email === 'server-action'; // For webhooks
    const isOnlyCounterUpdate = Object.keys(updatedData).length === 1 && 'orderCounter' in updatedData;
    
    // Special case for initial master user linking during registration
    const isInitialMasterUserLink = 
        Object.keys(updatedData).length === 1 && 
        'masterUserUid' in updatedData &&
        !currentData.masterUserUid; // The field must not be set yet

    if (
        !isSuperAdmin &&
        !isCorrectMasterUser &&
        !isServerAction &&
        !isOnlyCounterUpdate &&
        !isInitialMasterUserLink // <-- ADD THIS EXCEPTION
    ) {
        throw new Error("Permission Denied: You do not have permission to update this distributor.");
    }
    

    if (updatedData.slug) {
        const initialSlug = createSlug(updatedData.slug);
        const uniqueSlug = await ensureUniqueSlug(initialSlug);
        updatedData.slug = uniqueSlug;
        
        if (!isSuperAdmin && currentData.slugLastUpdatedAt) {
            const lastUpdate = new Date(currentData.slugLastUpdatedAt);
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            if (lastUpdate > oneMonthAgo) {
                throw new Error("Slug can only be updated once every 30 days.");
            }
        }
        (updatedData as Distributor).slugLastUpdatedAt = new Date().toISOString();
    }

    await updateDoc(distributorDocRef, {
        ...updatedData,
        ...(updatedData.slugLastUpdatedAt ? { slugLastUpdatedAt: Timestamp.fromDate(new Date(updatedData.slugLastUpdatedAt)) } : {})
    });
    
    const updatedDocSnap = await getDoc(distributorDocRef);
    if (updatedDocSnap.exists()) {
      return processDistributorTimestamps({ ...updatedDocSnap.data(), id: updatedDocSnap.id });
    }
    return null;

  } catch (error: any) {
    if (error.code === 'permission-denied') {
        const specificError = `(Operation: getDoc/updateDoc, Collection: ${DISTRIBUTORS_COLLECTION}, Document: ${id})`;
        throw new Error(`Permission Denied to update distributor document. ${specificError}`);
    }
    console.error(`DistributorService: Error updating distributor ${id} in Firestore:`, error);
    const specificError = `Operation: updateDoc, Collection: ${DISTRIBUTORS_COLLECTION}, Document: ${id}. Original: ${error.message}`;
    throw new Error(specificError);
  }
}

export async function deleteDistributor(id: string): Promise<boolean> {
  const distributorDocRef = doc(db, DISTRIBUTORS_COLLECTION, id);
  try {
    await deleteDoc(distributorDocRef);
    return true;
  } catch (error) {
    console.error(`DistributorService: Error deleting distributor ${id} from Firestore:`, error);
    throw error;
  }
}
