/**
 * Migration Script: Fix Fixed-Duration Programs with Recurring Billing
 * 
 * This script finds all programs where:
 * - durationType is 'fixed' (or undefined, which defaults to fixed)
 * - subscriptionEnabled is true
 * 
 * And fixes them by:
 * - Setting subscriptionEnabled to false
 * - Setting billingInterval to null
 * 
 * The price is preserved - programs become one-time payment only.
 * 
 * Run with: npx ts-node scripts/migrate-fixed-program-billing.ts
 * 
 * Add --dry-run flag to preview changes without applying them:
 *   npx ts-node scripts/migrate-fixed-program-billing.ts --dry-run
 * 
 * IMPORTANT: Back up your database first!
 */

import * as admin from 'firebase-admin';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  // Try to use service account from environment or default credentials
  try {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch {
    // Fallback to application default credentials
    initializeApp();
  }
}

const db = getFirestore();

interface Program {
  id: string;
  name: string;
  organizationId: string;
  durationType?: 'fixed' | 'evergreen';
  subscriptionEnabled?: boolean;
  billingInterval?: 'monthly' | 'quarterly' | 'yearly';
  priceInCents?: number;
  lengthDays?: number;
  lengthWeeks?: number;
}

async function migrateFixedProgramBilling(dryRun: boolean = false) {
  console.log('========================================');
  console.log('Fixed-Duration Program Billing Migration');
  console.log('========================================');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be applied)'}`);
  console.log('');

  try {
    // Query all programs with subscriptionEnabled = true
    const programsSnapshot = await db
      .collection('programs')
      .where('subscriptionEnabled', '==', true)
      .get();

    console.log(`Found ${programsSnapshot.size} programs with subscriptionEnabled = true`);
    console.log('');

    const invalidPrograms: Program[] = [];
    
    // Filter to only fixed-duration programs (durationType !== 'evergreen')
    for (const doc of programsSnapshot.docs) {
      const program = { id: doc.id, ...doc.data() } as Program;
      const durationType = program.durationType || 'fixed'; // Default to 'fixed'
      
      if (durationType !== 'evergreen') {
        invalidPrograms.push(program);
      }
    }

    if (invalidPrograms.length === 0) {
      console.log('✅ No invalid programs found. All programs with recurring billing are Evergreen.');
      return;
    }

    console.log(`Found ${invalidPrograms.length} fixed-duration programs with recurring billing enabled:`);
    console.log('');

    // Log details of each invalid program
    for (const program of invalidPrograms) {
      console.log(`  📋 Program: ${program.name}`);
      console.log(`     ID: ${program.id}`);
      console.log(`     Organization: ${program.organizationId}`);
      console.log(`     Duration Type: ${program.durationType || 'fixed (default)'}`);
      console.log(`     Duration: ${program.lengthWeeks || Math.ceil((program.lengthDays || 0) / 7)} weeks`);
      console.log(`     Price: $${((program.priceInCents || 0) / 100).toFixed(2)}`);
      console.log(`     Billing: ${program.billingInterval || 'monthly'} recurring`);
      console.log(`     → Will change to: One-time payment of $${((program.priceInCents || 0) / 100).toFixed(2)}`);
      console.log('');
    }

    if (dryRun) {
      console.log('========================================');
      console.log('DRY RUN COMPLETE - No changes made');
      console.log('========================================');
      console.log(`Would update ${invalidPrograms.length} programs`);
      console.log('');
      console.log('To apply these changes, run without --dry-run flag');
      return;
    }

    // Apply the migration
    console.log('Applying migration...');
    console.log('');

    let successCount = 0;
    let errorCount = 0;

    for (const program of invalidPrograms) {
      try {
        await db.collection('programs').doc(program.id).update({
          subscriptionEnabled: false,
          billingInterval: FieldValue.delete(),
          updatedAt: new Date().toISOString(),
        });

        console.log(`  ✅ Updated: ${program.name} (${program.id})`);
        successCount++;
      } catch (error) {
        console.error(`  ❌ Failed to update: ${program.name} (${program.id})`);
        console.error(`     Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        errorCount++;
      }
    }

    console.log('');
    console.log('========================================');
    console.log('MIGRATION COMPLETE');
    console.log('========================================');
    console.log(`✅ Successfully updated: ${successCount} programs`);
    if (errorCount > 0) {
      console.log(`❌ Failed to update: ${errorCount} programs`);
    }
    console.log('');
    console.log('Note: Program prices have been preserved. They are now one-time payments.');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Check for --dry-run flag
const dryRun = process.argv.includes('--dry-run');

// Run the migration
migrateFixedProgramBilling(dryRun)
  .then(() => {
    console.log('');
    console.log('Migration script finished.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration error:', error);
    process.exit(1);
  });
