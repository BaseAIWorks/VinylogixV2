
'use server';

import type { User, FirestoreUser } from '@/types';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  limit,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

const USERS_COLLECTION = 'users';

const processUserTimestamps = (userData: any): User => {
  const processed = { ...userData };
  if (processed.createdAt && typeof processed.createdAt.toDate === 'function') {
    processed.createdAt = processed.createdAt.toDate().toISOString();
  }
  if (processed.lastLoginAt && typeof processed.lastLoginAt.toDate === 'function') {
    processed.lastLoginAt = processed.lastLoginAt.toDate().toISOString();
  } else if (processed.lastLoginAt && processed.lastLoginAt._seconds) { // Handle Admin SDK Timestamp
     processed.lastLoginAt = new Date(processed.lastLoginAt._seconds * 1000).toISOString();
  }

  if (processed.loginHistory && Array.isArray(processed.loginHistory)) {
    processed.loginHistory = processed.loginHistory.map(ts => 
        (ts && typeof ts.toDate === 'function') ? ts.toDate().toISOString() : 
        (ts && ts._seconds) ? new Date(ts._seconds * 1000).toISOString() : ts
    );
  }
  return processed as User;
};


export async function getUserById(uid: string): Promise<User | null> {
    if (!uid) return null;
    const userDocRef = doc(db, USERS_COLLECTION, uid);

    try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            return processUserTimestamps({ ...docSnap.data(), id: docSnap.id, uid: docSnap.id });
        }
        return null;
    } catch (error) {
        console.error(`UserService: Error fetching user ${uid}:`, error);
        throw error;
    }
}

export async function getUserByEmail(email: string): Promise<User | null> {
    if (!email) return null;
    const usersCollectionRef = collection(db, USERS_COLLECTION);
    const q = query(usersCollectionRef, where("email", "==", email), limit(1));
    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            return null;
        }
        const userDoc = querySnapshot.docs[0];
        return processUserTimestamps({ ...userDoc.data(), id: userDoc.id, uid: userDoc.id });
    } catch (error) {
        console.error(`UserService: Error fetching user by email ${email}:`, error);
        throw error;
    }
}

// Fetches ONLY operators (master/worker) for a distributor
export async function getUsersByDistributorId(distributorId: string): Promise<User[]> {
    if (!distributorId) {
        console.log("getUsersByDistributorId: No distributorId provided, returning empty array.");
        return [];
    }
    console.log(`getUsersByDistributorId: Executing query for distributorId: ${distributorId}`);
    const usersCollectionRef = collection(db, USERS_COLLECTION);
    try {
        const q = query(
            usersCollectionRef,
            where("distributorId", "==", distributorId),
            where("role", "in", ["master", "worker"])
        );
        const querySnapshot = await getDocs(q);
        console.log(`getUsersByDistributorId: Found ${querySnapshot.docs.length} operators.`);
        return querySnapshot.docs.map(docSnap => processUserTimestamps({ ...docSnap.data(), uid: docSnap.id }));
    } catch (error) {
        console.error(`UserService: Error fetching operators for distributor ${distributorId}:`, error);
        throw error;
    }
}

// Fetches ONLY clients (viewers) for a distributor
export async function getClientsByDistributorId(distributorId: string): Promise<User[]> {
    if (!distributorId) {
        console.log("getClientsByDistributorId: No distributorId provided, returning empty array.");
        return [];
    }
    console.log(`getClientsByDistributorId: Executing query for distributorId: ${distributorId}`);
    const usersCollectionRef = collection(db, USERS_COLLECTION);
    try {
        let q = query(usersCollectionRef);
        q = query(q, where("accessibleDistributorIds", "array-contains", distributorId));
        
        const querySnapshot = await getDocs(q);
        console.log(`getClientsByDistributorId: Found ${querySnapshot.docs.length} clients.`);
        return querySnapshot.docs.map(docSnap => processUserTimestamps({ ...docSnap.data(), uid: docSnap.id }));
    } catch (error: any) {
        console.error(`UserService: Error fetching clients for distributor ${distributorId}. This may be due to a missing Firestore index. Please check the browser console for an index creation link.`, error);
        throw error; 
    }
}

export async function getMasterUserByDistributorId(distributorId: string): Promise<User | null> {
    if (!distributorId) return null;
    
    const usersCollectionRef = collection(db, USERS_COLLECTION);
    const q = query(
        usersCollectionRef,
        where("distributorId", "==", distributorId),
        where("role", "==", "master"),
        limit(1)
    );
    try {
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            return processUserTimestamps({ ...userDoc.data(), uid: userDoc.id });
        }
        return null;
    } catch (error) {
        console.error(`UserService: Error finding master user for distributor ${distributorId}:`, error);
        throw error;
    }
}


export async function updateUserDistributorAccess(viewerEmail: string, distributorId: string, action: 'grant' | 'revoke'): Promise<void> {
    const adminDb = getAdminDb();
    if (!adminDb) {
      throw new Error("Admin SDK is not initialized. This action can only be performed from the server.");
    }
    
    const usersCollectionRef = adminDb.collection(USERS_COLLECTION);
    const q = usersCollectionRef.where("email", "==", viewerEmail).limit(1);

    const userSnapshot = await q.get();

    if (userSnapshot.empty) {
        throw new Error(`User with email ${viewerEmail} not found.`);
    }

    const userDoc = userSnapshot.docs[0];
    const viewer = userDoc.data() as FirestoreUser;

    if (viewer.role !== 'viewer') {
        throw new Error(`This action is only applicable to Client accounts.`);
    }

    try {
        if (action === 'grant') {
            await userDoc.ref.update({
                accessibleDistributorIds: admin.firestore.FieldValue.arrayUnion(distributorId)
            });
        } else { // revoke
            await userDoc.ref.update({
                accessibleDistributorIds: admin.firestore.FieldValue.arrayRemove(distributorId)
            });
        }
    } catch (error) {
        console.error(`UserService (Admin): Error updating access for ${viewerEmail}:`, error);
        throw error;
    }
}
