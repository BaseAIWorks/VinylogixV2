
"use client";
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth } from '@/lib/firebase';
import type { User } from '@/types';

// This function now calls a secure Cloud Function to get user data.
export async function getAllUsers(): Promise<User[]> {
    try {
        // Ensure the user's auth token is fresh and includes custom claims
        if (auth.currentUser) {
            await auth.currentUser.getIdToken(true); // Force refresh the token to include latest custom claims
        }
        
        const functions = getFunctions(app, 'europe-west4');
        const getAllUsersCallable = httpsCallable(functions, 'getAllUsers');
        const result = await getAllUsersCallable();
        return result.data as User[];
    } catch (error) {
        console.error("UserService: Error calling getAllUsers Cloud Function:", error);
        // We throw the error so the calling context (e.g., AuthProvider) can handle it.
        throw new Error(`Failed to fetch users from the server: ${(error as Error).message}`);
    }
}
