
'use server';
import { getAdminDb } from '@/lib/firebase-admin'; 
import { firestore } from 'firebase-admin';
import { Timestamp } from 'firebase/firestore';

export type ApiName = 'discogs' | 'gemini';

const API_LOGS_COLLECTION = 'apiLogs';

export async function logApiCall(api: ApiName, distributorId?: string): Promise<void> {
    const adminDb = getAdminDb();
    if (!adminDb) {
        console.warn(`Admin SDK not initialized. Skipping API log for '${api}'. Check server environment variables.`);
        return;
    }

    const logData: { api: ApiName; timestamp: any; distributorId?: string } = {
        api,
        timestamp: firestore.FieldValue.serverTimestamp(),
    };
    if (distributorId) {
        logData.distributorId = distributorId;
    }
    try {
        await adminDb.collection(API_LOGS_COLLECTION).add(logData);
    } catch (error) {
        console.error(`Failed to log API call for ${api}:`, error);
    }
}

export interface ApiLog {
    id: string;
    api: ApiName;
    timestamp: string; // ISO string
    distributorId?: string;
}

export async function getApiLogs(since: Date, distributorId?: string): Promise<ApiLog[]> {
    const adminDb = getAdminDb();
    if (!adminDb) {
        throw new Error("Could not fetch API logs. Admin SDK is not available.");
    }
    
    let query: firestore.Query<firestore.DocumentData> = adminDb
        .collection(API_LOGS_COLLECTION)
        .where("timestamp", ">=", Timestamp.fromDate(since));
    
    if (distributorId) {
        query = query.where("distributorId", "==", distributorId);
    }

    try {
        const querySnapshot = await query.get();
        return querySnapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                api: data.api,
                timestamp: (data.timestamp as firestore.Timestamp).toDate().toISOString(),
                distributorId: data.distributorId,
            }
        });
    } catch (error) {
        console.error("Error fetching API logs with Admin SDK:", error);
        throw new Error(`Could not fetch API logs. ${(error as Error).message}`);
    }
}
