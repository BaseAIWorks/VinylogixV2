
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// Firebase configuration - uses environment variables with fallbacks for Firebase Studio
// In Firebase Studio, these values are automatically available from the project
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBNHIP0cIjg8abv8jLZ5bT6hlwRBJt01qQ",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "vinylogix-v1.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "vinylogix-v1",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "vinylogix-v1.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "709401169654",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:709401169654:web:93a83783ae8bfe62e1a6d7",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-Q91D5J3W1M",
};


let app: FirebaseApp;
let authInstance: Auth;
let dbInstance: Firestore;
let storageInstance: FirebaseStorage;

// Initialize Firebase only if it hasn't been initialized yet
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

authInstance = getAuth(app);
dbInstance = getFirestore(app);
// Explicitly pass the app and storageBucket URL to ensure correct initialization
storageInstance = getStorage(app, `gs://${firebaseConfig.storageBucket}`);


// Initialize Analytics only on the client side
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      getAnalytics(app);
    }
  });
}


export { app, authInstance as auth, dbInstance as db, storageInstance as storage };
