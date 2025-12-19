/**
 * Migration Script: Dual Squad Membership
 * 
 * This script migrates existing users from the legacy `squadId` field
 * to the new `standardSquadId` and `premiumSquadId` fields.
 * 
 * Migration logic:
 * 1. Find all users with a `squadId` set
 * 2. For each user, look up their squad to determine if it's premium or standard
 * 3. Set the appropriate field (standardSquadId or premiumSquadId)
 * 4. Keep the legacy squadId for backward compatibility
 * 
 * Run with: npx ts-node -r tsconfig-paths/register scripts/migrate-dual-squad.ts
 * 
 * Options:
 * --dry-run     Preview changes without writing to database
 * --verbose     Show detailed progress
 */

import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
function getFirebaseAdmin(): App {
  const existingApp = getApps()[0];
  if (existingApp) return existingApp;
  
  // Try to load from environment
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables.'
    );
  }
  
  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

interface MigrationStats {
  total: number;
  alreadyMigrated: number;
  migratedToPremium: number;
  migratedToStandard: number;
  squadNotFound: number;
  errors: number;
}

async function migrateUsers(dryRun: boolean = false, verbose: boolean = false): Promise<MigrationStats> {
  const app = getFirebaseAdmin();
  const db = getFirestore(app);
  
  const stats: MigrationStats = {
    total: 0,
    alreadyMigrated: 0,
    migratedToPremium: 0,
    migratedToStandard: 0,
    squadNotFound: 0,
    errors: 0,
  };
  
  console.log('\n🚀 Starting Dual Squad Migration');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}\n`);
  
  // Get all users with a squadId
  const usersSnapshot = await db.collection('users')
    .where('squadId', '!=', null)
    .get();
  
  stats.total = usersSnapshot.size;
  console.log(`Found ${stats.total} users with squadId to process\n`);
  
  // Cache squad lookups to reduce reads
  const squadCache = new Map<string, { isPremium: boolean; name: string } | null>();
  
  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;
    const userData = userDoc.data();
    const squadId = userData.squadId;
    
    try {
      // Check if already migrated
      if (userData.standardSquadId || userData.premiumSquadId) {
        stats.alreadyMigrated++;
        if (verbose) {
          console.log(`✓ User ${userId}: Already migrated`);
        }
        continue;
      }
      
      // Look up squad (use cache to reduce reads)
      let squadInfo = squadCache.get(squadId);
      if (squadInfo === undefined) {
        const squadDoc = await db.collection('squads').doc(squadId).get();
        if (squadDoc.exists) {
          const squadData = squadDoc.data();
          squadInfo = {
            isPremium: squadData?.isPremium || false,
            name: squadData?.name || 'Unknown Squad',
          };
        } else {
          squadInfo = null;
        }
        squadCache.set(squadId, squadInfo);
      }
      
      if (!squadInfo) {
        stats.squadNotFound++;
        if (verbose) {
          console.log(`⚠ User ${userId}: Squad ${squadId} not found, skipping`);
        }
        continue;
      }
      
      // Determine which field to set
      const fieldToSet = squadInfo.isPremium ? 'premiumSquadId' : 'standardSquadId';
      
      if (verbose) {
        console.log(`→ User ${userId}: Setting ${fieldToSet} = ${squadId} (${squadInfo.name})`);
      }
      
      if (!dryRun) {
        await db.collection('users').doc(userId).update({
          [fieldToSet]: squadId,
          updatedAt: new Date().toISOString(),
        });
      }
      
      if (squadInfo.isPremium) {
        stats.migratedToPremium++;
      } else {
        stats.migratedToStandard++;
      }
      
    } catch (error) {
      stats.errors++;
      console.error(`✗ User ${userId}: Error - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  return stats;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');
  
  try {
    const stats = await migrateUsers(dryRun, verbose);
    
    console.log('\n📊 Migration Summary');
    console.log('═'.repeat(40));
    console.log(`Total users processed:    ${stats.total}`);
    console.log(`Already migrated:         ${stats.alreadyMigrated}`);
    console.log(`Migrated to premium:      ${stats.migratedToPremium}`);
    console.log(`Migrated to standard:     ${stats.migratedToStandard}`);
    console.log(`Squad not found:          ${stats.squadNotFound}`);
    console.log(`Errors:                   ${stats.errors}`);
    console.log('═'.repeat(40));
    
    if (dryRun) {
      console.log('\n⚠️  This was a DRY RUN. No changes were made.');
      console.log('Run without --dry-run to apply changes.\n');
    } else {
      console.log('\n✅ Migration complete!\n');
    }
    
    process.exit(stats.errors > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();

