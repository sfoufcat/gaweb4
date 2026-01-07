/**
 * Cohort Task Sync
 *
 * Synchronizes program tasks to all members of a cohort.
 * One-way sync: Coach program → Cohort members' Daily Focus
 */

import { adminDb } from '@/lib/firebase-admin';
import {
  syncProgramTasksToClientDay,
  getProgramV2,
  type SyncMode,
  type SyncProgramTasksToClientDayResult,
} from '@/lib/program-engine';
import {
  getOrCreateCohortTaskState,
  getProgramCompletionThreshold,
} from '@/lib/cohort-task-state';
import type { Program, ProgramCohort, ProgramEnrollment, ProgramTaskTemplate } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface SyncProgramTasksToCohortParams {
  programId: string;
  cohortId: string;
  date: string; // ISO date YYYY-MM-DD
  mode: SyncMode;
  coachUserId?: string;
}

export interface CohortMemberSyncResult {
  userId: string;
  enrollmentId: string;
  result: SyncProgramTasksToClientDayResult;
}

export interface SyncProgramTasksToCohortResult {
  success: boolean;
  cohortId: string;
  date: string;
  totalMembers: number;
  membersProcessed: number;
  membersFailed: number;
  totalTasksCreated: number;
  totalTasksSkipped: number;
  totalTasksReplaced: number;
  cohortTaskStatesCreated: number;
  memberResults: CohortMemberSyncResult[];
  errors: string[];
}

// ============================================================================
// Main Sync Function
// ============================================================================

/**
 * Sync program tasks to all active members of a cohort
 *
 * This function:
 * 1. Gets all active enrollments for the cohort
 * 2. For each member, calls syncProgramTasksToClientDay
 * 3. Creates/updates CohortTaskState documents for tracking aggregated completion
 */
export async function syncProgramTasksToCohort(
  params: SyncProgramTasksToCohortParams
): Promise<SyncProgramTasksToCohortResult> {
  const { programId, cohortId, date, mode, coachUserId } = params;
  const errors: string[] = [];

  console.log(`[COHORT_SYNC] Starting sync for cohort ${cohortId}, date ${date}, mode ${mode}`);

  // 1. Get the cohort
  const cohortDoc = await adminDb.collection('program_cohorts').doc(cohortId).get();
  if (!cohortDoc.exists) {
    return {
      success: false,
      cohortId,
      date,
      totalMembers: 0,
      membersProcessed: 0,
      membersFailed: 0,
      totalTasksCreated: 0,
      totalTasksSkipped: 0,
      totalTasksReplaced: 0,
      cohortTaskStatesCreated: 0,
      memberResults: [],
      errors: ['Cohort not found'],
    };
  }

  const cohort = { id: cohortDoc.id, ...cohortDoc.data() } as ProgramCohort;

  // Verify cohort belongs to program
  if (cohort.programId !== programId) {
    return {
      success: false,
      cohortId,
      date,
      totalMembers: 0,
      membersProcessed: 0,
      membersFailed: 0,
      totalTasksCreated: 0,
      totalTasksSkipped: 0,
      totalTasksReplaced: 0,
      cohortTaskStatesCreated: 0,
      memberResults: [],
      errors: ['Cohort does not belong to the specified program'],
    };
  }

  // 2. Get the program
  const program = await getProgramV2(programId);
  if (!program) {
    return {
      success: false,
      cohortId,
      date,
      totalMembers: 0,
      membersProcessed: 0,
      membersFailed: 0,
      totalTasksCreated: 0,
      totalTasksSkipped: 0,
      totalTasksReplaced: 0,
      cohortTaskStatesCreated: 0,
      memberResults: [],
      errors: ['Program not found'],
    };
  }

  // 3. Get all active enrollments for this cohort
  const enrollmentsSnapshot = await adminDb
    .collection('program_enrollments')
    .where('cohortId', '==', cohortId)
    .where('status', 'in', ['active', 'upcoming'])
    .get();

  const enrollments: ProgramEnrollment[] = enrollmentsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as ProgramEnrollment[];

  if (enrollments.length === 0) {
    return {
      success: true,
      cohortId,
      date,
      totalMembers: 0,
      membersProcessed: 0,
      membersFailed: 0,
      totalTasksCreated: 0,
      totalTasksSkipped: 0,
      totalTasksReplaced: 0,
      cohortTaskStatesCreated: 0,
      memberResults: [],
      errors: [],
    };
  }

  console.log(`[COHORT_SYNC] Found ${enrollments.length} active enrollments for cohort ${cohortId}`);

  // 4. Sync tasks to each member
  const memberResults: CohortMemberSyncResult[] = [];
  let membersProcessed = 0;
  let membersFailed = 0;
  let totalTasksCreated = 0;
  let totalTasksSkipped = 0;
  let totalTasksReplaced = 0;

  // Track unique tasks synced for CohortTaskState creation
  const syncedTasks: Map<string, { title: string; programDayIndex: number; templateId: string }> = new Map();

  for (const enrollment of enrollments) {
    try {
      const result = await syncProgramTasksToClientDay({
        userId: enrollment.userId,
        programEnrollmentId: enrollment.id,
        date,
        mode,
        coachUserId,
      });

      memberResults.push({
        userId: enrollment.userId,
        enrollmentId: enrollment.id,
        result,
      });

      if (result.success) {
        membersProcessed++;
        totalTasksCreated += result.tasksCreated;
        totalTasksSkipped += result.tasksSkipped;
        totalTasksReplaced += result.tasksReplaced;

        // Track the program day for CohortTaskState
        if (result.programDayIndex > 0 && result.tasksCreated > 0) {
          // We'll need to look up the tasks that were created to get their template IDs
          // For now, we track by day index - actual task tracking happens below
        }
      } else {
        membersFailed++;
        if (result.errors) {
          errors.push(...result.errors.map(e => `User ${enrollment.userId}: ${e}`));
        }
      }

      console.log(
        `[COHORT_SYNC] Synced user ${enrollment.userId}: ${result.tasksCreated} created, ${result.tasksSkipped} skipped`
      );
    } catch (err) {
      membersFailed++;
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to sync user ${enrollment.userId}: ${errorMsg}`);
      console.error(`[COHORT_SYNC] Error syncing user ${enrollment.userId}:`, err);
    }
  }

  // 5. Create/update CohortTaskState documents
  // Get the tasks that were just synced to track in cohort state
  let cohortTaskStatesCreated = 0;

  if (totalTasksCreated > 0) {
    try {
      cohortTaskStatesCreated = await createCohortTaskStatesForSyncedTasks(
        cohortId,
        programId,
        cohort.organizationId || program.organizationId,
        date,
        enrollments.map(e => e.userId)
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to create CohortTaskStates: ${errorMsg}`);
      console.error('[COHORT_SYNC] Error creating CohortTaskStates:', err);
    }
  }

  console.log(
    `[COHORT_SYNC] Completed sync for cohort ${cohortId}: ` +
      `${membersProcessed}/${enrollments.length} members, ` +
      `${totalTasksCreated} tasks created, ` +
      `${cohortTaskStatesCreated} states created`
  );

  return {
    success: membersFailed === 0,
    cohortId,
    date,
    totalMembers: enrollments.length,
    membersProcessed,
    membersFailed,
    totalTasksCreated,
    totalTasksSkipped,
    totalTasksReplaced,
    cohortTaskStatesCreated,
    memberResults,
    errors,
  };
}

// ============================================================================
// Helper: Create CohortTaskState documents from synced tasks
// ============================================================================

/**
 * After syncing tasks to members, create CohortTaskState documents
 * by looking at what tasks were actually created
 */
async function createCohortTaskStatesForSyncedTasks(
  cohortId: string,
  programId: string,
  organizationId: string,
  date: string,
  memberUserIds: string[]
): Promise<number> {
  // Get all tasks created for these users on this date with program source
  const tasksSnapshot = await adminDb
    .collection('tasks')
    .where('date', '==', date)
    .where('userId', 'in', memberUserIds.slice(0, 10)) // Firestore 'in' limit is 10
    .where('sourceProgramId', '==', programId)
    .get();

  // If we have more than 10 members, we need multiple queries
  const allTasks: Array<{ title: string; programDayIndex: number; sourceWeekId?: string; sourceProgramDayId?: string }> = [];

  tasksSnapshot.docs.forEach(doc => {
    const data = doc.data();
    allTasks.push({
      title: data.title,
      programDayIndex: data.programDayIndex || 0,
      sourceWeekId: data.sourceWeekId,
      sourceProgramDayId: data.sourceProgramDayId,
    });
  });

  // For more than 10 members, fetch in batches
  if (memberUserIds.length > 10) {
    for (let i = 10; i < memberUserIds.length; i += 10) {
      const batch = memberUserIds.slice(i, i + 10);
      const batchSnapshot = await adminDb
        .collection('tasks')
        .where('date', '==', date)
        .where('userId', 'in', batch)
        .where('sourceProgramId', '==', programId)
        .get();

      batchSnapshot.docs.forEach(doc => {
        const data = doc.data();
        allTasks.push({
          title: data.title,
          programDayIndex: data.programDayIndex || 0,
          sourceWeekId: data.sourceWeekId,
          sourceProgramDayId: data.sourceProgramDayId,
        });
      });
    }
  }

  // Deduplicate by title + day index (same task template)
  const uniqueTasks = new Map<string, typeof allTasks[0]>();
  for (const task of allTasks) {
    const key = `${task.title}:${task.programDayIndex}`;
    if (!uniqueTasks.has(key)) {
      uniqueTasks.set(key, task);
    }
  }

  // Create CohortTaskState for each unique task
  let statesCreated = 0;

  for (const [key, task] of uniqueTasks) {
    const templateId = task.sourceProgramDayId || task.sourceWeekId || key;

    await getOrCreateCohortTaskState({
      cohortId,
      programId,
      organizationId,
      programDayIndex: task.programDayIndex,
      taskTemplateId: templateId,
      taskTitle: task.title,
      date,
      memberIds: memberUserIds,
    });

    statesCreated++;
  }

  return statesCreated;
}

// ============================================================================
// Batch Sync: Sync to all active cohorts of a program
// ============================================================================

export interface SyncToAllCohortsParams {
  programId: string;
  date: string;
  mode: SyncMode;
  coachUserId?: string;
  syncHorizonDays?: number; // How many days ahead to sync (default 7)
}

export interface SyncToAllCohortsResult {
  success: boolean;
  programId: string;
  cohortsProcessed: number;
  cohortsFailed: number;
  results: Array<{
    cohortId: string;
    cohortName: string;
    result: SyncProgramTasksToCohortResult;
  }>;
  errors: string[];
}

/**
 * Sync program tasks to all active cohorts
 * Used when coach saves a program template change
 */
export async function syncProgramTasksToAllCohorts(
  params: SyncToAllCohortsParams
): Promise<SyncToAllCohortsResult> {
  const { programId, date, mode, coachUserId, syncHorizonDays = 7 } = params;
  const errors: string[] = [];

  console.log(`[COHORT_SYNC_ALL] Starting sync for program ${programId}, starting date ${date}`);

  // Get all active cohorts for this program
  const cohortsSnapshot = await adminDb
    .collection('program_cohorts')
    .where('programId', '==', programId)
    .where('status', 'in', ['active', 'upcoming'])
    .get();

  const cohorts: ProgramCohort[] = cohortsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as ProgramCohort[];

  if (cohorts.length === 0) {
    return {
      success: true,
      programId,
      cohortsProcessed: 0,
      cohortsFailed: 0,
      results: [],
      errors: [],
    };
  }

  console.log(`[COHORT_SYNC_ALL] Found ${cohorts.length} active cohorts`);

  // Generate dates for sync horizon
  const datesToSync: string[] = [];
  const startDate = new Date(date);
  for (let i = 0; i < syncHorizonDays; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    datesToSync.push(d.toISOString().split('T')[0]);
  }

  // Sync each cohort
  const results: SyncToAllCohortsResult['results'] = [];
  let cohortsProcessed = 0;
  let cohortsFailed = 0;

  for (const cohort of cohorts) {
    // For each cohort, sync all dates in horizon
    let cohortHadErrors = false;
    let aggregatedResult: SyncProgramTasksToCohortResult | null = null;

    for (const syncDate of datesToSync) {
      try {
        const result = await syncProgramTasksToCohort({
          programId,
          cohortId: cohort.id,
          date: syncDate,
          mode,
          coachUserId,
        });

        if (!aggregatedResult) {
          aggregatedResult = result;
        } else {
          // Aggregate results across dates
          aggregatedResult.membersProcessed += result.membersProcessed;
          aggregatedResult.totalTasksCreated += result.totalTasksCreated;
          aggregatedResult.totalTasksSkipped += result.totalTasksSkipped;
          aggregatedResult.totalTasksReplaced += result.totalTasksReplaced;
          aggregatedResult.cohortTaskStatesCreated += result.cohortTaskStatesCreated;
          aggregatedResult.errors.push(...result.errors);
          if (!result.success) {
            aggregatedResult.success = false;
          }
        }

        if (!result.success) {
          cohortHadErrors = true;
        }
      } catch (err) {
        cohortHadErrors = true;
        const errorMsg = err instanceof Error ? err.message : String(err);
        errors.push(`Cohort ${cohort.name} (${cohort.id}), date ${syncDate}: ${errorMsg}`);
      }
    }

    if (aggregatedResult) {
      results.push({
        cohortId: cohort.id,
        cohortName: cohort.name,
        result: aggregatedResult,
      });
    }

    if (cohortHadErrors) {
      cohortsFailed++;
    } else {
      cohortsProcessed++;
    }
  }

  console.log(
    `[COHORT_SYNC_ALL] Completed sync for program ${programId}: ` +
      `${cohortsProcessed}/${cohorts.length} cohorts successful`
  );

  return {
    success: cohortsFailed === 0,
    programId,
    cohortsProcessed,
    cohortsFailed,
    results,
    errors,
  };
}
