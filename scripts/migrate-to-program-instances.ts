/**
 * Migration Script: Program Instances
 *
 * This script migrates from the current fragmented collection structure to
 * the simplified program_instances architecture.
 *
 * BEFORE (10+ collections):
 * - program_days (template days)
 * - program_weeks (template weeks)
 * - client_program_days (per-client day content)
 * - client_program_weeks (per-client week content)
 * - cohort_program_days (per-cohort day content)
 * - cohort_week_content (per-cohort week content)
 * - cohort_task_states (cohort completion tracking)
 *
 * AFTER (3 collections):
 * - programs (templates - unchanged)
 * - program_instances (one per enrollment/cohort)
 * - tasks (completion tracking via instanceId + templateTaskId)
 *
 * Usage:
 *   npx ts-node scripts/migrate-to-program-instances.ts [--dry-run] [--org=<orgId>]
 *
 * Flags:
 *   --dry-run: Don't write any changes, just log what would happen
 *   --org=<orgId>: Only migrate data for a specific organization
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import type {
  Program,
  ProgramEnrollment,
  ProgramCohort,
  ProgramWeek,
  ProgramDay,
  ClientProgramDay,
  ClientProgramWeek,
  CohortProgramDay,
  CohortWeekContent,
  ProgramInstance,
  ProgramInstanceWeek,
  ProgramInstanceDay,
  ProgramInstanceTask,
  Task,
} from '../src/types';

// Initialize Firebase Admin
if (!getApps().length) {
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}'
  );
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const orgArg = args.find(a => a.startsWith('--org='));
const TARGET_ORG = orgArg ? orgArg.split('=')[1] : null;

console.log('='.repeat(60));
console.log('Program Instances Migration');
console.log('='.repeat(60));
console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`);
console.log(`Target: ${TARGET_ORG || 'All organizations'}`);
console.log('='.repeat(60));

// Statistics
const stats = {
  enrollmentsProcessed: 0,
  cohortsProcessed: 0,
  instancesCreated: 0,
  tasksUpdated: 0,
  errors: [] as string[],
};

/**
 * Convert old task format to new ProgramInstanceTask
 */
function convertTask(task: any): ProgramInstanceTask {
  return {
    id: task.id || crypto.randomUUID(),
    label: task.label || task.title || '',
    isPrimary: task.isPrimary ?? true,
    type: task.type,
    estimatedMinutes: task.estimatedMinutes,
    notes: task.notes,
    tag: task.tag,
    source: task.source,
  };
}

/**
 * Build weeks structure from template + customizations
 */
async function buildWeeksForInstance(
  program: Program,
  templateWeeks: ProgramWeek[],
  templateDays: ProgramDay[],
  customDays: (ClientProgramDay | CohortProgramDay)[],
  customWeeks: (ClientProgramWeek | CohortWeekContent)[],
  startDate: string
): Promise<ProgramInstanceWeek[]> {
  const weeks: ProgramInstanceWeek[] = [];
  const includeWeekends = program.includeWeekends !== false;
  const daysPerWeek = includeWeekends ? 7 : 5;

  // Sort template weeks by weekNumber
  const sortedTemplateWeeks = [...templateWeeks].sort((a, b) => a.weekNumber - b.weekNumber);

  for (const templateWeek of sortedTemplateWeeks) {
    const weekNumber = templateWeek.weekNumber;

    // Calculate calendar dates for this week
    const startDateObj = new Date(startDate);
    let weekStartDate: Date;

    if (weekNumber === 0) {
      // Onboarding week starts on startDate
      weekStartDate = startDateObj;
    } else {
      // Regular weeks: calculate from startDate
      // Find the first Monday after onboarding
      const firstMonday = new Date(startDateObj);
      const dayOfWeek = firstMonday.getDay();
      const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
      firstMonday.setDate(firstMonday.getDate() + daysUntilMonday);

      // Add (weekNumber - 1) * 7 days
      weekStartDate = new Date(firstMonday);
      weekStartDate.setDate(weekStartDate.getDate() + (weekNumber - 1) * 7);
    }

    // Find custom week content
    const customWeek = customWeeks.find(w =>
      ('weekNumber' in w && w.weekNumber === weekNumber) ||
      ('templateWeekId' in w && w.templateWeekId === templateWeek.id)
    );

    // Build days for this week
    const instanceDays: ProgramInstanceDay[] = [];
    const startDayIndex = templateWeek.startDayIndex || (weekNumber === 0 ? 1 : (weekNumber - 1) * daysPerWeek + 1);
    const endDayIndex = templateWeek.endDayIndex || startDayIndex + daysPerWeek - 1;

    for (let dayIdx = startDayIndex; dayIdx <= endDayIndex; dayIdx++) {
      // Find template day
      const templateDay = templateDays.find(d => d.dayIndex === dayIdx);

      // Find custom day
      const customDay = customDays.find(d => d.dayIndex === dayIdx);

      // Calculate day within week (1-7)
      const dayWithinWeek = ((dayIdx - startDayIndex) % daysPerWeek) + 1;

      // Calculate calendar date
      const dayDate = new Date(weekStartDate);
      dayDate.setDate(dayDate.getDate() + dayWithinWeek - 1);
      const calendarDate = dayDate.toISOString().split('T')[0];

      // Merge template + custom content
      const tasks = (customDay?.tasks || templateDay?.tasks || []).map(convertTask);

      instanceDays.push({
        dayIndex: dayWithinWeek,
        globalDayIndex: dayIdx,
        calendarDate,
        title: customDay?.title || templateDay?.title,
        summary: customDay?.summary || templateDay?.summary,
        dailyPrompt: customDay?.dailyPrompt || templateDay?.dailyPrompt,
        tasks,
        habits: customDay?.habits || templateDay?.habits,
        courseAssignments: customDay?.courseAssignments || templateDay?.courseAssignments,
        hasLocalChanges: !!customDay,
      });
    }

    // Calculate week end date
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + instanceDays.length - 1);

    // Build week with merged content
    weeks.push({
      weekNumber,
      calendarStartDate: weekStartDate.toISOString().split('T')[0],
      calendarEndDate: weekEndDate.toISOString().split('T')[0],
      // CohortWeekContent doesn't have name/theme/description - only ClientProgramWeek does
      name: ('name' in (customWeek || {}) ? (customWeek as ClientProgramWeek)?.name : undefined) || templateWeek.name,
      theme: ('theme' in (customWeek || {}) ? (customWeek as ClientProgramWeek)?.theme : undefined) || templateWeek.theme,
      description: ('description' in (customWeek || {}) ? (customWeek as ClientProgramWeek)?.description : undefined) || templateWeek.description,
      weeklyPrompt: customWeek?.weeklyPrompt || templateWeek.weeklyPrompt,
      weeklyTasks: (customWeek?.weeklyTasks || templateWeek.weeklyTasks || []).map(convertTask),
      days: instanceDays,
      coachRecordingUrl: customWeek?.coachRecordingUrl || templateWeek.coachRecordingUrl,
      coachRecordingNotes: customWeek?.coachRecordingNotes || templateWeek.coachRecordingNotes,
      linkedSummaryIds: customWeek?.linkedSummaryIds,
      linkedCallEventIds: customWeek?.linkedCallEventIds,
      distribution: customWeek?.distribution || templateWeek.distribution,
      hasLocalChanges: !!customWeek,
    });
  }

  return weeks;
}

/**
 * Migrate an individual enrollment to a program instance
 */
async function migrateEnrollment(enrollment: ProgramEnrollment): Promise<void> {
  const enrollmentId = enrollment.id;
  const programId = enrollment.programId;
  const userId = enrollment.userId;

  console.log(`  Processing enrollment ${enrollmentId} for user ${userId}...`);

  try {
    // Get program template
    const programDoc = await db.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      throw new Error(`Program ${programId} not found`);
    }
    const program = { id: programDoc.id, ...programDoc.data() } as Program;

    // Get template weeks
    const templateWeeksSnap = await db.collection('program_weeks')
      .where('programId', '==', programId)
      .get();
    const templateWeeks = templateWeeksSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProgramWeek));

    // Get template days
    const templateDaysSnap = await db.collection('program_days')
      .where('programId', '==', programId)
      .get();
    const templateDays = templateDaysSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProgramDay));

    // Get client-specific days
    const clientDaysSnap = await db.collection('client_program_days')
      .where('enrollmentId', '==', enrollmentId)
      .get();
    const clientDays = clientDaysSnap.docs.map(d => ({ id: d.id, ...d.data() } as ClientProgramDay));

    // Get client-specific weeks
    const clientWeeksSnap = await db.collection('client_program_weeks')
      .where('enrollmentId', '==', enrollmentId)
      .get();
    const clientWeeks = clientWeeksSnap.docs.map(d => ({ id: d.id, ...d.data() } as ClientProgramWeek));

    // Calculate start date (startedAt is the enrollment field)
    const startDate = enrollment.startedAt?.split('T')[0] || enrollment.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0];

    // Build weeks structure
    const weeks = await buildWeeksForInstance(
      program,
      templateWeeks,
      templateDays,
      clientDays,
      clientWeeks,
      startDate
    );

    // Create program instance
    const instance: Omit<ProgramInstance, 'id'> = {
      programId,
      organizationId: program.organizationId,
      type: 'individual',
      userId,
      enrollmentId,
      startDate,
      weeks,
      includeWeekends: program.includeWeekends,
      dailyFocusSlots: program.dailyFocusSlots,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!DRY_RUN) {
      const instanceRef = await db.collection('program_instances').add(instance);
      console.log(`    Created instance ${instanceRef.id}`);

      // Update existing tasks to reference the new instance
      const tasksSnap = await db.collection('tasks')
        .where('userId', '==', userId)
        .where('programEnrollmentId', '==', enrollmentId)
        .get();

      const batch = db.batch();
      let taskCount = 0;

      for (const taskDoc of tasksSnap.docs) {
        const taskData = taskDoc.data() as Task;
        batch.update(taskDoc.ref, {
          instanceId: instanceRef.id,
          templateTaskId: taskData.programTaskId || null,
        });
        taskCount++;
      }

      if (taskCount > 0) {
        await batch.commit();
        console.log(`    Updated ${taskCount} tasks`);
        stats.tasksUpdated += taskCount;
      }

      stats.instancesCreated++;
    } else {
      console.log(`    [DRY RUN] Would create instance with ${weeks.length} weeks`);
    }

    stats.enrollmentsProcessed++;
  } catch (err) {
    const error = `Error migrating enrollment ${enrollmentId}: ${err}`;
    console.error(`    ${error}`);
    stats.errors.push(error);
  }
}

/**
 * Migrate a cohort to a program instance
 */
async function migrateCohort(cohort: ProgramCohort): Promise<void> {
  const cohortId = cohort.id;
  const programId = cohort.programId;

  console.log(`  Processing cohort ${cohortId} (${cohort.name})...`);

  try {
    // Get program template
    const programDoc = await db.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      throw new Error(`Program ${programId} not found`);
    }
    const program = { id: programDoc.id, ...programDoc.data() } as Program;

    // Get template weeks
    const templateWeeksSnap = await db.collection('program_weeks')
      .where('programId', '==', programId)
      .get();
    const templateWeeks = templateWeeksSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProgramWeek));

    // Get template days
    const templateDaysSnap = await db.collection('program_days')
      .where('programId', '==', programId)
      .get();
    const templateDays = templateDaysSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProgramDay));

    // Get cohort-specific days
    const cohortDaysSnap = await db.collection('cohort_program_days')
      .where('cohortId', '==', cohortId)
      .get();
    const cohortDays = cohortDaysSnap.docs.map(d => ({ id: d.id, ...d.data() } as CohortProgramDay));

    // Get cohort-specific weeks
    const cohortWeeksSnap = await db.collection('cohort_week_content')
      .where('cohortId', '==', cohortId)
      .get();
    const cohortWeeks = cohortWeeksSnap.docs.map(d => ({ id: d.id, ...d.data() } as CohortWeekContent));

    // Calculate start date
    const startDate = cohort.startDate || new Date().toISOString().split('T')[0];

    // Build weeks structure
    const weeks = await buildWeeksForInstance(
      program,
      templateWeeks,
      templateDays,
      cohortDays,
      cohortWeeks,
      startDate
    );

    // Create program instance
    const instance: Omit<ProgramInstance, 'id'> = {
      programId,
      organizationId: program.organizationId,
      type: 'cohort',
      cohortId,
      startDate,
      weeks,
      includeWeekends: program.includeWeekends,
      dailyFocusSlots: program.dailyFocusSlots,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!DRY_RUN) {
      const instanceRef = await db.collection('program_instances').add(instance);
      console.log(`    Created instance ${instanceRef.id}`);

      // Get all enrollments in this cohort
      const enrollmentsSnap = await db.collection('program_enrollments')
        .where('cohortId', '==', cohortId)
        .get();

      // Update tasks for all cohort members
      let totalTaskCount = 0;
      for (const enrollmentDoc of enrollmentsSnap.docs) {
        const enrollment = enrollmentDoc.data() as ProgramEnrollment;

        const tasksSnap = await db.collection('tasks')
          .where('userId', '==', enrollment.userId)
          .where('programEnrollmentId', '==', enrollmentDoc.id)
          .get();

        const batch = db.batch();
        for (const taskDoc of tasksSnap.docs) {
          const taskData = taskDoc.data() as Task;
          batch.update(taskDoc.ref, {
            instanceId: instanceRef.id,
            templateTaskId: taskData.programTaskId || null,
          });
          totalTaskCount++;
        }

        if (tasksSnap.docs.length > 0) {
          await batch.commit();
        }
      }

      if (totalTaskCount > 0) {
        console.log(`    Updated ${totalTaskCount} tasks across ${enrollmentsSnap.size} members`);
        stats.tasksUpdated += totalTaskCount;
      }

      stats.instancesCreated++;
    } else {
      console.log(`    [DRY RUN] Would create instance with ${weeks.length} weeks`);
    }

    stats.cohortsProcessed++;
  } catch (err) {
    const error = `Error migrating cohort ${cohortId}: ${err}`;
    console.error(`    ${error}`);
    stats.errors.push(error);
  }
}

/**
 * Main migration function
 */
async function migrate(): Promise<void> {
  console.log('\nStarting migration...\n');

  // Build query for programs
  const programsQueryBase = db.collection('programs').where('type', '==', 'individual');
  const programsQuery = TARGET_ORG
    ? programsQueryBase.where('organizationId', '==', TARGET_ORG)
    : programsQueryBase;

  // PHASE 1: Migrate individual program enrollments
  console.log('PHASE 1: Migrating individual program enrollments...');
  const individualPrograms = await programsQuery.get();

  for (const programDoc of individualPrograms.docs) {
    const program = { id: programDoc.id, ...programDoc.data() } as Program;
    console.log(`\nProgram: ${program.name} (${program.id})`);

    // Get enrollments for this program
    const enrollmentsSnap = await db.collection('program_enrollments')
      .where('programId', '==', program.id)
      .where('status', 'in', ['active', 'upcoming', 'completed'])
      .get();

    console.log(`  Found ${enrollmentsSnap.size} enrollments`);

    for (const enrollmentDoc of enrollmentsSnap.docs) {
      const enrollment = { id: enrollmentDoc.id, ...enrollmentDoc.data() } as ProgramEnrollment;

      // Skip if enrollment already has an instance
      const existingInstance = await db.collection('program_instances')
        .where('enrollmentId', '==', enrollment.id)
        .limit(1)
        .get();

      if (!existingInstance.empty) {
        console.log(`  Skipping enrollment ${enrollment.id} - instance already exists`);
        continue;
      }

      await migrateEnrollment(enrollment);
    }
  }

  // PHASE 2: Migrate cohort program instances
  console.log('\n\nPHASE 2: Migrating cohort programs...');
  const cohortsCollection = db.collection('program_cohorts');
  const cohortsQuery = TARGET_ORG
    ? cohortsCollection.where('organizationId', '==', TARGET_ORG)
    : cohortsCollection;

  const cohorts = await cohortsQuery.get();

  for (const cohortDoc of cohorts.docs) {
    const cohort = { id: cohortDoc.id, ...cohortDoc.data() } as ProgramCohort;

    // Skip if cohort already has an instance
    const existingInstance = await db.collection('program_instances')
      .where('cohortId', '==', cohort.id)
      .limit(1)
      .get();

    if (!existingInstance.empty) {
      console.log(`  Skipping cohort ${cohort.id} - instance already exists`);
      continue;
    }

    await migrateCohort(cohort);
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('MIGRATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`Enrollments processed: ${stats.enrollmentsProcessed}`);
  console.log(`Cohorts processed: ${stats.cohortsProcessed}`);
  console.log(`Instances created: ${stats.instancesCreated}`);
  console.log(`Tasks updated: ${stats.tasksUpdated}`);
  console.log(`Errors: ${stats.errors.length}`);

  if (stats.errors.length > 0) {
    console.log('\nErrors:');
    stats.errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes were made. Remove --dry-run to execute migration.');
  }
}

// Run migration
migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
