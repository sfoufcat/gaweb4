import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Check if Firebase config is available
const isConfigValid = firebaseConfig.apiKey && firebaseConfig.projectId;

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let storage: FirebaseStorage | null = null;

if (isConfigValid) {
  try {
    // Initialize Firebase only if it hasn't been initialized yet
    app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
    
    // Export Firebase services
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
  } catch (error) {
    console.error('[Firebase] Initialization failed:', error);
  }
} else {
  // Only warn in browser environment, not during SSR
  if (typeof window !== 'undefined') {
    console.warn('[Firebase] Config missing. Client-side Firebase services unavailable.');
  }
}

export { db, auth, storage };
export default app;

