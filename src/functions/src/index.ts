/**
 * Import function triggers from their respective submodules:
 *
 * import { onCall } from "firebase-functions/v2/https";
 * import { onDocumentWritten } from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
admin.initializeApp();

/**
 * Helper: normaliseert Firestore Timestamp velden naar ISO strings,
 * zodat de frontend ze makkelijk kan gebruiken.
 */
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
      ts && typeof ts.toDate === "function" ? ts.toDate().toISOString() : ts
    );
  }

  return processed;
};

/**
 * deleteAuthUser
 * -----------------------------
 * Veilige server-side functie om een gebruiker uit Firebase Authentication te verwijderen.
 * Alleen aan te roepen door ingelogde users met role 'master' of 'superadmin'.
 */
export const deleteAuthUser = onCall(
  {
    region: "europe-west4",
    enforceAppCheck: false,
    cors: [
      "https://vinylogix.com",
      "https://www.vinylogix.com",
      "http://localhost:3000",
      "http://127.0.0.1:3000"
    ]
  },
  async (request: CallableRequest<{ uidToDelete?: string }>) => {
    // Check authentication
    if (!request.auth) {
      logger.warn("deleteAuthUser was called by an unauthenticated user.");
      throw new HttpsError(
        "unauthenticated",
        "Authentication required to delete a user."
      );
    }

    const actingUid = request.auth.uid;
    const { uidToDelete } = request.data || {};

    if (!uidToDelete) {
      throw new HttpsError(
        "invalid-argument",
        "The function must be called with a 'uidToDelete' argument."
      );
    }

    try {
      // Haal role van de acting user uit Firestore
      const actingUserDoc = await admin
        .firestore()
        .collection("users")
        .doc(actingUid)
        .get();
      const actingUserRole = actingUserDoc.data()?.role;

      if (actingUserRole !== "master" && actingUserRole !== "superadmin") {
        logger.error(
          `User ${actingUid} with role ${actingUserRole} attempted to delete user ${uidToDelete}.`
        );
        throw new HttpsError(
          "permission-denied",
          "Permission denied. You must be a master user or superadmin to delete users."
        );
      }

      logger.info(
        `User ${uidToDelete} is being deleted by ${actingUserRole} user ${actingUid}.`
      );

      // Verwijder de user uit Firebase Auth
      await admin.auth().deleteUser(uidToDelete);

      logger.info(
        `Successfully deleted user ${uidToDelete} from Firebase Authentication.`
      );

      return {
        success: true,
        message: `User ${uidToDelete} has been deleted from authentication.`
      };
    } catch (error: any) {
      logger.error(`Error deleting user ${uidToDelete} from auth:`, error);

      if (error instanceof HttpsError) {
        throw error;
      }

      if (error?.code === "auth/user-not-found") {
        throw new HttpsError(
          "not-found",
          "The user to delete was not found in Firebase Authentication."
        );
      }

      throw new HttpsError(
        "internal",
        "An internal error occurred while deleting the user."
      );
    }
  }
);

/**
 * getAllUsers
 * -----------------------------
 * Veilige server-side functie om alle users op te halen.
 * Alleen 'master' en 'superadmin' mogen deze functie aanroepen.
 */
export const getAllUsers = onCall(
  {
    region: "europe-west4",
    enforceAppCheck: false,
    cors: [
      "https://vinylogix.com",
      "https://www.vinylogix.com",
      "http://localhost:3000",
      "http://127.0.0.1:3000"
    ]
  },
  async (request: CallableRequest<unknown>) => {
    // CRITICAL: Check if the user is authenticated FIRST.
    if (!request.auth) {
      logger.warn("getAllUsers was called by an unauthenticated user.");
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    // Nu weten we zeker dat de gebruiker geauthenticeerd is
    const uid = request.auth.uid;

    try {
      // Check role van de aanroepende user
      const userDoc = await admin.firestore().collection("users").doc(uid).get();
      const userRole = userDoc.data()?.role;

      if (userRole !== "master" && userRole !== "superadmin") {
        logger.error(
          `User ${uid} with role ${userRole} attempted to call getAllUsers.`
        );
        throw new HttpsError(
          "permission-denied",
          "Permission denied. You must be a master user or superadmin."
        );
      }

      logger.info(
        `getAllUsers called by authenticated user: ${uid} with role ${userRole}`
      );

      // Haal alle Auth users op (max 1000 per call)
      const listUsersResult = await admin.auth().listUsers(1000);

      // Haal alle Firestore user docs op
      const allFirestoreUsers = await admin.firestore().collection("users").get();

      const firestoreUsersMap = new Map<string, any>();
      allFirestoreUsers.forEach((doc) => {
        firestoreUsersMap.set(doc.id, processUserTimestamps(doc.data()));
      });

      const combinedUsers = listUsersResult.users.map((userRecord) => {
        const firestoreData = firestoreUsersMap.get(userRecord.uid) || {};
        return {
          uid: userRecord.uid,
          email: userRecord.email,
          ...firestoreData
        };
      });

      return combinedUsers;
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }

      logger.error("Error fetching all users:", error);
      throw new HttpsError(
        "internal",
        "An internal error occurred while fetching users."
      );
    }
  }
);

/**
 * setCustomUserClaimsOnUserWrite
 * -----------------------------
 * Firestore trigger: wordt aangeroepen bij writes op users/{userId}.
 * Zet / update custom claims in Firebase Auth op basis van het Firestore userdocument.
 */
export const setCustomUserClaimsOnUserWrite = onDocumentWritten(
  "users/{userId}",
  async (event: any) => {
    const userId: string = event.params.userId;
    const afterData = event.data?.after?.data();

    // Als het document is verwijderd
    if (!afterData) {
      logger.info(`User document ${userId} deleted. Clearing custom claims.`);
      try {
        await admin.auth().setCustomUserClaims(userId, {});
      } catch (error) {
        logger.error(`Error clearing custom claims for user ${userId}:`, error);
      }
      return null;
    }

    // Haal huidige custom claims op
    const currentUser = await admin.auth().getUser(userId);
    const currentClaims = currentUser.customClaims || {};

    let newClaims: { [key: string]: any } = { ...currentClaims };

    // 'role' claim updaten
    const role = afterData.role;
    if (typeof role === "string") {
      newClaims.role = role;
    } else if (newClaims.role !== undefined) {
      delete newClaims.role;
    }

    // 'distributorId' claim updaten
    const distributorId = afterData.distributorId;
    if (typeof distributorId === "string") {
      newClaims.distributorId = distributorId;
    } else if (newClaims.distributorId !== undefined) {
      delete newClaims.distributorId;
    }

    // 'accessibleDistributorIds' claim updaten
    const accessibleDistributorIds = afterData.accessibleDistributorIds;
    if (Array.isArray(accessibleDistributorIds)) {
      newClaims.accessibleDistributorIds = accessibleDistributorIds;
    } else if (newClaims.accessibleDistributorIds !== undefined) {
      delete newClaims.accessibleDistributorIds;
    }

    // Alleen als claims echt veranderd zijn, updaten
    const claimsChanged =
      JSON.stringify(newClaims) !== JSON.stringify(currentClaims);

    if (claimsChanged) {
      try {
        await admin.auth().setCustomUserClaims(userId, newClaims);
        logger.info(`Custom claims set for user ${userId}:`, newClaims);
      } catch (error) {
        logger.error(
          `Error setting custom claims for user ${userId}:`,
          error
        );
      }
    } else {
      logger.info(
        `Custom claims for user ${userId} are already up to date.`
      );
    }

    return null;
  }
);
