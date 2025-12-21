/**
 * Clear User Tracks Script
 * 
 * This script removes the deprecated `track` field from all users in Firebase.
 * Tracks have been fully deprecated in favor of coach-defined Programs.
 * 
 * What it does:
 * 1. Finds all users with a `track` field set
 * 2. Removes the `track` field from each user's Firebase document
 * 3. Logs migration results
 * 
 * Usage:
 *   doppler run -- npx tsx scripts/clear-user-tracks.ts [--dry-run]
 * 
 * Options:
 *   --dry-run    Preview changes without modifying any data
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin
if (!process.env.FIREBASE_PROJECT_ID) {
  console.error('❌ Missing Firebase environment variables');
  process.exit(1);
}

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore(app);

interface MigrationResult {
  usersWithTrack: number;
  usersCleared: number;
  errors: string[];
}

async function clearUserTracks(dryRun: boolean): Promise<MigrationResult> {
  console.log('\n========================================');
  console.log('🗑️  CLEAR USER TRACKS MIGRATION');
  console.log('========================================');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}\n`);

  const result: MigrationResult = {
    usersWithTrack: 0,
    usersCleared: 0,
    errors: [],
  };

  try {
    // Step 1: Find all users with a track field set
    console.log('--- Step 1: Finding users with track field ---');
    
    const usersSnapshot = await db.collection('users').get();
    const usersWithTrack: { id: string; email?: string; track: string }[] = [];
    
    for (const doc of usersSnapshot.docs) {
      const data = doc.data();
      if (data.track) {
        usersWithTrack.push({
          id: doc.id,
          email: data.email,
          track: data.track,
        });
      }
    }

    result.usersWithTrack = usersWithTrack.length;
    console.log(`✅ Found ${usersWithTrack.length} users with track field set\n`);

    if (usersWithTrack.length === 0) {
      console.log('✨ No users have track field set. Nothing to migrate.');
      return result;
    }

    // Log track distribution
    const trackCounts: Record<string, number> = {};
    for (const user of usersWithTrack) {
      trackCounts[user.track] = (trackCounts[user.track] || 0) + 1;
    }
    
    console.log('Track distribution:');
    for (const [track, count] of Object.entries(trackCounts)) {
      console.log(`   - ${track}: ${count} users`);
    }
    console.log('');

    // Step 2: Clear track field from each user
    console.log('--- Step 2: Clearing track fields ---\n');

    for (const user of usersWithTrack) {
      try {
        if (dryRun) {
          console.log(`[DRY RUN] Would clear track "${user.track}" from user ${user.id} (${user.email || 'no email'})`);
          result.usersCleared++;
        } else {
          await db.collection('users').doc(user.id).update({
            track: FieldValue.delete(),
            updatedAt: new Date().toISOString(),
            trackRemovedAt: new Date().toISOString(),
          });
          console.log(`✅ Cleared track "${user.track}" from user ${user.id} (${user.email || 'no email'})`);
          result.usersCleared++;
        }
      } catch (err) {
        const errorMsg = `Failed to clear track for user ${user.id}: ${err instanceof Error ? err.message : 'Unknown error'}`;
        console.error(`❌ ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }

    // Final summary
    console.log('\n========================================');
    console.log('📊 MIGRATION SUMMARY');
    console.log('========================================');
    console.log(`   Users with track: ${result.usersWithTrack}`);
    console.log(`   Users cleared: ${result.usersCleared}`);
    console.log(`   Errors: ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      console.log('\n   Errors:');
      for (const error of result.errors) {
        console.log(`   - ${error}`);
      }
    }

    if (dryRun) {
      console.log('\n⚠️  DRY RUN - No changes were made. Run without --dry-run to apply changes.\n');
    } else {
      console.log('\n✅ MIGRATION COMPLETE\n');
    }

    return result;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    result.errors.push(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }
}

// Check for dry run flag
const dryRun = process.argv.includes('--dry-run');

clearUserTracks(dryRun)
  .then((result) => {
    if (result.errors.length === 0) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });

