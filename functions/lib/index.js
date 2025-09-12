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
exports.setCustomUserClaimsOnUserWrite = exports.getAllUsers = void 0;
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
// This is a secure, server-side function to fetch all users.
// It can only be called by authenticated users.
exports.getAllUsers = (0, https_1.onCall)({ region: "europe-west4" }, async (request) => {
    var _a;
    // CRITICAL: Check if the user is authenticated FIRST.
    if (!request.auth) {
        logger.warn("getAllUsers was called by an unauthenticated user.");
        // Throw a specific, structured error that the client can handle.
        throw new https_1.HttpsError("unauthenticated", "Authentication required.");
    }
    // Now that we know the user is authenticated, we can safely access their UID.
    const uid = request.auth.uid;
    try {
        // Check if the user has the required role from Firestore.
        const userDoc = await admin.firestore().collection("users").doc(uid).get();
        const userRole = (_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.role;
        if (userRole !== "master" && userRole !== "superadmin") {
            logger.error(`User ${uid} with role ${userRole} attempted to call getAllUsers.`);
            throw new https_1.HttpsError("permission-denied", "Permission denied. You must be a master user or superadmin.");
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
// NIEUWE FUNCTIE: stelt Firebase Auth Custom Claims in op basis van Firestore gebruikersdocument
exports.setCustomUserClaimsOnUserWrite = (0, firestore_1.onDocumentWritten)('users/{userId}', async (event) => {
    var _a, _b;
    const userId = event.params.userId; // <-- event.params
    const afterData = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.after) === null || _b === void 0 ? void 0 : _b.data(); // Data after the write (if exists)
    // Als het document is verwijderd (afterData is null)
    if (!afterData) {
        logger.info(`User document ${userId} deleted. Clearing custom claims.`);
        try {
            await admin.auth().setCustomUserClaims(userId, {}); // Cleart alle custom claims
        }
        catch (error) {
            logger.error(`Error clearing custom claims for user ${userId}:`, error);
        }
        return null;
    }
    // Verkrijg de huidige custom claims van de gebruiker
    const currentUser = await admin.auth().getUser(userId);
    const currentClaims = currentUser.customClaims || {};
    let newClaims = Object.assign({}, currentClaims); // Begin met huidige claims
    // Controleer en update de 'role' claim
    const role = afterData.role;
    if (typeof role === 'string') {
        newClaims.role = role;
    }
    else if (newClaims.role !== undefined) { // Als rol nu ontbreekt in Firestore, verwijder uit claims
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