
// Import the individual modules to avoid potential conflicts
import { initializeApp, getApps, App, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let adminApp: App | null = null;
let adminDb: Firestore | null = null;

function initializeFirebaseAdmin(): App | null {
  // Only initialize on server-side
  if (typeof window !== 'undefined') {
    console.warn('Firebase Admin SDK should only be used on the server side.');
    return null;
  }

  try {
    // Check if already initialized
    const existingApps = getApps();
    if (existingApps.length > 0) {
      adminApp = existingApps[0];
      if (!adminDb) {
        adminDb = getFirestore(adminApp);
      }
      return adminApp;
    }

    console.log('Initializing Firebase Admin SDK with default credentials...');
    
    // In a managed environment like App Hosting, the SDK will automatically
    // find the service account credentials. We don't need to provide them manually.
    adminApp = initializeApp();
    
    adminDb = getFirestore(adminApp);
    console.log('Firebase Admin SDK initialized successfully!');
    return adminApp;
    
  } catch (error: any) {
    console.error('Firebase Admin SDK initialization error:', error);
    // Log the full error to help diagnose issues in the cloud environment.
    console.error('Full error object:', JSON.stringify(error));
    adminApp = null;
    adminDb = null;
    return null;
  }
}

export function getAdminDb(): Firestore | null {
  // Ensure the app is initialized before returning the db instance.
  if (!adminApp) {
    initializeFirebaseAdmin();
  }
  
  if (!adminDb) {
    // This check is important for logging if initialization failed for some reason.
    console.warn("Firebase Admin Firestore instance is not available. Admin operations will fail.");
  }
  
  return adminDb;
}

export function getAdminAuth() {
  // Ensure the app is initialized before returning the auth instance.
  if (!adminApp) {
    initializeFirebaseAdmin();
  }
  
  if (!adminApp) {
      console.warn("Firebase Admin App is not available. Auth operations will fail.");
      return null;
  }

  return getAuth(adminApp);
}
