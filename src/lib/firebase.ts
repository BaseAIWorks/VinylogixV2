
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// =====================================================================================
// IMPORTANT: REPLACE THE PLACEHOLDER VALUES BELOW
// You can find these details in your Firebase project settings.
// Go to: Project Overview > Project settings (gear icon) > General > Your apps > Select your web app > Config
// =====================================================================================
const firebaseConfig = {
  // Found in Firebase Console: Project settings > General > Your apps > Config
  apiKey: "AIzaSyBNHIP0cIjg8abv8jLZ5bT6hlwRBJt01qQ", 
  
  // Found in Firebase Console: Project settings > General > Your apps > Config
  // Should be: [YOUR_PROJECT_ID].firebaseapp.com
  authDomain: "vinylogix-v1.firebaseapp.com", 
  
  // This is your permanent Project ID. This value should be correct.
  projectId: "vinylogix-v1", 
  
  // Found in Firebase Console: Project settings > General > Your apps > Config
  // Should be: [YOUR_PROJECT_ID].appspot.com
  storageBucket: "vinylogix-v1.firebasestorage.app", 
  
  // Found in Firebase Console: Project settings > General > Your apps > Config
  messagingSenderId: "709401169654",
  
  // Found in Firebase Console: Project settings > General > Your apps > Config
  appId: "1:709401169654:web:93a83783ae8bfe62e1a6d7",
  
    // Found in Firebase Console: Project settings > General > Your apps > Config
  measurementId: "G-Q91D5J3W1M",
};
// =====================================================================================
// END OF CONFIGURATION TO REPLACE
// =====================================================================================


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
