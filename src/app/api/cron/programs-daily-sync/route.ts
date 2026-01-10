// Programs Daily Sync Cron Job
//
// This endpoint is called by Vercel Cron every 6 hours to ensure users
// receive their program tasks even if they don't open the app.
// Runs at 0:00, 6:00, 12:00, 18:00 UTC to cover all timezones.
//
// Creates tasks for TODAY and TOMORROW to provide a buffer.
// This is especially important since lazy sync has been removed from GET /api/tasks.
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
import { syncProgramTasksForDay } from '@/lib/program-engine';

// Vercel cron job secret (set in environment)
const CRON_SECRET = process.env.CRON_SECRET;

// Batch size for processing enrollments
const BATCH_SIZE = 50;

/**
 * GET /api/cron/programs-daily-sync
 * Sync program tasks for all active enrollments (called by Vercel Cron every 6 hours)
 * Creates tasks for TODAY and TOMORROW to ensure users always have tasks ready.
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

    console.log('[CRON_PROGRAMS_SYNC] Starting program tasks sync...');

    // Calculate today and tomorrow dates
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    console.log(`[CRON_PROGRAMS_SYNC] Syncing for dates: ${todayStr} (today) and ${tomorrowStr} (tomorrow)`);

    // Get all active enrollments with their enrollment IDs
    const enrollmentsSnapshot = await adminDb
      .collection('program_enrollments')
      .where('status', '==', 'active')
      .get();

    const enrollments = enrollmentsSnapshot.docs.map(doc => ({
      id: doc.id,
      userId: doc.data().userId as string,
      programId: doc.data().programId as string,
    }));

    console.log(`[CRON_PROGRAMS_SYNC] Found ${enrollments.length} active enrollments`);

    let syncedToday = 0;
    let syncedTomorrow = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process enrollments in batches to avoid overwhelming Firestore
    for (let i = 0; i < enrollments.length; i += BATCH_SIZE) {
      const batch = enrollments.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (enrollment) => {
        try {
          // Sync TODAY's tasks (fill-empty mode - don't override existing)
          const todayExisting = await adminDb
            .collection('tasks')
            .where('userId', '==', enrollment.userId)
            .where('date', '==', todayStr)
            .where('programEnrollmentId', '==', enrollment.id)
            .limit(1)
            .get();

          if (todayExisting.empty) {
            const todayResult = await syncProgramTasksForDay({
              userId: enrollment.userId,
              enrollmentId: enrollment.id,
              date: todayStr,
              mode: 'fill-empty',
            });

            if (todayResult.tasksCreated > 0) {
              syncedToday++;
              console.log(`[CRON_PROGRAMS_SYNC] Today sync for ${enrollment.userId}: ${todayResult.tasksCreated} tasks`);
            } else {
              skippedCount++;
            }
          } else {
            skippedCount++;
          }

          // Sync TOMORROW's tasks (buffer for users in advance timezones)
          const tomorrowExisting = await adminDb
            .collection('tasks')
            .where('userId', '==', enrollment.userId)
            .where('date', '==', tomorrowStr)
            .where('programEnrollmentId', '==', enrollment.id)
            .limit(1)
            .get();

          if (tomorrowExisting.empty) {
            const tomorrowResult = await syncProgramTasksForDay({
              userId: enrollment.userId,
              enrollmentId: enrollment.id,
              date: tomorrowStr,
              mode: 'fill-empty',
            });

            if (tomorrowResult.tasksCreated > 0) {
              syncedTomorrow++;
              console.log(`[CRON_PROGRAMS_SYNC] Tomorrow sync for ${enrollment.userId}: ${tomorrowResult.tasksCreated} tasks`);
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
      `${skippedCount} skipped, ${errorCount} errors`
    );

    return NextResponse.json({
      success: true,
      stats: {
        totalEnrollments: enrollments.length,
        syncedToday,
        syncedTomorrow,
        skipped: skippedCount,
        errors: errorCount,
      },
      dates: {
        today: todayStr,
        tomorrow: tomorrowStr,
      },
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      ...(errors.length > 0 && { errorDetails: errors.slice(0, 10) }), // Include first 10 errors
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
