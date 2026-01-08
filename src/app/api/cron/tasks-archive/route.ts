import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Task } from '@/types';

/**
 * GET/POST /api/cron/tasks-archive
 *
 * Cron job for task archive lifecycle:
 *
 * Phase 1: Auto-archive stale backlog tasks
 * - Tasks in backlog for 7+ days are archived
 * - Sets status='archived', archivedAt, scheduledDeleteAt (30 days out)
 * - Program-sourced tasks get clientLocked=true
 *
 * Phase 2: Permanently delete old archived tasks
 * - Tasks archived for 30+ days are permanently deleted
 *
 * Should run daily at 3 AM UTC: "0 3 * * *"
 *
 * Security: Protected by CRON_SECRET header.
 */

const STALE_DAYS = 7;      // Archive after 7 days in backlog
const DELETE_DAYS = 30;    // Delete 30 days after archive
const BATCH_SIZE = 100;
const MAX_BATCHES = 10;    // Safety limit per phase

export async function GET(request: NextRequest) {
  return handleCronRequest(request);
}

export async function POST(request: NextRequest) {
  return handleCronRequest(request);
}

async function handleCronRequest(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Validate cron secret (Vercel sends Authorization: Bearer <CRON_SECRET>)
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON_TASKS_ARCHIVE] Starting task archive/cleanup job...');

    const now = new Date();
    const nowISO = now.toISOString();

    // Threshold: tasks moved to backlog more than 7 days ago
    const archiveThreshold = new Date(now.getTime() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    // 30 days from now for scheduled deletion
    const scheduledDeleteAt = new Date(now.getTime() + DELETE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    let totalArchived = 0;
    let totalDeleted = 0;
    const errors: string[] = [];

    // ============================================
    // PHASE 1: Auto-archive stale backlog tasks
    // ============================================
    console.log(`[CRON_TASKS_ARCHIVE] Phase 1: Archiving tasks in backlog > ${STALE_DAYS} days...`);
    console.log(`[CRON_TASKS_ARCHIVE] Archive threshold: ${archiveThreshold}`);

    let archiveBatchCount = 0;
    while (archiveBatchCount < MAX_BATCHES) {
      try {
        // Query for stale backlog tasks
        // Note: Tasks without movedToBacklogAt will use createdAt fallback below
        const staleTasksSnapshot = await adminDb
          .collection('tasks')
          .where('status', '==', 'pending')
          .where('listType', '==', 'backlog')
          .where('movedToBacklogAt', '<=', archiveThreshold)
          .limit(BATCH_SIZE)
          .get();

        if (staleTasksSnapshot.empty) {
          console.log('[CRON_TASKS_ARCHIVE] No more stale tasks to archive');
          break;
        }

        const batch = adminDb.batch();
        let batchCount = 0;

        staleTasksSnapshot.forEach((doc) => {
          const task = doc.data() as Task;

          // Check if this is a program-sourced task
          const isProgramSourced = task.sourceType &&
            ['program', 'program_day', 'program_week', 'coach_manual'].includes(task.sourceType);

          batch.update(doc.ref, {
            status: 'archived',
            archivedAt: nowISO,
            scheduledDeleteAt,
            updatedAt: nowISO,
            // CRITICAL: Lock program tasks to prevent sync interference
            ...(isProgramSourced && !task.clientLocked ? { clientLocked: true } : {}),
          });
          batchCount++;
        });

        await batch.commit();
        totalArchived += batchCount;
        archiveBatchCount++;

        console.log(`[CRON_TASKS_ARCHIVE] Archived batch ${archiveBatchCount}: ${batchCount} tasks`);

        // If we got fewer than BATCH_SIZE, we're done with this phase
        if (batchCount < BATCH_SIZE) {
          break;
        }
      } catch (archiveError) {
        const errorMsg = archiveError instanceof Error ? archiveError.message : String(archiveError);
        console.error(`[CRON_TASKS_ARCHIVE] Archive batch ${archiveBatchCount + 1} failed:`, errorMsg);
        errors.push(`Archive batch failed: ${errorMsg}`);

        // If it's an index error, log helpful info but continue to phase 2
        if (errorMsg.includes('index')) {
          console.error('[CRON_TASKS_ARCHIVE] Missing Firestore composite index for archive query.');
          console.error('[CRON_TASKS_ARCHIVE] Required index: tasks(status ASC, listType ASC, movedToBacklogAt ASC)');
        }
        break;
      }
    }

    // ============================================
    // PHASE 2: Permanently delete old archived tasks
    // ============================================
    console.log(`[CRON_TASKS_ARCHIVE] Phase 2: Deleting tasks archived > ${DELETE_DAYS} days ago...`);

    let deleteBatchCount = 0;
    while (deleteBatchCount < MAX_BATCHES) {
      try {
        // Query for archived tasks past their scheduled deletion date
        const oldArchivedSnapshot = await adminDb
          .collection('tasks')
          .where('status', '==', 'archived')
          .where('scheduledDeleteAt', '<=', nowISO)
          .limit(BATCH_SIZE)
          .get();

        if (oldArchivedSnapshot.empty) {
          console.log('[CRON_TASKS_ARCHIVE] No more archived tasks to delete');
          break;
        }

        const batch = adminDb.batch();
        let batchCount = 0;

        oldArchivedSnapshot.forEach((doc) => {
          batch.delete(doc.ref);
          batchCount++;
        });

        await batch.commit();
        totalDeleted += batchCount;
        deleteBatchCount++;

        console.log(`[CRON_TASKS_ARCHIVE] Deleted batch ${deleteBatchCount}: ${batchCount} tasks`);

        // If we got fewer than BATCH_SIZE, we're done
        if (batchCount < BATCH_SIZE) {
          break;
        }
      } catch (deleteError) {
        const errorMsg = deleteError instanceof Error ? deleteError.message : String(deleteError);
        console.error(`[CRON_TASKS_ARCHIVE] Delete batch ${deleteBatchCount + 1} failed:`, errorMsg);
        errors.push(`Delete batch failed: ${errorMsg}`);

        // If it's an index error, log helpful info
        if (errorMsg.includes('index')) {
          console.error('[CRON_TASKS_ARCHIVE] Missing Firestore composite index for delete query.');
          console.error('[CRON_TASKS_ARCHIVE] Required index: tasks(status ASC, scheduledDeleteAt ASC)');
        }
        break;
      }
    }

    const duration = Date.now() - startTime;

    console.log(`[CRON_TASKS_ARCHIVE] Completed. Archived: ${totalArchived}, Deleted: ${totalDeleted}, Duration: ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: 'Task archive cron completed',
      stats: {
        archived: totalArchived,
        deleted: totalDeleted,
        archiveBatches: archiveBatchCount,
        deleteBatches: deleteBatchCount,
      },
      duration: `${duration}ms`,
      timestamp: nowISO,
      ...(errors.length > 0 && { errors: errors.slice(0, 10) }),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[CRON_TASKS_ARCHIVE] Fatal error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`,
      },
      { status: 500 }
    );
  }
}
