/**
 * Migration Script: Squad Architecture Cleanup
 * 
 * This script normalizes existing squad data after the isPremium → coachId migration:
 * 
 * 1. For squads with coachId but hasCoach undefined: sets hasCoach = true
 * 2. For squads with isPremium but no coachId: logs for review (data inconsistency)
 * 3. Does NOT delete any data - just normalization
 * 
 * Run with: npx ts-node -r tsconfig-paths/register scripts/migrate-squad-cleanup.ts
 */

import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Dry run mode - set to false to actually make changes
const DRY_RUN = true;

// Get service account from environment or file
const getServiceAccount = (): ServiceAccount => {
  // Try environment variable first (production)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY) as ServiceAccount;
  }
  
  // Try local file (development)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../firebase-service-account.json') as ServiceAccount;
  } catch {
    throw new Error('No Firebase service account found. Set FIREBASE_SERVICE_ACCOUNT_KEY env var or provide firebase-service-account.json');
  }
};

// Initialize Firebase Admin
let app;
try {
  app = initializeApp({
    credential: cert(getServiceAccount()),
  });
} catch (error) {
  // App might already be initialized
  console.log('Firebase app already initialized or error:', error);
  process.exit(1);
}

const db = getFirestore(app);

interface SquadData {
  coachId?: string | null;
  hasCoach?: boolean;
  isPremium?: boolean;
  name?: string;
}

interface MigrationStats {
  total: number;
  normalized: number;
  inconsistent: number;
  skipped: number;
  errors: number;
}

const log = (message: string, data?: unknown) => {
  if (data) {
    console.log(message, JSON.stringify(data, null, 2));
  } else {
    console.log(message);
  }
};

async function migrateSquads(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    normalized: 0,
    inconsistent: 0,
    skipped: 0,
    errors: 0,
  };

  log('\n📋 Processing squads...');
  
  const squadsSnapshot = await db.collection('squads').get();
  stats.total = squadsSnapshot.size;
  log(`Found ${stats.total} squads to process`);

  const batch = db.batch();
  let batchCount = 0;
  const MAX_BATCH_SIZE = 500;

  for (const doc of squadsSnapshot.docs) {
    const data = doc.data() as SquadData;

    try {
      // Case 1: Has coachId but hasCoach is undefined
      if (data.coachId && data.hasCoach === undefined) {
        if (DRY_RUN) {
          log(`  🔍 Would normalize squad ${doc.id} (${data.name}): coachId=${data.coachId}, hasCoach=undefined → hasCoach=true`);
        } else {
          batch.update(doc.ref, {
            hasCoach: true,
            updatedAt: FieldValue.serverTimestamp(),
          });
          batchCount++;
        }
        stats.normalized++;
        continue;
      }

      // Case 2: Has isPremium=true but no coachId (data inconsistency)
      if (data.isPremium === true && !data.coachId) {
        log(`  ⚠️ INCONSISTENT: Squad ${doc.id} (${data.name}) has isPremium=true but no coachId`);
        stats.inconsistent++;
        continue;
      }

      // Case 3: Already normalized or peer squad
      stats.skipped++;

    } catch (error) {
      console.error(`  ❌ Error processing squad ${doc.id}:`, error);
      stats.errors++;
    }

    // Commit batch if it's getting large
    if (!DRY_RUN && batchCount >= MAX_BATCH_SIZE) {
      await batch.commit();
      log(`  ✅ Committed batch of ${batchCount} updates`);
      batchCount = 0;
    }
  }

  // Commit remaining updates
  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
    log(`  ✅ Committed final batch of ${batchCount} updates`);
  }

  return stats;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Squad Architecture Cleanup Migration');
  console.log('Normalizes hasCoach field based on coachId');
  console.log('='.repeat(60));
  
  if (DRY_RUN) {
    console.log('\n🔵 DRY RUN MODE - No changes will be made');
    console.log('   Set DRY_RUN = false to apply changes\n');
  } else {
    console.log('\n🟢 LIVE MODE - Changes will be applied\n');
  }

  try {
    const stats = await migrateSquads();
    
    console.log('\n' + '='.repeat(60));
    console.log('Migration Summary');
    console.log('='.repeat(60));
    console.log(`Total squads:     ${stats.total}`);
    console.log(`Normalized:       ${stats.normalized}`);
    console.log(`Inconsistent:     ${stats.inconsistent} (logged for review)`);
    console.log(`Already OK:       ${stats.skipped}`);
    console.log(`Errors:           ${stats.errors}`);
    
    if (stats.inconsistent > 0) {
      console.log('\n⚠️ WARNING: Found squads with isPremium=true but no coachId.');
      console.log('   These may need manual review to assign a coach or set isPremium=false.');
    }
    
    if (DRY_RUN && stats.normalized > 0) {
      console.log('\n🔵 Run with DRY_RUN = false to apply these changes.');
    }
    
    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();

