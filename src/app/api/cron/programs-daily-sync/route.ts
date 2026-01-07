// Programs Daily Sync Cron Job
//
// This endpoint is called by Vercel Cron every 6 hours to ensure users
// receive their program tasks even if they don't open the app.
// Runs at 0:00, 6:00, 12:00, 18:00 UTC to cover all timezones.
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
import { syncProgramV2TasksForToday } from '@/lib/program-engine';

// Vercel cron job secret (set in environment)
const CRON_SECRET = process.env.CRON_SECRET;

// Batch size for processing enrollments
const BATCH_SIZE = 50;

/**
 * GET /api/cron/programs-daily-sync
 * Sync program tasks for all active enrollments (called by Vercel Cron every 6 hours)
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

    const today = new Date().toISOString().split('T')[0];

    // Get all active enrollments
    const enrollmentsSnapshot = await adminDb
      .collection('program_enrollments')
      .where('status', '==', 'active')
      .get();

    const enrollments = enrollmentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log(`[CRON_PROGRAMS_SYNC] Found ${enrollments.length} active enrollments`);

    // Group enrollments by userId (user may have multiple enrollments)
    const userIds = [...new Set(enrollments.map(e => e.userId as string))];

    let syncedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process users in batches to avoid overwhelming Firestore
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (userId) => {
        try {
          // Check if user already has program tasks for today
          const existingTasksSnapshot = await adminDb
            .collection('tasks')
            .where('userId', '==', userId)
            .where('date', '==', today)
            .where('source', '==', 'program')
            .limit(1)
            .get();

          if (!existingTasksSnapshot.empty) {
            // User already has program tasks for today, skip
            skippedCount++;
            return;
          }

          // Sync program tasks for this user
          const result = await syncProgramV2TasksForToday(userId);

          if (result && (result.synced > 0 || result.created > 0)) {
            syncedCount++;
            console.log(`[CRON_PROGRAMS_SYNC] Synced tasks for user ${userId}:`, result);
          } else {
            skippedCount++;
          }
        } catch (err) {
          errorCount++;
          const errorMsg = err instanceof Error ? err.message : String(err);
          errors.push(`User ${userId}: ${errorMsg}`);
          console.error(`[CRON_PROGRAMS_SYNC] Error syncing user ${userId}:`, err);
        }
      }));

      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < userIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const duration = Date.now() - startTime;

    console.log(`[CRON_PROGRAMS_SYNC] Completed in ${duration}ms: ${syncedCount} synced, ${skippedCount} skipped, ${errorCount} errors`);

    return NextResponse.json({
      success: true,
      stats: {
        totalEnrollments: enrollments.length,
        uniqueUsers: userIds.length,
        synced: syncedCount,
        skipped: skippedCount,
        errors: errorCount,
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
