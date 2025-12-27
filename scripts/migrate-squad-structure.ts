/**
 * Migration Script: isPremium → hasCoach & squadIds Array
 * 
 * This script migrates the database from the old dual-squad structure to the new multi-squad structure:
 * 
 * 1. SQUADS COLLECTION:
 *    - Adds hasCoach boolean based on existing isPremium field
 *    - Keeps isPremium for backward compatibility
 * 
 * 2. USERS COLLECTION:
 *    - Creates squadIds array from standardSquadId and premiumSquadId fields
 *    - Keeps legacy fields for backward compatibility
 * 
 * 3. ORG_MEMBERSHIPS COLLECTION:
 *    - Creates squadIds array from squadId and premiumSquadId fields
 *    - Keeps legacy fields for backward compatibility
 * 
 * Run with:
 *   npx ts-node --compiler-options '{"module":"commonjs","esModuleInterop":true}' scripts/migrate-squad-structure.ts
 * 
 * Options:
 *   --dry-run    Show what would be changed without making changes
 *   --verbose    Show detailed logs
 */

import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin
let app: App;
if (getApps().length === 0) {
  // Check for service account credentials
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccount) {
    console.error('Error: FIREBASE_SERVICE_ACCOUNT_KEY environment variable not set');
    console.error('Set it with: export FIREBASE_SERVICE_ACCOUNT_KEY="$(cat path/to/service-account.json)"');
    process.exit(1);
  }
  
  try {
    const credentials = JSON.parse(serviceAccount);
    app = initializeApp({
      credential: cert(credentials),
    });
  } catch (error) {
    console.error('Error parsing service account JSON:', error);
    process.exit(1);
  }
} else {
  app = getApps()[0];
}

const db: Firestore = getFirestore(app);

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');

function log(message: string, data?: unknown) {
  console.log(message);
  if (VERBOSE && data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

interface MigrationStats {
  squadsProcessed: number;
  squadsUpdated: number;
  usersProcessed: number;
  usersUpdated: number;
  membershipsProcessed: number;
  membershipsUpdated: number;
  errors: string[];
}

const stats: MigrationStats = {
  squadsProcessed: 0,
  squadsUpdated: 0,
  usersProcessed: 0,
  usersUpdated: 0,
  membershipsProcessed: 0,
  membershipsUpdated: 0,
  errors: [],
};

/**
 * Migrate squads: Add hasCoach field based on isPremium
 */
async function migrateSquads(): Promise<void> {
  log('\n📋 Migrating squads collection...');
  
  const squadsSnapshot = await db.collection('squads').get();
  log(`Found ${squadsSnapshot.size} squads to process`);
  
  const batch = db.batch();
  let batchCount = 0;
  const MAX_BATCH_SIZE = 500;
  
  for (const doc of squadsSnapshot.docs) {
    stats.squadsProcessed++;
    const data = doc.data();
    
    // Skip if already has hasCoach field
    if (data.hasCoach !== undefined) {
      if (VERBOSE) {
        log(`  ⏭️  Squad ${doc.id} already has hasCoach: ${data.hasCoach}`);
      }
      continue;
    }
    
    // Set hasCoach based on isPremium or coachId
    const hasCoach = data.isPremium === true || !!data.coachId;
    
    const updateData = {
      hasCoach,
      updatedAt: new Date().toISOString(),
    };
    
    if (DRY_RUN) {
      log(`  🔍 Would update squad ${doc.id}:`, { isPremium: data.isPremium, coachId: data.coachId, hasCoach });
    } else {
      batch.update(doc.ref, updateData);
      batchCount++;
    }
    
    stats.squadsUpdated++;
    
    // Commit batch if at limit
    if (batchCount >= MAX_BATCH_SIZE) {
      await batch.commit();
      log(`  ✅ Committed batch of ${batchCount} squad updates`);
      batchCount = 0;
    }
  }
  
  // Commit remaining
  if (batchCount > 0 && !DRY_RUN) {
    await batch.commit();
    log(`  ✅ Committed final batch of ${batchCount} squad updates`);
  }
  
  log(`✅ Squads: ${stats.squadsUpdated}/${stats.squadsProcessed} updated`);
}

/**
 * Migrate users: Create squadIds array from legacy fields
 */
async function migrateUsers(): Promise<void> {
  log('\n👤 Migrating users collection...');
  
  const usersSnapshot = await db.collection('users').get();
  log(`Found ${usersSnapshot.size} users to process`);
  
  const batch = db.batch();
  let batchCount = 0;
  const MAX_BATCH_SIZE = 500;
  
  for (const doc of usersSnapshot.docs) {
    stats.usersProcessed++;
    const data = doc.data();
    
    // Build squadIds array from legacy fields
    const squadIds: string[] = [];
    
    // Add existing squadIds if present
    if (data.squadIds && Array.isArray(data.squadIds)) {
      squadIds.push(...data.squadIds);
    }
    
    // Add standardSquadId if not already in array
    if (data.standardSquadId && !squadIds.includes(data.standardSquadId)) {
      squadIds.push(data.standardSquadId);
    }
    
    // Add premiumSquadId if not already in array
    if (data.premiumSquadId && !squadIds.includes(data.premiumSquadId)) {
      squadIds.push(data.premiumSquadId);
    }
    
    // Add legacy squadId if not already in array
    if (data.squadId && !squadIds.includes(data.squadId)) {
      squadIds.push(data.squadId);
    }
    
    // Skip if no squad IDs to add or squadIds already set correctly
    if (squadIds.length === 0) {
      if (VERBOSE) {
        log(`  ⏭️  User ${doc.id} has no squad memberships`);
      }
      continue;
    }
    
    // Check if squadIds is already correctly set
    const existingSquadIds = data.squadIds || [];
    if (existingSquadIds.length === squadIds.length && 
        existingSquadIds.every((id: string) => squadIds.includes(id))) {
      if (VERBOSE) {
        log(`  ⏭️  User ${doc.id} squadIds already up to date`);
      }
      continue;
    }
    
    const updateData = {
      squadIds,
      updatedAt: new Date().toISOString(),
    };
    
    if (DRY_RUN) {
      log(`  🔍 Would update user ${doc.id}:`, { 
        standardSquadId: data.standardSquadId,
        premiumSquadId: data.premiumSquadId,
        squadId: data.squadId,
        newSquadIds: squadIds 
      });
    } else {
      batch.update(doc.ref, updateData);
      batchCount++;
    }
    
    stats.usersUpdated++;
    
    // Commit batch if at limit
    if (batchCount >= MAX_BATCH_SIZE) {
      await batch.commit();
      log(`  ✅ Committed batch of ${batchCount} user updates`);
      batchCount = 0;
    }
  }
  
  // Commit remaining
  if (batchCount > 0 && !DRY_RUN) {
    await batch.commit();
    log(`  ✅ Committed final batch of ${batchCount} user updates`);
  }
  
  log(`✅ Users: ${stats.usersUpdated}/${stats.usersProcessed} updated`);
}

/**
 * Migrate org memberships: Create squadIds array from legacy fields
 */
async function migrateOrgMemberships(): Promise<void> {
  log('\n🏢 Migrating org_memberships collection...');
  
  const membershipsSnapshot = await db.collection('org_memberships').get();
  log(`Found ${membershipsSnapshot.size} memberships to process`);
  
  const batch = db.batch();
  let batchCount = 0;
  const MAX_BATCH_SIZE = 500;
  
  for (const doc of membershipsSnapshot.docs) {
    stats.membershipsProcessed++;
    const data = doc.data();
    
    // Build squadIds array from legacy fields
    const squadIds: string[] = [];
    
    // Add existing squadIds if present
    if (data.squadIds && Array.isArray(data.squadIds)) {
      squadIds.push(...data.squadIds);
    }
    
    // Add squadId if not already in array
    if (data.squadId && !squadIds.includes(data.squadId)) {
      squadIds.push(data.squadId);
    }
    
    // Add premiumSquadId if not already in array
    if (data.premiumSquadId && !squadIds.includes(data.premiumSquadId)) {
      squadIds.push(data.premiumSquadId);
    }
    
    // Skip if no squad IDs to add or squadIds already set correctly
    if (squadIds.length === 0) {
      if (VERBOSE) {
        log(`  ⏭️  Membership ${doc.id} has no squad memberships`);
      }
      continue;
    }
    
    // Check if squadIds is already correctly set
    const existingSquadIds = data.squadIds || [];
    if (existingSquadIds.length === squadIds.length && 
        existingSquadIds.every((id: string) => squadIds.includes(id))) {
      if (VERBOSE) {
        log(`  ⏭️  Membership ${doc.id} squadIds already up to date`);
      }
      continue;
    }
    
    const updateData = {
      squadIds,
      updatedAt: new Date().toISOString(),
    };
    
    if (DRY_RUN) {
      log(`  🔍 Would update membership ${doc.id}:`, { 
        squadId: data.squadId,
        premiumSquadId: data.premiumSquadId,
        newSquadIds: squadIds 
      });
    } else {
      batch.update(doc.ref, updateData);
      batchCount++;
    }
    
    stats.membershipsUpdated++;
    
    // Commit batch if at limit
    if (batchCount >= MAX_BATCH_SIZE) {
      await batch.commit();
      log(`  ✅ Committed batch of ${batchCount} membership updates`);
      batchCount = 0;
    }
  }
  
  // Commit remaining
  if (batchCount > 0 && !DRY_RUN) {
    await batch.commit();
    log(`  ✅ Committed final batch of ${batchCount} membership updates`);
  }
  
  log(`✅ Memberships: ${stats.membershipsUpdated}/${stats.membershipsProcessed} updated`);
}

/**
 * Main migration function
 */
async function runMigration(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Squad Structure Migration');
  console.log('isPremium → hasCoach + squadIds Array');
  console.log('='.repeat(60));
  
  if (DRY_RUN) {
    console.log('\n🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  const startTime = Date.now();
  
  try {
    await migrateSquads();
    await migrateUsers();
    await migrateOrgMemberships();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(60));
    console.log('Migration Summary');
    console.log('='.repeat(60));
    console.log(`Duration: ${duration}s`);
    console.log(`Squads: ${stats.squadsUpdated}/${stats.squadsProcessed} updated`);
    console.log(`Users: ${stats.usersUpdated}/${stats.usersProcessed} updated`);
    console.log(`Memberships: ${stats.membershipsUpdated}/${stats.membershipsProcessed} updated`);
    
    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors (${stats.errors.length}):`);
      stats.errors.forEach(err => console.log(`  - ${err}`));
    }
    
    if (DRY_RUN) {
      console.log('\n🔍 DRY RUN COMPLETE - Run without --dry-run to apply changes');
    } else {
      console.log('\n✅ Migration complete!');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});


