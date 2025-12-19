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

async function fixSquadVisibility() {
  const squadId = 'iX6tgYJe1cVfjTyWE3da';
  
  console.log(`Updating squad ${squadId} to set visibility to 'public'...`);
  
  const squadRef = db.collection('squads').doc(squadId);
  const squadDoc = await squadRef.get();
  
  if (!squadDoc.exists) {
    console.error(`❌ Squad ${squadId} not found`);
    process.exit(1);
  }
  
  const data = squadDoc.data();
  console.log(`Current visibility: ${data?.visibility} (Type: ${typeof data?.visibility})`);
  
  await squadRef.update({
    visibility: 'public',
  });
  
  console.log(`✅ Successfully updated squad ${squadId} visibility to 'public'`);
}

fixSquadVisibility().catch(console.error);









