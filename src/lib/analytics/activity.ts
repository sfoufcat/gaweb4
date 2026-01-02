/**
 * Activity Resolver
 * 
 * Unified source of truth for computing user activity across the platform.
 * Checks multiple data sources to determine if a user is active and what signals exist.
 * 
 * MULTI-TENANCY: All queries are scoped by organizationId
 */

import { adminDb } from '../firebase-admin';
import type { Habit, Task } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

export interface ActivitySignals {
  tasks: boolean;
  habits: boolean;
  morningCheckins: boolean;
  eveningCheckins: boolean;
  weeklyReflections: boolean;
  lastActivityAt: Date | null;
  primarySignal: 'task' | 'habit' | 'checkin' | 'weekly' | null;
  daysActiveInPeriod: number;
  activityDates: string[]; // ISO dates with activity
}

export interface ActivityResult {
  active: boolean;
  activitySignals: ActivitySignals;
  status: 'thriving' | 'active' | 'inactive';
  atRisk: boolean; // active but declining (active this week but not last 2 days)
}

export interface ActivityResolverOptions {
  orgId: string;
  userId: string;
  sinceDate?: Date; // defaults to 7 days ago
}

// ============================================================================
// THRESHOLDS (configurable)
// ============================================================================

export const ACTIVITY_THRESHOLDS = {
  // Minimum days active to be considered "thriving"
  thrivingDays: 4,
  // Minimum distinct activity types to be considered "thriving" (alternative)
  thrivingActivityTypes: 3,
  // Days without activity to be considered "inactive"
  inactiveDays: 7,
  // Default lookback period in days
  defaultLookbackDays: 7,
} as const;

// ============================================================================
// ACTIVITY RESOLVER
// ============================================================================

/**
 * Compute activity status for a user
 * 
 * Checks:
 * - Habits: looks at progress.completionDates[] array
 * - Tasks: looks at status='completed' and completedAt timestamp
 * - Morning Check-ins: looks at morning_checkins collection
 * - Evening Check-ins: looks at evening_checkins collection
 * - Weekly Reflections: looks at weekly_reflections collection
 */
export async function resolveActivity(options: ActivityResolverOptions): Promise<ActivityResult> {
  const { orgId, userId } = options;
  const sinceDate = options.sinceDate || getDefaultSinceDate();
  const sinceDateStr = sinceDate.toISOString();
  const sinceDateOnly = sinceDate.toISOString().split('T')[0];

  const signals: ActivitySignals = {
    tasks: false,
    habits: false,
    morningCheckins: false,
    eveningCheckins: false,
    weeklyReflections: false,
    lastActivityAt: null,
    primarySignal: null,
    daysActiveInPeriod: 0,
    activityDates: [],
  };

  const activityDatesSet = new Set<string>();
  let latestActivityDate: Date | null = null;

  // Track which sources we checked (for debugging)
  const sourcesChecked: string[] = [];

  try {
    // A) Check Habits
    // Habits store completion dates in progress.completionDates[] array
    const habitsSnapshot = await adminDb
      .collection('habits')
      .where('userId', '==', userId)
      .where('organizationId', '==', orgId)
      .where('archived', '==', false)
      .get();

    sourcesChecked.push('habits');

    for (const doc of habitsSnapshot.docs) {
      const habit = doc.data() as Habit;
      const completionDates = habit.progress?.completionDates || [];
      
      for (const dateStr of completionDates) {
        // Date format: YYYY-MM-DD or ISO string
        const dateOnly = dateStr.split('T')[0];
        if (dateOnly >= sinceDateOnly) {
          signals.habits = true;
          activityDatesSet.add(dateOnly);
          
          const activityDate = new Date(dateStr);
          if (!latestActivityDate || activityDate > latestActivityDate) {
            latestActivityDate = activityDate;
          }
        }
      }
    }
  } catch (error) {
    console.warn('[ACTIVITY_RESOLVER] Habits query failed:', error);
  }

  try {
    // B) Check Tasks
    // Tasks have status='completed' and optional completedAt timestamp
    const tasksSnapshot = await adminDb
      .collection('tasks')
      .where('userId', '==', userId)
      .where('organizationId', '==', orgId)
      .where('status', '==', 'completed')
      .get();

    sourcesChecked.push('tasks');

    for (const doc of tasksSnapshot.docs) {
      const task = doc.data() as Task;
      // Use completedAt if available, otherwise fall back to updatedAt
      const completedAt = task.completedAt || task.updatedAt;
      
      if (completedAt && completedAt >= sinceDateStr) {
        signals.tasks = true;
        const dateOnly = completedAt.split('T')[0];
        activityDatesSet.add(dateOnly);
        
        const activityDate = new Date(completedAt);
        if (!latestActivityDate || activityDate > latestActivityDate) {
          latestActivityDate = activityDate;
        }
      }
    }
  } catch (error) {
    console.warn('[ACTIVITY_RESOLVER] Tasks query failed:', error);
  }

  try {
    // C) Check Morning Check-ins
    // Doc ID format: ${orgId}_${userId}_${date}
    // We need to query by date prefix
    const morningCheckinsSnapshot = await adminDb
      .collection('morning_checkins')
      .where('userId', '==', userId)
      .where('organizationId', '==', orgId)
      .get();

    sourcesChecked.push('morning_checkins');

    for (const doc of morningCheckinsSnapshot.docs) {
      const data = doc.data();
      const completedAt = data.completedAt || data.createdAt;
      
      if (completedAt && completedAt >= sinceDateStr) {
        signals.morningCheckins = true;
        const dateOnly = completedAt.split('T')[0];
        activityDatesSet.add(dateOnly);
        
        const activityDate = new Date(completedAt);
        if (!latestActivityDate || activityDate > latestActivityDate) {
          latestActivityDate = activityDate;
        }
      }
    }
  } catch (error) {
    console.warn('[ACTIVITY_RESOLVER] Morning check-ins query failed:', error);
  }

  try {
    // D) Check Evening Check-ins
    const eveningCheckinsSnapshot = await adminDb
      .collection('evening_checkins')
      .where('userId', '==', userId)
      .where('organizationId', '==', orgId)
      .get();

    sourcesChecked.push('evening_checkins');

    for (const doc of eveningCheckinsSnapshot.docs) {
      const data = doc.data();
      const completedAt = data.completedAt || data.createdAt;
      
      if (completedAt && completedAt >= sinceDateStr) {
        signals.eveningCheckins = true;
        const dateOnly = completedAt.split('T')[0];
        activityDatesSet.add(dateOnly);
        
        const activityDate = new Date(completedAt);
        if (!latestActivityDate || activityDate > latestActivityDate) {
          latestActivityDate = activityDate;
        }
      }
    }
  } catch (error) {
    console.warn('[ACTIVITY_RESOLVER] Evening check-ins query failed:', error);
  }

  try {
    // E) Check Weekly Reflections
    const weeklyReflectionsSnapshot = await adminDb
      .collection('weekly_reflections')
      .where('userId', '==', userId)
      .where('organizationId', '==', orgId)
      .get();

    sourcesChecked.push('weekly_reflections');

    for (const doc of weeklyReflectionsSnapshot.docs) {
      const data = doc.data();
      const completedAt = data.completedAt || data.createdAt;
      
      if (completedAt && completedAt >= sinceDateStr) {
        signals.weeklyReflections = true;
        const dateOnly = completedAt.split('T')[0];
        activityDatesSet.add(dateOnly);
        
        const activityDate = new Date(completedAt);
        if (!latestActivityDate || activityDate > latestActivityDate) {
          latestActivityDate = activityDate;
        }
      }
    }
  } catch (error) {
    console.warn('[ACTIVITY_RESOLVER] Weekly reflections query failed:', error);
  }

  // Compile results
  signals.activityDates = Array.from(activityDatesSet).sort();
  signals.daysActiveInPeriod = activityDatesSet.size;
  signals.lastActivityAt = latestActivityDate;

  // Determine primary signal (most common/recent activity type)
  if (signals.tasks) signals.primarySignal = 'task';
  else if (signals.habits) signals.primarySignal = 'habit';
  else if (signals.morningCheckins || signals.eveningCheckins) signals.primarySignal = 'checkin';
  else if (signals.weeklyReflections) signals.primarySignal = 'weekly';

  // Determine activity status
  const hasAnyActivity = signals.tasks || signals.habits || signals.morningCheckins || 
                         signals.eveningCheckins || signals.weeklyReflections;
  
  // Count distinct activity types
  const activityTypesCount = [
    signals.tasks,
    signals.habits,
    signals.morningCheckins || signals.eveningCheckins,
    signals.weeklyReflections,
  ].filter(Boolean).length;

  // Determine status
  let status: 'thriving' | 'active' | 'inactive' = 'inactive';
  
  if (hasAnyActivity) {
    // Check for thriving: either high number of active days OR variety of activity types
    if (signals.daysActiveInPeriod >= ACTIVITY_THRESHOLDS.thrivingDays || 
        activityTypesCount >= ACTIVITY_THRESHOLDS.thrivingActivityTypes) {
      status = 'thriving';
    } else {
      status = 'active';
    }
  }

  // Check if at-risk (active but declining)
  // At-risk = has activity in period but no activity in last 2 days
  let atRisk = false;
  if (hasAnyActivity && latestActivityDate) {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    atRisk = latestActivityDate < twoDaysAgo;
  }

  console.log(`[ACTIVITY_RESOLVER] User ${userId} in org ${orgId}: status=${status}, active=${hasAnyActivity}, sources=${sourcesChecked.join(',')}`);

  return {
    active: hasAnyActivity,
    activitySignals: signals,
    status,
    atRisk,
  };
}

/**
 * Batch resolve activity for multiple users
 * More efficient for squad/program-level analytics
 */
export async function batchResolveActivity(
  orgId: string,
  userIds: string[],
  sinceDate?: Date
): Promise<Map<string, ActivityResult>> {
  const results = new Map<string, ActivityResult>();
  
  // Process in batches of 10 to avoid overwhelming Firestore
  const batchSize = 10;
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    const promises = batch.map(userId => 
      resolveActivity({ orgId, userId, sinceDate })
        .then(result => results.set(userId, result))
        .catch(error => {
          console.error(`[ACTIVITY_RESOLVER] Failed for user ${userId}:`, error);
          // Return inactive status on error
          results.set(userId, {
            active: false,
            activitySignals: {
              tasks: false,
              habits: false,
              morningCheckins: false,
              eveningCheckins: false,
              weeklyReflections: false,
              lastActivityAt: null,
              primarySignal: null,
              daysActiveInPeriod: 0,
              activityDates: [],
            },
            status: 'inactive',
            atRisk: false,
          });
        })
    );
    await Promise.all(promises);
  }

  return results;
}

// ============================================================================
// HELPERS
// ============================================================================

function getDefaultSinceDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() - ACTIVITY_THRESHOLDS.defaultLookbackDays);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Get a summary of activity counts for an organization
 */
export async function getOrgActivitySummary(
  orgId: string,
  userIds: string[],
  sinceDate?: Date
): Promise<{
  total: number;
  thriving: number;
  active: number;
  inactive: number;
  atRisk: number;
}> {
  const results = await batchResolveActivity(orgId, userIds, sinceDate);
  
  let thriving = 0;
  let active = 0;
  let inactive = 0;
  let atRisk = 0;

  for (const result of results.values()) {
    if (result.status === 'thriving') thriving++;
    else if (result.status === 'active') active++;
    else inactive++;
    
    if (result.atRisk) atRisk++;
  }

  return {
    total: userIds.length,
    thriving,
    active,
    inactive,
    atRisk,
  };
}









