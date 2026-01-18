#!/usr/bin/env npx ts-node

/**
 * Migration Script: courseAssignments → resourceAssignments
 *
 * This script migrates program weeks from the legacy `courseAssignments`
 * format (DayCourseAssignment[]) to the unified `resourceAssignments`
 * format (WeekResourceAssignment[]).
 *
 * The migration:
 * 1. Reads all programs and program_instances
 * 2. For each week with courseAssignments:
 *    - Converts each DayCourseAssignment to WeekResourceAssignment
 *    - Merges with any existing resourceAssignments
 *    - Clears courseAssignments field
 * 3. Writes back the updated document
 *
 * Usage:
 *   npx ts-node scripts/migrate-course-assignments.ts [--dry-run]
 *
 * Options:
 *   --dry-run    Preview changes without writing to database
 */

import * as admin from 'firebase-admin';
import * as path from 'path';

// Initialize Firebase Admin
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  path.join(__dirname, '../service-account.json');

if (!admin.apps.length) {
  try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    console.log('Make sure FIREBASE_SERVICE_ACCOUNT_PATH or service-account.json exists');
    process.exit(1);
  }
}

const db = admin.firestore();

interface DayCourseAssignment {
  courseId: string;
  moduleIds?: string[];
  lessonIds?: string[];
}

interface WeekResourceAssignment {
  id: string;
  resourceType: 'course' | 'article' | 'document' | 'video' | 'link';
  resourceId: string;
  dayTag: 'week' | 'daily' | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  moduleIds?: string[];
  lessonIds?: string[];
  isRequired?: boolean;
  order?: number;
}

interface ProgramWeek {
  weekNumber: number;
  courseAssignments?: DayCourseAssignment[];
  resourceAssignments?: WeekResourceAssignment[];
  [key: string]: unknown;
}

interface MigrationStats {
  programsChecked: number;
  programsUpdated: number;
  instancesChecked: number;
  instancesUpdated: number;
  weeksUpdated: number;
  assignmentsMigrated: number;
  errors: string[];
}

const stats: MigrationStats = {
  programsChecked: 0,
  programsUpdated: 0,
  instancesChecked: 0,
  instancesUpdated: 0,
  weeksUpdated: 0,
  assignmentsMigrated: 0,
  errors: [],
};

/**
 * Convert a DayCourseAssignment to WeekResourceAssignment
 */
function convertToResourceAssignment(
  ca: DayCourseAssignment,
  index: number
): WeekResourceAssignment {
  return {
    id: `migrated-${ca.courseId}-${Date.now()}-${index}`,
    resourceType: 'course',
    resourceId: ca.courseId,
    dayTag: 'week', // Legacy had no day targeting, default to week-level
    moduleIds: ca.moduleIds,
    lessonIds: ca.lessonIds,
    isRequired: false,
    order: index,
  };
}

/**
 * Migrate weeks from courseAssignments to resourceAssignments
 * Returns true if any changes were made
 */
function migrateWeeks(weeks: ProgramWeek[]): boolean {
  let changed = false;

  for (const week of weeks) {
    const courseAssignments = week.courseAssignments;

    if (!courseAssignments || courseAssignments.length === 0) {
      continue;
    }

    // Convert courseAssignments to resourceAssignments
    const newResourceAssignments = courseAssignments.map((ca, index) =>
      convertToResourceAssignment(ca, index)
    );

    // Merge with existing resourceAssignments (if any)
    const existingResourceAssignments = week.resourceAssignments || [];

    // Check for duplicates by resourceId (avoid re-migrating)
    const existingResourceIds = new Set(
      existingResourceAssignments.map((ra) => ra.resourceId)
    );

    const uniqueNewAssignments = newResourceAssignments.filter(
      (ra) => !existingResourceIds.has(ra.resourceId)
    );

    if (uniqueNewAssignments.length > 0) {
      // Merge: existing first, then new
      week.resourceAssignments = [
        ...existingResourceAssignments,
        ...uniqueNewAssignments,
      ];

      // Update order for all
      week.resourceAssignments.forEach((ra, i) => {
        ra.order = i;
      });

      stats.assignmentsMigrated += uniqueNewAssignments.length;
      stats.weeksUpdated++;
      changed = true;
    }

    // Clear courseAssignments (mark as migrated)
    delete week.courseAssignments;
  }

  return changed;
}

/**
 * Migrate a single program document
 */
async function migrateProgram(
  docRef: admin.firestore.DocumentReference,
  data: admin.firestore.DocumentData,
  dryRun: boolean
): Promise<boolean> {
  const weeks = data.weeks as ProgramWeek[] | undefined;

  if (!weeks || weeks.length === 0) {
    return false;
  }

  // Check if there are any courseAssignments to migrate
  const hasCourseAssignments = weeks.some(
    (w) => w.courseAssignments && w.courseAssignments.length > 0
  );

  if (!hasCourseAssignments) {
    return false;
  }

  console.log(`  Migrating program: ${docRef.id}`);

  const weeksCopy = JSON.parse(JSON.stringify(weeks));
  const changed = migrateWeeks(weeksCopy);

  if (changed && !dryRun) {
    await docRef.update({
      weeks: weeksCopy,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return changed;
}

/**
 * Migrate a single program_instances document
 */
async function migrateInstance(
  docRef: admin.firestore.DocumentReference,
  data: admin.firestore.DocumentData,
  dryRun: boolean
): Promise<boolean> {
  const weeks = data.weeks as ProgramWeek[] | undefined;

  if (!weeks || weeks.length === 0) {
    return false;
  }

  // Check if there are any courseAssignments to migrate
  const hasCourseAssignments = weeks.some(
    (w) => w.courseAssignments && w.courseAssignments.length > 0
  );

  if (!hasCourseAssignments) {
    return false;
  }

  console.log(`  Migrating instance: ${docRef.id}`);

  const weeksCopy = JSON.parse(JSON.stringify(weeks));
  const changed = migrateWeeks(weeksCopy);

  if (changed && !dryRun) {
    await docRef.update({
      weeks: weeksCopy,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return changed;
}

/**
 * Main migration function
 */
async function runMigration(dryRun: boolean) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Course Assignments Migration Script`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  console.log(`${'='.repeat(60)}\n`);

  // Migrate programs collection
  console.log('Checking programs collection...');
  const programsSnapshot = await db.collection('programs').get();

  for (const doc of programsSnapshot.docs) {
    stats.programsChecked++;
    try {
      const updated = await migrateProgram(doc.ref, doc.data(), dryRun);
      if (updated) {
        stats.programsUpdated++;
      }
    } catch (error) {
      const msg = `Error migrating program ${doc.id}: ${error}`;
      stats.errors.push(msg);
      console.error(`  ${msg}`);
    }
  }

  console.log(`\nPrograms: ${stats.programsUpdated}/${stats.programsChecked} updated`);

  // Migrate program_instances collection
  console.log('\nChecking program_instances collection...');
  const instancesSnapshot = await db.collection('program_instances').get();

  for (const doc of instancesSnapshot.docs) {
    stats.instancesChecked++;
    try {
      const updated = await migrateInstance(doc.ref, doc.data(), dryRun);
      if (updated) {
        stats.instancesUpdated++;
      }
    } catch (error) {
      const msg = `Error migrating instance ${doc.id}: ${error}`;
      stats.errors.push(msg);
      console.error(`  ${msg}`);
    }
  }

  console.log(`\nInstances: ${stats.instancesUpdated}/${stats.instancesChecked} updated`);

  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('MIGRATION SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`Programs checked:     ${stats.programsChecked}`);
  console.log(`Programs updated:     ${stats.programsUpdated}`);
  console.log(`Instances checked:    ${stats.instancesChecked}`);
  console.log(`Instances updated:    ${stats.instancesUpdated}`);
  console.log(`Weeks updated:        ${stats.weeksUpdated}`);
  console.log(`Assignments migrated: ${stats.assignmentsMigrated}`);
  console.log(`Errors:               ${stats.errors.length}`);

  if (stats.errors.length > 0) {
    console.log('\nErrors:');
    stats.errors.forEach((err) => console.log(`  - ${err}`));
  }

  if (dryRun) {
    console.log('\n*** DRY RUN - No changes were made ***');
    console.log('Run without --dry-run to apply changes.');
  } else {
    console.log('\n*** Migration complete ***');
  }

  console.log(`${'='.repeat(60)}\n`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Run the migration
runMigration(dryRun)
  .then(() => {
    console.log('Done.');
    process.exit(stats.errors.length > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
