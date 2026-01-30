/**
 * Fix corrupted summaryCredits field in organizations collection
 * 
 * Problem: When summaryCredits object doesn't exist and we use dot notation
 * to update 'summaryCredits.purchasedMinutes', Firestore creates a literal
 * field named "summaryCredits.purchasedMinutes" instead of a nested object.
 * 
 * This script finds and fixes all affected organizations.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, FieldPath } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

// Load environment
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin using individual env vars
if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('Missing Firebase credentials in environment');
    console.error('Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    process.exit(1);
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const db = getFirestore();

async function fixCorruptedCredits() {
  console.log('Scanning organizations for corrupted summaryCredits...\n');
  
  const orgsSnapshot = await db.collection('organizations').get();
  let fixed = 0;
  let skipped = 0;
  
  for (const doc of orgsSnapshot.docs) {
    const data = doc.data();
    const orgId = doc.id;
    
    // Check for corrupted flat field (literal "summaryCredits.purchasedMinutes")
    const flatFieldValue = data['summaryCredits.purchasedMinutes'];
    const nestedValue = data.summaryCredits;
    
    if (flatFieldValue !== undefined) {
      console.log(`[${orgId}] Found corrupted flat field: ${flatFieldValue} minutes`);

      // Merge with any existing nested values if present
      const existingNested = nestedValue || {};

      // Step 1: Delete the corrupted flat field (literal field name with dot)
      // Use FieldPath to reference the literal field name, not a nested path
      await doc.ref.update(
        new FieldPath('summaryCredits.purchasedMinutes'),
        FieldValue.delete()
      );

      // Step 2: Create proper nested object
      await doc.ref.update({
        summaryCredits: {
          allocatedMinutes: existingNested.allocatedMinutes || 0,
          usedMinutes: existingNested.usedMinutes || 0,
          purchasedMinutes: flatFieldValue,
          usedPurchasedMinutes: existingNested.usedPurchasedMinutes || 0,
        },
      });

      console.log(`[${orgId}] Fixed! Created nested summaryCredits with purchasedMinutes: ${flatFieldValue}`);
      fixed++;
    } else {
      skipped++;
    }
  }
  
  console.log(`\nDone! Fixed: ${fixed}, Skipped: ${skipped}`);
}

fixCorruptedCredits()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
