
import * as admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';

// Note: This script expects environment variables to be loaded (e.g. via doppler)

// Initialize Firebase Admin
if (!getApps().length) {
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    console.error('❌ Missing Firebase environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

async function listSquads() {
  console.log('Listing all squads...');
  const snapshot = await db.collection('squads').get();
  
  if (snapshot.empty) {
    console.log('No squads found.');
    return;
  }

  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id}`);
    console.log(`Name: ${data.name}`);
    console.log(`Visibility: ${data.visibility} (Type: ${typeof data.visibility})`);
    console.log(`IsPremium: ${data.isPremium} (Type: ${typeof data.isPremium})`);
    console.log('---');
  });
}

listSquads().catch(console.error);
