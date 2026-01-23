import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, setLogLevel } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Suppress Firestore internal assertion errors (known SDK bug in v11.x)
// These errors occur during rapid mount/unmount cycles but don't affect functionality
// See: https://github.com/firebase/firebase-js-sdk/issues/9267
if (typeof window !== 'undefined') {
  // Helper to check if error is a Firestore internal assertion
  const isFirestoreInternalError = (value: unknown): boolean => {
    if (!value) return false;
    if (typeof value === 'string') {
      return value.includes('INTERNAL ASSERTION FAILED');
    }
    if (value instanceof Error) {
      return value.message?.includes('INTERNAL ASSERTION FAILED') ?? false;
    }
    if (typeof value === 'object' && 'message' in value) {
      return typeof (value as { message: unknown }).message === 'string' &&
        (value as { message: string }).message.includes('INTERNAL ASSERTION FAILED');
    }
    return false;
  };

  // Suppress console.error for Firestore internal errors
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (args.some(isFirestoreInternalError)) {
      return;
    }
    originalError.apply(console, args);
  };

  // Also suppress console.warn for these errors (some paths use warn)
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (args.some(isFirestoreInternalError)) {
      return;
    }
    originalWarn.apply(console, args);
  };

  // Catch unhandled promise rejections from Firestore
  window.addEventListener('unhandledrejection', (event) => {
    if (isFirestoreInternalError(event.reason)) {
      event.preventDefault();
    }
  });

  // Catch uncaught errors (window.onerror)
  window.addEventListener('error', (event) => {
    if (isFirestoreInternalError(event.error) || isFirestoreInternalError(event.message)) {
      event.preventDefault();
    }
  });
}

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

    // Suppress Firestore SDK internal logs (errors are still caught by our handlers)
    // This prevents the @firebase/firestore logger from outputting INTERNAL ASSERTION errors
    setLogLevel('silent');
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

