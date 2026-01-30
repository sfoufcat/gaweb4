/**
 * Migration script to update cohort squad names to new format:
 * Old: "{cohort.name} - Squad {n}"
 * New: "{program.name} ({cohort.name}) - Group {n}"
 *
 * Usage:
 *   npx ts-node scripts/migrate-squad-names.ts [--dry-run]
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

interface Squad {
  id: string;
  name: string;
  programId?: string;
  cohortId?: string;
  squadNumber?: number;
}

interface Program {
  id: string;
  name: string;
}

interface Cohort {
  id: string;
  name: string;
}

async function migrateSquadNames(dryRun: boolean) {
  console.log(`\n🚀 Starting squad name migration${dryRun ? ' (DRY RUN)' : ''}...\n`);

  // Get all squads with cohortId
  const squadsSnapshot = await db.collection('squads')
    .where('cohortId', '!=', null)
    .get();

  console.log(`Found ${squadsSnapshot.size} cohort squads to process\n`);

  // Build lookup maps for programs and cohorts
  const programIds = new Set<string>();
  const cohortIds = new Set<string>();

  squadsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.programId) programIds.add(data.programId);
    if (data.cohortId) cohortIds.add(data.cohortId);
  });

  // Fetch programs
  const programsMap = new Map<string, Program>();
  if (programIds.size > 0) {
    const programDocs = await Promise.all(
      Array.from(programIds).map(id => db.collection('programs').doc(id).get())
    );
    programDocs.forEach(doc => {
      if (doc.exists) {
        programsMap.set(doc.id, { id: doc.id, name: doc.data()?.name || 'Unknown Program' });
      }
    });
  }

  // Fetch cohorts
  const cohortsMap = new Map<string, Cohort>();
  if (cohortIds.size > 0) {
    const cohortDocs = await Promise.all(
      Array.from(cohortIds).map(id => db.collection('cohorts').doc(id).get())
    );
    cohortDocs.forEach(doc => {
      if (doc.exists) {
        cohortsMap.set(doc.id, { id: doc.id, name: doc.data()?.name || 'Unknown Cohort' });
      }
    });
  }

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const batch = db.batch();
  const MAX_BATCH_SIZE = 500;
  let batchCount = 0;

  for (const doc of squadsSnapshot.docs) {
    const squad = { id: doc.id, ...doc.data() } as Squad;

    const program = squad.programId ? programsMap.get(squad.programId) : null;
    const cohort = squad.cohortId ? cohortsMap.get(squad.cohortId) : null;

    if (!program || !cohort) {
      console.log(`⚠️  Skipping ${squad.id}: missing program or cohort`);
      skipped++;
      continue;
    }

    const squadNumber = squad.squadNumber || 1;
    const newName = `${program.name} (${cohort.name}) - Group ${squadNumber}`;

    if (squad.name === newName) {
      console.log(`✓  ${squad.id}: already correct`);
      skipped++;
      continue;
    }

    console.log(`📝 ${squad.id}:`);
    console.log(`   Old: "${squad.name}"`);
    console.log(`   New: "${newName}"`);

    if (!dryRun) {
      batch.update(doc.ref, { name: newName });
      batchCount++;

      // Commit batch if hitting limit
      if (batchCount >= MAX_BATCH_SIZE) {
        await batch.commit();
        console.log(`\n💾 Committed batch of ${batchCount} updates\n`);
        batchCount = 0;
      }
    }

    updated++;
  }

  // Commit remaining
  if (!dryRun && batchCount > 0) {
    await batch.commit();
    console.log(`\n💾 Committed final batch of ${batchCount} updates`);
  }

  console.log(`\n✅ Migration complete:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);

  if (dryRun) {
    console.log(`\n⚠️  This was a dry run. Run without --dry-run to apply changes.`);
  }
}

// Run
const dryRun = process.argv.includes('--dry-run');
migrateSquadNames(dryRun)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
