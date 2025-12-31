"use strict";
/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.setCustomUserClaimsOnUserWrite = exports.getAllUsers = exports.deleteAuthUser = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore"); // <-- NIEUWE IMPORT
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin SDK (deze staat er al en is prima)
admin.initializeApp();
const processUserTimestamps = (userData) => {
    const processed = Object.assign({}, userData);
    if (processed.createdAt && typeof processed.createdAt.toDate === "function") {
        processed.createdAt = processed.createdAt.toDate().toISOString();
    }
    if (processed.lastLoginAt && typeof processed.lastLoginAt.toDate === "function") {
        processed.lastLoginAt = processed.lastLoginAt.toDate().toISOString();
    }
    if (processed.loginHistory && Array.isArray(processed.loginHistory)) {
        processed.loginHistory = processed.loginHistory.map((ts) => (ts && typeof ts.toDate === "function") ? ts.toDate().toISOString() : ts);
    }
    return processed;
};
// This is a secure, server-side function to delete a user from Authentication.
// It can only be called by authenticated users with a 'master' or 'superadmin' role.
// SECURITY: Masters can only delete users from their own distributor.
exports.deleteAuthUser = (0, https_1.onCall)({ region: "europe-west4", enforceAppCheck: false, cors: true }, async (request) => {
    // CRITICAL: Check if the user is authenticated.
    if (!request.auth) {
        logger.warn("deleteAuthUser was called by an unauthenticated user.");
        throw new https_1.HttpsError("unauthenticated", "Authentication required to delete a user.");
    }
    const actingUid = request.auth.uid;
    const { uidToDelete } = request.data;
    if (!uidToDelete) {
        throw new https_1.HttpsError("invalid-argument", "The function must be called with a 'uidToDelete' argument.");
    }
    // Prevent self-deletion
    if (actingUid === uidToDelete) {
        throw new https_1.HttpsError("invalid-argument", "You cannot delete your own account.");
    }
    try {
        // Get the acting user's data
        const actingUserDoc = await admin.firestore().collection("users").doc(actingUid).get();
        const actingUserData = actingUserDoc.data();
        const actingUserRole = actingUserData === null || actingUserData === void 0 ? void 0 : actingUserData.role;
        const actingUserDistributorId = actingUserData === null || actingUserData === void 0 ? void 0 : actingUserData.distributorId;
        if (actingUserRole !== 'master' && actingUserRole !== 'superadmin') {
            logger.error(`User ${actingUid} with role ${actingUserRole} attempted to delete user ${uidToDelete}.`);
            throw new https_1.HttpsError("permission-denied", "Permission denied. You must be a master user or superadmin to delete users.");
        }
        // SECURITY FIX: If the caller is a master (not superadmin), verify the target user
        // belongs to the same distributor. This prevents cross-tenant user deletion.
        if (actingUserRole === 'master') {
            const targetUserDoc = await admin.firestore().collection("users").doc(uidToDelete).get();
            if (!targetUserDoc.exists) {
                // User exists in Auth but not Firestore - still allow deletion for cleanup
                logger.warn(`User ${uidToDelete} exists in Auth but not Firestore. ` +
                    `Allowing deletion by master ${actingUid} for cleanup.`);
            }
            else {
                const targetUserData = targetUserDoc.data();
                const targetUserDistributorId = targetUserData === null || targetUserData === void 0 ? void 0 : targetUserData.distributorId;
                const targetUserRole = targetUserData === null || targetUserData === void 0 ? void 0 : targetUserData.role;
                // Masters cannot delete other masters or superadmins
                if (targetUserRole === 'master' || targetUserRole === 'superadmin') {
                    logger.warn(`SECURITY: Master ${actingUid} attempted to delete ${targetUserRole} user ${uidToDelete}.`);
                    throw new https_1.HttpsError("permission-denied", "You cannot delete master or superadmin users.");
                }
                // Masters can only delete users from their own distributor
                if (targetUserDistributorId !== actingUserDistributorId) {
                    logger.warn(`SECURITY: Master ${actingUid} (distributor: ${actingUserDistributorId}) ` +
                        `attempted to delete user ${uidToDelete} from distributor ${targetUserDistributorId}.`);
                    throw new https_1.HttpsError("permission-denied", "You can only delete users from your own organization.");
                }
            }
        }
        logger.info(`User ${uidToDelete} is being deleted by ${actingUserRole} user ${actingUid} ` +
            `(distributor: ${actingUserDistributorId || 'N/A'}).`);
        // Proceed with deleting the user from Firebase Authentication
        await admin.auth().deleteUser(uidToDelete);
        logger.info(`Successfully deleted user ${uidToDelete} from Firebase Authentication.`);
        return { success: true, message: `User ${uidToDelete} has been deleted from authentication.` };
    }
    catch (error) {
        logger.error(`Error deleting user ${uidToDelete} from auth:`, error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        // Handle auth-specific errors
        if (error.code === 'auth/user-not-found') {
            throw new https_1.HttpsError('not-found', 'The user to delete was not found in Firebase Authentication.');
        }
        throw new https_1.HttpsError("internal", "An internal error occurred while deleting the user from authentication.");
    }
});
// This is a secure, server-side function to fetch all users.
// SECURITY: This function is restricted to superadmins ONLY.
// Master users should use getUsersByDistributorId for their own team.
exports.getAllUsers = (0, https_1.onCall)({ region: "europe-west4", cors: true }, async (request) => {
    var _a, _b;
    // CRITICAL: Check if the user is authenticated FIRST.
    if (!request.auth) {
        logger.warn("getAllUsers was called by an unauthenticated user.");
        throw new https_1.HttpsError("unauthenticated", "Authentication required.");
    }
    const uid = request.auth.uid;
    try {
        // Check if the user has the required role from Firestore.
        const userDoc = await admin.firestore().collection("users").doc(uid).get();
        const userRole = (_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.role;
        const userDistributorId = (_b = userDoc.data()) === null || _b === void 0 ? void 0 : _b.distributorId;
        // SECURITY FIX: Only superadmins can fetch ALL users across the platform.
        // This prevents cross-tenant data leakage where a master user could see
        // users from other distributors.
        if (userRole !== "superadmin") {
            logger.warn(`SECURITY: User ${uid} with role "${userRole}" (distributor: ${userDistributorId}) ` +
                `attempted to call getAllUsers. This function is restricted to superadmins only.`);
            throw new https_1.HttpsError("permission-denied", "Permission denied. Only superadmins can access all platform users. " +
                "Use the operators page to manage your team.");
        }
        logger.info(`getAllUsers called by superadmin: ${uid}`);
        // Proceed with fetching all user data
        const listUsersResult = await admin.auth().listUsers(1000);
        const allFirestoreUsers = await admin.firestore().collection("users").get();
        const firestoreUsersMap = new Map();
        allFirestoreUsers.forEach((doc) => {
            firestoreUsersMap.set(doc.id, processUserTimestamps(doc.data()));
        });
        const combinedUsers = listUsersResult.users.map((userRecord) => {
            const firestoreData = firestoreUsersMap.get(userRecord.uid) || {};
            return Object.assign({ uid: userRecord.uid, email: userRecord.email }, firestoreData);
        });
        return combinedUsers;
    }
    catch (error) {
        // If it's already an HttpsError, re-throw it.
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        // For any other errors, log them and throw a generic internal error.
        logger.error("Error fetching all users:", error);
        throw new https_1.HttpsError("internal", "An internal error occurred while fetching users.");
    }
});
// Syncs Firebase Auth Custom Claims based on Firestore user document changes.
// SECURITY: This function validates that role changes are legitimate to prevent privilege escalation.
exports.setCustomUserClaimsOnUserWrite = (0, firestore_1.onDocumentWritten)('users/{userId}', async (event) => {
    var _a, _b, _c, _d;
    const userId = event.params.userId;
    const beforeData = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before) === null || _b === void 0 ? void 0 : _b.data(); // Data before the write
    const afterData = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.after) === null || _d === void 0 ? void 0 : _d.data(); // Data after the write
    // If the document was deleted, clear all custom claims
    if (!afterData) {
        logger.info(`User document ${userId} deleted. Clearing custom claims.`);
        try {
            await admin.auth().setCustomUserClaims(userId, {});
        }
        catch (error) {
            logger.error(`Error clearing custom claims for user ${userId}:`, error);
        }
        return null;
    }
    // Get current claims from Firebase Auth
    const currentUser = await admin.auth().getUser(userId);
    const currentClaims = currentUser.customClaims || {};
    let newClaims = Object.assign({}, currentClaims);
    // SECURITY: Validate role changes
    // If the role is changing, verify it's a legitimate change
    const oldRole = beforeData === null || beforeData === void 0 ? void 0 : beforeData.role;
    const newRole = afterData.role;
    if (typeof newRole === 'string' && newRole !== oldRole) {
        // SECURITY CHECK: Prevent escalation to master or superadmin through direct Firestore writes
        // Only allow these role assignments if:
        // 1. It's a new user (no previous role) AND role is not master/superadmin, OR
        // 2. The previous role was already master/superadmin (legitimate admin action)
        // 3. The role is being downgraded (e.g., master -> worker)
        const isEscalation = (newRole === 'master' || newRole === 'superadmin');
        const wasPrivileged = (oldRole === 'master' || oldRole === 'superadmin');
        if (isEscalation && !wasPrivileged && oldRole !== undefined) {
            // Someone tried to escalate a regular user to master/superadmin
            // This should have been blocked by Firestore rules, but we add defense-in-depth
            logger.error(`SECURITY ALERT: Attempted privilege escalation detected for user ${userId}. ` +
                `Role change from "${oldRole}" to "${newRole}" was blocked. ` +
                `This may indicate a security rule bypass attempt.`);
            // Don't sync the escalated role - keep the old role in claims
            if (oldRole) {
                newClaims.role = oldRole;
            }
            else {
                delete newClaims.role;
            }
        }
        else {
            // Legitimate role change
            newClaims.role = newRole;
            logger.info(`Role updated for user ${userId}: "${oldRole}" -> "${newRole}"`);
        }
    }
    else if (typeof newRole === 'string') {
        newClaims.role = newRole;
    }
    else if (newClaims.role !== undefined) {
        delete newClaims.role;
    }
    // Controleer en update de 'distributorId' claim
    const distributorId = afterData.distributorId;
    if (typeof distributorId === 'string') {
        newClaims.distributorId = distributorId;
    }
    else if (newClaims.distributorId !== undefined) { // Als distributorId nu ontbreekt in Firestore, verwijder uit claims
        delete newClaims.distributorId;
    }
    // Controleer en update de 'accessibleDistributorIds' claim
    const accessibleDistributorIds = afterData.accessibleDistributorIds;
    if (Array.isArray(accessibleDistributorIds)) {
        newClaims.accessibleDistributorIds = accessibleDistributorIds;
    }
    else if (newClaims.accessibleDistributorIds !== undefined) { // Als array nu ontbreekt in Firestore, verwijder uit claims
        delete newClaims.accessibleDistributorIds;
    }
    // ** NIEUW ** Controleer en update de 'unreadChangelogs' claim
    const unreadChangelogs = afterData.unreadChangelogs;
    if (typeof unreadChangelogs === 'boolean') {
        newClaims.unreadChangelogs = unreadChangelogs;
    }
    else if (newClaims.unreadChangelogs !== undefined) { // Als veld nu ontbreekt, verwijder uit claims
        delete newClaims.unreadChangelogs;
    }
    // Controleer of de nieuwe claims daadwerkelijk verschillen van de huidige claims
    const claimsChanged = JSON.stringify(newClaims) !== JSON.stringify(currentClaims);
    if (claimsChanged) {
        try {
            await admin.auth().setCustomUserClaims(userId, newClaims);
            logger.info(`Custom claims set for user ${userId}:`, newClaims);
        }
        catch (error) {
            logger.error(`Error setting custom claims for user ${userId}:`, error);
        }
    }
    else {
        logger.info(`Custom claims for user ${userId} are already up to date.`);
    }
    return null;
});
//# sourceMappingURL=index.js.map