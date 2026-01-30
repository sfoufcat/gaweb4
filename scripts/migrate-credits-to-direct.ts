/**
 * Migration Script: Convert Minutes to Credits
 *
 * This script migrates the summaryCredits field from minutes-based storage
 * to direct credits storage.
 *
 * Before: { allocatedMinutes: 1200, usedMinutes: 60, purchasedMinutes: 12000, usedPurchasedMinutes: 4 }
 * After:  { allocatedCredits: 20, usedCredits: 1, purchasedCredits: 200, usedPurchasedCredits: 0 }
 *
 * Run with: doppler run -- npx ts-node scripts/migrate-credits-to-direct.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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

interface OldSummaryCredits {
  allocatedMinutes?: number;
  usedMinutes?: number;
  purchasedMinutes?: number;
  usedPurchasedMinutes?: number;
  periodStart?: string;
  periodEnd?: string;
}

interface NewSummaryCredits {
  allocatedCredits: number;
  usedCredits: number;
  purchasedCredits: number;
  usedPurchasedCredits: number;
  periodStart?: string;
  periodEnd?: string;
}

async function migrateCredits() {
  console.log('Starting credits migration...\n');

  const orgsSnapshot = await db.collection('organizations').get();
  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const orgDoc of orgsSnapshot.docs) {
    const orgId = orgDoc.id;
    const orgData = orgDoc.data();
    const oldCredits = orgData?.summaryCredits as OldSummaryCredits | undefined;

    // Skip if no summaryCredits
    if (!oldCredits) {
      console.log(`[SKIP] ${orgId}: No summaryCredits field`);
      skippedCount++;
      continue;
    }

    // Skip if already migrated (has allocatedCredits field)
    if ('allocatedCredits' in oldCredits) {
      console.log(`[SKIP] ${orgId}: Already migrated`);
      skippedCount++;
      continue;
    }

    // Convert minutes to credits (divide by 60)
    const newCredits: Record<string, number | string | null> = {
      allocatedCredits: Math.floor((oldCredits.allocatedMinutes ?? 0) / 60),
      usedCredits: Math.floor((oldCredits.usedMinutes ?? 0) / 60),
      purchasedCredits: Math.floor((oldCredits.purchasedMinutes ?? 0) / 60),
      usedPurchasedCredits: Math.floor((oldCredits.usedPurchasedMinutes ?? 0) / 60),
    };

    // Only include period fields if they exist
    if (oldCredits.periodStart !== undefined) {
      newCredits.periodStart = oldCredits.periodStart;
    }
    if (oldCredits.periodEnd !== undefined) {
      newCredits.periodEnd = oldCredits.periodEnd;
    }

    try {
      // Update the document with new fields
      await db.collection('organizations').doc(orgId).update({
        summaryCredits: newCredits,
      });

      console.log(`[MIGRATED] ${orgId}:`);
      console.log(`  allocatedMinutes: ${oldCredits.allocatedMinutes ?? 0} -> allocatedCredits: ${newCredits.allocatedCredits}`);
      console.log(`  usedMinutes: ${oldCredits.usedMinutes ?? 0} -> usedCredits: ${newCredits.usedCredits}`);
      console.log(`  purchasedMinutes: ${oldCredits.purchasedMinutes ?? 0} -> purchasedCredits: ${newCredits.purchasedCredits}`);
      console.log(`  usedPurchasedMinutes: ${oldCredits.usedPurchasedMinutes ?? 0} -> usedPurchasedCredits: ${newCredits.usedPurchasedCredits}`);
      migratedCount++;
    } catch (error) {
      console.error(`[ERROR] ${orgId}:`, error);
      errorCount++;
    }
  }

  console.log('\n--- Migration Summary ---');
  console.log(`Total organizations: ${orgsSnapshot.docs.length}`);
  console.log(`Migrated: ${migratedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
}

// Run the migration
migrateCredits()
  .then(() => {
    console.log('\nMigration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
