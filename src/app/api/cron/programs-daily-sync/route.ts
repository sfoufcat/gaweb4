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
import type { ProgramInstance, ProgramInstanceDay, ProgramInstanceTask } from '@/types';

// Vercel cron job secret (set in environment)
const CRON_SECRET = process.env.CRON_SECRET;

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
  calendarDate: string
): Promise<number> {
  const batch = adminDb.batch();
  const now = new Date().toISOString();
  let tasksCreated = 0;

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

  // Create tasks that don't exist yet (fill-empty mode)
  for (const task of tasks) {
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
        dayIndex,
        date: calendarDate,
        completed: false,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
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
    }>;

    console.log(`[CRON_PROGRAMS_SYNC] Found ${enrollments.length} active enrollments`);

    // Get all program_instances
    const instancesSnapshot = await adminDb
      .collection('program_instances')
      .get();

    // Build lookup maps
    const instanceByEnrollmentId = new Map<string, ProgramInstance>();
    const instanceByCohortId = new Map<string, ProgramInstance>();

    for (const doc of instancesSnapshot.docs) {
      const data = doc.data();
      const instance = { ...data, id: doc.id } as ProgramInstance;

      if (instance.type === 'individual' && instance.enrollmentId) {
        instanceByEnrollmentId.set(instance.enrollmentId, instance);
      } else if (instance.type === 'cohort' && instance.cohortId) {
        instanceByCohortId.set(instance.cohortId, instance);
      }
    }

    let syncedToday = 0;
    let syncedTomorrow = 0;
    let skippedCount = 0;
    let noInstanceCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process enrollments in batches to avoid overwhelming Firestore
    for (let i = 0; i < enrollments.length; i += BATCH_SIZE) {
      const batch = enrollments.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (enrollment) => {
        try {
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

          // Sync TODAY's tasks
          const todayDay = findDayByCalendarDate(instance, todayStr);
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
                todayStr
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

          // Sync TOMORROW's tasks
          const tomorrowDay = findDayByCalendarDate(instance, tomorrowStr);
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
                tomorrowStr
              );
              if (tasksCreated > 0) {
                syncedTomorrow++;
                console.log(`[CRON_PROGRAMS_SYNC] Tomorrow sync for ${enrollment.userId}: ${tasksCreated} tasks`);
              }
            }
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
      `${skippedCount} skipped, ${noInstanceCount} no instance, ${errorCount} errors`
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
