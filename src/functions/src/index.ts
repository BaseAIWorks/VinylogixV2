

/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import {onDocumentWritten} from "firebase-functions/v2/firestore"; // <-- NIEUWE IMPORT
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK (deze staat er al en is prima)
admin.initializeApp();

const processUserTimestamps = (userData: any): any => {
    const processed = { ...userData };
    if (processed.createdAt && typeof processed.createdAt.toDate === "function") {
      processed.createdAt = processed.createdAt.toDate().toISOString();
    }
    if (processed.lastLoginAt && typeof processed.lastLoginAt.toDate === "function") {
      processed.lastLoginAt = processed.lastLoginAt.toDate().toISOString();
    }
  
    if (processed.loginHistory && Array.isArray(processed.loginHistory)) {
      processed.loginHistory = processed.loginHistory.map((ts: any) =>
          (ts && typeof ts.toDate === "function") ? ts.toDate().toISOString() : ts,
      );
    }
    return processed;
};
  
// This is a secure, server-side function to delete a user from Authentication.
// It can only be called by authenticated users with a 'master' or 'superadmin' role.
export const deleteAuthUser = onCall({ region: "europe-west4", enforceAppCheck: false, cors: true }, async (request) => {
  // CRITICAL: Check if the user is authenticated.
  if (!request.auth) {
    logger.warn("deleteAuthUser was called by an unauthenticated user.");
    throw new HttpsError("unauthenticated", "Authentication required to delete a user.");
  }
  
  const actingUid = request.auth.uid;
  const { uidToDelete } = request.data;

  if (!uidToDelete) {
      throw new HttpsError("invalid-argument", "The function must be called with a 'uidToDelete' argument.");
  }

  try {
    const actingUserDoc = await admin.firestore().collection("users").doc(actingUid).get();
    const actingUserRole = actingUserDoc.data()?.role;

    if (actingUserRole !== 'master' && actingUserRole !== 'superadmin') {
      logger.error(`User ${actingUid} with role ${actingUserRole} attempted to delete user ${uidToDelete}.`);
      throw new HttpsError("permission-denied", "Permission denied. You must be a master user or superadmin to delete users.");
    }
    
    logger.info(`User ${uidToDelete} is being deleted by ${actingUserRole} user ${actingUid}.`);

    // Proceed with deleting the user from Firebase Authentication
    await admin.auth().deleteUser(uidToDelete);
    
    logger.info(`Successfully deleted user ${uidToDelete} from Firebase Authentication.`);
    return { success: true, message: `User ${uidToDelete} has been deleted from authentication.` };

  } catch (error) {
    logger.error(`Error deleting user ${uidToDelete} from auth:`, error);
    if (error instanceof HttpsError) {
      throw error;
    }
    // Handle auth-specific errors
    if ((error as any).code === 'auth/user-not-found') {
        throw new HttpsError('not-found', 'The user to delete was not found in Firebase Authentication.');
    }
    throw new HttpsError("internal", "An internal error occurred while deleting the user from authentication.");
  }
});


// This is a secure, server-side function to fetch all users.
// It can only be called by authenticated users.
export const getAllUsers = onCall({ region: "europe-west4", cors: true }, async (request) => {
  // CRITICAL: Check if the user is authenticated FIRST.
  if (!request.auth) {
    logger.warn("getAllUsers was called by an unauthenticated user.");
    // Throw a specific, structured error that the client can handle.
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  // Now that we know the user is authenticated, we can safely access their UID.
  const uid = request.auth.uid;
  
  try {
    // Check if the user has the required role from Firestore.
    const userDoc = await admin.firestore().collection("users").doc(uid).get();
    const userRole = userDoc.data()?.role;

    if (userRole !== "master" && userRole !== "superadmin") {
      logger.error(`User ${uid} with role ${userRole} attempted to call getAllUsers.`);
      throw new HttpsError("permission-denied", "Permission denied. You must be a master user or superadmin.");
    }
    
    logger.info(`getAllUsers called by authenticated user: ${uid} with role ${userRole}`);

    // Proceed with fetching all user data
    const listUsersResult = await admin.auth().listUsers(1000);
    const allFirestoreUsers = await admin.firestore().collection("users").get();

    const firestoreUsersMap = new Map();
    allFirestoreUsers.forEach((doc) => {
        firestoreUsersMap.set(doc.id, processUserTimestamps(doc.data()));
    });

    const combinedUsers = listUsersResult.users.map((userRecord) => {
        const firestoreData = firestoreUsersMap.get(userRecord.uid) || {};
        return {
            uid: userRecord.uid,
            email: userRecord.email,
            ...firestoreData,
        };
    });
    
    return combinedUsers;

  } catch (error) {
    // If it's already an HttpsError, re-throw it.
    if (error instanceof HttpsError) {
      throw error;
    }
    // For any other errors, log them and throw a generic internal error.
    logger.error("Error fetching all users:", error);
    throw new HttpsError("internal", "An internal error occurred while fetching users.");
  }
});


// NIEUWE FUNCTIE: stelt Firebase Auth Custom Claims in op basis van Firestore gebruikersdocument
export const setCustomUserClaimsOnUserWrite = onDocumentWritten('users/{userId}', async (event) => { // <-- v2 syntax
    const userId = event.params.userId; // <-- event.params
    const afterData = event.data?.after?.data();   // Data after the write (if exists)

    // Als het document is verwijderd (afterData is null)
    if (!afterData) {
      logger.info(`User document ${userId} deleted. Clearing custom claims.`);
      try {
        await admin.auth().setCustomUserClaims(userId, {}); // Cleart alle custom claims
      } catch (error) {
        logger.error(`Error clearing custom claims for user ${userId}:`, error);
      }
      return null;
    }

    // Verkrijg de huidige custom claims van de gebruiker
    const currentUser = await admin.auth().getUser(userId);
    const currentClaims = currentUser.customClaims || {};

    let newClaims: { [key: string]: any } = { ...currentClaims }; // Begin met huidige claims

    // Controleer en update de 'role' claim
    const role = afterData.role;
    if (typeof role === 'string') {
        newClaims.role = role;
    } else if (newClaims.role !== undefined) { // Als rol nu ontbreekt in Firestore, verwijder uit claims
        delete newClaims.role;
    }
    
    // Controleer en update de 'distributorId' claim
    const distributorId = afterData.distributorId;
    if (typeof distributorId === 'string') {
        newClaims.distributorId = distributorId;
    } else if (newClaims.distributorId !== undefined) { // Als distributorId nu ontbreekt in Firestore, verwijder uit claims
        delete newClaims.distributorId;
    }

    // Controleer en update de 'accessibleDistributorIds' claim
    const accessibleDistributorIds = afterData.accessibleDistributorIds;
    if (Array.isArray(accessibleDistributorIds)) {
        newClaims.accessibleDistributorIds = accessibleDistributorIds;
    } else if (newClaims.accessibleDistributorIds !== undefined) { // Als array nu ontbreekt in Firestore, verwijder uit claims
        delete newClaims.accessibleDistributorIds;
    }
    
    // Controleer of de nieuwe claims daadwerkelijk verschillen van de huidige claims
    const claimsChanged = JSON.stringify(newClaims) !== JSON.stringify(currentClaims);

    if (claimsChanged) {
      try {
        await admin.auth().setCustomUserClaims(userId, newClaims);
        logger.info(`Custom claims set for user ${userId}:`, newClaims);
      } catch (error) {
        logger.error(`Error setting custom claims for user ${userId}:`, error);
      }
    } else {
      logger.info(`Custom claims for user ${userId} are already up to date.`);
    }
    return null;
});
