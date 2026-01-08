/**
 * Cohort Task State Utilities
 *
 * Functions for managing CohortTaskState documents which track
 * aggregated task completion across cohort members.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { CohortTaskState, CohortTaskStateMemberState, Program, ProgramCohort } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface CreateCohortTaskStateParams {
  cohortId: string;
  programId: string;
  organizationId: string;
  programDayIndex: number;
  taskTemplateId: string;
  taskTitle: string;
  programTaskId?: string; // Links to template task for robust matching
  date: string;
  memberIds: string[];
}

export interface UpdateMemberStateParams {
  cohortTaskStateId: string;
  userId: string;
  status: 'pending' | 'completed';
  taskId?: string;
}

export interface CohortTaskStateWithThreshold extends CohortTaskState {
  threshold: number;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new CohortTaskState document
 * Called when syncing program tasks to a cohort
 */
export async function createCohortTaskState(
  params: CreateCohortTaskStateParams
): Promise<CohortTaskState> {
  const { cohortId, programId, organizationId, programDayIndex, taskTemplateId, taskTitle, programTaskId, date, memberIds } = params;

  const now = new Date().toISOString();

  // Initialize member states as pending
  const memberStates: Record<string, CohortTaskStateMemberState> = {};
  for (const memberId of memberIds) {
    memberStates[memberId] = { status: 'pending' };
  }

  const stateData: Omit<CohortTaskState, 'id'> = {
    cohortId,
    programId,
    organizationId,
    programDayIndex,
    taskTemplateId,
    taskTitle,
    programTaskId: programTaskId || undefined,
    date,
    totalMembers: memberIds.length,
    completedCount: 0,
    completionRate: 0,
    isThresholdMet: false,
    memberStates,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await adminDb.collection('cohort_task_states').add(stateData);

  return {
    id: docRef.id,
    ...stateData,
  };
}

/**
 * Get a CohortTaskState by its ID
 */
export async function getCohortTaskState(id: string): Promise<CohortTaskState | null> {
  const doc = await adminDb.collection('cohort_task_states').doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as CohortTaskState;
}

/**
 * Get all CohortTaskStates for a cohort on a specific date
 */
export async function getCohortTaskStatesForDate(
  cohortId: string,
  date: string
): Promise<CohortTaskState[]> {
  const snapshot = await adminDb
    .collection('cohort_task_states')
    .where('cohortId', '==', cohortId)
    .where('date', '==', date)
    .orderBy('programDayIndex', 'asc')
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as CohortTaskState[];
}

/**
 * Find a CohortTaskState by task template ID and date
 * Used when a member completes a task to find the corresponding state
 */
export async function findCohortTaskState(
  cohortId: string,
  taskTemplateId: string,
  date: string
): Promise<CohortTaskState | null> {
  const snapshot = await adminDb
    .collection('cohort_task_states')
    .where('cohortId', '==', cohortId)
    .where('taskTemplateId', '==', taskTemplateId)
    .where('date', '==', date)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as CohortTaskState;
}

/**
 * Find CohortTaskState by matching a user's task details
 * Used when we only have the task info, not the template ID
 */
export async function findCohortTaskStateByTaskTitle(
  cohortId: string,
  taskTitle: string,
  date: string,
  programDayIndex: number
): Promise<CohortTaskState | null> {
  const snapshot = await adminDb
    .collection('cohort_task_states')
    .where('cohortId', '==', cohortId)
    .where('taskTitle', '==', taskTitle)
    .where('date', '==', date)
    .where('programDayIndex', '==', programDayIndex)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as CohortTaskState;
}

/**
 * Find CohortTaskState by programTaskId (robust matching)
 * Preferred method for finding CohortTaskState as it survives task renames
 */
export async function findCohortTaskStateByProgramTaskId(
  cohortId: string,
  programTaskId: string,
  date: string
): Promise<CohortTaskState | null> {
  const snapshot = await adminDb
    .collection('cohort_task_states')
    .where('cohortId', '==', cohortId)
    .where('programTaskId', '==', programTaskId)
    .where('date', '==', date)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as CohortTaskState;
}

// ============================================================================
// Aggregate Calculations
// ============================================================================

/**
 * Recalculate aggregates for a CohortTaskState
 * Called after member state changes
 */
export function recalculateAggregates(
  state: CohortTaskState,
  threshold: number
): { completedCount: number; completionRate: number; isThresholdMet: boolean; totalMembers: number } {
  // Count active members (not removed)
  let totalMembers = 0;
  let completedCount = 0;

  for (const [, memberState] of Object.entries(state.memberStates)) {
    if (memberState.removed) continue;
    totalMembers++;
    if (memberState.status === 'completed') {
      completedCount++;
    }
  }

  const completionRate = totalMembers > 0 ? Math.round((completedCount / totalMembers) * 100) : 0;
  const isThresholdMet = completionRate >= threshold;

  return { completedCount, completionRate, isThresholdMet, totalMembers };
}

/**
 * Update a member's task completion state and recalculate aggregates
 */
export async function updateMemberTaskState(
  cohortTaskStateId: string,
  userId: string,
  completed: boolean,
  taskId?: string,
  threshold: number = 50
): Promise<CohortTaskState | null> {
  const stateRef = adminDb.collection('cohort_task_states').doc(cohortTaskStateId);

  const result = await adminDb.runTransaction(async (transaction) => {
    const doc = await transaction.get(stateRef);
    if (!doc.exists) return null;

    const state = { id: doc.id, ...doc.data() } as CohortTaskState;

    // Update member state
    state.memberStates[userId] = {
      status: completed ? 'completed' : 'pending',
      completedAt: completed ? new Date().toISOString() : undefined,
      taskId,
    };

    // Recalculate aggregates
    const aggregates = recalculateAggregates(state, threshold);

    // Update document
    transaction.update(stateRef, {
      memberStates: state.memberStates,
      ...aggregates,
      updatedAt: new Date().toISOString(),
    });

    return {
      ...state,
      ...aggregates,
    };
  });

  return result;
}

// ============================================================================
// Member Management
// ============================================================================

/**
 * Add a new member to all current CohortTaskStates for a cohort
 * Called when a user joins an active cohort
 */
export async function addMemberToCohortStates(
  cohortId: string,
  userId: string,
  currentDate: string,
  threshold: number = 50
): Promise<number> {
  // Get all states for today and future dates
  const snapshot = await adminDb
    .collection('cohort_task_states')
    .where('cohortId', '==', cohortId)
    .where('date', '>=', currentDate)
    .get();

  const batch = adminDb.batch();
  let updatedCount = 0;

  for (const doc of snapshot.docs) {
    const state = { id: doc.id, ...doc.data() } as CohortTaskState;

    // Only add if member not already in state
    if (state.memberStates[userId]) continue;

    state.memberStates[userId] = { status: 'pending' };
    const aggregates = recalculateAggregates(state, threshold);

    batch.update(doc.ref, {
      memberStates: state.memberStates,
      ...aggregates,
      updatedAt: new Date().toISOString(),
    });

    updatedCount++;
  }

  if (updatedCount > 0) {
    await batch.commit();
  }

  return updatedCount;
}

/**
 * Mark a member as removed from cohort states
 * Preserves historical data but excludes from aggregates
 */
export async function removeMemberFromCohortStates(
  cohortId: string,
  userId: string,
  threshold: number = 50
): Promise<number> {
  const snapshot = await adminDb
    .collection('cohort_task_states')
    .where('cohortId', '==', cohortId)
    .get();

  const batch = adminDb.batch();
  let updatedCount = 0;

  for (const doc of snapshot.docs) {
    const state = { id: doc.id, ...doc.data() } as CohortTaskState;

    // Only update if member exists and not already removed
    if (!state.memberStates[userId] || state.memberStates[userId].removed) continue;

    state.memberStates[userId].removed = true;
    const aggregates = recalculateAggregates(state, threshold);

    batch.update(doc.ref, {
      memberStates: state.memberStates,
      ...aggregates,
      updatedAt: new Date().toISOString(),
    });

    updatedCount++;
  }

  if (updatedCount > 0) {
    await batch.commit();
  }

  return updatedCount;
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Get or create CohortTaskState for a task
 * Used during sync to ensure state exists
 */
export async function getOrCreateCohortTaskState(
  params: CreateCohortTaskStateParams
): Promise<CohortTaskState> {
  // Try to find existing
  const existing = await findCohortTaskState(
    params.cohortId,
    params.taskTemplateId,
    params.date
  );

  if (existing) {
    // Update member list if needed
    let needsUpdate = false;
    for (const memberId of params.memberIds) {
      if (!existing.memberStates[memberId]) {
        existing.memberStates[memberId] = { status: 'pending' };
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      await adminDb.collection('cohort_task_states').doc(existing.id).update({
        memberStates: existing.memberStates,
        totalMembers: Object.keys(existing.memberStates).filter(k => !existing.memberStates[k].removed).length,
        updatedAt: new Date().toISOString(),
      });
    }

    return existing;
  }

  // Create new
  return createCohortTaskState(params);
}

/**
 * Delete all CohortTaskStates for a cohort (cleanup)
 */
export async function deleteCohortTaskStates(cohortId: string): Promise<number> {
  const snapshot = await adminDb
    .collection('cohort_task_states')
    .where('cohortId', '==', cohortId)
    .get();

  const batch = adminDb.batch();
  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
  }

  await batch.commit();
  return snapshot.size;
}

// ============================================================================
// Helper to get threshold from program
// ============================================================================

/**
 * Get the completion threshold for a program
 * Returns the configured threshold or default of 50
 */
export async function getProgramCompletionThreshold(programId: string): Promise<number> {
  const doc = await adminDb.collection('programs').doc(programId).get();
  if (!doc.exists) return 50;

  const program = doc.data() as Program;
  return program.cohortCompletionThreshold ?? 50;
}

/**
 * Get cohort with its program's threshold
 */
export async function getCohortWithThreshold(cohortId: string): Promise<{
  cohort: ProgramCohort;
  threshold: number;
} | null> {
  const cohortDoc = await adminDb.collection('program_cohorts').doc(cohortId).get();
  if (!cohortDoc.exists) return null;

  const cohort = { id: cohortDoc.id, ...cohortDoc.data() } as ProgramCohort;
  const threshold = await getProgramCompletionThreshold(cohort.programId);

  return { cohort, threshold };
}
