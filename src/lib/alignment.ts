/**
 * Daily Alignment Service
 * 
 * Handles computing and updating daily alignment scores and streaks.
 * The alignment score is now CONFIGURABLE per-organization.
 * 
 * Available activities:
 * 1. Morning check-in (confidence check-in)
 * 2. Evening check-in (day reflection)
 * 3. Set today's tasks (Daily Focus)
 * 4. Complete tasks (with configurable threshold: at_least_one, half, all)
 * 5. Chat with your squad (send a message)
 * 6. Have an active goal
 * 7. Complete habits (with configurable threshold: at_least_one, half, all)
 * 
 * Each enabled activity is worth 100 / (enabled count) %.
 * 
 * MULTI-TENANCY: All alignment data is scoped per-organization.
 * Each user has separate alignment scores/streaks for each org they belong to.
 */

import { adminDb } from './firebase-admin';
import { invalidateSquadCache } from './squad-alignment';
import type { 
  UserAlignment, 
  UserAlignmentSummary, 
  AlignmentUpdatePayload, 
  AlignmentActivityConfig, 
  AlignmentActivityKey,
  CompletionThreshold,
  OrgSettings 
} from '@/types';
import { DEFAULT_ALIGNMENT_CONFIG } from '@/types';

/**
 * Get today's date in YYYY-MM-DD format
 * Uses the user's local date based on server time
 */
export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get yesterday's date in YYYY-MM-DD format
 */
export function getYesterdayDate(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

/**
 * Check if a date string (YYYY-MM-DD) falls on a weekend
 */
function isWeekendDate(dateString: string): boolean {
  const date = new Date(dateString + 'T12:00:00'); // Use noon to avoid timezone issues
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

/**
 * Get the last weekday date (skipping Saturday and Sunday)
 * Used for streak calculation to bridge over weekends
 * e.g., On Monday, this returns Friday
 */
function getLastWeekdayDate(fromDate: string): string {
  const date = new Date(fromDate + 'T12:00:00');
  date.setDate(date.getDate() - 1); // Start with yesterday
  
  // Keep going back until we find a weekday
  while (isWeekendDate(date.toISOString().split('T')[0])) {
    date.setDate(date.getDate() - 1);
  }
  
  return date.toISOString().split('T')[0];
}

/**
 * Generate document ID for alignment: `${organizationId}_${userId}_${date}`
 * Multi-tenancy: Each user has separate alignment per organization
 */
function getAlignmentDocId(organizationId: string, userId: string, date: string): string {
  return `${organizationId}_${userId}_${date}`;
}

/**
 * Generate document ID for alignment summary: `${organizationId}_${userId}`
 * Multi-tenancy: Each user has separate streak per organization
 */
function getAlignmentSummaryDocId(organizationId: string, userId: string): string {
  return `${organizationId}_${userId}`;
}

/**
 * Get org alignment configuration
 * Falls back to default config for backward compatibility
 */
async function getOrgAlignmentConfig(organizationId: string): Promise<AlignmentActivityConfig> {
  try {
    const settingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
    
    if (settingsDoc.exists) {
      const settings = settingsDoc.data() as OrgSettings;
      if (settings.alignmentConfig) {
        return settings.alignmentConfig;
      }
    }
    
    return DEFAULT_ALIGNMENT_CONFIG;
  } catch (error) {
    console.error('[ALIGNMENT] Error fetching org config:', error);
    return DEFAULT_ALIGNMENT_CONFIG;
  }
}

/**
 * Export for use by other components (like AlignmentSheet)
 */
export { getOrgAlignmentConfig };

/**
 * Check if user has completed their evening check-in for today
 */
async function checkUserDidEveningCheckin(userId: string, organizationId: string, date: string): Promise<boolean> {
  try {
    const checkInId = `${organizationId}_${userId}_${date}`;
    const eveningCheckInDoc = await adminDb
      .collection('evening_checkins')
      .doc(checkInId)
      .get();

    return eveningCheckInDoc.exists;
  } catch (error) {
    console.error('[ALIGNMENT] Error checking evening checkin:', error);
    return false;
  }
}

/**
 * Check if user has completed tasks based on threshold
 */
async function checkUserCompletedTasks(
  userId: string, 
  organizationId: string, 
  date: string,
  threshold: CompletionThreshold = 'at_least_one'
): Promise<boolean> {
  try {
    // Get all focus tasks for today
    const tasksSnapshot = await adminDb
      .collection('tasks')
      .where('userId', '==', userId)
      .where('organizationId', '==', organizationId)
      .where('date', '==', date)
      .where('listType', '==', 'focus')
      .get();
    
    if (tasksSnapshot.empty) {
      return false; // No tasks to complete
    }
    
    const tasks = tasksSnapshot.docs.map(doc => doc.data());
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    
    switch (threshold) {
      case 'at_least_one':
        return completedTasks >= 1;
      case 'half':
        return completedTasks >= Math.ceil(totalTasks / 2);
      case 'all':
        return completedTasks === totalTasks;
      default:
        return completedTasks >= 1;
    }
  } catch (error) {
    console.error('[ALIGNMENT] Error checking completed tasks:', error);
    return false;
  }
}

/**
 * Check if user has completed habits based on threshold
 */
async function checkUserCompletedHabits(
  userId: string, 
  organizationId: string, 
  date: string,
  threshold: CompletionThreshold = 'at_least_one'
): Promise<boolean> {
  try {
    // Get user's active habits for this organization
    const habitsSnapshot = await adminDb
      .collection('habits')
      .where('userId', '==', userId)
      .where('organizationId', '==', organizationId)
      .where('isActive', '==', true)
      .get();
    
    if (habitsSnapshot.empty) {
      return false; // No habits to complete
    }
    
    // Check completions for today
    const habitIds = habitsSnapshot.docs.map(doc => doc.id);
    let completedCount = 0;
    
    for (const habitId of habitIds) {
      const completionDoc = await adminDb
        .collection('habits')
        .doc(habitId)
        .collection('completions')
        .doc(date)
        .get();
      
      if (completionDoc.exists) {
        completedCount++;
      }
    }
    
    const totalHabits = habitIds.length;
    
    switch (threshold) {
      case 'at_least_one':
        return completedCount >= 1;
      case 'half':
        return completedCount >= Math.ceil(totalHabits / 2);
      case 'all':
        return completedCount === totalHabits;
      default:
        return completedCount >= 1;
    }
  } catch (error) {
    console.error('[ALIGNMENT] Error checking completed habits:', error);
    return false;
  }
}

/**
 * Activity completion status for all possible activities
 */
interface ActivityStatus {
  morning_checkin: boolean;
  evening_checkin: boolean;
  set_tasks: boolean;
  complete_tasks: boolean;
  chat_with_squad: boolean;
  active_goal: boolean;
  complete_habits: boolean;
}

/**
 * Calculate alignment score based on org config and activity status
 */
function calculateAlignmentScore(
  activityStatus: ActivityStatus,
  config: AlignmentActivityConfig
): number {
  const enabledActivities = config.enabledActivities;
  if (enabledActivities.length === 0) return 0;
  
  const pointsPerActivity = 100 / enabledActivities.length;
  let score = 0;
  
  for (const activity of enabledActivities) {
    if (activityStatus[activity]) {
      score += pointsPerActivity;
    }
  }
  
  // Round to avoid floating point issues
  return Math.round(score);
}

/**
 * Legacy: Calculate alignment score from the four boolean flags
 * Used for backward compatibility when no config is set
 */
function calculateLegacyAlignmentScore(
  didMorningCheckin: boolean,
  didSetTasks: boolean,
  didInteractWithSquad: boolean,
  hasActiveGoal: boolean
): number {
  let score = 0;
  if (didMorningCheckin) score += 25;
  if (didSetTasks) score += 25;
  if (didInteractWithSquad) score += 25;
  if (hasActiveGoal) score += 25;
  return score;
}

/**
 * Check if user has an active goal within an organization
 * Multi-tenancy: Goals are stored in org_memberships collection
 */
async function checkUserHasActiveGoal(userId: string, organizationId: string): Promise<boolean> {
  try {
    // Check org_memberships for org-scoped goal
    const membershipSnapshot = await adminDb.collection('org_memberships')
      .where('userId', '==', userId)
      .where('organizationId', '==', organizationId)
      .limit(1)
      .get();

    if (!membershipSnapshot.empty) {
      const memberData = membershipSnapshot.docs[0].data();
      // User has an active goal if they have a goal and goalTargetDate set
      // and the goal hasn't been completed or archived
      if (memberData?.goal && memberData?.goalTargetDate && !memberData?.goalCompleted) {
        return true;
      }
    }

    // No active goal found for this organization
    return false;
  } catch (error) {
    console.error('[ALIGNMENT] Error checking active goal:', error);
    return false;
  }
}

/**
 * Check if user has set tasks for today (at least one focus task)
 * Also checks evening check-in as fallback (tasks may have moved to backlog)
 * Multi-tenancy: Only checks tasks within the specified organization
 */
async function checkUserHasSetTasks(userId: string, organizationId: string, date: string): Promise<boolean> {
  try {
    // First, check if there are any focus tasks within this organization
    const tasksSnapshot = await adminDb
      .collection('tasks')
      .where('userId', '==', userId)
      .where('organizationId', '==', organizationId)
      .where('date', '==', date)
      .where('listType', '==', 'focus')
      .limit(1)
      .get();
    
    if (!tasksSnapshot.empty) {
      return true;
    }

    // Fallback: Check evening check-in for historical task data (top-level collection)
    // This handles the case where tasks were moved to backlog after evening check-in
    const checkInId = `${organizationId}_${userId}_${date}`;
    const eveningCheckInDoc = await adminDb
      .collection('evening_checkins')
      .doc(checkInId)
      .get();

    if (eveningCheckInDoc.exists) {
      const data = eveningCheckInDoc.data();
      // If evening check-in has recorded tasks (either in snapshot or total count), user had set tasks
      if (data?.completedTasksSnapshot?.length > 0 || data?.tasksTotal > 0) {
        return true;
      }
    }

    // Legacy fallback: Check user subcollection (for data migration period)
    const legacyCheckInDoc = await adminDb
      .collection('users')
      .doc(userId)
      .collection('eveningCheckins')
      .doc(date)
      .get();

    if (legacyCheckInDoc.exists) {
      const data = legacyCheckInDoc.data();
      if (data?.completedTasksSnapshot?.length > 0 || data?.tasksTotal > 0) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('[ALIGNMENT] Error checking tasks:', error);
    return false;
  }
}

/**
 * Get user alignment for a specific date within an organization
 * Multi-tenancy: Alignment is scoped per organization
 */
export async function getUserAlignment(
  userId: string,
  organizationId: string,
  date: string = getTodayDate()
): Promise<UserAlignment | null> {
  try {
    const docId = getAlignmentDocId(organizationId, userId, date);
    const docRef = adminDb.collection('userAlignment').doc(docId);
    const doc = await docRef.get();
    
    if (!doc.exists) return null;
    
    return { id: doc.id, ...doc.data() } as UserAlignment;
  } catch (error) {
    console.error('[ALIGNMENT] Error fetching alignment:', error);
    return null;
  }
}

/**
 * Get user alignment summary (streak info) within an organization
 * Multi-tenancy: Streak is tracked separately per organization
 */
export async function getUserAlignmentSummary(
  userId: string,
  organizationId: string
): Promise<UserAlignmentSummary | null> {
  try {
    const docId = getAlignmentSummaryDocId(organizationId, userId);
    const docRef = adminDb.collection('userAlignmentSummary').doc(docId);
    const doc = await docRef.get();
    
    if (!doc.exists) return null;
    
    return { id: doc.id, ...doc.data() } as UserAlignmentSummary;
  } catch (error) {
    console.error('[ALIGNMENT] Error fetching alignment summary:', error);
    return null;
  }
}

/**
 * Update alignment for today within an organization
 * This is the main function called when user actions occur
 * Multi-tenancy: Alignment is tracked separately per organization
 */
export async function updateAlignmentForToday(
  userId: string,
  organizationId: string,
  updates: AlignmentUpdatePayload
): Promise<UserAlignment | null> {
  const today = getTodayDate();
  const docId = getAlignmentDocId(organizationId, userId, today);
  const docRef = adminDb.collection('userAlignment').doc(docId);
  const now = new Date().toISOString();

  try {
    // Fetch org alignment config
    const config = await getOrgAlignmentConfig(organizationId);
    
    // Fetch existing alignment doc or create new one
    const existingDoc = await docRef.get();
    let existingData: Partial<UserAlignment> = {};
    let wasFullyAlignedBefore = false;

    if (existingDoc.exists) {
      existingData = existingDoc.data() as UserAlignment;
      wasFullyAlignedBefore = existingData.fullyAligned || false;
    }

    // Merge updates with existing data
    // These flags are "sticky" - once true for a day, they stay true
    // This prevents losing credit when tasks are moved to backlog after evening check-in
    const didMorningCheckin = updates.didMorningCheckin || existingData.didMorningCheckin || false;
    const didInteractWithSquad = updates.didInteractWithSquad || existingData.didInteractWithSquad || false;
    
    // For didSetTasks: if already true, keep it true; otherwise check updates or current state
    let didSetTasks = existingData.didSetTasks || false;
    if (!didSetTasks) {
      didSetTasks = updates.didSetTasks ?? await checkUserHasSetTasks(userId, organizationId, today);
    }
    
    // Always recompute hasActiveGoal to ensure it's current (org-scoped)
    const hasActiveGoal = await checkUserHasActiveGoal(userId, organizationId);
    
    // New activities - check if enabled in config and compute status
    let didEveningCheckin = existingData.didEveningCheckin || false;
    if (!didEveningCheckin && config.enabledActivities.includes('evening_checkin')) {
      didEveningCheckin = updates.didEveningCheckin ?? await checkUserDidEveningCheckin(userId, organizationId, today);
    }
    
    let didCompleteTasks = existingData.didCompleteTasks || false;
    if (!didCompleteTasks && config.enabledActivities.includes('complete_tasks')) {
      didCompleteTasks = updates.didCompleteTasks ?? await checkUserCompletedTasks(
        userId, 
        organizationId, 
        today,
        config.taskCompletionThreshold
      );
    }
    
    let didCompleteHabits = existingData.didCompleteHabits || false;
    if (!didCompleteHabits && config.enabledActivities.includes('complete_habits')) {
      didCompleteHabits = updates.didCompleteHabits ?? await checkUserCompletedHabits(
        userId, 
        organizationId, 
        today,
        config.habitCompletionThreshold
      );
    }

    // Build activity status for scoring
    const activityStatus: ActivityStatus = {
      morning_checkin: didMorningCheckin,
      evening_checkin: didEveningCheckin,
      set_tasks: didSetTasks,
      complete_tasks: didCompleteTasks,
      chat_with_squad: didInteractWithSquad,
      active_goal: hasActiveGoal,
      complete_habits: didCompleteHabits,
    };

    // Calculate score based on org config
    const alignmentScore = calculateAlignmentScore(activityStatus, config);
    const fullyAligned = alignmentScore === 100;

    // Get current streak info
    let streakOnThisDay = existingData.streakOnThisDay ?? 0;

    // If becoming fully aligned for the first time today, update streak
    if (fullyAligned && !wasFullyAlignedBefore) {
      streakOnThisDay = await updateStreak(userId, organizationId, today);
    }

    // Prepare alignment data
    const alignmentData: Omit<UserAlignment, 'id'> = {
      userId,
      organizationId,
      date: today,
      // Original activities
      didMorningCheckin,
      didSetTasks,
      didInteractWithSquad,
      hasActiveGoal,
      // New activities
      didEveningCheckin,
      didCompleteTasks,
      didCompleteHabits,
      // Score tracking
      alignmentScore,
      fullyAligned,
      streakOnThisDay,
      createdAt: existingData.createdAt || now,
      updatedAt: now,
    };

    // Save to Firestore
    await docRef.set(alignmentData, { merge: true });

    // Invalidate squad cache so squad view shows updated alignment instantly
    // This is fire-and-forget - we don't wait for it and don't fail if it errors
    invalidateUserSquadCache(userId, organizationId).catch(err => {
      console.error('[ALIGNMENT] Failed to invalidate squad cache (will refresh via TTL):', err);
    });

    return { id: docId, ...alignmentData };
  } catch (error) {
    console.error('[ALIGNMENT] Error updating alignment:', error);
    return null;
  }
}

/**
 * Find user's squad within an organization and invalidate its cache
 * Called after alignment updates to ensure squad view shows fresh data
 * Multi-tenancy: Only invalidates squad cache for squads in the same organization
 */
async function invalidateUserSquadCache(userId: string, organizationId: string): Promise<void> {
  // Find the user's squad membership within this organization
  const membershipSnapshot = await adminDb.collection('squadMembers')
    .where('userId', '==', userId)
    .get();

  if (membershipSnapshot.empty) {
    return; // User is not in any squad
  }

  // Find squad that belongs to this organization
  for (const doc of membershipSnapshot.docs) {
    const squadId = doc.data().squadId;
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();
    
    if (squadDoc.exists) {
      const squadData = squadDoc.data();
      // Only invalidate cache for squads in the current organization
      if (squadData?.organizationId === organizationId) {
        await invalidateSquadCache(squadId);
        return; // Found and invalidated the relevant squad
      }
    }
  }
}

/**
 * Check if the user's streak should be reset to 0 within an organization
 * Called on page load to proactively show broken streaks
 * 
 * If the previous day (or weekday if weekends disabled) wasn't fully aligned, 
 * reset streak to 0 immediately rather than waiting until the user next hits 100%
 * Multi-tenancy: Streak is tracked separately per organization
 */
async function checkAndResetBrokenStreak(userId: string, organizationId: string, today: string): Promise<void> {
  const summaryDocId = getAlignmentSummaryDocId(organizationId, userId);
  const summaryRef = adminDb.collection('userAlignmentSummary').doc(summaryDocId);
  
  try {
    // Get org config to check weekend setting
    const config = await getOrgAlignmentConfig(organizationId);
    const weekendStreakEnabled = config.weekendStreakEnabled === true;
    
    const summaryDoc = await summaryRef.get();
    
    if (!summaryDoc.exists) return; // No streak to reset
    
    const summary = summaryDoc.data() as UserAlignmentSummary;
    
    // If already at 0, nothing to do
    if (summary.currentStreak === 0) return;
    
    // Skip check on weekends only if weekend streak is disabled (default behavior)
    if (!weekendStreakEnabled && isWeekendDate(today)) return;
    
    // Get the expected last aligned date based on weekend setting
    const expectedLastDate = weekendStreakEnabled 
      ? getYesterdayDate() 
      : getLastWeekdayDate(today);
    
    // If last aligned date matches expected date, streak is intact
    if (summary.lastAlignedDate === expectedLastDate) return;
    
    // If last aligned date is today, streak is intact (already aligned today)
    if (summary.lastAlignedDate === today) return;
    
    // There's a gap - reset streak to 0
    await summaryRef.update({
      currentStreak: 0,
      updatedAt: new Date().toISOString(),
    });
    
    console.log(`[ALIGNMENT] Reset broken streak for user ${userId} in org ${organizationId} (last aligned: ${summary.lastAlignedDate}, expected: ${expectedLastDate})`);
  } catch (error) {
    console.error('[ALIGNMENT] Error checking/resetting broken streak:', error);
  }
}

/**
 * Update the user's streak when they become fully aligned within an organization
 * Returns the new streak count
 * 
 * Weekend handling (when weekendStreakEnabled is false - default):
 * - If called on a weekend, returns current streak without modification (safety guard)
 * - When checking streak continuity, looks back to last weekday (skipping Sat/Sun)
 * - This ensures streaks bridge from Friday to Monday without breaking
 * 
 * When weekendStreakEnabled is true:
 * - Weekends are treated like any other day
 * - Members must complete activities every day to maintain streak
 * 
 * Multi-tenancy: Streak is tracked separately per organization
 */
async function updateStreak(userId: string, organizationId: string, today: string): Promise<number> {
  const summaryDocId = getAlignmentSummaryDocId(organizationId, userId);
  const summaryRef = adminDb.collection('userAlignmentSummary').doc(summaryDocId);
  const now = new Date().toISOString();

  try {
    // Get org config to check weekend setting
    const config = await getOrgAlignmentConfig(organizationId);
    const weekendStreakEnabled = config.weekendStreakEnabled === true;
    
    // Safety guard: If called on a weekend and weekends are disabled, don't modify streak
    if (!weekendStreakEnabled && isWeekendDate(today)) {
      const summaryDoc = await summaryRef.get();
      if (summaryDoc.exists) {
        return (summaryDoc.data() as UserAlignmentSummary).currentStreak || 0;
      }
      return 0;
    }

    const summaryDoc = await summaryRef.get();
    let currentStreak = 1;
    let lastAlignedDate: string | undefined;

    if (summaryDoc.exists) {
      const summaryData = summaryDoc.data() as UserAlignmentSummary;
      lastAlignedDate = summaryData.lastAlignedDate;

      // Get the expected last aligned date based on weekend setting
      // If weekends enabled, check yesterday; otherwise check last weekday
      const expectedLastDate = weekendStreakEnabled 
        ? getYesterdayDate() 
        : getLastWeekdayDate(today);
      
      if (lastAlignedDate === expectedLastDate) {
        currentStreak = (summaryData.currentStreak || 0) + 1;
      } else if (lastAlignedDate === today) {
        // Already aligned today, don't increment (shouldn't happen but safety check)
        return summaryData.currentStreak || 1;
      } else {
        // Gap in alignment, reset streak
        currentStreak = 1;
      }
    }

    // Update summary
    const summaryUpdate: Omit<UserAlignmentSummary, 'id'> = {
      userId,
      organizationId,
      currentStreak,
      lastAlignedDate: today,
      updatedAt: now,
    };

    await summaryRef.set(summaryUpdate, { merge: true });

    return currentStreak;
  } catch (error) {
    console.error('[ALIGNMENT] Error updating streak:', error);
    return 1;
  }
}

/**
 * Get full alignment state for client (alignment + summary) within an organization
 * Multi-tenancy: Alignment is scoped per organization
 */
export async function getFullAlignmentState(
  userId: string,
  organizationId: string,
  date: string = getTodayDate()
): Promise<{ alignment: UserAlignment | null; summary: UserAlignmentSummary | null }> {
  const [alignment, summary] = await Promise.all([
    getUserAlignment(userId, organizationId, date),
    getUserAlignmentSummary(userId, organizationId),
  ]);

  return { alignment, summary };
}

/**
 * Initialize alignment for today if it doesn't exist within an organization
 * This should be called when loading the homepage to ensure we have current state
 * Multi-tenancy: Alignment is scoped per organization
 */
export async function initializeAlignmentForToday(userId: string, organizationId: string): Promise<UserAlignment> {
  const today = getTodayDate();
  
  // Proactively check and reset broken streaks on page load
  // This ensures users see their streak as 0 immediately if they missed a day
  await checkAndResetBrokenStreak(userId, organizationId, today);
  
  // Get org config to know which activities to check
  const config = await getOrgAlignmentConfig(organizationId);
  
  const existing = await getUserAlignment(userId, organizationId, today);
  
  if (existing) {
    // Refresh hasActiveGoal as it can change (goal completed/archived)
    const hasActiveGoal = await checkUserHasActiveGoal(userId, organizationId);
    
    // For didSetTasks: only check if currently false (it's "sticky" - once true, stays true)
    // This prevents losing credit when tasks are moved to backlog after evening check-in
    let didSetTasks = existing.didSetTasks;
    if (!didSetTasks) {
      didSetTasks = await checkUserHasSetTasks(userId, organizationId, today);
    }
    
    // Check new activities if enabled and not already true
    let didCompleteTasks = existing.didCompleteTasks || false;
    if (!didCompleteTasks && config.enabledActivities.includes('complete_tasks')) {
      didCompleteTasks = await checkUserCompletedTasks(userId, organizationId, today, config.taskCompletionThreshold);
    }
    
    let didCompleteHabits = existing.didCompleteHabits || false;
    if (!didCompleteHabits && config.enabledActivities.includes('complete_habits')) {
      didCompleteHabits = await checkUserCompletedHabits(userId, organizationId, today, config.habitCompletionThreshold);
    }
    
    let didEveningCheckin = existing.didEveningCheckin || false;
    if (!didEveningCheckin && config.enabledActivities.includes('evening_checkin')) {
      didEveningCheckin = await checkUserDidEveningCheckin(userId, organizationId, today);
    }
    
    // Build activity status and calculate expected score based on current config
    // This ensures score is recalculated if config changed (e.g., activities enabled/disabled)
    const activityStatus: ActivityStatus = {
      morning_checkin: existing.didMorningCheckin || false,
      evening_checkin: didEveningCheckin,
      set_tasks: didSetTasks,
      complete_tasks: didCompleteTasks,
      chat_with_squad: existing.didInteractWithSquad || false,
      active_goal: hasActiveGoal,
      complete_habits: didCompleteHabits,
    };
    const expectedScore = calculateAlignmentScore(activityStatus, config);
    const scoreNeedsUpdate = existing.alignmentScore !== expectedScore;
    
    // Only update if something changed (including score recalculation due to config change)
    const needsUpdate = 
      existing.hasActiveGoal !== hasActiveGoal || 
      existing.didSetTasks !== didSetTasks ||
      existing.didCompleteTasks !== didCompleteTasks ||
      existing.didCompleteHabits !== didCompleteHabits ||
      existing.didEveningCheckin !== didEveningCheckin ||
      scoreNeedsUpdate;
      
    if (needsUpdate) {
      return (await updateAlignmentForToday(userId, organizationId, { 
        hasActiveGoal, 
        didSetTasks,
        didCompleteTasks,
        didCompleteHabits,
        didEveningCheckin,
      }))!;
    }
    
    return existing;
  }

  // Create new alignment for today
  const alignment = await updateAlignmentForToday(userId, organizationId, {});
  return alignment!;
}

