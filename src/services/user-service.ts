
'use server';

import type { User, FirestoreUser } from '@/types';
import { getAdminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

const USERS_COLLECTION = 'users';

const processUserTimestamps = (userData: any): User => {
  const processed = { ...userData };
  if (processed.createdAt && typeof processed.createdAt.toDate === 'function') {
    processed.createdAt = processed.createdAt.toDate().toISOString();
  } else if (processed.createdAt && processed.createdAt._seconds) {
    processed.createdAt = new Date(processed.createdAt._seconds * 1000).toISOString();
  }
  if (processed.lastLoginAt && typeof processed.lastLoginAt.toDate === 'function') {
    processed.lastLoginAt = processed.lastLoginAt.toDate().toISOString();
  } else if (processed.lastLoginAt && processed.lastLoginAt._seconds) {
    processed.lastLoginAt = new Date(processed.lastLoginAt._seconds * 1000).toISOString();
  }

  if (processed.loginHistory && Array.isArray(processed.loginHistory)) {
    processed.loginHistory = processed.loginHistory.map(ts =>
        (ts && typeof ts.toDate === 'function') ? ts.toDate().toISOString() :
        (ts && ts._seconds) ? new Date(ts._seconds * 1000).toISOString() : ts
    );
  }
  if (processed.invitedAt && typeof processed.invitedAt.toDate === 'function') {
    processed.invitedAt = processed.invitedAt.toDate().toISOString();
  } else if (processed.invitedAt && processed.invitedAt._seconds) {
    processed.invitedAt = new Date(processed.invitedAt._seconds * 1000).toISOString();
  }
  return processed as User;
};

function requireAdminDb() {
  const adminDb = getAdminDb();
  if (!adminDb) {
    throw new Error('Admin SDK not available. This function requires server-side execution.');
  }
  return adminDb;
}

export async function getUserById(uid: string): Promise<User | null> {
    if (!uid) return null;
    const adminDb = requireAdminDb();

    try {
        const docSnap = await adminDb.collection(USERS_COLLECTION).doc(uid).get();
        if (docSnap.exists) {
            return processUserTimestamps({ ...docSnap.data(), id: docSnap.id, uid: docSnap.id });
        }
        return null;
    } catch (error) {
        console.error(`UserService (Admin): Error fetching user ${uid}:`, error);
        throw error;
    }
}

export async function getUserByEmail(email: string): Promise<User | null> {
    if (!email) return null;
    const adminDb = requireAdminDb();

    try {
        const querySnapshot = await adminDb.collection(USERS_COLLECTION)
            .where("email", "==", email)
            .limit(1)
            .get();
        if (querySnapshot.empty) {
            return null;
        }
        const userDoc = querySnapshot.docs[0];
        return processUserTimestamps({ ...userDoc.data(), id: userDoc.id, uid: userDoc.id });
    } catch (error) {
        console.error(`UserService (Admin): Error fetching user by email ${email}:`, error);
        throw error;
    }
}

export async function getUsersByDistributorId(distributorId: string): Promise<User[]> {
    if (!distributorId) return [];
    const adminDb = requireAdminDb();

    try {
        const querySnapshot = await adminDb.collection(USERS_COLLECTION)
            .where("distributorId", "==", distributorId)
            .where("role", "in", ["master", "worker"])
            .get();
        return querySnapshot.docs.map(docSnap => processUserTimestamps({ ...docSnap.data(), uid: docSnap.id }));
    } catch (error) {
        console.error(`UserService (Admin): Error fetching operators for distributor ${distributorId}:`, error);
        throw error;
    }
}

export async function getClientsByDistributorId(distributorId: string): Promise<User[]> {
    if (!distributorId) return [];
    const adminDb = requireAdminDb();

    try {
        const querySnapshot = await adminDb.collection(USERS_COLLECTION)
            .where("accessibleDistributorIds", "array-contains", distributorId)
            .get();
        return querySnapshot.docs.map(docSnap => processUserTimestamps({ ...docSnap.data(), uid: docSnap.id }));
    } catch (error) {
        console.error(`UserService (Admin): Error fetching clients for distributor ${distributorId}:`, error);
        throw error;
    }
}

export async function getMasterUserByDistributorId(distributorId: string): Promise<User | null> {
    if (!distributorId) return null;
    const adminDb = requireAdminDb();

    try {
        const querySnapshot = await adminDb.collection(USERS_COLLECTION)
            .where("distributorId", "==", distributorId)
            .where("role", "==", "master")
            .limit(1)
            .get();
        if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            return processUserTimestamps({ ...userDoc.data(), uid: userDoc.id });
        }
        return null;
    } catch (error) {
        console.error(`UserService (Admin): Error finding master user for distributor ${distributorId}:`, error);
        throw error;
    }
}

export async function updateUserDistributorAccess(viewerEmail: string, distributorId: string, action: 'grant' | 'revoke'): Promise<void> {
    const adminDb = requireAdminDb();

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
        } else {
            await userDoc.ref.update({
                accessibleDistributorIds: admin.firestore.FieldValue.arrayRemove(distributorId)
            });
        }
    } catch (error) {
        console.error(`UserService (Admin): Error updating access for ${viewerEmail}:`, error);
        throw error;
    }
}
