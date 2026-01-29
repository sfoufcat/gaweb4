// Programs Daily Sync Cron Job
//
// This endpoint is called by Vercel Cron every 6 hours to ensure users
// receive their program tasks even if they don't open the app.
// Runs at 0:00, 6:00, 12:00, 18:00 UTC to cover all timezones.
//
// Creates tasks for TODAY and TOMORROW to provide a buffer.
// This is especially important since lazy sync has been removed from GET /api/tasks.
//
// Uses the NEW instance-based system only (program_instances collection).
// Enrollments without instances are skipped.
//
// Configure in vercel.json:
// {
//   "crons": [{
//     "path": "/api/cron/programs-daily-sync",
//     "schedule": "0 */6 * * *"
//   }]
// }

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getTodayInTimezone } from '@/lib/timezone';
import type { ProgramInstance, ProgramInstanceDay, ProgramInstanceTask, ProgramInstanceModule, ProgramHabitTemplate, FrequencyType, Program } from '@/types';

// Vercel cron job secret (set in environment)
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Map program habit frequency to Habit format
 */
function mapHabitFrequency(template: ProgramHabitTemplate): {
  frequencyType: FrequencyType;
  frequencyValue: number | number[];
} {
  if (template.frequency === 'daily') {
    return { frequencyType: 'daily', frequencyValue: 1 };
  } else if (template.frequency === 'weekday') {
    return { frequencyType: 'weekly_specific_days', frequencyValue: [0, 1, 2, 3, 4] };
  } else {
    const days = template.customDays && template.customDays.length > 0
      ? template.customDays
      : [0, 2, 4];
    return { frequencyType: 'weekly_specific_days', frequencyValue: days };
  }
}

/**
 * Calculate user's current day index based on enrollment start date
 * Uses user's timezone to determine "today" correctly
 */
function calculateCurrentDayIndex(startedAt: string, includeWeekends: boolean = false, userTimezone: string = 'UTC'): number {
  // Parse startedAt as date-only to avoid timezone conversion issues
  const startDateStr = startedAt.split('T')[0]; // "2024-01-27"
  const startDate = new Date(startDateStr + 'T12:00:00'); // Noon avoids DST issues

  // Get today in user's timezone
  const todayStr = getTodayInTimezone(userTimezone);
  const today = new Date(todayStr + 'T12:00:00');

  if (includeWeekends) {
    const diffMs = today.getTime() - startDate.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  } else {
    let dayIndex = 0;
    const current = new Date(startDate);
    while (current <= today) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        dayIndex++;
      }
      current.setDate(current.getDate() + 1);
    }
    return Math.max(1, dayIndex);
  }
}

/**
 * Find the module a user should be in based on their current day index
 */
function getCurrentModule(
  modules: ProgramInstanceModule[],
  currentDayIndex: number
): ProgramInstanceModule | null {
  const sortedModules = [...modules].sort((a, b) => a.order - b.order);
  for (const module of sortedModules) {
    if (currentDayIndex >= module.startDayIndex && currentDayIndex <= module.endDayIndex) {
      return module;
    }
  }
  if (sortedModules.length > 0 && currentDayIndex > sortedModules[sortedModules.length - 1].endDayIndex) {
    return sortedModules[sortedModules.length - 1];
  }
  if (sortedModules.length > 0 && currentDayIndex < sortedModules[0].startDayIndex) {
    return sortedModules[0];
  }
  return null;
}

/**
 * Sync habits for a user based on their current module
 */
async function syncHabitsForUser(
  userId: string,
  organizationId: string,
  programId: string,
  instance: ProgramInstance,
  startedAt: string,
  includeWeekends: boolean,
  userTimezone: string = 'UTC'
): Promise<{ created: number; updated: number; archived: number }> {
  const now = new Date().toISOString();
  let created = 0, updated = 0, archived = 0;

  const currentDayIndex = calculateCurrentDayIndex(startedAt, includeWeekends, userTimezone);
  const instanceModules = instance.modules || [];
  
  if (instanceModules.length === 0) {
    return { created, updated, archived };
  }

  const currentModule = getCurrentModule(instanceModules, currentDayIndex);
  if (!currentModule) {
    return { created, updated, archived };
  }

  const habitsToSync = currentModule.habits || [];
  const currentModuleId = currentModule.templateModuleId;

  // Get existing habits
  const existingHabitsSnapshot = await adminDb
    .collection('habits')
    .where('userId', '==', userId)
    .where('organizationId', '==', organizationId)
    .where('programId', '==', programId)
    .where('source', 'in', ['module_default', 'program_default'])
    .get();

  const existingByTitle = new Map<string, { id: string; archived?: boolean; moduleId?: string }>();
  existingHabitsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    existingByTitle.set(data.text, { id: doc.id, archived: data.archived, moduleId: data.moduleId });
  });

  // Archive habits not in current module
  const syncingTitles = new Set(habitsToSync.map(h => h.title));
  for (const [title, habit] of Array.from(existingByTitle.entries())) {
    if (!syncingTitles.has(title) && !habit.archived) {
      await adminDb.collection('habits').doc(habit.id).update({
        archived: true,
        status: 'archived',
        updatedAt: now,
      });
      archived++;
    }
  }

  // Create or update habits (max 3)
  let count = 0;
  for (const template of habitsToSync) {
    if (count >= 3) break;

    const existing = existingByTitle.get(template.title);
    const { frequencyType, frequencyValue } = mapHabitFrequency(template);

    if (existing) {
      await adminDb.collection('habits').doc(existing.id).update({
        linkedRoutine: template.description || null,
        frequencyType,
        frequencyValue,
        moduleId: currentModuleId,
        source: 'module_default',
        archived: false,
        status: 'active',
        updatedAt: now,
      });
      updated++;
    } else {
      await adminDb.collection('habits').add({
        userId,
        organizationId,
        text: template.title,
        linkedRoutine: template.description || null,
        frequencyType,
        frequencyValue,
        reminder: null,
        targetRepetitions: null,
        progress: { currentCount: 0, lastCompletedDate: null, completionDates: [], skipDates: [] },
        archived: false,
        status: 'active',
        source: 'module_default',
        programId,
        moduleId: currentModuleId,
        createdAt: now,
        updatedAt: now,
      });
      created++;
    }
    count++;
  }

  return { created, updated, archived };
}

// Batch size for processing enrollments
const BATCH_SIZE = 50;

/**
 * Sync day tasks to user's tasks collection using the instance-based system.
 * Creates tasks with instanceId/instanceTaskId fields.
 */
async function syncInstanceDayTasksToUser(
  instanceId: string,
  userId: string,
  dayIndex: number,
  tasks: ProgramInstanceTask[],
  calendarDate: string,
  organizationId: string | undefined
): Promise<number> {
  const batch = adminDb.batch();
  const now = new Date().toISOString();
  let tasksCreated = 0;

  // Get org's focus limit setting
  let focusLimit = 3; // Default
  if (organizationId) {
    try {
      const orgSettingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
      const orgSettings = orgSettingsDoc.data();
      focusLimit = orgSettings?.defaultDailyFocusSlots ?? 3;
    } catch {
      // Fallback to 3 if org settings can't be fetched
    }
  }

  // Get existing tasks for this instance + day + user
  const existingTasksQuery = await adminDb.collection('tasks')
    .where('userId', '==', userId)
    .where('instanceId', '==', instanceId)
    .where('dayIndex', '==', dayIndex)
    .get();

  const existingTasksByInstanceTaskId = new Map<string, string>();
  for (const doc of existingTasksQuery.docs) {
    const data = doc.data();
    if (data.instanceTaskId) {
      existingTasksByInstanceTaskId.set(data.instanceTaskId, doc.id);
    }
  }

  // Count how many focus tasks the user already has for this date (excluding this instance's tasks)
  let existingFocusCount = 0;
  if (calendarDate) {
    const focusTasksQuery = await adminDb.collection('tasks')
      .where('userId', '==', userId)
      .where('date', '==', calendarDate)
      .where('listType', '==', 'focus')
      .get();
    // Count focus tasks that are NOT from this instance (to avoid double counting)
    existingFocusCount = focusTasksQuery.docs.filter(doc => doc.data().instanceId !== instanceId).length;
  }

  let availableFocusSlots = focusLimit - existingFocusCount;

  // Separate primary and non-primary tasks
  const primaryTasks = tasks.filter(t => t.isPrimary);
  const nonPrimaryTasks = tasks.filter(t => !t.isPrimary);

  // Process primary tasks first (try to put in Focus)
  for (const task of primaryTasks) {
    if (!existingTasksByInstanceTaskId.has(task.id)) {
      const listType = availableFocusSlots > 0 ? 'focus' : 'backlog';
      if (listType === 'focus') {
        availableFocusSlots--;
      }

      const taskRef = adminDb.collection('tasks').doc();
      batch.set(taskRef, {
        userId,
        instanceId,
        instanceTaskId: task.id,
        label: task.label,
        title: task.label, // For backward compatibility with UI that uses title
        isPrimary: task.isPrimary,
        type: task.type || 'task',
        estimatedMinutes: task.estimatedMinutes || null,
        notes: task.notes || null,
        tag: task.tag || null,
        source: 'program',
        sourceType: 'program', // Match other sync functions
        listType, // CRITICAL: Include listType for Daily Focus to work
        status: 'pending',
        order: tasksCreated,
        isPrivate: false,
        dayIndex,
        date: calendarDate,
        completed: false,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
        // CRITICAL: Include organizationId for multi-tenant filtering
        ...(organizationId && { organizationId }),
      });
      tasksCreated++;
    }
  }

  // Process non-primary tasks (always go to backlog)
  for (const task of nonPrimaryTasks) {
    if (!existingTasksByInstanceTaskId.has(task.id)) {
      const taskRef = adminDb.collection('tasks').doc();
      batch.set(taskRef, {
        userId,
        instanceId,
        instanceTaskId: task.id,
        label: task.label,
        title: task.label, // For backward compatibility with UI that uses title
        isPrimary: task.isPrimary,
        type: task.type || 'task',
        estimatedMinutes: task.estimatedMinutes || null,
        notes: task.notes || null,
        tag: task.tag || null,
        source: 'program',
        sourceType: 'program', // Match other sync functions
        listType: 'backlog', // Non-primary always goes to backlog
        status: 'pending',
        order: tasksCreated,
        isPrivate: false,
        dayIndex,
        date: calendarDate,
        completed: false,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
        // CRITICAL: Include organizationId for multi-tenant filtering
        ...(organizationId && { organizationId }),
      });
      tasksCreated++;
    }
  }

  if (tasksCreated > 0) {
    await batch.commit();
  }

  return tasksCreated;
}

/**
 * Find the day in an instance that matches the given calendar date
 */
function findDayByCalendarDate(
  instance: ProgramInstance,
  targetDate: string
): { day: ProgramInstanceDay; globalDayIndex: number } | null {
  for (const week of instance.weeks || []) {
    for (const day of week.days || []) {
      if (day.calendarDate === targetDate) {
        return { day, globalDayIndex: day.globalDayIndex };
      }
    }
  }
  return null;
}

/**
 * GET /api/cron/programs-daily-sync
 * Sync program tasks for all active enrollments (called by Vercel Cron every 6 hours)
 * Creates tasks for TODAY and TOMORROW to ensure users always have tasks ready.
 *
 * Uses instance-based system only. Enrollments without program_instances are skipped.
 */
export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    // Verify cron secret if configured
    if (CRON_SECRET) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        console.warn('[CRON_PROGRAMS_SYNC] Invalid cron secret');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    console.log('[CRON_PROGRAMS_SYNC] Starting program tasks sync (instance-based)...');

    // Calculate today and tomorrow dates
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    console.log(`[CRON_PROGRAMS_SYNC] Syncing for dates: ${todayStr} (today) and ${tomorrowStr} (tomorrow)`);

    // Get all active enrollments
    const enrollmentsSnapshot = await adminDb
      .collection('program_enrollments')
      .where('status', '==', 'active')
      .get();

    const enrollments = enrollmentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Array<{
      id: string;
      userId: string;
      programId: string;
      cohortId?: string;
      organizationId?: string;
      startedAt?: string; // For habit sync
    }>;

    console.log(`[CRON_PROGRAMS_SYNC] Found ${enrollments.length} active enrollments`);

    // Get all program_instances
    const instancesSnapshot = await adminDb
      .collection('program_instances')
      .get();

    // Build lookup maps
    const instanceByEnrollmentId = new Map<string, ProgramInstance>();
    const instanceByCohortId = new Map<string, ProgramInstance>();
    const validInstanceIds = new Set<string>();

    for (const doc of instancesSnapshot.docs) {
      const data = doc.data();
      const instance = { ...data, id: doc.id } as ProgramInstance;
      validInstanceIds.add(doc.id);

      if (instance.type === 'individual' && instance.enrollmentId) {
        instanceByEnrollmentId.set(instance.enrollmentId, instance);
      } else if (instance.type === 'cohort' && instance.cohortId) {
        instanceByCohortId.set(instance.cohortId, instance);
      }
    }

    // Batch fetch user timezones for timezone-aware date calculations
    const userIds = [...new Set(enrollments.map(e => e.userId))];
    const userTimezoneMap = new Map<string, string>();

    // Fetch in batches of 10 (Firestore 'in' query limit)
    for (let i = 0; i < userIds.length; i += 10) {
      const batchIds = userIds.slice(i, i + 10);
      const usersSnapshot = await adminDb.collection('users')
        .where('__name__', 'in', batchIds)
        .get();

      for (const doc of usersSnapshot.docs) {
        const userData = doc.data();
        userTimezoneMap.set(doc.id, userData.timezone || 'UTC');
      }
    }

    // Default UTC for users not found
    for (const userId of userIds) {
      if (!userTimezoneMap.has(userId)) {
        userTimezoneMap.set(userId, 'UTC');
      }
    }

    console.log(`[CRON_PROGRAMS_SYNC] Fetched timezones for ${userTimezoneMap.size} users`);

    // Clean orphan tasks (tasks referencing non-existent instances)
    // This prevents orphaned tasks from polluting focus slot counts
    let orphansDeleted = 0;
    try {
      const orphanTasksQuery = await adminDb.collection('tasks')
        .where('sourceType', '==', 'program')
        .get();

      const orphanBatch = adminDb.batch();
      let orphanBatchCount = 0;

      for (const doc of orphanTasksQuery.docs) {
        const taskData = doc.data();
        const instanceId = taskData.instanceId;
        // If task has instanceId but instance doesn't exist, it's orphaned
        if (instanceId && !validInstanceIds.has(instanceId)) {
          orphanBatch.delete(doc.ref);
          orphanBatchCount++;
          orphansDeleted++;

          // Commit in batches of 500 (Firestore limit)
          if (orphanBatchCount >= 500) {
            await orphanBatch.commit();
            orphanBatchCount = 0;
          }
        }
      }

      // Commit remaining
      if (orphanBatchCount > 0) {
        await orphanBatch.commit();
      }

      if (orphansDeleted > 0) {
        console.log(`[CRON_PROGRAMS_SYNC] Cleaned ${orphansDeleted} orphaned tasks`);
      }
    } catch (orphanError) {
      console.error('[CRON_PROGRAMS_SYNC] Error cleaning orphan tasks:', orphanError);
      // Continue with sync even if orphan cleanup fails
    }

    let syncedToday = 0;
    let syncedTomorrow = 0;
    let skippedCount = 0;
    let noInstanceCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    
    // Habit sync stats
    let habitsCreated = 0;
    let habitsUpdated = 0;
    let habitsArchived = 0;
    
    // Fetch programs for includeWeekends setting (cache)
    const programCache = new Map<string, Program>();

    // Process enrollments in batches to avoid overwhelming Firestore
    for (let i = 0; i < enrollments.length; i += BATCH_SIZE) {
      const batch = enrollments.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (enrollment) => {
        try {
          // Get user's timezone for accurate date calculations
          const userTimezone = userTimezoneMap.get(enrollment.userId) || 'UTC';
          const userTodayStr = getTodayInTimezone(userTimezone);
          const userTomorrow = new Date(userTodayStr + 'T12:00:00');
          userTomorrow.setDate(userTomorrow.getDate() + 1);
          const userTomorrowStr = new Intl.DateTimeFormat('en-CA', {
            timeZone: userTimezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(userTomorrow);

          // Find the instance for this enrollment
          let instance: ProgramInstance | undefined;

          if (enrollment.cohortId) {
            // Cohort enrollment - use cohort instance
            instance = instanceByCohortId.get(enrollment.cohortId);
          } else {
            // Individual enrollment - use individual instance
            instance = instanceByEnrollmentId.get(enrollment.id);
          }

          if (!instance) {
            // No instance found - skip this enrollment
            noInstanceCount++;
            return;
          }

          // Skip if instance is not active (completed, stopped, paused)
          if (instance.status && instance.status !== 'active') {
            skippedCount++;
            return;
          }

          // Sync TODAY's tasks (using user's timezone-aware today)
          const todayDay = findDayByCalendarDate(instance, userTodayStr);
          if (todayDay && todayDay.day.tasks.length > 0) {
            // Check if tasks already exist for today
            const todayExisting = await adminDb
              .collection('tasks')
              .where('userId', '==', enrollment.userId)
              .where('instanceId', '==', instance.id)
              .where('dayIndex', '==', todayDay.globalDayIndex)
              .limit(1)
              .get();

            if (todayExisting.empty) {
              const tasksCreated = await syncInstanceDayTasksToUser(
                instance.id,
                enrollment.userId,
                todayDay.globalDayIndex,
                todayDay.day.tasks,
                userTodayStr,
                enrollment.organizationId
              );
              if (tasksCreated > 0) {
                syncedToday++;
                console.log(`[CRON_PROGRAMS_SYNC] Today sync for ${enrollment.userId}: ${tasksCreated} tasks`);
              } else {
                skippedCount++;
              }
            } else {
              skippedCount++;
            }
          } else {
            skippedCount++;
          }

          // Sync TOMORROW's tasks (using user's timezone-aware tomorrow)
          const tomorrowDay = findDayByCalendarDate(instance, userTomorrowStr);
          if (tomorrowDay && tomorrowDay.day.tasks.length > 0) {
            const tomorrowExisting = await adminDb
              .collection('tasks')
              .where('userId', '==', enrollment.userId)
              .where('instanceId', '==', instance.id)
              .where('dayIndex', '==', tomorrowDay.globalDayIndex)
              .limit(1)
              .get();

            if (tomorrowExisting.empty) {
              const tasksCreated = await syncInstanceDayTasksToUser(
                instance.id,
                enrollment.userId,
                tomorrowDay.globalDayIndex,
                tomorrowDay.day.tasks,
                userTomorrowStr,
                enrollment.organizationId
              );
              if (tasksCreated > 0) {
                syncedTomorrow++;
                console.log(`[CRON_PROGRAMS_SYNC] Tomorrow sync for ${enrollment.userId}: ${tasksCreated} tasks`);
              }
            }
          }

          // HABIT SYNC: Sync habits based on current module
          if (enrollment.organizationId && enrollment.startedAt && instance.modules && instance.modules.length > 0) {
            // Get program's includeWeekends setting (cached)
            let program = programCache.get(enrollment.programId);
            if (!program) {
              const programDoc = await adminDb.collection('programs').doc(enrollment.programId).get();
              if (programDoc.exists) {
                program = { id: programDoc.id, ...programDoc.data() } as Program;
                programCache.set(enrollment.programId, program);
              }
            }
            const includeWeekends = program?.includeWeekends !== false;

            const habitResult = await syncHabitsForUser(
              enrollment.userId,
              enrollment.organizationId,
              enrollment.programId,
              instance,
              enrollment.startedAt,
              includeWeekends,
              userTimezone
            );
            habitsCreated += habitResult.created;
            habitsUpdated += habitResult.updated;
            habitsArchived += habitResult.archived;
          }
        } catch (err) {
          errorCount++;
          const errorMsg = err instanceof Error ? err.message : String(err);
          errors.push(`Enrollment ${enrollment.id}: ${errorMsg}`);
          console.error(`[CRON_PROGRAMS_SYNC] Error syncing enrollment ${enrollment.id}:`, err);
        }
      }));

      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < enrollments.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const duration = Date.now() - startTime;

    console.log(
      `[CRON_PROGRAMS_SYNC] Completed in ${duration}ms: ` +
      `${syncedToday} synced today, ${syncedTomorrow} synced tomorrow, ` +
      `${skippedCount} skipped, ${noInstanceCount} no instance, ${errorCount} errors. ` +
      `Habits: ${habitsCreated} created, ${habitsUpdated} updated, ${habitsArchived} archived`
    );

    return NextResponse.json({
      success: true,
      stats: {
        totalEnrollments: enrollments.length,
        syncedToday,
        syncedTomorrow,
        skipped: skippedCount,
        noInstance: noInstanceCount,
        errors: errorCount,
        habits: {
          created: habitsCreated,
          updated: habitsUpdated,
          archived: habitsArchived,
        },
      },
      dates: {
        today: todayStr,
        tomorrow: tomorrowStr,
      },
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      ...(errors.length > 0 && { errorDetails: errors.slice(0, 10) }),
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[CRON_PROGRAMS_SYNC] Fatal error:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// Also support POST for manual triggering
export async function POST(request: Request) {
  return GET(request);
}
