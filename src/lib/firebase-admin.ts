import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

// Initialize Firebase Admin SDK (server-side only)
const initAdmin = () => {
  if (getApps().length === 0) {
    console.log('[FIREBASE_ADMIN] Initializing...');
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

    // Check if running in a service account environment
    if (projectId && privateKey && clientEmail) {
      console.log('[FIREBASE_ADMIN] Using env vars for credentials');
      try {
        initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
          storageBucket,
        });
        console.log('[FIREBASE_ADMIN] Initialized successfully with cert');
      } catch (error) {
        console.error('[FIREBASE_ADMIN] Initialization error:', error);
      }
    } else {
      console.log('[FIREBASE_ADMIN] Missing env vars:', { 
        hasProjectId: !!projectId, 
        hasClientEmail: !!clientEmail, 
        hasPrivateKey: !!privateKey 
      });
      // Fallback to default credentials (useful for local development with gcloud)
      try {
        initializeApp({
          storageBucket,
        });
        console.log('[FIREBASE_ADMIN] Initialized with default credentials');
      } catch (error) {
        console.error('[FIREBASE_ADMIN] Default initialization error:', error);
      }
    }

    // Configure Firestore settings immediately after initialization
    // This must be done before any other Firestore operations
    // and only once when the app is first initialized
    try {
      const db = getFirestore();
      db.settings({ ignoreUndefinedProperties: true });
      console.log('[FIREBASE_ADMIN] Firestore settings configured');
    } catch (error) {
      console.error('[FIREBASE_ADMIN] Firestore settings error:', error);
    }
  }
};

// Initialize admin
initAdmin();

// Export Firestore, Auth, and Storage instances (settings already applied during init)
export const adminDb = getFirestore();
export const adminAuth = getAuth();
export const adminStorage = getStorage();

export { initAdmin };
