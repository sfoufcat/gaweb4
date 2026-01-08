/**
 * Coach API: Clear Future Program Tasks for Client/Cohort
 *
 * POST /api/coach/org-programs/[programId]/clear-tasks
 *
 * Clears all future incomplete program-sourced tasks for a client or cohort.
 * Preserves:
 * - Today's tasks
 * - Completed tasks
 * - Client-locked tasks
 * - Tasks not from the program template
 *
 * Body parameters:
 * - enrollmentId (string): For individual client clear
 * - cohortId (string): For cohort-wide clear
 *
 * One of enrollmentId or cohortId must be provided.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { Program, ProgramEnrollment, ProgramCohort, Task } from '@/types';

interface ClearTasksRequest {
  enrollmentId?: string;
  cohortId?: string;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

/**
 * Clear tasks for a single enrollment
 * Returns count of deleted tasks
 */
async function clearTasksForEnrollment(
  enrollmentId: string,
  userId: string,
  todayDate: string
): Promise<{ deleted: number; errors: string[] }> {
  const errors: string[] = [];
  let deleted = 0;

  try {
    // Query tasks that match our criteria:
    // - Belongs to this enrollment
    // - Source is from program template
    // - Date is in the future (after today)
    const tasksSnapshot = await adminDb
      .collection('tasks')
      .where('userId', '==', userId)
      .where('programEnrollmentId', '==', enrollmentId)
      .where('sourceType', 'in', ['program', 'program_day', 'program_week'])
      .get();

    if (tasksSnapshot.empty) {
      return { deleted: 0, errors: [] };
    }

    // Filter and delete tasks
    const batch = adminDb.batch();
    let batchCount = 0;
    const maxBatchSize = 500;

    for (const doc of tasksSnapshot.docs) {
      const task = doc.data() as Task;

      // Skip if:
      // - Date is today or in the past
      // - Task is already completed
      // - Task is client-locked
      if (!task.date || task.date <= todayDate) {
        continue;
      }
      if (task.status === 'completed') {
        continue;
      }
      if (task.clientLocked === true) {
        continue;
      }

      batch.delete(doc.ref);
      batchCount++;
      deleted++;

      // Firestore batches have a limit of 500 operations
      if (batchCount >= maxBatchSize) {
        await batch.commit();
        batchCount = 0;
      }
    }

    // Commit any remaining deletions
    if (batchCount > 0) {
      await batch.commit();
    }
  } catch (error) {
    errors.push(
      `Enrollment ${enrollmentId}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  return { deleted, errors };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId } = await params;
    const body: ClearTasksRequest = await request.json();

    const { enrollmentId, cohortId } = body;

    // Validate: must have one of enrollmentId or cohortId
    if (!enrollmentId && !cohortId) {
      return NextResponse.json(
        { error: 'Either enrollmentId or cohortId is required' },
        { status: 400 }
      );
    }

    // Fetch and verify the program
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const program = { id: programDoc.id, ...programDoc.data() } as Program;
    if (program.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Program not found in your organization' },
        { status: 404 }
      );
    }

    const todayDate = getTodayDate();

    // Handle individual enrollment clear
    if (enrollmentId) {
      const enrollmentDoc = await adminDb
        .collection('program_enrollments')
        .doc(enrollmentId)
        .get();

      if (!enrollmentDoc.exists) {
        return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
      }

      const enrollment = {
        id: enrollmentDoc.id,
        ...enrollmentDoc.data(),
      } as ProgramEnrollment;

      if (enrollment.programId !== programId) {
        return NextResponse.json(
          { error: 'Enrollment does not belong to this program' },
          { status: 400 }
        );
      }

      console.log(
        `[CLEAR_TASKS] Clearing future tasks for enrollment ${enrollmentId} in program ${programId}`
      );

      const result = await clearTasksForEnrollment(enrollmentId, enrollment.userId, todayDate);

      console.log(`[CLEAR_TASKS] Cleared ${result.deleted} tasks for enrollment ${enrollmentId}`);

      return NextResponse.json({
        success: result.errors.length === 0,
        enrollmentId,
        tasksDeleted: result.deleted,
        message: `Cleared ${result.deleted} future tasks`,
        errors: result.errors.length > 0 ? result.errors : undefined,
      });
    }

    // Handle cohort clear
    if (cohortId) {
      const cohortDoc = await adminDb.collection('program_cohorts').doc(cohortId).get();

      if (!cohortDoc.exists) {
        return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
      }

      const cohort = { id: cohortDoc.id, ...cohortDoc.data() } as ProgramCohort;

      if (cohort.programId !== programId) {
        return NextResponse.json(
          { error: 'Cohort does not belong to this program' },
          { status: 400 }
        );
      }

      // Get all active enrollments for this cohort
      const enrollmentsSnapshot = await adminDb
        .collection('program_enrollments')
        .where('cohortId', '==', cohortId)
        .where('status', 'in', ['active', 'upcoming'])
        .get();

      if (enrollmentsSnapshot.empty) {
        return NextResponse.json({
          success: true,
          cohortId,
          message: 'No active enrollments in cohort',
          membersProcessed: 0,
          totalTasksDeleted: 0,
        });
      }

      const enrollments = enrollmentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ProgramEnrollment[];

      console.log(
        `[CLEAR_TASKS] Clearing future tasks for cohort ${cohortId} with ${enrollments.length} members`
      );

      let totalTasksDeleted = 0;
      let membersProcessed = 0;
      let membersFailed = 0;
      const errors: string[] = [];

      // Process each enrollment
      for (const enrollment of enrollments) {
        const result = await clearTasksForEnrollment(enrollment.id, enrollment.userId, todayDate);
        totalTasksDeleted += result.deleted;

        if (result.errors.length === 0) {
          membersProcessed++;
        } else {
          membersFailed++;
          errors.push(...result.errors);
        }
      }

      console.log(
        `[CLEAR_TASKS] Cohort clear complete: ${membersProcessed} members, ${totalTasksDeleted} tasks deleted`
      );

      return NextResponse.json({
        success: membersFailed === 0,
        cohortId,
        membersProcessed,
        membersFailed,
        totalTasksDeleted,
        message: `Cleared ${totalTasksDeleted} future tasks for ${membersProcessed} members`,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    // Should never reach here
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('[CLEAR_TASKS] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to clear tasks' }, { status: 500 });
  }
}
