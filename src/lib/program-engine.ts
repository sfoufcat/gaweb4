/**
 * Program Engine
 *
 * =============================================================================
 * PROGRAM SYSTEM ARCHITECTURE
 * =============================================================================
 *
 * This file handles syncing program content to users' Daily Focus.
 *
 * DATA FLOW:
 *   Template (program_days)
 *     → "Sync from Template" button
 *   Editor (cohort_program_days / client_program_days)
 *     → Cron job or manual sync (syncProgramTasksForDay)
 *   Daily Focus (tasks collection)
 *
 * KEY FUNCTIONS:
 * - syncProgramTasksForDay()     → Unified sync for both 1:1 and cohort programs
 * - syncProgramTasksToClientDay() → Core sync implementation
 * - calculateCurrentDayIndexV2() → Maps calendar date to program day index
 *
 * KEY RULES:
 * - For cohorts: ALL members see the same day (cohort.startDate is source of truth)
 * - For 1:1: Uses enrollment.startedAt
 * - Day editor content is source of truth (no template fallback at runtime)
 * - Calendar-aligned weeks: Onboarding = partial first week until Monday
 *
 * COHORT COMPLETION TRACKING:
 * - CohortTaskState documents track member completion rates
 * - Created when tasks are synced to cohort members
 * - Updated when users complete/uncomplete tasks
 *
 * =============================================================================
 * SOURCE OF TRUTH
 * =============================================================================
 *
 * This file syncs FROM:
 *   - cohort_program_days (for cohort members) ← SOURCE OF TRUTH
 *   - client_program_days (for 1:1 clients)    ← SOURCE OF TRUTH
 *
 * This file syncs TO:
 *   - tasks collection (user's Daily Focus)
 *   - cohort_task_states (completion tracking)
 *
 * The *_program_days collections are the source of truth. If a coach deletes
 * a task from the day editor, it stays deleted. NO template fallback at runtime.
 *
 * =============================================================================
 */

import { adminDb } from './firebase-admin';
import { calculateSpreadDayIndices } from './program-utils';
import { getStreamServerClient } from './stream-server';
import { FieldValue } from 'firebase-admin/firestore';
import type {
  StarterProgram,
  StarterProgramDay,
  StarterProgramEnrollment,
  ProgramTaskTemplate,
  Task,
  UserTrack,
  Squad,
  // Programs v2 types
  Program,
  ProgramDay,
  ProgramEnrollment,
  ProgramCohort,
  ClientProgramDay,
  // Programs v3 types (modules/weeks)
  ProgramWeek,
  CallSummary,
  TaskDistribution,
} from '@/types';

// Import and re-export client-safe utilities (these can be used in client components)
// NOTE: These are in a separate file to avoid bundling firebase-admin in client code
export {
  isWeekend,
  countWeekdaysBetween,
  getActiveCycleNumber,
  calculateProgramDayIndex,
} from './program-client-utils';
import { isWeekend, countWeekdaysBetween, getActiveCycleNumber, calculateProgramDayIndex } from './program-client-utils';

// ============================================================================
// WEEKEND HELPERS
// ============================================================================

/**
 * Get the next Monday from a given date
 * If the date is already a weekday, returns the same date
 */
export function getNextWeekday(date: Date): Date {
  const result = new Date(date);
  while (isWeekend(result)) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

/**
 * Calculate the number of working days in a program based on total days
 * Assumes a 5-day work week
 */
export function calculateWorkingDays(totalDays: number): number {
  const fullWeeks = Math.floor(totalDays / 7);
  const remainingDays = totalDays % 7;

  // 5 working days per full week
  let workingDays = fullWeeks * 5;

  // Add working days from remaining days (assuming start on Monday)
  // This is an approximation - actual count depends on start day
  workingDays += Math.min(remainingDays, 5);

  return workingDays;
}

// ============================================================================
// EVERGREEN CYCLE HELPERS
// ============================================================================

/**
 * Roll over to the next cycle for an evergreen program
 * Returns the updated cycle number and resets day tracking
 */
export async function rolloverToNextCycle(
  enrollmentId: string,
  currentCycleNumber: number
): Promise<{ newCycleNumber: number; cycleStartedAt: string }> {
  const now = new Date().toISOString();
  const newCycleNumber = currentCycleNumber + 1;

  await adminDb.collection('program_enrollments').doc(enrollmentId).update({
    currentCycleNumber: newCycleNumber,
    cycleStartedAt: now,
    cycleCompletedAt: null, // Reset for new cycle
    lastAssignedDayIndex: 0, // Reset day index for new cycle
    lastAssignedWeekIndex: 0, // Reset week index for new cycle
    updatedAt: now,
  });

  console.log(`[PROGRAM_ENGINE] Rolled over enrollment ${enrollmentId} to cycle ${newCycleNumber}`);

  return {
    newCycleNumber,
    cycleStartedAt: now,
  };
}

// ============================================================================
// PROGRAM QUERIES
// ============================================================================

/**
 * Get all starter programs
 */
export async function getAllPrograms(): Promise<StarterProgram[]> {
  const snapshot = await adminDb.collection('starter_programs').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StarterProgram));
}

/**
 * Get a starter program by ID
 */
export async function getProgramById(programId: string): Promise<StarterProgram | null> {
  const doc = await adminDb.collection('starter_programs').doc(programId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as StarterProgram;
}

/**
 * Get the first starter program for a track (programOrder: 1)
 * Falls back to isDefaultForTrack for backward compatibility
 */
export async function getDefaultProgramForTrack(track: UserTrack): Promise<StarterProgram | null> {
  // First try to find program with programOrder: 1
  let snapshot = await adminDb
    .collection('starter_programs')
    .where('track', '==', track)
    .where('programOrder', '==', 1)
    .where('isActive', '==', true)
    .limit(1)
    .get();
  
  // Fallback to isDefaultForTrack for backward compatibility
  if (snapshot.empty) {
    snapshot = await adminDb
      .collection('starter_programs')
      .where('track', '==', track)
      .where('isDefaultForTrack', '==', true)
      .limit(1)
      .get();
  }
  
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as StarterProgram;
}

/**
 * Get the next program in sequence for a track
 * @param track - User's track
 * @param currentOrder - Current program's order number
 * @returns Next program or null if no more programs
 */
export async function getNextProgramForTrack(
  track: UserTrack, 
  currentOrder: number
): Promise<StarterProgram | null> {
  const snapshot = await adminDb
    .collection('starter_programs')
    .where('track', '==', track)
    .where('programOrder', '==', currentOrder + 1)
    .where('isActive', '==', true)
    .limit(1)
    .get();
  
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as StarterProgram;
}

/**
 * Get program day template
 */
export async function getProgramDay(
  programId: string, 
  dayIndex: number
): Promise<StarterProgramDay | null> {
  const snapshot = await adminDb
    .collection('starter_program_days')
    .where('programId', '==', programId)
    .where('dayIndex', '==', dayIndex)
    .limit(1)
    .get();
  
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as StarterProgramDay;
}

// ============================================================================
// ENROLLMENT MANAGEMENT
// ============================================================================

/**
 * Get user's active enrollment
 */
export async function getActiveEnrollment(userId: string): Promise<StarterProgramEnrollment | null> {
  const snapshot = await adminDb
    .collection('starter_program_enrollments')
    .where('userId', '==', userId)
    .where('status', '==', 'active')
    .limit(1)
    .get();
  
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as StarterProgramEnrollment;
}

/**
 * Calculate program start date based on signup time
 * 
 * Logic (matches morning check-in first-day logic):
 * - If user signs up before noon (12:00 user local time) → Day 1 starts today
 * - If user signs up at/after noon → Day 1 starts tomorrow
 * 
 * @param signupTime - ISO timestamp when user signed up (defaults to now)
 * @returns ISO date string (YYYY-MM-DD) for program start
 */
export function calculateProgramStartDate(signupTime?: string): string {
  const signup = signupTime ? new Date(signupTime) : new Date();
  const hour = signup.getHours();
  
  // If before noon (12:00), start today
  // If noon or after, start tomorrow
  if (hour < 12) {
    return signup.toISOString().split('T')[0];
  } else {
    // Add one day
    const tomorrow = new Date(signup);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
}

/**
 * Create a new enrollment for a user
 * 
 * The start date follows the same logic as morning check-in availability:
 * - Before noon → Program starts today (Day 1)
 * - After noon → Program starts tomorrow (Day 1)
 * 
 * @param userId - User ID
 * @param programId - Program ID
 * @param userCreatedAt - Optional: user's account creation time for accurate start date
 */
export async function createEnrollment(
  userId: string, 
  programId: string,
  userCreatedAt?: string
): Promise<StarterProgramEnrollment> {
  const now = new Date().toISOString();
  
  // Calculate start date based on signup time (before/after noon logic)
  const startDate = calculateProgramStartDate(userCreatedAt || now);
  
  const enrollmentData: Omit<StarterProgramEnrollment, 'id'> = {
    userId,
    programId,
    startedAt: startDate,
    status: 'active',
    lastAssignedDayIndex: 0,
    createdAt: now,
    updatedAt: now,
  };
  
  const docRef = await adminDb.collection('starter_program_enrollments').add(enrollmentData);
  console.log(`[PROGRAM_ENGINE] Created enrollment ${docRef.id} for user ${userId} in program ${programId}, starts ${startDate}`);
  
  return { id: docRef.id, ...enrollmentData };
}

/**
 * Stop an enrollment (mark as stopped)
 */
export async function stopEnrollment(enrollmentId: string): Promise<void> {
  const now = new Date().toISOString();
  await adminDb.collection('starter_program_enrollments').doc(enrollmentId).update({
    status: 'stopped',
    updatedAt: now,
  });
  console.log(`[PROGRAM_ENGINE] Stopped enrollment ${enrollmentId}`);
}

/**
 * Mark enrollment as completed
 */
export async function completeEnrollment(enrollmentId: string): Promise<void> {
  const now = new Date().toISOString();
  await adminDb.collection('starter_program_enrollments').doc(enrollmentId).update({
    status: 'completed',
    updatedAt: now,
  });
  console.log(`[PROGRAM_ENGINE] Completed enrollment ${enrollmentId}`);
}

/**
 * Update enrollment's lastAssignedDayIndex
 */
async function updateEnrollmentDayIndex(
  enrollmentId: string, 
  dayIndex: number
): Promise<void> {
  const now = new Date().toISOString();
  await adminDb.collection('starter_program_enrollments').doc(enrollmentId).update({
    lastAssignedDayIndex: dayIndex,
    updatedAt: now,
  });
}

// ============================================================================
// TASK GENERATION
// ============================================================================

/**
 * Calculate the current program day index for an enrollment
 * Returns the day index (1-based) based on elapsed days since enrollment started
 */
export function calculateCurrentDayIndex(
  enrollmentStartedAt: string, // YYYY-MM-DD
  programLengthDays: number,
  todayDate?: string // YYYY-MM-DD, defaults to today
): number {
  const today = todayDate || new Date().toISOString().split('T')[0];
  const startDate = new Date(enrollmentStartedAt + 'T00:00:00');
  const todayDateObj = new Date(today + 'T00:00:00');
  
  // Calculate elapsed days
  const elapsedMs = todayDateObj.getTime() - startDate.getTime();
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
  
  // Day index is 1-based: day 1 = first day, etc.
  const dayIndex = elapsedDays + 1;
  
  // Cap at program length
  return Math.min(dayIndex, programLengthDays);
}

/**
 * Check if a program task already exists for the user on a given day
 * (Prevents duplicates when syncing)
 */
async function programTaskExists(
  userId: string,
  enrollmentId: string,
  dayIndex: number,
  taskLabel: string,
  date: string
): Promise<boolean> {
  const snapshot = await adminDb
    .collection('tasks')
    .where('userId', '==', userId)
    .where('programEnrollmentId', '==', enrollmentId)
    .where('programDayIndex', '==', dayIndex)
    .where('title', '==', taskLabel)
    .where('date', '==', date)
    .limit(1)
    .get();
  
  return !snapshot.empty;
}

/**
 * Get existing focus tasks for a user on a date
 */
async function getExistingFocusTasks(
  userId: string, 
  date: string
): Promise<Task[]> {
  const snapshot = await adminDb
    .collection('tasks')
    .where('userId', '==', userId)
    .where('date', '==', date)
    .where('listType', '==', 'focus')
    .get();
  
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
}

/**
 * Get existing backlog tasks for a user on a date
 */
async function getExistingBacklogTasks(
  userId: string, 
  date: string
): Promise<Task[]> {
  const snapshot = await adminDb
    .collection('tasks')
    .where('userId', '==', userId)
    .where('date', '==', date)
    .where('listType', '==', 'backlog')
    .get();
  
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
}

/**
 * Create a task from a program template
 * Note: organizationId is optional for backward compatibility with legacy StarterProgramEnrollment
 */
async function createProgramTask(
  userId: string,
  enrollmentId: string,
  organizationId: string | undefined,
  dayIndex: number,
  template: ProgramTaskTemplate,
  listType: 'focus' | 'backlog',
  order: number,
  date: string
): Promise<Task> {
  const now = new Date().toISOString();
  
  const taskData = {
    userId,
    ...(organizationId && { organizationId }),
    title: template.label,
    status: 'pending',
    listType,
    order,
    date,
    isPrivate: false,
    sourceType: 'program',
    programEnrollmentId: enrollmentId,
    programDayIndex: dayIndex,
    instanceTaskId: template.id || undefined,
    originalTitle: template.label, // Preserve original for fallback matching when client edits title
    createdAt: now,
    updatedAt: now,
  } as Omit<Task, 'id'>;

  const docRef = await adminDb.collection('tasks').add(taskData);
  console.log(`[PROGRAM_ENGINE] Created program task: "${template.label}" (${listType}) for day ${dayIndex}`);
  
  return { id: docRef.id, ...taskData };
}

// ============================================================================
// MAIN SYNC FUNCTION
// ============================================================================

export interface SyncProgramTasksResult {
  success: boolean;
  tasksCreated: number;
  focusTasksCreated: number;
  backlogTasksCreated: number;
  currentDayIndex: number;
  enrollmentId: string | null;
  programId: string | null;
  programName: string | null;
  programCompleted: boolean; // True if program was just completed this sync
  message: string;
}

/**
 * Main function: Sync program tasks for today
 * 
 * This is the core engine function that:
 * 1. Finds the user's active enrollment (if any)
 * 2. Calculates what program day they're on
 * 3. Creates tasks from the program day template if needed
 * 4. Places tasks in Daily Focus (up to org's defaultDailyFocusSlots) or Backlog
 */
export async function syncProgramTasksForToday(
  userId: string,
  todayDate?: string // YYYY-MM-DD, defaults to today
): Promise<SyncProgramTasksResult> {
  const today = todayDate || new Date().toISOString().split('T')[0];
  
  // 1. Find active enrollment
  const enrollment = await getActiveEnrollment(userId);
  
  if (!enrollment) {
    return {
      success: true,
      tasksCreated: 0,
      focusTasksCreated: 0,
      backlogTasksCreated: 0,
      currentDayIndex: 0,
      enrollmentId: null,
      programId: null,
      programName: null,
      programCompleted: false,
      message: 'No active program enrollment',
    };
  }
  
  // 2. Get the program
  const program = await getProgramById(enrollment.programId);
  
  if (!program) {
    console.error(`[PROGRAM_ENGINE] Program ${enrollment.programId} not found for enrollment ${enrollment.id}`);
    return {
      success: false,
      tasksCreated: 0,
      focusTasksCreated: 0,
      backlogTasksCreated: 0,
      currentDayIndex: 0,
      enrollmentId: enrollment.id,
      programId: enrollment.programId,
      programName: null,
      programCompleted: false,
      message: 'Program not found',
    };
  }
  
  // 3. Calculate current day index
  const dayIndex = calculateCurrentDayIndex(enrollment.startedAt, program.lengthDays, today);
  
  // 4. Track if this is a new day or re-sync of an existing day
  // We still check for new tasks even if day was already processed (coach may have added new tasks)
  const isResync = dayIndex <= enrollment.lastAssignedDayIndex;
  
  // 5. Get the program day template
  const programDay = await getProgramDay(enrollment.programId, dayIndex);
  
  if (!programDay || !programDay.tasks || programDay.tasks.length === 0) {
    console.log(`[PROGRAM_ENGINE] No tasks defined for day ${dayIndex} of program ${program.slug}`);
    // Only update lastAssignedDayIndex if this is a fresh sync (not a re-sync)
    if (!isResync) {
      await updateEnrollmentDayIndex(enrollment.id, dayIndex);
    }
    return {
      success: true,
      tasksCreated: 0,
      focusTasksCreated: 0,
      backlogTasksCreated: 0,
      currentDayIndex: dayIndex,
      enrollmentId: enrollment.id,
      programId: program.id,
      programName: program.name,
      programCompleted: false,
      message: `No tasks defined for day ${dayIndex}`,
    };
  }
  
  // 6. Get existing tasks for today to determine placement
  const existingFocusTasks = await getExistingFocusTasks(userId, today);
  const existingBacklogTasks = await getExistingBacklogTasks(userId, today);
  
  // Get org focus limit (defaultDailyFocusSlots or fallback to 3)
  let focusLimit = 3;
  const orgId = (enrollment as { organizationId?: string }).organizationId;
  if (orgId) {
    try {
      const orgSettingsDoc = await adminDb.collection('org_settings').doc(orgId).get();
      const orgSettings = orgSettingsDoc.data();
      focusLimit = orgSettings?.defaultDailyFocusSlots ?? 3;
    } catch {
      // Fallback to 3 if org settings can't be fetched
    }
  }
  
  let availableFocusSlots = focusLimit - existingFocusTasks.length;
  let nextFocusOrder = existingFocusTasks.length > 0 
    ? Math.max(...existingFocusTasks.map(t => t.order)) + 1 
    : 0;
  let nextBacklogOrder = existingBacklogTasks.length > 0 
    ? Math.max(...existingBacklogTasks.map(t => t.order)) + 1 
    : 0;
  
  let tasksCreated = 0;
  let focusTasksCreated = 0;
  let backlogTasksCreated = 0;
  
  // 7. Create tasks from templates
  // First, handle primary tasks (try to put in Focus)
  const primaryTasks = programDay.tasks.filter(t => t.isPrimary);
  const nonPrimaryTasks = programDay.tasks.filter(t => !t.isPrimary);
  
  for (const template of primaryTasks) {
    // Check if task already exists (avoid duplicates)
    const exists = await programTaskExists(
      userId, 
      enrollment.id, 
      dayIndex, 
      template.label, 
      today
    );
    
    if (exists) {
      console.log(`[PROGRAM_ENGINE] Task "${template.label}" already exists, skipping`);
      continue;
    }
    
    // Determine placement
    let listType: 'focus' | 'backlog';
    let order: number;
    
    if (availableFocusSlots > 0) {
      listType = 'focus';
      order = nextFocusOrder++;
      availableFocusSlots--;
      focusTasksCreated++;
    } else {
      listType = 'backlog';
      order = nextBacklogOrder++;
      backlogTasksCreated++;
    }
    
    await createProgramTask(
      userId,
      enrollment.id,
      (enrollment as { organizationId?: string }).organizationId,
      dayIndex,
      template,
      listType,
      order,
      today
    );
    
    tasksCreated++;
  }
  
  // Then, handle non-primary tasks (always go to Backlog)
  for (const template of nonPrimaryTasks) {
    // Check if task already exists
    const exists = await programTaskExists(
      userId, 
      enrollment.id, 
      dayIndex, 
      template.label, 
      today
    );
    
    if (exists) {
      console.log(`[PROGRAM_ENGINE] Task "${template.label}" already exists, skipping`);
      continue;
    }
    
    await createProgramTask(
      userId,
      enrollment.id,
      (enrollment as { organizationId?: string }).organizationId,
      dayIndex,
      template,
      'backlog',
      nextBacklogOrder++,
      today
    );
    
    tasksCreated++;
    backlogTasksCreated++;
  }
  
  // 8. Update enrollment lastAssignedDayIndex (only if this is a fresh sync, not a re-sync)
  if (!isResync) {
    await updateEnrollmentDayIndex(enrollment.id, dayIndex);
  }
  
  // 9. Check if program is completed (today is the last day)
  let programCompleted = false;
  if (dayIndex >= program.lengthDays) {
    // Use markProgramCompleted to set check-in flag
    await markProgramCompleted(userId, enrollment.id, program.id, program.name);
    programCompleted = true;
    console.log(`[PROGRAM_ENGINE] User ${userId} completed program ${program.slug}! Check-in pending.`);
  }
  
  console.log(`[PROGRAM_ENGINE] Synced day ${dayIndex} for user ${userId}: ${tasksCreated} tasks created (${focusTasksCreated} focus, ${backlogTasksCreated} backlog)`);
  
  return {
    success: true,
    tasksCreated,
    focusTasksCreated,
    backlogTasksCreated,
    currentDayIndex: dayIndex,
    enrollmentId: enrollment.id,
    programId: program.id,
    programName: program.name,
    programCompleted,
    message: programCompleted 
      ? `Program completed! Created ${tasksCreated} tasks for final day ${dayIndex}`
      : `Created ${tasksCreated} tasks for day ${dayIndex}`,
  };
}

// ============================================================================
// TRACK CHANGE UTILITIES
// ============================================================================

/**
 * Delete all program-generated tasks for a user's enrollment
 */
export async function deleteProgramTasks(
  userId: string, 
  enrollmentId: string
): Promise<number> {
  const snapshot = await adminDb
    .collection('tasks')
    .where('userId', '==', userId)
    .where('programEnrollmentId', '==', enrollmentId)
    .get();
  
  if (snapshot.empty) return 0;
  
  const batch = adminDb.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  
  console.log(`[PROGRAM_ENGINE] Deleted ${snapshot.size} program tasks for enrollment ${enrollmentId}`);
  return snapshot.size;
}

/**
 * Stop all active enrollments for a user and optionally delete their program tasks
 */
export async function stopAllEnrollmentsForUser(
  userId: string,
  deleteTasks: boolean = true
): Promise<{ enrollmentsStopped: number; tasksDeleted: number }> {
  const snapshot = await adminDb
    .collection('starter_program_enrollments')
    .where('userId', '==', userId)
    .where('status', '==', 'active')
    .get();
  
  let tasksDeleted = 0;
  
  for (const doc of snapshot.docs) {
    const enrollment = { id: doc.id, ...doc.data() } as StarterProgramEnrollment;
    
    if (deleteTasks) {
      tasksDeleted += await deleteProgramTasks(userId, enrollment.id);
    }
    
    await stopEnrollment(enrollment.id);
  }
  
  return {
    enrollmentsStopped: snapshot.size,
    tasksDeleted,
  };
}

/**
 * Enroll user in default program for their track (if one exists)
 * 
 * @param userId - User ID
 * @param track - User's selected track
 * @param userCreatedAt - Optional: user's account creation time for accurate start date
 */
export async function enrollUserInDefaultProgram(
  userId: string,
  track: UserTrack,
  userCreatedAt?: string
): Promise<StarterProgramEnrollment | null> {
  const program = await getDefaultProgramForTrack(track);
  
  if (!program) {
    console.log(`[PROGRAM_ENGINE] No default program for track: ${track}`);
    return null;
  }
  
  return await createEnrollment(userId, program.id, userCreatedAt);
}

/**
 * Enroll user in the next program in sequence
 * Used after completing a program to continue with the next one
 * 
 * @param userId - User ID
 * @param track - User's track
 * @param completedProgramId - The program ID that was just completed
 * @returns New enrollment or null if no next program
 */
export async function enrollUserInNextProgram(
  userId: string,
  track: UserTrack,
  completedProgramId: string
): Promise<StarterProgramEnrollment | null> {
  // Get the completed program to find its order
  const completedProgram = await getProgramById(completedProgramId);
  
  if (!completedProgram) {
    console.log(`[PROGRAM_ENGINE] Completed program not found: ${completedProgramId}`);
    return null;
  }
  
  const currentOrder = completedProgram.programOrder || 1;
  const nextProgram = await getNextProgramForTrack(track, currentOrder);
  
  if (!nextProgram) {
    console.log(`[PROGRAM_ENGINE] No next program after order ${currentOrder} for track: ${track}`);
    return null;
  }
  
  console.log(`[PROGRAM_ENGINE] Enrolling user ${userId} in next program: ${nextProgram.name} (order ${nextProgram.programOrder})`);
  return await createEnrollment(userId, nextProgram.id);
}

/**
 * Mark program as completed and set user's pending check-in flag
 * This triggers the program completion check-in flow
 */
export async function markProgramCompleted(
  userId: string,
  enrollmentId: string,
  programId: string,
  programName: string
): Promise<void> {
  const now = new Date().toISOString();
  
  // Mark enrollment as completed
  await adminDb.collection('starter_program_enrollments').doc(enrollmentId).update({
    status: 'completed',
    completedAt: now,
    updatedAt: now,
  });
  
  // Set pending check-in flag on user document
  await adminDb.collection('users').doc(userId).update({
    pendingProgramCheckIn: true,
    lastCompletedProgramId: programId,
    lastCompletedProgramName: programName,
    updatedAt: now,
  });
  
  console.log(`[PROGRAM_ENGINE] Marked program ${programName} as completed for user ${userId}, check-in pending`);
}

/**
 * Clear the pending program check-in flag after user completes or dismisses it
 * @param userId - User ID
 * @param dismissed - If true, sets dismissedAt timestamp (shows prompt for 24h)
 */
export async function clearProgramCheckIn(
  userId: string, 
  dismissed: boolean = false
): Promise<void> {
  const now = new Date().toISOString();
  
  const updateData: Record<string, unknown> = {
    pendingProgramCheckIn: false,
    updatedAt: now,
  };
  
  if (dismissed) {
    // If dismissed (not completed), set timestamp to show prompt for 24h
    updateData.programCheckInDismissedAt = now;
  } else {
    // If completed, clear the dismissed timestamp too
    updateData.programCheckInDismissedAt = null;
    updateData.lastCompletedProgramId = null;
    updateData.lastCompletedProgramName = null;
  }
  
  await adminDb.collection('users').doc(userId).update(updateData);
  console.log(`[PROGRAM_ENGINE] Cleared program check-in for user ${userId} (dismissed: ${dismissed})`);
}

/**
 * Check if user should see the program check-in prompt
 * Returns true if:
 * - pendingProgramCheckIn is true, OR
 * - programCheckInDismissedAt is set and within 24 hours
 */
export async function shouldShowProgramCheckIn(userId: string): Promise<{
  show: boolean;
  programId: string | null;
  programName: string | null;
}> {
  const userDoc = await adminDb.collection('users').doc(userId).get();
  const userData = userDoc.data();
  
  if (!userData) {
    return { show: false, programId: null, programName: null };
  }
  
  // Check if pending check-in
  if (userData.pendingProgramCheckIn) {
    return {
      show: true,
      programId: userData.lastCompletedProgramId || null,
      programName: userData.lastCompletedProgramName || null,
    };
  }
  
  // Check if dismissed within 24 hours
  if (userData.programCheckInDismissedAt) {
    const dismissedAt = new Date(userData.programCheckInDismissedAt);
    const now = new Date();
    const hoursSinceDismissal = (now.getTime() - dismissedAt.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceDismissal < 24) {
      return {
        show: true,
        programId: userData.lastCompletedProgramId || null,
        programName: userData.lastCompletedProgramName || null,
      };
    }
  }
  
  return { show: false, programId: null, programName: null };
}

// ============================================================================
// SQUAD MEMBERSHIP MANAGEMENT
// ============================================================================

/**
 * Archive old squad memberships when user joins a new program squad.
 * 
 * This removes the user from old squad memberIds (so Squad tab shows new squad)
 * but keeps them in the Stream chat channel (so they can still message old squadmates).
 * 
 * The "pinned" behavior is derived from squad membership - removing from memberIds
 * effectively "unpins" the old squad chat in the UI.
 * 
 * @param userId - User ID
 * @param newSquadId - The new squad ID (will be excluded from archiving)
 */
export async function archiveOldSquadMemberships(
  userId: string,
  newSquadId: string
): Promise<{ archivedSquads: string[] }> {
  const archivedSquads: string[] = [];
  
  try {
    // Find all squads where user is a member (excluding the new squad)
    const squadsSnapshot = await adminDb
      .collection('squads')
      .where('memberIds', 'array-contains', userId)
      .get();
    
    for (const squadDoc of squadsSnapshot.docs) {
      if (squadDoc.id === newSquadId) {
        continue; // Skip the new squad
      }
      
      const squadData = squadDoc.data() as Squad;
      
      // Remove user from memberIds array
      await squadDoc.ref.update({
        memberIds: FieldValue.arrayRemove(userId),
        updatedAt: new Date().toISOString(),
      });
      
      archivedSquads.push(squadDoc.id);
      console.log(`[SQUAD_ARCHIVE] Removed user ${userId} from squad ${squadDoc.id} (${squadData.name}) - kept in chat`);
    }
    
    // Also clean up squadMembers collection (if exists)
    if (archivedSquads.length > 0) {
      const squadMembersSnapshot = await adminDb
        .collection('squadMembers')
        .where('squadId', 'in', archivedSquads)
        .where('userId', '==', userId)
        .get();
      
      const batch = adminDb.batch();
      squadMembersSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      
      console.log(`[SQUAD_ARCHIVE] Deleted ${squadMembersSnapshot.size} squadMembers records`);
      
      // Clear user's squad references for archived squads
      // This ensures the old squad doesn't show as pinned in chat
      const userRef = adminDb.collection('users').doc(userId);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };
        
        // Clear premium/standard/legacy squad ID if it matches an archived squad
        for (const archivedSquadId of archivedSquads) {
          if (userData?.premiumSquadId === archivedSquadId) {
            updateData.premiumSquadId = null;
            console.log(`[SQUAD_ARCHIVE] Clearing premiumSquadId ${archivedSquadId} from user ${userId}`);
          }
          if (userData?.standardSquadId === archivedSquadId) {
            updateData.standardSquadId = null;
            console.log(`[SQUAD_ARCHIVE] Clearing standardSquadId ${archivedSquadId} from user ${userId}`);
          }
          if (userData?.squadId === archivedSquadId) {
            updateData.squadId = null;
            console.log(`[SQUAD_ARCHIVE] Clearing squadId ${archivedSquadId} from user ${userId}`);
          }
        }
        
        // Only update if we have fields to clear
        if (Object.keys(updateData).length > 1) {
          await userRef.update(updateData);
        }
      }
    }
    
    return { archivedSquads };
  } catch (error) {
    console.error('[SQUAD_ARCHIVE] Error archiving old squad memberships:', error);
    throw error;
  }
}

/**
 * Fully remove a user from a squad and its chat channel.
 * Used when a coach removes a user from a program - they lose both squad and chat access.
 * 
 * @param userId - User ID to remove
 * @param squadId - Squad ID to remove from
 */
export async function removeUserFromSquadEntirely(
  userId: string,
  squadId: string
): Promise<void> {
  try {
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();
    
    if (!squadDoc.exists) {
      console.log(`[SQUAD_REMOVE] Squad ${squadId} not found`);
      return;
    }
    
    const squadData = squadDoc.data() as Squad;
    
    // 1. Remove from squad memberIds
    await squadDoc.ref.update({
      memberIds: FieldValue.arrayRemove(userId),
      updatedAt: new Date().toISOString(),
    });
    
    // 2. Delete squadMembers record
    const squadMembersSnapshot = await adminDb
      .collection('squadMembers')
      .where('squadId', '==', squadId)
      .where('userId', '==', userId)
      .get();
    
    const batch = adminDb.batch();
    squadMembersSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    
    // 3. Remove from Stream chat channel
    if (squadData.chatChannelId) {
      try {
        const streamClient = await getStreamServerClient();
        const channel = streamClient.channel('messaging', squadData.chatChannelId);
        await channel.removeMembers([userId]);
        console.log(`[SQUAD_REMOVE] Removed user ${userId} from Stream channel ${squadData.chatChannelId}`);
      } catch (streamError) {
        console.error('[SQUAD_REMOVE] Error removing from Stream channel:', streamError);
        // Continue - Firebase removal succeeded
      }
    }
    
    // 4. Clear user's squad references
    // This ensures the squad doesn't show as pinned in chat
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      
      if (userData?.premiumSquadId === squadId) {
        updateData.premiumSquadId = null;
        console.log(`[SQUAD_REMOVE] Clearing premiumSquadId from user ${userId}`);
      }
      if (userData?.standardSquadId === squadId) {
        updateData.standardSquadId = null;
        console.log(`[SQUAD_REMOVE] Clearing standardSquadId from user ${userId}`);
      }
      if (userData?.squadId === squadId) {
        updateData.squadId = null;
        console.log(`[SQUAD_REMOVE] Clearing squadId from user ${userId}`);
      }
      
      // Only update if we have fields to clear
      if (Object.keys(updateData).length > 1) {
        await userRef.update(updateData);
      }
    }
    
    console.log(`[SQUAD_REMOVE] Fully removed user ${userId} from squad ${squadId} (${squadData.name})`);
  } catch (error) {
    console.error('[SQUAD_REMOVE] Error removing user from squad:', error);
    throw error;
  }
}

/**
 * Remove a user from a squad's Stream chat channel ONLY.
 * Keeps Firebase squad membership intact for re-enrollment.
 * Used when stopping an enrollment - user loses chat access but remains enrollable.
 *
 * @param userId - User ID to remove from chat
 * @param squadId - Squad ID whose chat to remove from
 */
export async function removeUserFromSquadChat(
  userId: string,
  squadId: string
): Promise<void> {
  try {
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();

    if (!squadDoc.exists) {
      console.log(`[SQUAD_CHAT_REMOVE] Squad ${squadId} not found`);
      return;
    }

    const squadData = squadDoc.data() as Squad;

    // Only remove from Stream chat - keep Firebase membership
    if (squadData.chatChannelId) {
      try {
        const streamClient = await getStreamServerClient();
        const channel = streamClient.channel('messaging', squadData.chatChannelId);
        await channel.removeMembers([userId]);
        console.log(`[SQUAD_CHAT_REMOVE] Removed user ${userId} from Stream channel ${squadData.chatChannelId}`);
      } catch (streamError) {
        console.error('[SQUAD_CHAT_REMOVE] Error removing from Stream channel:', streamError);
        // Non-fatal - enrollment status already updated
      }
    } else {
      console.log(`[SQUAD_CHAT_REMOVE] Squad ${squadId} has no chat channel`);
    }
  } catch (error) {
    console.error('[SQUAD_CHAT_REMOVE] Error:', error);
    // Non-fatal - don't throw, let enrollment status update proceed
  }
}

// ============================================================================
// PROGRAMS V2 SYNC (program_enrollments + program_days collections)
// ============================================================================

/**
 * Get user's active enrollment from Programs v2 (program_enrollments collection)
 *
 * Also handles "upcoming" enrollments that should be active based on cohort start date.
 * If the cohort's start date has arrived but status is still 'upcoming', this function
 * will update the status to 'active' and return the enrollment.
 *
 * @param userId - User ID to find enrollment for
 * @param organizationId - Optional organization ID to filter by (for multi-tenant isolation)
 */
export async function getActiveEnrollmentV2(userId: string, organizationId?: string | null): Promise<ProgramEnrollment | null> {
  // First try to find an active enrollment
  let activeQuery = adminDb
    .collection('program_enrollments')
    .where('userId', '==', userId)
    .where('status', '==', 'active');

  // CRITICAL: Filter by organization for multi-tenant isolation
  if (organizationId) {
    activeQuery = activeQuery.where('organizationId', '==', organizationId);
  }

  const activeSnapshot = await activeQuery.limit(1).get();

  if (!activeSnapshot.empty) {
    const doc = activeSnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as ProgramEnrollment;
  }

  // If no active enrollment, check for "upcoming" that should be active
  let upcomingQuery = adminDb
    .collection('program_enrollments')
    .where('userId', '==', userId)
    .where('status', '==', 'upcoming');

  // CRITICAL: Filter by organization for multi-tenant isolation
  if (organizationId) {
    upcomingQuery = upcomingQuery.where('organizationId', '==', organizationId);
  }

  const upcomingSnapshot = await upcomingQuery.limit(1).get();
  
  if (upcomingSnapshot.empty) return null;
  
  const doc = upcomingSnapshot.docs[0];
  const enrollment = { id: doc.id, ...doc.data() } as ProgramEnrollment;
  
  // Check if this upcoming enrollment should actually be active
  const today = new Date().toISOString().split('T')[0];
  let actualStartDate = enrollment.startedAt;
  
  // For group programs, use cohort start date
  if (enrollment.cohortId) {
    const cohortDoc = await adminDb.collection('program_cohorts').doc(enrollment.cohortId).get();
    if (cohortDoc.exists) {
      const cohortData = cohortDoc.data() as ProgramCohort;
      actualStartDate = cohortData.startDate;
    }
  }
  
  // If start date has arrived, activate the enrollment
  if (actualStartDate <= today) {
    const now = new Date().toISOString();
    await adminDb.collection('program_enrollments').doc(enrollment.id).update({
      status: 'active',
      startedAt: actualStartDate, // Fix startedAt to match actual start
      updatedAt: now,
    });
    
    console.log(`[PROGRAM_ENGINE_V2] Auto-activated enrollment ${enrollment.id} (start: ${actualStartDate})`);
    
    // Return the updated enrollment
    return {
      ...enrollment,
      status: 'active',
      startedAt: actualStartDate,
    };
  }
  
  // Enrollment is still upcoming (start date in future)
  return null;
}

/**
 * Get program day template from Programs v2 (program_days collection)
 */
export async function getProgramDayV2(
  programId: string, 
  dayIndex: number
): Promise<ProgramDay | null> {
  const snapshot = await adminDb
    .collection('program_days')
    .where('programId', '==', programId)
    .where('dayIndex', '==', dayIndex)
    .limit(1)
    .get();
  
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as ProgramDay;
}

/**
 * Get client-specific program day content for 1:1 programs.
 * This takes precedence over template days for individual programs.
 */
export async function getClientProgramDay(
  enrollmentId: string,
  dayIndex: number
): Promise<ClientProgramDay | null> {
  const snapshot = await adminDb
    .collection('client_program_days')
    .where('enrollmentId', '==', enrollmentId)
    .where('dayIndex', '==', dayIndex)
    .limit(1)
    .get();
  
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as ClientProgramDay;
}

// REMOVED: getClientProgramWeekForDay

/**
 * Get day tasks from program_instances (NEW architecture).
 * This is the source of truth for both cohort and individual programs.
 * Falls back to null if no instance exists (legacy data).
 */
export async function getInstanceDayTasks(
  programId: string,
  enrollmentId: string | null,
  cohortId: string | null,
  dayIndex: number
): Promise<{ tasks: ProgramTaskTemplate[]; found: boolean } | null> {
  // Find the program_instances document
  let instanceQuery = adminDb.collection('program_instances')
    .where('programId', '==', programId);

  if (cohortId) {
    instanceQuery = instanceQuery.where('cohortId', '==', cohortId);
  } else if (enrollmentId) {
    instanceQuery = instanceQuery.where('enrollmentId', '==', enrollmentId);
  } else {
    return null;
  }

  const instanceSnapshot = await instanceQuery.limit(1).get();
  if (instanceSnapshot.empty) {
    return null; // No instance - fall back to legacy collections
  }

  const instance = instanceSnapshot.docs[0].data();
  const weeks = instance.weeks || [];

  // Find the week that contains this dayIndex
  for (const week of weeks) {
    const startDay = week.startDayIndex || 1;
    const endDay = week.endDayIndex || 7;

    if (dayIndex >= startDay && dayIndex <= endDay) {
      // Found the week - now find the day
      const days = week.days || [];
      const dayWithinWeek = days.find((d: { globalDayIndex?: number; dayIndex?: number }) =>
        d.globalDayIndex === dayIndex || d.dayIndex === (dayIndex - startDay + 1)
      );

      if (dayWithinWeek) {
        // Return tasks from the instance day
        const tasks = dayWithinWeek.tasks || [];
        console.log(`[PROGRAM_ENGINE] Got ${tasks.length} tasks from program_instances for day ${dayIndex}`);
        return { tasks: tasks as ProgramTaskTemplate[], found: true };
      } else {
        // Week exists but day not found - return empty (no tasks for this day)
        console.log(`[PROGRAM_ENGINE] Day ${dayIndex} not found in week ${week.weekNumber}, returning empty tasks`);
        return { tasks: [], found: true };
      }
    }
  }

  // Day index not in any week
  console.log(`[PROGRAM_ENGINE] Day ${dayIndex} not in any week of instance`);
  return { tasks: [], found: true };
}
// This function read from client_program_weeks at runtime.
// Now client_program_weeks is UI-only - sync reads from client_program_days.


/**
 * Get program week that contains a specific day index
 */
export async function getProgramWeekForDay(
  programId: string,
  dayIndex: number
): Promise<ProgramWeek | null> {
  // Find the week that contains this day
  const snapshot = await adminDb
    .collection('program_weeks')
    .where('programId', '==', programId)
    .where('startDayIndex', '<=', dayIndex)
    .get();
  
  if (snapshot.empty) return null;
  
  // Find the week where endDayIndex >= dayIndex
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.endDayIndex >= dayIndex) {
      return { id: doc.id, ...data } as ProgramWeek;
    }
  }
  return null;
}

/**
 * Get tasks for a specific day from weekly mode
 * Applies distribution logic (repeat-daily or spread)
 * Distribution is always program-wide, passed in as a parameter
 */
export function getWeeklyTasksForDay(
  week: ProgramWeek,
  dayIndex: number,
  programDistribution?: TaskDistribution
): ProgramTaskTemplate[] {
  const weeklyTasks = week.weeklyTasks || [];
  if (weeklyTasks.length === 0) return [];

  // Distribution is always program-wide, never week-specific
  const distribution = programDistribution ?? 'spread';
  
  if (distribution === 'repeat-daily') {
    // All tasks appear every day
    return weeklyTasks;
  }
  
  // Spread distribution: use centered spacing (same as distributeClientWeeklyTasksToDays)
  const spreadDays = calculateSpreadDayIndices(
    weeklyTasks.length,
    week.startDayIndex,
    week.endDayIndex
  );

  // Find which task index (if any) is assigned to this day
  const taskIndex = spreadDays.indexOf(dayIndex);

  if (taskIndex !== -1 && taskIndex < weeklyTasks.length) {
    return [weeklyTasks[taskIndex]];
  }

  return [];
}

/**
 * Get program from Programs v2 (programs collection)
 */
export async function getProgramV2(programId: string): Promise<Program | null> {
  const doc = await adminDb.collection('programs').doc(programId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Program;
}

/**
 * Update enrollment's lastAssignedDayIndex for Programs v2
 */
async function updateEnrollmentDayIndexV2(
  enrollmentId: string, 
  dayIndex: number
): Promise<void> {
  const now = new Date().toISOString();
  await adminDb.collection('program_enrollments').doc(enrollmentId).update({
    lastAssignedDayIndex: dayIndex,
    updatedAt: now,
  });
}

/**
 * Check if a program task already exists for the user on a given day (Programs v2)
 * (Prevents duplicates when syncing)
 */
async function programTaskExistsV2(
  userId: string,
  enrollmentId: string,
  dayIndex: number,
  taskLabel: string,
  date: string
): Promise<boolean> {
  const snapshot = await adminDb
    .collection('tasks')
    .where('userId', '==', userId)
    .where('programEnrollmentId', '==', enrollmentId)
    .where('programDayIndex', '==', dayIndex)
    .where('title', '==', taskLabel)
    .where('date', '==', date)
    .limit(1)
    .get();
  
  return !snapshot.empty;
}

/**
 * Create a task from a program template (Programs v2)
 */
async function createProgramTaskV2(
  userId: string,
  enrollmentId: string,
  organizationId: string,
  programId: string,
  dayIndex: number,
  template: ProgramTaskTemplate,
  listType: 'focus' | 'backlog',
  order: number,
  date: string,
  cycleNumber?: number
): Promise<Task> {
  const now = new Date().toISOString();
  
  const taskData = {
    userId,
    organizationId,
    title: template.label,
    status: 'pending',
    listType,
    order,
    date,
    isPrivate: false,
    sourceType: 'program',
    programEnrollmentId: enrollmentId,
    programDayIndex: dayIndex,
    // Sync fields for cohort task state tracking
    sourceProgramId: programId,
    instanceTaskId: template.id || undefined,
    originalTitle: template.label, // Preserve original for fallback matching when client edits title
    visibility: 'public' as const,
    clientLocked: false,
    ...(cycleNumber !== undefined && { cycleNumber }),
    createdAt: now,
    updatedAt: now,
  } as Omit<Task, 'id'>;
  
  const docRef = await adminDb.collection('tasks').add(taskData);
  console.log(`[PROGRAM_ENGINE_V2] Created program task: "${template.label}" (${listType}) for day ${dayIndex}${cycleNumber ? ` cycle ${cycleNumber}` : ''}`);
  
  return { id: docRef.id, ...taskData };
}

/**
 * Calculate program day index considering cohort start date for group programs
 * and weekend exclusion settings
 */
function calculateCurrentDayIndexV2(
  enrollment: ProgramEnrollment,
  program: Program,
  cohort: ProgramCohort | null,
  todayDate?: string
): number {
  const today = todayDate || new Date().toISOString().split('T')[0];
  const todayDateObj = new Date(today + 'T00:00:00');
  
  // CRITICAL: For group programs, cohort.startDate is THE source of truth
  // ALL cohort members must see the same day index regardless of when they joined
  let startDateStr: string;
  
  if (program.type === 'group') {
    if (!cohort?.startDate) {
      console.warn(
        `[PROGRAM_ENGINE] Group program ${program.id} missing cohort data for enrollment ${enrollment.id}. ` +
        `This should not happen - all group program members need a cohort.`
      );
      // Fallback to enrollment date with warning (should not happen in production)
      startDateStr = enrollment.startedAt;
    } else {
      // Use cohort start date for ALL members - they all see the same day
      startDateStr = cohort.startDate;
      
      // Log if member's enrollment date differs from cohort (late joiner)
      if (enrollment.startedAt !== cohort.startDate) {
        console.log(
          `[PROGRAM_ENGINE] Late joiner: enrollment ${enrollment.id} started ${enrollment.startedAt} ` +
          `but cohort started ${cohort.startDate}. Using cohort date (day index will match other members).`
        );
      }
    }
  } else {
    // Individual programs use enrollment.startedAt
    startDateStr = enrollment.startedAt;
  }
  
  let startDate = new Date(startDateStr + 'T00:00:00');
  
  // Handle weekend exclusion
  const includeWeekends = program.includeWeekends !== false; // Default true
  
  if (!includeWeekends) {
    // If today is a weekend, skip task feeding entirely
    if (isWeekend(todayDateObj)) {
      return 0;
    }
    
    // If program starts on weekend, adjust to next Monday
    if (isWeekend(startDate)) {
      startDate = getNextWeekday(startDate);
    }
    
    // If today is before the effective start date, program hasn't started
    if (todayDateObj < startDate) {
      return 0;
    }
    
    // Count only weekdays between start and today
    const workingDayIndex = countWeekdaysBetween(startDate, todayDateObj);
    
    // Calculate max working days for this program
    const maxWorkingDays = calculateWorkingDays(program.lengthDays);
    
    // Cap at max working days
    return Math.min(workingDayIndex, maxWorkingDays);
  }
  
  // Original logic for programs that include weekends
  // Calculate elapsed days
  const elapsedMs = todayDateObj.getTime() - startDate.getTime();
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
  
  // Day index is 1-based: day 1 = first day, etc.
  const dayIndex = elapsedDays + 1;
  
  // If day index is <= 0, program hasn't started yet
  if (dayIndex <= 0) return 0;
  
  // Cap at program length
  return Math.min(dayIndex, program.lengthDays);
}


/**
 * Reverse of calculateCurrentDayIndexV2 - given a dayIndex, returns the calendar date
 * that corresponds to that program day for a specific cohort.
 * 
 * @returns ISO date string (YYYY-MM-DD) or null if dayIndex is invalid
 */
export function calculateDateForDayIndex(
  cohort: ProgramCohort,
  program: Program,
  dayIndex: number
): string | null {
  if (dayIndex <= 0 || dayIndex > program.lengthDays) {
    return null;
  }

  const startDateStr = cohort.startDate;
  if (!startDateStr) {
    return null;
  }

  // Handle both date-only strings (2026-01-03) and full ISO timestamps (2026-01-03T13:10:47.267Z)
  const dateOnly = startDateStr.includes('T') ? startDateStr.split('T')[0] : startDateStr;
  let startDate = new Date(dateOnly + 'T00:00:00');

  // Guard against invalid date
  if (isNaN(startDate.getTime())) {
    console.warn(`[calculateDateForDayIndex] Invalid start date: ${startDateStr} (parsed as: ${dateOnly})`);
    return null;
  }

  const includeWeekends = program.includeWeekends !== false;

  if (!includeWeekends) {
    // If program starts on weekend, adjust to next Monday
    if (isWeekend(startDate)) {
      startDate = getNextWeekday(startDate);
    }

    // Find the date that is `dayIndex` weekdays from start
    let currentDate = new Date(startDate);
    let weekdayCount = 1; // Start date is day 1

    while (weekdayCount < dayIndex) {
      currentDate.setDate(currentDate.getDate() + 1);
      if (!isWeekend(currentDate)) {
        weekdayCount++;
      }
    }

    return currentDate.toISOString().split('T')[0];
  }

  // For programs that include weekends: simple date arithmetic
  // dayIndex 1 = start date, dayIndex 2 = start + 1 day, etc.
  const elapsedDays = dayIndex - 1;
  const targetDate = new Date(startDate);
  targetDate.setDate(targetDate.getDate() + elapsedDays);

  return targetDate.toISOString().split('T')[0];
}

/**
 * Main function: Sync program tasks for today (Programs v2)
 * 
 * This is the v2 engine function that:
 * 1. Finds the user's active enrollment from program_enrollments
 * 2. Calculates what program day they're on (using cohort date for groups)
 * 3. Creates tasks from the program_days template if needed
 * 4. Places tasks in Daily Focus or Backlog
 */
/**
 * @deprecated Use syncProgramTasksForDay() instead.
 * This function will be removed in a future version.
 */
export async function syncProgramV2TasksForToday(
  userId: string,
  todayDate?: string,
  organizationId?: string | null
): Promise<SyncProgramTasksResult> {
  console.warn('[PROGRAM_ENGINE_V2] syncProgramV2TasksForToday is deprecated. Use syncProgramTasksForDay() instead.');
  const today = todayDate || new Date().toISOString().split('T')[0];

  // 1. Find active enrollment from program_enrollments (filtered by org for multi-tenancy)
  const enrollment = await getActiveEnrollmentV2(userId, organizationId);
  
  if (!enrollment) {
    return {
      success: true,
      tasksCreated: 0,
      focusTasksCreated: 0,
      backlogTasksCreated: 0,
      currentDayIndex: 0,
      enrollmentId: null,
      programId: null,
      programName: null,
      programCompleted: false,
      message: 'No active V2 program enrollment',
    };
  }
  
  // 2. Get the program
  const program = await getProgramV2(enrollment.programId);
  
  if (!program) {
    console.error(`[PROGRAM_ENGINE_V2] Program ${enrollment.programId} not found for enrollment ${enrollment.id}`);
    return {
      success: false,
      tasksCreated: 0,
      focusTasksCreated: 0,
      backlogTasksCreated: 0,
      currentDayIndex: 0,
      enrollmentId: enrollment.id,
      programId: enrollment.programId,
      programName: null,
      programCompleted: false,
      message: 'Program not found',
    };
  }
  
  // 3. Get cohort for group programs
  let cohort: ProgramCohort | null = null;
  if (enrollment.cohortId) {
    const cohortDoc = await adminDb.collection('program_cohorts').doc(enrollment.cohortId).get();
    if (cohortDoc.exists) {
      cohort = { id: cohortDoc.id, ...cohortDoc.data() } as ProgramCohort;
    }
  }
  
  // 4. Calculate current day index
  const dayIndex = calculateCurrentDayIndexV2(enrollment, program, cohort, today);
  
  // If dayIndex is 0, program hasn't started yet
  if (dayIndex === 0) {
    return {
      success: true,
      tasksCreated: 0,
      focusTasksCreated: 0,
      backlogTasksCreated: 0,
      currentDayIndex: 0,
      enrollmentId: enrollment.id,
      programId: program.id,
      programName: program.name,
      programCompleted: false,
      message: 'Program has not started yet',
    };
  }
  
  // 5. Track if this is a new day or re-sync of an existing day
  // We still check for new tasks even if day was already processed (coach may have added new tasks)
  const isResync = dayIndex <= enrollment.lastAssignedDayIndex;
  
  // 6. Get tasks for this day
  // Priority chain (document EXISTS means stop fallback, even if empty):
  // 1. Client-specific day (for 1:1)
  // 2. Cohort-specific day (for group programs)
  // 3. Week-level tasks (distributed)
  // 4. Template day tasks
  let tasksForToday: ProgramTaskTemplate[] = [];
  let foundExplicitDay = false; // Track if we found an explicit day document (even if empty)

  // NEW ARCHITECTURE: Try program_instances first (source of truth)
  const instanceResult = await getInstanceDayTasks(
    enrollment.programId,
    program.type === 'individual' ? enrollment.id : null,
    program.type === 'group' ? (enrollment.cohortId || null) : null,
    dayIndex
  );

  if (instanceResult) {
    tasksForToday = instanceResult.tasks;
    foundExplicitDay = instanceResult.found;
    console.log(`[PROGRAM_ENGINE_V2] Got ${tasksForToday.length} tasks from program_instances for day ${dayIndex}`);
  }

  // LEGACY FALLBACK: For individual (1:1) programs, check client-specific day content
  if (!foundExplicitDay && program.type === 'individual') {
    const clientDay = await getClientProgramDay(enrollment.id, dayIndex);
    if (clientDay) {
      // Document EXISTS - use it even if tasks empty (coach explicitly cleared them)
      tasksForToday = clientDay.tasks ? [...clientDay.tasks] : [];
      foundExplicitDay = true;
      console.log(`[PROGRAM_ENGINE_V2] LEGACY: Got ${tasksForToday.length} client-specific tasks for day ${dayIndex}`);
    }
  }

  // LEGACY FALLBACK: For group programs with cohort, check cohort-specific day content
  if (!foundExplicitDay && program.type === 'group' && enrollment.cohortId) {
    const cohortDaySnapshot = await adminDb
      .collection('cohort_program_days')
      .where('cohortId', '==', enrollment.cohortId)
      .where('programId', '==', enrollment.programId)
      .where('dayIndex', '==', dayIndex)
      .limit(1)
      .get();

    if (!cohortDaySnapshot.empty) {
      // Document EXISTS - use it even if tasks empty (coach explicitly cleared them)
      const cohortDay = cohortDaySnapshot.docs[0].data();
      tasksForToday = cohortDay.tasks ? [...cohortDay.tasks] : [];
      foundExplicitDay = true;
      console.log(`[PROGRAM_ENGINE_V2] LEGACY: Got ${tasksForToday.length} cohort-specific tasks for day ${dayIndex}`);
    }
  }

  // If no content found anywhere, log for debugging
  if (!foundExplicitDay) {
    console.log(`[PROGRAM_ENGINE_V2] No content for day ${dayIndex} in program_instances or legacy collections`);
  }
  
  if (tasksForToday.length === 0) {
    console.log(`[PROGRAM_ENGINE_V2] No tasks defined for day ${dayIndex} of program ${program.name}`);
    // Only update lastAssignedDayIndex if this is a fresh sync (not a re-sync)
    if (!isResync) {
      await updateEnrollmentDayIndexV2(enrollment.id, dayIndex);
    }
    return {
      success: true,
      tasksCreated: 0,
      focusTasksCreated: 0,
      backlogTasksCreated: 0,
      currentDayIndex: dayIndex,
      enrollmentId: enrollment.id,
      programId: program.id,
      programName: program.name,
      programCompleted: false,
      message: `No tasks defined for day ${dayIndex}`,
    };
  }
  
  // 7. Get existing tasks for today to determine placement
  const existingFocusTasks = await getExistingFocusTasks(userId, today);
  const existingBacklogTasks = await getExistingBacklogTasks(userId, today);
  
  // Get focus limit from org settings or program settings
  let focusLimit = program.dailyFocusSlots || 3;
  try {
    const orgSettingsDoc = await adminDb.collection('org_settings').doc(enrollment.organizationId).get();
    const orgSettings = orgSettingsDoc.data();
    if (orgSettings?.defaultDailyFocusSlots) {
      focusLimit = orgSettings.defaultDailyFocusSlots;
    }
  } catch {
    // Fallback to program setting or default
  }
  
  let availableFocusSlots = focusLimit - existingFocusTasks.length;
  let nextFocusOrder = existingFocusTasks.length > 0 
    ? Math.max(...existingFocusTasks.map(t => t.order)) + 1 
    : 0;
  let nextBacklogOrder = existingBacklogTasks.length > 0 
    ? Math.max(...existingBacklogTasks.map(t => t.order)) + 1 
    : 0;
  
  let tasksCreated = 0;
  let focusTasksCreated = 0;
  let backlogTasksCreated = 0;

  // Calculate cycleNumber for evergreen programs only
  const cycleNumberForTasks = program.durationType === 'evergreen'
    ? getActiveCycleNumber(enrollment)
    : undefined;

  // 8. Create tasks from templates
  // First, handle primary tasks (try to put in Focus)
  const primaryTasks = tasksForToday.filter(t => t.isPrimary);
  const nonPrimaryTasks = tasksForToday.filter(t => !t.isPrimary);
  
  for (const template of primaryTasks) {
    // Check if task already exists (avoid duplicates)
    const exists = await programTaskExistsV2(
      userId, 
      enrollment.id, 
      dayIndex, 
      template.label, 
      today
    );
    
    if (exists) {
      console.log(`[PROGRAM_ENGINE_V2] Task "${template.label}" already exists, skipping`);
      continue;
    }
    
    // Determine placement
    let listType: 'focus' | 'backlog';
    let order: number;
    
    if (availableFocusSlots > 0) {
      listType = 'focus';
      order = nextFocusOrder++;
      availableFocusSlots--;
      focusTasksCreated++;
    } else {
      listType = 'backlog';
      order = nextBacklogOrder++;
      backlogTasksCreated++;
    }
    
    await createProgramTaskV2(
      userId,
      enrollment.id,
      enrollment.organizationId,
      program.id,
      dayIndex,
      template,
      listType,
      order,
      today,
      cycleNumberForTasks
    );

    tasksCreated++;
  }

  // Then, handle non-primary tasks (always go to Backlog)
  for (const template of nonPrimaryTasks) {
    // Check if task already exists
    const exists = await programTaskExistsV2(
      userId, 
      enrollment.id, 
      dayIndex, 
      template.label, 
      today
    );
    
    if (exists) {
      console.log(`[PROGRAM_ENGINE_V2] Task "${template.label}" already exists, skipping`);
      continue;
    }
    
    await createProgramTaskV2(
      userId,
      enrollment.id,
      enrollment.organizationId,
      program.id,
      dayIndex,
      template,
      'backlog',
      nextBacklogOrder++,
      today,
      cycleNumberForTasks
    );

    tasksCreated++;
    backlogTasksCreated++;
  }

  // 9. Update enrollment lastAssignedDayIndex (only if this is a fresh sync, not a re-sync)
  if (!isResync) {
    await updateEnrollmentDayIndexV2(enrollment.id, dayIndex);
  }

  // 10. Check if program is completed (today is the last day)
  let programCompleted = false;
  let cycleRolledOver = false;
  const currentCycleNumber = getActiveCycleNumber(enrollment);

  if (dayIndex >= program.lengthDays) {
    const isEvergreen = program.durationType === 'evergreen';

    if (isEvergreen) {
      // Evergreen program: roll over to next cycle instead of completing
      const { newCycleNumber } = await rolloverToNextCycle(enrollment.id, currentCycleNumber);
      cycleRolledOver = true;
      console.log(`[PROGRAM_ENGINE_V2] User ${userId} completed cycle ${currentCycleNumber} of evergreen program ${program.name}, rolling to cycle ${newCycleNumber}`);
    } else {
      // Fixed program: mark as completed
      const now = new Date().toISOString();
      await adminDb.collection('program_enrollments').doc(enrollment.id).update({
        status: 'completed',
        completedAt: now,
        updatedAt: now,
      });
      programCompleted = true;
      console.log(`[PROGRAM_ENGINE_V2] User ${userId} completed program ${program.name}!`);
    }
  }

  console.log(`[PROGRAM_ENGINE_V2] Synced day ${dayIndex} for user ${userId}: ${tasksCreated} tasks created (${focusTasksCreated} focus, ${backlogTasksCreated} backlog)`);

  return {
    success: true,
    tasksCreated,
    focusTasksCreated,
    backlogTasksCreated,
    currentDayIndex: dayIndex,
    enrollmentId: enrollment.id,
    programId: program.id,
    programName: program.name,
    programCompleted,
    message: cycleRolledOver
      ? `Cycle ${currentCycleNumber} completed! Rolling to cycle ${currentCycleNumber + 1}. Created ${tasksCreated} tasks for day ${dayIndex}`
      : programCompleted
        ? `Program completed! Created ${tasksCreated} tasks for final day ${dayIndex}`
        : `Created ${tasksCreated} tasks for day ${dayIndex}`,
  };
}

// ============================================================================
// WEEKLY SYNC ENGINE (Programs with week-based task distribution)
// ============================================================================

export interface SyncWeeklyTasksResult {
  success: boolean;
  tasksCreated: number;
  currentWeekIndex: number;
  weekId: string | null;
  enrollmentId: string | null;
  programId: string | null;
  programName: string | null;
  message: string;
}

export interface SyncWeeklyTasksOptions {
  forceResync?: boolean;
  fromSummary?: CallSummary;
}

// REMOVED: getCurrentWeekForEnrollment and calculateWeekTaskDates
// These functions were used by the old syncWeeklyTasks implementation
// which has been deprecated in favor of syncProgramTasksForDay.
// The client_program_weeks collection is now UI-only.


/**
 * Sync weekly tasks for a user's enrollment
 *
 * For weekly-oriented programs, this syncs tasks at the week level:
 * 1. Find the current week based on enrollment progress
 * 2. Get weeklyTasks from the ProgramWeek
 * 3. Create tasks spread across the week (or all on day 1)
 * 4. Update enrollment with weekly sync info
 */
/**
 * @deprecated Use syncProgramTasksForDay() instead.
 * This function will be removed in a future version.
 */
export async function syncWeeklyTasks(
  userId: string,
  enrollmentId: string,
  options: SyncWeeklyTasksOptions = {}
): Promise<SyncWeeklyTasksResult> {
  // DEPRECATED: This function now delegates to syncProgramTasksForDay
  // The weekly sync logic has been removed in favor of day-level sync.
  // client_program_weeks is now UI-only - it distributes to client_program_days on save.
  console.warn('[PROGRAM_ENGINE] syncWeeklyTasks is deprecated. Using syncProgramTasksForDay instead.');
  
  const today = new Date().toISOString().split('T')[0];
  
  // Call the new unified sync for today only
  const result = await syncProgramTasksForDay({
    userId,
    enrollmentId,
    date: today,
    mode: 'fill-empty',
  });
  
  // Map the result to the legacy format
  return {
    success: result.success,
    tasksCreated: result.tasksCreated,
    currentWeekIndex: 0, // No longer tracked at week level
    weekId: null,
    enrollmentId,
    programId: result.programId || null,
    programName: result.programName || null,
    message: result.message,
  };
}

/**
 * Trigger weekly resync for all active enrollments of a program when coach edits week content
 */
export async function queueWeeklyResyncForProgram(
  programId: string,
  weekNumber: number
): Promise<{ queued: number }> {
  // Find all active enrollments for this program at this week
  const enrollmentsSnapshot = await adminDb
    .collection('program_enrollments')
    .where('programId', '==', programId)
    .where('status', '==', 'active')
    .where('currentWeekIndex', '==', weekNumber)
    .get();

  let queued = 0;

  for (const enrollmentDoc of enrollmentsSnapshot.docs) {
    const enrollment = { id: enrollmentDoc.id, ...enrollmentDoc.data() } as ProgramEnrollment;

    // Reset the weeklyTasksSynced flag to trigger resync on next check
    await enrollmentDoc.ref.update({
      weeklyTasksSynced: false,
      updatedAt: FieldValue.serverTimestamp(),
    });

    queued++;
    console.log(`[WEEKLY_SYNC] Queued resync for enrollment ${enrollment.id}`);
  }

  return { queued };
}

/**
 * Unified sync function for all programs
 * Uses weekly task sync which handles both week-level and day-level tasks
 */
/**
 * @deprecated Use syncProgramTasksForDay() instead.
 * This function will be removed in a future version.
 */
export async function syncProgramTasksAuto(
  userId: string,
  todayDate?: string,
  organizationId?: string | null
): Promise<SyncProgramTasksResult | SyncWeeklyTasksResult> {
  // DEPRECATED: This function now delegates to syncProgramTasksForDay
  // The auto-detect logic has been removed - all programs now use day-level sync.
  console.warn('[PROGRAM_ENGINE] syncProgramTasksAuto is deprecated. Using syncProgramTasksForDay instead.');

  // Get the user's active enrollment (filtered by org for multi-tenancy)
  const enrollment = await getActiveEnrollmentV2(userId, organizationId);

  if (!enrollment) {
    return {
      success: true,
      tasksCreated: 0,
      focusTasksCreated: 0,
      backlogTasksCreated: 0,
      currentDayIndex: 0,
      enrollmentId: null,
      programId: null,
      programName: null,
      programCompleted: false,
      message: 'No active program enrollment',
    };
  }

  const today = todayDate || new Date().toISOString().split('T')[0];
  
  // Use the new unified sync function
  const result = await syncProgramTasksForDay({
    userId,
    enrollmentId: enrollment.id,
    date: today,
    mode: 'fill-empty',
  });
  
  // Map the result to the legacy format
  return {
    success: result.success,
    tasksCreated: result.tasksCreated,
    focusTasksCreated: result.focusTasks || 0,
    backlogTasksCreated: result.backlogTasks || 0,
    currentDayIndex: result.programDayIndex,
    enrollmentId: enrollment.id,
    programId: result.programId || null,
    programName: result.programName || null,
    programCompleted: false,
    message: result.message,
  };
}


// =============================================================================
// 2-WAY COACH-CLIENT TASK SYNC
// =============================================================================

export type SyncMode = 'fill-empty' | 'override-program-sourced';

export interface SyncProgramTasksToClientDayParams {
  userId: string;
  programEnrollmentId: string;
  date: string; // ISO date string YYYY-MM-DD
  mode: SyncMode;
  coachUserId?: string; // For tracking who triggered the sync
  forceDayIndex?: number; // If provided, use this dayIndex instead of calculating from date
}

export interface SyncProgramTasksToClientDayResult {
  success: boolean;
  tasksCreated: number;
  tasksSkipped: number;
  tasksReplaced: number;
  tasksToBacklog: number;
  focusTasks: number;
  backlogTasks: number;
  programDayIndex: number;
  programId: string | null;
  programName: string | null;
  message: string;
  errors?: string[];
}

/**
 * Sync program tasks to a client's Daily Focus for a specific date.
 * 
 * This is the core 2-way sync function that enables immediate task sync
 * when coaches edit program content.
 * 
 * Modes:
 * - 'fill-empty': Only fill empty slots, never override existing tasks
 * - 'override-program-sourced': Replace program/coach tasks, preserve client tasks
 * 
 * Rules:
 * - Client-created tasks (sourceType='user') are NEVER overwritten
 * - Tasks with clientLocked=true are NEVER overwritten
 * - Max Daily Focus limit is respected (excess goes to backlog)
 * - Program-sourced tasks get visibility='public' by default
 */

// ============================================================================
// UNIFIED SYNC FUNCTION - Use this instead of the deprecated functions below
// ============================================================================

/**
 * Parameters for the unified sync function
 */
export interface SyncProgramTasksForDayParams {
  userId: string;
  enrollmentId: string;
  date: string; // YYYY-MM-DD
  mode: 'fill-empty' | 'override-program-sourced';
  coachUserId?: string;
}

/**
 * Result of the unified sync function
 */
export interface SyncProgramTasksForDayResult {
  success: boolean;
  tasksCreated: number;
  tasksSkipped: number;
  tasksReplaced: number;
  tasksToBacklog: number;
  focusTasks: number;
  backlogTasks: number;
  programDayIndex: number;
  programId: string | null;
  programName: string | null;
  message: string;
  errors?: string[];
}

/**
 * Unified sync function - THE one function to sync program tasks.
 * 
 * This function:
 * 1. Gets enrollment and program
 * 2. Calculates dayIndex from date (using cohort.startDate for group programs)
 * 3. Gets tasks from client/cohort editor ONLY (no template fallback)
 * 4. Creates/updates tasks based on mode
 * 
 * Use this instead of deprecated functions:
 * - syncProgramV2TasksForToday() 
 * - syncProgramTasksToClientDay()
 * - syncWeeklyTasks()
 * - syncProgramTasksAuto()
 */
export async function syncProgramTasksForDay(
  params: SyncProgramTasksForDayParams
): Promise<SyncProgramTasksForDayResult> {
  const { userId, enrollmentId, date, mode, coachUserId } = params;

  console.log(`[SYNC_UNIFIED] syncProgramTasksForDay called:`, {
    userId,
    enrollmentId,
    date,
    mode,
  });

  // Delegate to the existing implementation (which we've already cleaned up)
  // This wrapper provides the clean interface going forward
  const result = await syncProgramTasksToClientDay({
    userId,
    programEnrollmentId: enrollmentId,
    date,
    mode,
    coachUserId,
    // Note: We don't pass forceDayIndex - let it calculate from date
  });

  // UNIFIED APPROACH: For cohort enrollments, ensure CohortTaskStates exist
  // This makes the unified sync function work for both 1:1 and cohort programs
  if (result.success && result.tasksCreated > 0) {
    try {
      const enrollmentDoc = await adminDb.collection('program_enrollments').doc(enrollmentId).get();
      if (enrollmentDoc.exists) {
        const enrollment = enrollmentDoc.data();
        if (enrollment?.cohortId) {
          // Import dynamically to avoid circular dependency
          const { getOrCreateCohortTaskState } = await import('@/lib/cohort-task-state');

          // Get program tasks that were just synced
          const syncedTasksSnapshot = await adminDb
            .collection('tasks')
            .where('userId', '==', userId)
            .where('date', '==', date)
            .where('programEnrollmentId', '==', enrollmentId)
            .get();

          // Get all cohort members for the state
          const cohortMembersSnapshot = await adminDb
            .collection('program_enrollments')
            .where('cohortId', '==', enrollment.cohortId)
            .where('status', 'in', ['active', 'upcoming'])
            .get();
          const memberIds = cohortMembersSnapshot.docs.map(d => d.data().userId);

          // Create CohortTaskStates for each program-sourced task
          for (const doc of syncedTasksSnapshot.docs) {
            const task = doc.data();
            const sourceType = task.sourceType;
            if (!sourceType || !['program', 'program_day', 'program_week', 'coach_manual'].includes(sourceType)) {
              continue;
            }

            await getOrCreateCohortTaskState({
              cohortId: enrollment.cohortId,
              programId: enrollment.programId,
              organizationId: task.organizationId || enrollment.organizationId || '',
              programDayIndex: task.programDayIndex || 0,
              taskTemplateId: task.instanceTaskId || `${task.title}:${task.programDayIndex || 0}`,
              taskTitle: task.originalTitle || task.title,
              programTaskId: task.instanceTaskId, // Renamed field, still passed to deprecated function
              date,
              memberIds,
            });
          }
          console.log(`[SYNC_UNIFIED] Created CohortTaskStates for cohort ${enrollment.cohortId}`);
        }
      }
    } catch (err) {
      console.error('[SYNC_UNIFIED] Failed to create CohortTaskStates:', err);
      // Don't fail the sync - CohortTaskStates can be created on-demand when user completes task
    }
  }

  return {
    success: result.success,
    tasksCreated: result.tasksCreated,
    tasksSkipped: result.tasksSkipped,
    tasksReplaced: result.tasksReplaced,
    tasksToBacklog: result.tasksToBacklog,
    focusTasks: result.focusTasks,
    backlogTasks: result.backlogTasks,
    programDayIndex: result.programDayIndex,
    programId: result.programId,
    programName: result.programName,
    message: result.message,
    errors: result.errors,
  };
}

/**
 * @deprecated Use syncProgramTasksForDay() instead.
 * This function will be removed in a future version.
 */
export async function syncProgramTasksToClientDay(
  params: SyncProgramTasksToClientDayParams
): Promise<SyncProgramTasksToClientDayResult> {
  const { userId, programEnrollmentId, date, mode, coachUserId, forceDayIndex } = params;
  const errors: string[] = [];
  
  console.log(`[SYNC_TO_CLIENT] syncProgramTasksToClientDay called:`, {
    userId,
    programEnrollmentId,
    date,
    mode,
    forceDayIndex,
  });
  
  // 1. Get the enrollment
  const enrollmentDoc = await adminDb.collection('program_enrollments').doc(programEnrollmentId).get();
  if (!enrollmentDoc.exists) {
    return {
      success: false,
      tasksCreated: 0,
      tasksSkipped: 0,
      tasksReplaced: 0,
      tasksToBacklog: 0,
      focusTasks: 0,
      backlogTasks: 0,
      programDayIndex: 0,
      programId: null,
      programName: null,
      message: 'Enrollment not found',
    };
  }
  
  const enrollment = { id: enrollmentDoc.id, ...enrollmentDoc.data() } as ProgramEnrollment;
  
  // Verify ownership
  if (enrollment.userId !== userId) {
    return {
      success: false,
      tasksCreated: 0,
      tasksSkipped: 0,
      tasksReplaced: 0,
      tasksToBacklog: 0,
      focusTasks: 0,
      backlogTasks: 0,
      programDayIndex: 0,
      programId: enrollment.programId,
      programName: null,
      message: 'Enrollment does not belong to user',
    };
  }
  
  // 2. Get the program
  const program = await getProgramV2(enrollment.programId);
  if (!program) {
    return {
      success: false,
      tasksCreated: 0,
      tasksSkipped: 0,
      tasksReplaced: 0,
      tasksToBacklog: 0,
      focusTasks: 0,
      backlogTasks: 0,
      programDayIndex: 0,
      programId: enrollment.programId,
      programName: null,
      message: 'Program not found',
    };
  }
  
  // 3. Get cohort if applicable
  let cohort: ProgramCohort | null = null;
  if (enrollment.cohortId) {
    const cohortDoc = await adminDb.collection('program_cohorts').doc(enrollment.cohortId).get();
    if (cohortDoc.exists) {
      cohort = { id: cohortDoc.id, ...cohortDoc.data() } as ProgramCohort;
    }
  }
  
  // 4. Calculate program day index for this date (or use forceDayIndex if provided)
  const dayIndex = forceDayIndex ?? calculateCurrentDayIndexV2(enrollment, program, cohort, date);
  
  if (dayIndex === 0) {
    return {
      success: true,
      tasksCreated: 0,
      tasksSkipped: 0,
      tasksReplaced: 0,
      tasksToBacklog: 0,
      focusTasks: 0,
      backlogTasks: 0,
      programDayIndex: 0,
      programId: program.id,
      programName: program.name,
      message: 'Date is before program start or on a weekend (weekends excluded)',
    };
  }
  
  if (dayIndex > program.lengthDays) {
    return {
      success: true,
      tasksCreated: 0,
      tasksSkipped: 0,
      tasksReplaced: 0,
      tasksToBacklog: 0,
      focusTasks: 0,
      backlogTasks: 0,
      programDayIndex: dayIndex,
      programId: program.id,
      programName: program.name,
      message: 'Date is after program end',
    };
  }
  
  // 5. Get tasks for this day from program templates
  // Priority chain (document EXISTS means stop fallback, even if empty):
  // 1. program_instances (NEW architecture - source of truth)
  // 2. Client-specific day (for 1:1) - LEGACY fallback
  // 3. Cohort-specific day (for group programs) - LEGACY fallback
  let tasksForDay: ProgramTaskTemplate[] = [];
  let sourceType: 'program_day' | 'program_week' = 'program_day';
  let sourceWeekId: string | null = null;
  let sourceProgramDayId: string | null = null;
  let foundExplicitDay = false; // Track if we found an explicit day document (even if empty)

  console.log(`[SYNC_TO_CLIENT] Looking for tasks for day ${dayIndex}:`, {
    programType: program.type,
    enrollmentId: programEnrollmentId,
    cohortId: enrollment.cohortId,
  });

  // NEW ARCHITECTURE: Try program_instances first (source of truth)
  const instanceResult = await getInstanceDayTasks(
    enrollment.programId,
    program.type === 'individual' ? programEnrollmentId : null,
    program.type === 'group' ? (enrollment.cohortId || null) : null,
    dayIndex
  );

  if (instanceResult) {
    tasksForDay = instanceResult.tasks;
    foundExplicitDay = instanceResult.found;
    sourceType = 'program_day';
    console.log(`[SYNC_TO_CLIENT] Got ${tasksForDay.length} tasks from program_instances for day ${dayIndex}`);
  }

  // LEGACY FALLBACK: For 1:1 programs, check client-specific day
  if (!foundExplicitDay && program.type === 'individual') {
    console.log(`[SYNC_TO_CLIENT] LEGACY: Checking client_program_days for enrollment ${programEnrollmentId}, dayIndex ${dayIndex}`);
    const clientDay = await getClientProgramDay(programEnrollmentId, dayIndex);
    if (clientDay) {
      // Document EXISTS - use it even if tasks empty (coach explicitly cleared them)
      tasksForDay = clientDay.tasks ? [...clientDay.tasks] : [];
      foundExplicitDay = true;
      sourceType = 'program_day';
      sourceProgramDayId = clientDay.id;
      console.log(`[SYNC_TO_CLIENT] LEGACY: FOUND client_program_day:`, {
        dayIndex,
        clientDayId: clientDay.id,
        tasksCount: tasksForDay.length,
        taskLabels: tasksForDay.map(t => t.label),
        isPrimaryFlags: tasksForDay.map(t => t.isPrimary),
        sources: tasksForDay.map(t => t.source),
      });
    } else {
      console.log(`[SYNC_TO_CLIENT] LEGACY: NO client_program_day exists for day ${dayIndex}`);
    }
  }

  // LEGACY FALLBACK: For group programs with cohortId, check cohort-specific day
  if (!foundExplicitDay && program.type === 'group' && enrollment.cohortId) {
    const cohortDaySnapshot = await adminDb
      .collection('cohort_program_days')
      .where('cohortId', '==', enrollment.cohortId)
      .where('programId', '==', enrollment.programId)
      .where('dayIndex', '==', dayIndex)
      .limit(1)
      .get();

    if (!cohortDaySnapshot.empty) {
      // Document EXISTS - use it even if tasks empty (coach explicitly cleared them)
      const cohortDay = cohortDaySnapshot.docs[0].data();
      tasksForDay = cohortDay.tasks ? [...cohortDay.tasks] : [];
      foundExplicitDay = true;
      sourceType = 'program_day';
      sourceProgramDayId = cohortDaySnapshot.docs[0].id;
      console.log(`[SYNC_TO_CLIENT] LEGACY: Got ${tasksForDay.length} cohort-specific tasks from cohort_program_days for day ${dayIndex}`);
    }
  }

  // If no content found anywhere, log for debugging
  if (!foundExplicitDay) {
    console.log(`[SYNC_TO_CLIENT] No content for day ${dayIndex} in program_instances or legacy collections`);
  }
  
  // Log final task source decision
  console.log(`[SYNC_TO_CLIENT] Final task source for day ${dayIndex}:`, {
    foundExplicitDay,
    sourceType,
    sourceWeekId,
    sourceProgramDayId,
    tasksCount: tasksForDay.length,
    taskLabels: tasksForDay.map(t => t.label).join(', '),
  });
  
  // 6. Get existing tasks for this user on this date FIRST
  // (needed for override mode deletion before early return)
  const existingTasksSnapshot = await adminDb
    .collection('tasks')
    .where('userId', '==', userId)
    .where('date', '==', date)
    .get();
  
  const existingTasks: Task[] = existingTasksSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Task[];
  
  // 7. Process tasks based on mode - track counters
  let tasksCreated = 0;
  let tasksSkipped = 0;
  let tasksReplaced = 0;
  let tasksToBacklog = 0;
  let focusTasksCreated = 0;

  // In override mode, ALWAYS delete existing program-sourced tasks first
  // This runs even when tasksForDay is empty (coach explicitly cleared the day)
  if (mode === 'override-program-sourced') {
    const tasksToDelete = existingTasks.filter(t => {
      // Never delete client-created tasks
      if (t.sourceType === 'user' || !t.sourceType) return false;
      // Never delete client-locked tasks
      if (t.clientLocked) return false;
      // CRITICAL: Only delete tasks from THIS program enrollment, not other programs
      // This prevents Program B's sync from deleting Program A's tasks
      if (t.programEnrollmentId && t.programEnrollmentId !== programEnrollmentId) return false;
      // Delete program and coach tasks (only from this enrollment)
      return ['program', 'program_day', 'program_week', 'coach_manual'].includes(t.sourceType);
    });
    
    for (const task of tasksToDelete) {
      try {
        await adminDb.collection('tasks').doc(task.id).delete();
        tasksReplaced++;
        console.log(`[SYNC_TO_CLIENT] Deleted replaceable task: "${task.title}"`);
      } catch (err) {
        errors.push(`Failed to delete task ${task.id}: ${err}`);
      }
    }
  }

  // NOW check if we have new tasks to add (after deletion)
  if (tasksForDay.length === 0) {
    return {
      success: errors.length === 0,
      tasksCreated: 0,
      tasksSkipped: 0,
      tasksReplaced, // Include the deletion count!
      tasksToBacklog: 0,
      focusTasks: 0,
      backlogTasks: 0,
      programDayIndex: dayIndex,
      programId: program.id,
      programName: program.name,
      message: tasksReplaced > 0
        ? `Cleared ${tasksReplaced} tasks for day ${dayIndex}`
        : `No tasks defined for day ${dayIndex}`,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
  
  const existingFocusTasks = existingTasks.filter(t => t.listType === 'focus');
  const existingBacklogTasks = existingTasks.filter(t => t.listType === 'backlog');
  
  // 8. Get focus limit from org settings or program
  let focusLimit = program.dailyFocusSlots || 3;
  try {
    const orgSettingsDoc = await adminDb.collection('org_settings').doc(enrollment.organizationId).get();
    const orgSettings = orgSettingsDoc.data();
    if (orgSettings?.defaultDailyFocusSlots) {
      focusLimit = orgSettings.defaultDailyFocusSlots;
    }
  } catch {
    // Use default
  }
  
  const now = new Date().toISOString();

  // Calculate cycleNumber for evergreen programs only
  const cycleNumberForTasks = program.durationType === 'evergreen'
    ? getActiveCycleNumber(enrollment)
    : undefined;
  
  // Recalculate available slots after potential deletions
  // Note: We fetch all tasks and filter in code to avoid requiring a composite index
  const allRemainingSnapshot = await adminDb
    .collection('tasks')
    .where('userId', '==', userId)
    .where('date', '==', date)
    .get();

  // Filter out soft-deleted and archived tasks - they should not count towards limits or order
  const remainingTasks = allRemainingSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Task))
    .filter(t => t.status !== 'deleted' && t.status !== 'archived');

  const remainingFocus = remainingTasks.filter(t => t.listType === 'focus');
  const remainingBacklog = remainingTasks.filter(t => t.listType === 'backlog');

  let availableFocusSlots = focusLimit - remainingFocus.length;
  
  let nextFocusOrder = remainingFocus.length > 0
    ? Math.max(...remainingFocus.map(t => t.order || 0)) + 1
    : 0;
  let nextBacklogOrder = remainingBacklog.length > 0
    ? Math.max(...remainingBacklog.map(t => t.order || 0)) + 1
    : 0;
  
  // 9. Create new tasks from templates
  for (const template of tasksForDay) {
    // Match existing task by instanceTaskId (robust) or fallback to title (backward compat)
    const existingTask = remainingTasks.find(t => {
      if (t.programEnrollmentId !== programEnrollmentId) return false;
      // Prefer instanceTaskId matching if template has an id
      if (template.id && t.instanceTaskId) {
        return t.instanceTaskId === template.id;
      }
      // Fallback to title matching for backward compatibility
      return t.title === template.label;
    });

    if (existingTask) {
      // In fill-empty mode, skip if task exists
      if (mode === 'fill-empty') {
        tasksSkipped++;
        console.log(`[SYNC_TO_CLIENT] Skipped existing task: "${template.label}" (matched by ${existingTask.instanceTaskId ? 'instanceTaskId' : 'title'})`);
        continue;
      }
      // In override mode, we already deleted replaceable tasks, so if it still exists
      // it means it's client-locked or client-created - skip it
      if (existingTask.clientLocked || existingTask.sourceType === 'user') {
        tasksSkipped++;
        console.log(`[SYNC_TO_CLIENT] Skipped client-protected task: "${template.label}"`);
        continue;
      }
    }
    
    // Determine placement
    // Default isPrimary to true for program-sourced tasks if not explicitly set to false
    // This ensures week tasks go to focus unless coach explicitly marks them as backlog
    // Using !== false means: true -> focus, undefined -> focus, false -> backlog
    let listType: 'focus' | 'backlog';
    let order: number;
    
    const shouldGoToFocus = (template.isPrimary !== false) && availableFocusSlots > 0;
    
    if (shouldGoToFocus) {
      listType = 'focus';
      order = nextFocusOrder++;
      availableFocusSlots--;
      focusTasksCreated++;
    } else {
      listType = 'backlog';
      order = nextBacklogOrder++;
      tasksToBacklog++;
    }
    
    // Create the task with sync metadata
    const taskData: Omit<Task, 'id'> = {
      userId,
      organizationId: enrollment.organizationId,
      title: template.label,
      status: 'pending',
      listType,
      order,
      date,
      isPrivate: false,
      sourceType,
      programEnrollmentId,
      programDayIndex: dayIndex,
      createdAt: now,
      updatedAt: now,
      // New sync fields
      visibility: 'public', // Program tasks are always visible to coach
      clientLocked: false,
      sourceProgramId: enrollment.programId,
      sourceProgramDayId,
      sourceWeekId,
      assignedByCoachId: coachUserId || null,
      // Link to instance task for robust matching on renames
      instanceTaskId: template.id || undefined,
      originalTitle: template.label, // Preserve original for fallback matching when client edits title
      // Cycle tracking for evergreen programs
      ...(cycleNumberForTasks !== undefined && { cycleNumber: cycleNumberForTasks }),
    };
    
    try {
      await adminDb.collection('tasks').add(taskData);
      tasksCreated++;
      console.log(`[SYNC_TO_CLIENT] Created task: "${template.label}" (${listType}) for day ${dayIndex}`);
    } catch (err) {
      errors.push(`Failed to create task "${template.label}": ${err}`);
    }
  }
  
  console.log(`[SYNC_TO_CLIENT] Completed sync for user ${userId}, date ${date}: ${tasksCreated} created, ${tasksSkipped} skipped, ${tasksReplaced} replaced`);

  return {
    success: errors.length === 0,
    tasksCreated,
    tasksSkipped,
    tasksReplaced,
    tasksToBacklog,
    focusTasks: focusTasksCreated,
    backlogTasks: tasksToBacklog,
    programDayIndex: dayIndex,
    programId: program.id,
    programName: program.name,
    message: `Synced ${tasksCreated} tasks for day ${dayIndex}`,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Sync program tasks for multiple dates (used when coach edits template)
 * Syncs from today to today + horizon days
 */
export async function syncProgramTasksForDateRange(
  programId: string,
  options: {
    mode: SyncMode;
    horizonDays?: number; // Default 7
    coachUserId?: string;
    specificEnrollmentId?: string; // If set, only sync for this enrollment
  }
): Promise<{
  success: boolean;
  enrollmentsSynced: number;
  totalTasksCreated: number;
  errors: string[];
}> {
  const { mode, horizonDays = 7, coachUserId, specificEnrollmentId } = options;
  const errors: string[] = [];
  let enrollmentsSynced = 0;
  let totalTasksCreated = 0;
  
  // Get active enrollments for this program
  let enrollmentsQuery = adminDb
    .collection('program_enrollments')
    .where('programId', '==', programId)
    .where('status', '==', 'active');
  
  if (specificEnrollmentId) {
    // Only sync for a specific enrollment
    const enrollmentDoc = await adminDb.collection('program_enrollments').doc(specificEnrollmentId).get();
    if (!enrollmentDoc.exists) {
      return { success: false, enrollmentsSynced: 0, totalTasksCreated: 0, errors: ['Enrollment not found'] };
    }
    const enrollment = { id: enrollmentDoc.id, ...enrollmentDoc.data() } as ProgramEnrollment;
    
    // Sync for each day in the horizon
    const today = new Date();
    for (let i = 0; i <= horizonDays; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      const dateStr = targetDate.toISOString().split('T')[0];
      
      // Use syncProgramTasksForDay to ensure CohortTaskState is created
      const result = await syncProgramTasksForDay({
        userId: enrollment.userId,
        enrollmentId: enrollment.id,
        date: dateStr,
        mode,
        coachUserId,
      });

      totalTasksCreated += result.tasksCreated;
      if (result.errors) {
        errors.push(...result.errors);
      }
    }
    enrollmentsSynced = 1;
  } else {
    // Sync for all active enrollments
    const enrollmentsSnapshot = await enrollmentsQuery.get();

    for (const doc of enrollmentsSnapshot.docs) {
      const enrollment = { id: doc.id, ...doc.data() } as ProgramEnrollment;

      // Sync for each day in the horizon
      const today = new Date();
      for (let i = 0; i <= horizonDays; i++) {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + i);
        const dateStr = targetDate.toISOString().split('T')[0];

        try {
          // Use syncProgramTasksForDay to ensure CohortTaskState is created
          const result = await syncProgramTasksForDay({
            userId: enrollment.userId,
            enrollmentId: enrollment.id,
            date: dateStr,
            mode,
            coachUserId,
          });

          totalTasksCreated += result.tasksCreated;
          if (result.errors) {
            errors.push(...result.errors);
          }
        } catch (err) {
          errors.push(`Failed to sync enrollment ${enrollment.id}: ${err}`);
        }
      }
      enrollmentsSynced++;
    }
  }
  
  console.log(`[SYNC_RANGE] Synced ${enrollmentsSynced} enrollments, ${totalTasksCreated} tasks created`);
  
  return {
    success: errors.length === 0,
    enrollmentsSynced,
    totalTasksCreated,
    errors,
  };
}

/**
 * Helper: Calculate the date for a given program day index
 */
export function calculateDateForProgramDay(
  enrollment: ProgramEnrollment,
  program: Program,
  cohort: ProgramCohort | null,
  targetDayIndex: number
): string | null {
  const startDateStr = cohort?.startDate || enrollment.startedAt;

  // Guard against missing start date
  if (!startDateStr) {
    console.warn(`[calculateDateForProgramDay] No start date for enrollment ${enrollment.id}`);
    return null;
  }

  // Handle both date-only strings (2026-01-03) and full ISO timestamps (2026-01-03T13:10:47.267Z)
  // Extract just the date part if it's a full timestamp
  const dateOnly = startDateStr.includes('T') ? startDateStr.split('T')[0] : startDateStr;
  let startDate = new Date(dateOnly + 'T00:00:00');

  // Guard against invalid date
  if (isNaN(startDate.getTime())) {
    console.warn(`[calculateDateForProgramDay] Invalid start date: ${startDateStr} (parsed as: ${dateOnly})`);
    return null;
  }

  const includeWeekends = program.includeWeekends !== false;
  
  if (!includeWeekends) {
    // Adjust start date if it falls on weekend
    if (isWeekend(startDate)) {
      startDate = getNextWeekday(startDate);
    }
    
    // Count forward, skipping weekends
    let currentDate = new Date(startDate);
    let dayCount = 1;
    
    while (dayCount < targetDayIndex) {
      currentDate.setDate(currentDate.getDate() + 1);
      if (!isWeekend(currentDate)) {
        dayCount++;
      }
    }
    
    return currentDate.toISOString().split('T')[0];
  }
  
  // With weekends: simple day math
  const targetDate = new Date(startDate);
  targetDate.setDate(startDate.getDate() + targetDayIndex - 1);
  return targetDate.toISOString().split('T')[0];
}


// ============================================================================
// Sync All Program Tasks - Full program sync for new enrollments
// ============================================================================

export interface SyncAllProgramTasksParams {
  userId: string;
  enrollmentId: string;
  mode?: SyncMode;
  coachUserId?: string;
  batchSize?: number; // Default 10 - process this many days before yielding
}

export interface SyncAllProgramTasksResult {
  success: boolean;
  tasksCreated: number;
  tasksSkipped: number;
  daysProcessed: number;
  totalDays: number;
  errors: string[];
}

/**
 * Sync ALL program tasks for an entire program enrollment.
 * 
 * Used when:
 * - A new client is enrolled (sync all days upfront)
 * - Coach manually triggers a full sync
 * 
 * This function syncs tasks for all days from Day 1 to program.lengthDays.
 * It uses 'fill-empty' mode by default to not overwrite existing tasks.
 * 
 * For large programs (50+ days), it batches operations to avoid blocking.
 */
export async function syncAllProgramTasks(
  params: SyncAllProgramTasksParams
): Promise<SyncAllProgramTasksResult> {
  const { 
    userId, 
    enrollmentId, 
    mode = 'fill-empty', 
    coachUserId,
    batchSize = 10 
  } = params;
  
  const errors: string[] = [];
  let tasksCreated = 0;
  let tasksSkipped = 0;
  let daysProcessed = 0;

  console.log(`[SYNC_ALL] Starting full sync for enrollment ${enrollmentId}`);

  // 1. Get the enrollment
  const enrollmentDoc = await adminDb.collection('program_enrollments').doc(enrollmentId).get();
  if (!enrollmentDoc.exists) {
    return {
      success: false,
      tasksCreated: 0,
      tasksSkipped: 0,
      daysProcessed: 0,
      totalDays: 0,
      errors: ['Enrollment not found'],
    };
  }

  const enrollment = { id: enrollmentDoc.id, ...enrollmentDoc.data() } as ProgramEnrollment;

  // Verify ownership
  if (enrollment.userId !== userId) {
    return {
      success: false,
      tasksCreated: 0,
      tasksSkipped: 0,
      daysProcessed: 0,
      totalDays: 0,
      errors: ['Enrollment does not belong to user'],
    };
  }

  // 2. Get the program
  const program = await getProgramV2(enrollment.programId);
  if (!program) {
    return {
      success: false,
      tasksCreated: 0,
      tasksSkipped: 0,
      daysProcessed: 0,
      totalDays: 0,
      errors: ['Program not found'],
    };
  }

  // 3. Get cohort if applicable
  let cohort: ProgramCohort | null = null;
  if (enrollment.cohortId) {
    const cohortDoc = await adminDb.collection('program_cohorts').doc(enrollment.cohortId).get();
    if (cohortDoc.exists) {
      cohort = { id: cohortDoc.id, ...cohortDoc.data() } as ProgramCohort;
    }
  }

  const totalDays = program.lengthDays;
  console.log(`[SYNC_ALL] Syncing ${totalDays} days for program "${program.name}"`);

  // 4. Loop through all program days
  for (let dayIndex = 1; dayIndex <= totalDays; dayIndex++) {
    try {
      // Calculate the date for this day index
      const dateStr = calculateDateForProgramDay(enrollment, program, cohort, dayIndex);
      
      if (!dateStr) {
        errors.push(`Could not calculate date for day ${dayIndex}`);
        continue;
      }

      // Sync this day's tasks using syncProgramTasksForDay (not syncProgramTasksToClientDay)
      // This ensures CohortTaskState documents are created for cohort enrollments
      const result = await syncProgramTasksForDay({
        userId,
        enrollmentId,
        date: dateStr,
        mode,
        coachUserId,
      });

      tasksCreated += result.tasksCreated;
      tasksSkipped += result.tasksSkipped || 0;
      daysProcessed++;

      if (result.errors && result.errors.length > 0) {
        errors.push(...result.errors);
      }

      // Batch processing - yield to event loop periodically for large programs
      if (totalDays > 50 && dayIndex % batchSize === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push(`Day ${dayIndex}: ${errorMsg}`);
    }
  }

  console.log(`[SYNC_ALL] Completed: ${daysProcessed}/${totalDays} days, ${tasksCreated} tasks created, ${tasksSkipped} skipped`);

  return {
    success: errors.length === 0,
    tasksCreated,
    tasksSkipped,
    daysProcessed,
    totalDays,
    errors,
  };
}


/**
 * Sync program tasks from a specific day index onwards.
 * 
 * Used for manual sync when coach wants to sync only remaining days.
 * Calculates which day the enrollment is currently on and syncs from there.
 */
export async function syncProgramTasksFromCurrentDay(
  params: SyncAllProgramTasksParams
): Promise<SyncAllProgramTasksResult> {
  const { 
    userId, 
    enrollmentId, 
    mode = 'fill-empty', 
    coachUserId,
    batchSize = 10 
  } = params;
  
  const errors: string[] = [];
  let tasksCreated = 0;
  let tasksSkipped = 0;
  let daysProcessed = 0;

  console.log(`[SYNC_FROM_CURRENT] Starting sync from current day for enrollment ${enrollmentId}`);

  // 1. Get the enrollment
  const enrollmentDoc = await adminDb.collection('program_enrollments').doc(enrollmentId).get();
  if (!enrollmentDoc.exists) {
    return {
      success: false,
      tasksCreated: 0,
      tasksSkipped: 0,
      daysProcessed: 0,
      totalDays: 0,
      errors: ['Enrollment not found'],
    };
  }

  const enrollment = { id: enrollmentDoc.id, ...enrollmentDoc.data() } as ProgramEnrollment;

  // Verify ownership
  if (enrollment.userId !== userId) {
    return {
      success: false,
      tasksCreated: 0,
      tasksSkipped: 0,
      daysProcessed: 0,
      totalDays: 0,
      errors: ['Enrollment does not belong to user'],
    };
  }

  // 2. Get the program
  const program = await getProgramV2(enrollment.programId);
  if (!program) {
    return {
      success: false,
      tasksCreated: 0,
      tasksSkipped: 0,
      daysProcessed: 0,
      totalDays: 0,
      errors: ['Program not found'],
    };
  }

  // 3. Get cohort if applicable
  let cohort: ProgramCohort | null = null;
  if (enrollment.cohortId) {
    const cohortDoc = await adminDb.collection('program_cohorts').doc(enrollment.cohortId).get();
    if (cohortDoc.exists) {
      cohort = { id: cohortDoc.id, ...cohortDoc.data() } as ProgramCohort;
    }
  }

  // 4. Calculate current day index
  const today = new Date().toISOString().split('T')[0];
  const currentDayIndex = calculateCurrentDayIndexV2(enrollment, program, cohort, today);
  
  // If enrollment hasn't started yet (currentDayIndex === 0), start from day 1
  const startDayIndex = currentDayIndex === 0 ? 1 : currentDayIndex;
  const totalDays = program.lengthDays;
  const daysToSync = totalDays - startDayIndex + 1;

  console.log(`[SYNC_FROM_CURRENT] Syncing days ${startDayIndex}-${totalDays} (${daysToSync} days)`);

  // 5. Loop through remaining program days
  for (let dayIndex = startDayIndex; dayIndex <= totalDays; dayIndex++) {
    try {
      // Calculate the date for this day index
      const dateStr = calculateDateForProgramDay(enrollment, program, cohort, dayIndex);
      
      if (!dateStr) {
        errors.push(`Could not calculate date for day ${dayIndex}`);
        continue;
      }

      // Sync this day's tasks using syncProgramTasksForDay (not syncProgramTasksToClientDay)
      // This ensures CohortTaskState documents are created for cohort enrollments
      const result = await syncProgramTasksForDay({
        userId,
        enrollmentId,
        date: dateStr,
        mode,
        coachUserId,
      });

      tasksCreated += result.tasksCreated;
      tasksSkipped += result.tasksSkipped || 0;
      daysProcessed++;

      if (result.errors && result.errors.length > 0) {
        errors.push(...result.errors);
      }

      // Batch processing
      if (daysToSync > 50 && (dayIndex - startDayIndex + 1) % batchSize === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push(`Day ${dayIndex}: ${errorMsg}`);
    }
  }

  console.log(`[SYNC_FROM_CURRENT] Completed: ${daysProcessed} days, ${tasksCreated} tasks created`);

  return {
    success: errors.length === 0,
    tasksCreated,
    tasksSkipped,
    daysProcessed,
    totalDays: daysToSync,
    errors,
  };
}

