/**
 * Migration Script: Resource Assignments
 *
 * This script migrates from individual resource linking fields to the unified
 * resourceAssignments format with dayTag support.
 *
 * BEFORE:
 * - linkedArticleIds: string[]
 * - linkedDownloadIds: string[]
 * - linkedLinkIds: string[]
 * - linkedQuestionnaireIds: string[]
 * - linkedCourseIds: string[]
 * - courseAssignments: DayCourseAssignment[]
 *
 * AFTER:
 * - resourceAssignments: WeekResourceAssignment[]
 *   (with dayTag: 'week' for all migrated records)
 *
 * Usage:
 *   npx ts-node scripts/migrate-resource-assignments.ts [--dry-run] [--org=<orgId>]
 *
 * Flags:
 *   --dry-run: Don't write any changes, just log what would happen
 *   --org=<orgId>: Only migrate data for a specific organization
 *   --rollback: Restore original fields from backup (if migration failed)
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type {
  ProgramInstanceWeek,
  ProgramWeek,
  WeekResourceAssignment,
  ResourceDayTag,
} from '../src/types';

// Initialize Firebase Admin
if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && privateKey && clientEmail) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
    console.log('Firebase Admin initialized with credentials');
  } else {
    console.error('Missing Firebase credentials. Required env vars:');
    console.error('  FIREBASE_PROJECT_ID:', !!projectId);
    console.error('  FIREBASE_CLIENT_EMAIL:', !!clientEmail);
    console.error('  FIREBASE_PRIVATE_KEY:', !!privateKey);
    process.exit(1);
  }
}

const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const ROLLBACK = args.includes('--rollback');
const orgArg = args.find(a => a.startsWith('--org='));
const TARGET_ORG = orgArg ? orgArg.split('=')[1] : null;

console.log('='.repeat(60));
console.log('Resource Assignments Migration');
console.log('='.repeat(60));
console.log(`Mode: ${ROLLBACK ? 'ROLLBACK' : (DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE')}`);
console.log(`Target: ${TARGET_ORG || 'All organizations'}`);
console.log('='.repeat(60));

// Statistics
const stats = {
  programsProcessed: 0,
  instancesProcessed: 0,
  weeksUpdated: 0,
  resourcesConverted: 0,
  errors: [] as string[],
};

// Type for course assignment (old format)
interface DayCourseAssignment {
  courseId: string;
  moduleIds?: string[];
  lessonIds?: string[];
  order?: number;
}

// Type for old week format with individual resource fields
interface OldWeekFormat {
  linkedArticleIds?: string[];
  linkedDownloadIds?: string[];
  linkedLinkIds?: string[];
  linkedQuestionnaireIds?: string[];
  linkedCourseIds?: string[];
  courseAssignments?: DayCourseAssignment[];
}

/**
 * Generate a unique ID for resource assignments
 */
function generateAssignmentId(type: string, resourceId: string): string {
  return `${type.substring(0, 3)}-${resourceId}-${Date.now().toString(36)}`;
}

/**
 * Convert old resource linking to unified resourceAssignments
 */
function convertToResourceAssignments(week: OldWeekFormat): WeekResourceAssignment[] {
  const assignments: WeekResourceAssignment[] = [];
  let order = 0;

  // Convert linked articles
  if (week.linkedArticleIds?.length) {
    for (const articleId of week.linkedArticleIds) {
      assignments.push({
        id: generateAssignmentId('article', articleId),
        resourceType: 'article',
        resourceId: articleId,
        dayTag: 'week' as ResourceDayTag,
        isRequired: false,
        order: order++,
      });
      stats.resourcesConverted++;
    }
  }

  // Convert linked downloads
  if (week.linkedDownloadIds?.length) {
    for (const downloadId of week.linkedDownloadIds) {
      assignments.push({
        id: generateAssignmentId('download', downloadId),
        resourceType: 'download',
        resourceId: downloadId,
        dayTag: 'week' as ResourceDayTag,
        isRequired: false,
        order: order++,
      });
      stats.resourcesConverted++;
    }
  }

  // Convert linked links
  if (week.linkedLinkIds?.length) {
    for (const linkId of week.linkedLinkIds) {
      assignments.push({
        id: generateAssignmentId('link', linkId),
        resourceType: 'link',
        resourceId: linkId,
        dayTag: 'week' as ResourceDayTag,
        isRequired: false,
        order: order++,
      });
      stats.resourcesConverted++;
    }
  }

  // Convert linked questionnaires
  if (week.linkedQuestionnaireIds?.length) {
    for (const questionnaireId of week.linkedQuestionnaireIds) {
      assignments.push({
        id: generateAssignmentId('questionnaire', questionnaireId),
        resourceType: 'questionnaire',
        resourceId: questionnaireId,
        dayTag: 'week' as ResourceDayTag,
        isRequired: false,
        order: order++,
      });
      stats.resourcesConverted++;
    }
  }

  // Convert course assignments (with moduleIds/lessonIds)
  if (week.courseAssignments?.length) {
    for (const ca of week.courseAssignments) {
      assignments.push({
        id: generateAssignmentId('course', ca.courseId),
        resourceType: 'course',
        resourceId: ca.courseId,
        moduleIds: ca.moduleIds,
        lessonIds: ca.lessonIds,
        dayTag: 'week' as ResourceDayTag,
        isRequired: false,
        order: ca.order ?? order++,
      });
      stats.resourcesConverted++;
    }
  }

  // Convert simple linked courses (without assignments)
  if (week.linkedCourseIds?.length) {
    for (const courseId of week.linkedCourseIds) {
      // Skip if already added via courseAssignments
      if (week.courseAssignments?.some(ca => ca.courseId === courseId)) {
        continue;
      }
      assignments.push({
        id: generateAssignmentId('course', courseId),
        resourceType: 'course',
        resourceId: courseId,
        dayTag: 'week' as ResourceDayTag,
        isRequired: false,
        order: order++,
      });
      stats.resourcesConverted++;
    }
  }

  return assignments;
}

/**
 * Check if a week has any old-format resource linking
 */
function hasOldResourceFormat(week: OldWeekFormat): boolean {
  return !!(
    week.linkedArticleIds?.length ||
    week.linkedDownloadIds?.length ||
    week.linkedLinkIds?.length ||
    week.linkedQuestionnaireIds?.length ||
    week.linkedCourseIds?.length ||
    week.courseAssignments?.length
  );
}

/**
 * Migrate a program's template weeks
 */
async function migrateProgram(programId: string, programName: string, weeks: ProgramWeek[]): Promise<ProgramWeek[] | null> {
  console.log(`  Processing program: ${programName} (${programId})`);

  let hasChanges = false;
  const migratedWeeks: ProgramWeek[] = [];

  for (const week of weeks) {
    const oldWeek = week as unknown as OldWeekFormat;

    if (hasOldResourceFormat(oldWeek)) {
      // Convert to new format
      const resourceAssignments = convertToResourceAssignments(oldWeek);

      // Create updated week with new format
      const updatedWeek: ProgramWeek = {
        ...week,
        resourceAssignments: [
          ...(week.resourceAssignments || []),
          ...resourceAssignments,
        ],
        // Keep old fields for backward compatibility during migration
        // They will be removed in a future cleanup
      };

      migratedWeeks.push(updatedWeek);
      hasChanges = true;
      stats.weeksUpdated++;
      console.log(`    Week ${week.weekNumber}: Converted ${resourceAssignments.length} resources`);
    } else {
      migratedWeeks.push(week);
    }
  }

  if (!hasChanges) {
    console.log(`    No resources to migrate`);
    return null;
  }

  return migratedWeeks;
}

/**
 * Migrate a program instance's weeks
 */
async function migrateInstance(instanceId: string, weeks: ProgramInstanceWeek[]): Promise<ProgramInstanceWeek[] | null> {
  let hasChanges = false;
  const migratedWeeks: ProgramInstanceWeek[] = [];

  for (const week of weeks) {
    const oldWeek = week as unknown as OldWeekFormat;

    if (hasOldResourceFormat(oldWeek)) {
      // Convert to new format
      const resourceAssignments = convertToResourceAssignments(oldWeek);

      // Create updated week with new format
      const updatedWeek: ProgramInstanceWeek = {
        ...week,
        resourceAssignments: [
          ...(week.resourceAssignments || []),
          ...resourceAssignments,
        ],
      };

      migratedWeeks.push(updatedWeek);
      hasChanges = true;
      stats.weeksUpdated++;
    } else {
      migratedWeeks.push(week);
    }
  }

  if (!hasChanges) {
    return null;
  }

  console.log(`    Instance ${instanceId}: Updated ${migratedWeeks.filter((_, i) =>
    hasOldResourceFormat(weeks[i] as unknown as OldWeekFormat)
  ).length} weeks`);

  return migratedWeeks;
}

/**
 * Main migration function
 */
async function migrate(): Promise<void> {
  console.log('\nStarting migration...\n');

  // PHASE 1: Migrate program templates
  console.log('PHASE 1: Migrating program templates...');

  const programsQuery = TARGET_ORG
    ? db.collection('programs').where('organizationId', '==', TARGET_ORG)
    : db.collection('programs');

  const programsSnap = await programsQuery.get();
  console.log(`Found ${programsSnap.size} programs`);

  for (const programDoc of programsSnap.docs) {
    const program = programDoc.data();
    const weeks = program.weeks as ProgramWeek[] | undefined;

    if (!weeks?.length) {
      continue;
    }

    const migratedWeeks = await migrateProgram(programDoc.id, program.name, weeks);

    if (migratedWeeks && !DRY_RUN) {
      await programDoc.ref.update({
        weeks: migratedWeeks,
        updatedAt: new Date().toISOString(),
      });
    }

    stats.programsProcessed++;
  }

  // PHASE 2: Migrate program instances
  console.log('\n\nPHASE 2: Migrating program instances...');

  const instancesQuery = TARGET_ORG
    ? db.collection('program_instances').where('organizationId', '==', TARGET_ORG)
    : db.collection('program_instances');

  const instancesSnap = await instancesQuery.get();
  console.log(`Found ${instancesSnap.size} instances`);

  for (const instanceDoc of instancesSnap.docs) {
    const instance = instanceDoc.data();
    const weeks = instance.weeks as ProgramInstanceWeek[] | undefined;

    if (!weeks?.length) {
      continue;
    }

    const migratedWeeks = await migrateInstance(instanceDoc.id, weeks);

    if (migratedWeeks && !DRY_RUN) {
      await instanceDoc.ref.update({
        weeks: migratedWeeks,
        updatedAt: new Date().toISOString(),
      });
    }

    stats.instancesProcessed++;
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('MIGRATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`Programs processed: ${stats.programsProcessed}`);
  console.log(`Instances processed: ${stats.instancesProcessed}`);
  console.log(`Weeks updated: ${stats.weeksUpdated}`);
  console.log(`Resources converted: ${stats.resourcesConverted}`);
  console.log(`Errors: ${stats.errors.length}`);

  if (stats.errors.length > 0) {
    console.log('\nErrors:');
    stats.errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes were made. Remove --dry-run to execute migration.');
  }
}

/**
 * Rollback function - removes resourceAssignments and relies on old fields
 */
async function rollback(): Promise<void> {
  console.log('\nStarting rollback...\n');
  console.log('Note: Rollback removes resourceAssignments field. Old fields are preserved.');

  // PHASE 1: Rollback program templates
  console.log('PHASE 1: Rolling back program templates...');

  const programsQuery = TARGET_ORG
    ? db.collection('programs').where('organizationId', '==', TARGET_ORG)
    : db.collection('programs');

  const programsSnap = await programsQuery.get();

  for (const programDoc of programsSnap.docs) {
    const program = programDoc.data();
    const weeks = program.weeks as ProgramWeek[] | undefined;

    if (!weeks?.length) continue;

    let hasAssignments = false;
    const rolledBackWeeks = weeks.map(week => {
      if (week.resourceAssignments?.length) {
        hasAssignments = true;
        const { resourceAssignments, ...rest } = week;
        return rest;
      }
      return week;
    });

    if (hasAssignments && !DRY_RUN) {
      await programDoc.ref.update({
        weeks: rolledBackWeeks,
        updatedAt: new Date().toISOString(),
      });
      console.log(`  Rolled back program: ${program.name}`);
    }
  }

  // PHASE 2: Rollback program instances
  console.log('\n\nPHASE 2: Rolling back program instances...');

  const instancesQuery = TARGET_ORG
    ? db.collection('program_instances').where('organizationId', '==', TARGET_ORG)
    : db.collection('program_instances');

  const instancesSnap = await instancesQuery.get();

  for (const instanceDoc of instancesSnap.docs) {
    const instance = instanceDoc.data();
    const weeks = instance.weeks as ProgramInstanceWeek[] | undefined;

    if (!weeks?.length) continue;

    let hasAssignments = false;
    const rolledBackWeeks = weeks.map(week => {
      if (week.resourceAssignments?.length) {
        hasAssignments = true;
        const { resourceAssignments, ...rest } = week;
        return rest;
      }
      return week;
    });

    if (hasAssignments && !DRY_RUN) {
      await instanceDoc.ref.update({
        weeks: rolledBackWeeks,
        updatedAt: new Date().toISOString(),
      });
      console.log(`  Rolled back instance: ${instanceDoc.id}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('ROLLBACK COMPLETE');
  console.log('='.repeat(60));

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes were made. Remove --dry-run to execute rollback.');
  }
}

// Run migration or rollback
(ROLLBACK ? rollback() : migrate())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Operation failed:', err);
    process.exit(1);
  });
