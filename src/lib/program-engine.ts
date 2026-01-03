/**
 * Starter Program Engine
 * 
 * Core logic for managing starter programs:
 * - User enrollment in programs
 * - Daily task generation from program templates
 * - Program progress tracking
 * - Squad membership management on enrollment transitions
 */

import { adminDb } from './firebase-admin';
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
} from '@/types';

// ============================================================================
// WEEKEND HELPERS
// ============================================================================

/**
 * Check if a date is a weekend (Saturday = 6, Sunday = 0)
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

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
 * Count weekdays between two dates (inclusive of start, exclusive of end for elapsed calculation)
 */
function countWeekdaysBetween(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    if (!isWeekend(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
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
  
  // 4. Check if we need to generate tasks for this day
  if (dayIndex <= enrollment.lastAssignedDayIndex) {
    // Tasks already generated for this day
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
      message: `Tasks already generated for day ${dayIndex}`,
    };
  }
  
  // 5. Get the program day template
  const programDay = await getProgramDay(enrollment.programId, dayIndex);
  
  if (!programDay || !programDay.tasks || programDay.tasks.length === 0) {
    console.log(`[PROGRAM_ENGINE] No tasks defined for day ${dayIndex} of program ${program.slug}`);
    // Still update the lastAssignedDayIndex to prevent repeated checks
    await updateEnrollmentDayIndex(enrollment.id, dayIndex);
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
  
  // 8. Update enrollment lastAssignedDayIndex
  await updateEnrollmentDayIndex(enrollment.id, dayIndex);
  
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

// ============================================================================
// PROGRAMS V2 SYNC (program_enrollments + program_days collections)
// ============================================================================

/**
 * Get user's active enrollment from Programs v2 (program_enrollments collection)
 * 
 * Also handles "upcoming" enrollments that should be active based on cohort start date.
 * If the cohort's start date has arrived but status is still 'upcoming', this function
 * will update the status to 'active' and return the enrollment.
 */
export async function getActiveEnrollmentV2(userId: string): Promise<ProgramEnrollment | null> {
  // First try to find an active enrollment
  const activeSnapshot = await adminDb
    .collection('program_enrollments')
    .where('userId', '==', userId)
    .where('status', '==', 'active')
    .limit(1)
    .get();
  
  if (!activeSnapshot.empty) {
    const doc = activeSnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as ProgramEnrollment;
  }
  
  // If no active enrollment, check for "upcoming" that should be active
  const upcomingSnapshot = await adminDb
    .collection('program_enrollments')
    .where('userId', '==', userId)
    .where('status', '==', 'upcoming')
    .limit(1)
    .get();
  
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
  dayIndex: number,
  template: ProgramTaskTemplate,
  listType: 'focus' | 'backlog',
  order: number,
  date: string
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
    createdAt: now,
    updatedAt: now,
  } as Omit<Task, 'id'>;
  
  const docRef = await adminDb.collection('tasks').add(taskData);
  console.log(`[PROGRAM_ENGINE_V2] Created program task: "${template.label}" (${listType}) for day ${dayIndex}`);
  
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
  
  // For group programs with cohort, use cohort start date
  // For individual programs, use enrollment.startedAt
  const startDateStr = cohort?.startDate || enrollment.startedAt;
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
 * Main function: Sync program tasks for today (Programs v2)
 * 
 * This is the v2 engine function that:
 * 1. Finds the user's active enrollment from program_enrollments
 * 2. Calculates what program day they're on (using cohort date for groups)
 * 3. Creates tasks from the program_days template if needed
 * 4. Places tasks in Daily Focus or Backlog
 */
export async function syncProgramV2TasksForToday(
  userId: string,
  todayDate?: string
): Promise<SyncProgramTasksResult> {
  const today = todayDate || new Date().toISOString().split('T')[0];
  
  // 1. Find active enrollment from program_enrollments
  const enrollment = await getActiveEnrollmentV2(userId);
  
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
  
  // 5. Check if we need to generate tasks for this day
  if (dayIndex <= enrollment.lastAssignedDayIndex) {
    // Tasks already generated for this day
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
      message: `Tasks already generated for day ${dayIndex}`,
    };
  }
  
  // 6. Get the program day template from program_days
  const programDay = await getProgramDayV2(enrollment.programId, dayIndex);
  
  if (!programDay || !programDay.tasks || programDay.tasks.length === 0) {
    console.log(`[PROGRAM_ENGINE_V2] No tasks defined for day ${dayIndex} of program ${program.name}`);
    // Still update the lastAssignedDayIndex to prevent repeated checks
    await updateEnrollmentDayIndexV2(enrollment.id, dayIndex);
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
  
  // 8. Create tasks from templates
  // First, handle primary tasks (try to put in Focus)
  const primaryTasks = programDay.tasks.filter(t => t.isPrimary);
  const nonPrimaryTasks = programDay.tasks.filter(t => !t.isPrimary);
  
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
      dayIndex,
      template,
      'backlog',
      nextBacklogOrder++,
      today
    );
    
    tasksCreated++;
    backlogTasksCreated++;
  }
  
  // 9. Update enrollment lastAssignedDayIndex
  await updateEnrollmentDayIndexV2(enrollment.id, dayIndex);
  
  // 10. Check if program is completed (today is the last day)
  let programCompleted = false;
  if (dayIndex >= program.lengthDays) {
    // Mark enrollment as completed
    const now = new Date().toISOString();
    await adminDb.collection('program_enrollments').doc(enrollment.id).update({
      status: 'completed',
      completedAt: now,
      updatedAt: now,
    });
    programCompleted = true;
    console.log(`[PROGRAM_ENGINE_V2] User ${userId} completed program ${program.name}!`);
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
    message: programCompleted 
      ? `Program completed! Created ${tasksCreated} tasks for final day ${dayIndex}`
      : `Created ${tasksCreated} tasks for day ${dayIndex}`,
  };
}

