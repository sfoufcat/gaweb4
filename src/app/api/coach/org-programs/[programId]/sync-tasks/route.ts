/**
 * Coach API: Sync Program Tasks to Client/Cohort
 *
 * POST /api/coach/org-programs/[programId]/sync-tasks
 *
 * Syncs program tasks from the template to a client's Daily Focus or
 * to all members of a cohort. Only syncs from today onwards.
 *
 * Body parameters:
 * - enrollmentId (string): For individual client sync
 * - cohortId (string): For cohort-wide sync
 *
 * One of enrollmentId or cohortId must be provided.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { syncProgramTasksFromCurrentDay } from '@/lib/program-engine';
import type { Program, ProgramEnrollment, ProgramCohort } from '@/types';

interface SyncTasksRequest {
  enrollmentId?: string;
  cohortId?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { organizationId, userId: coachUserId } = await requireCoachWithOrg();
    const { programId } = await params;
    const body: SyncTasksRequest = await request.json();

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

    // Handle individual enrollment sync
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
        `[SYNC_TASKS] Syncing tasks for enrollment ${enrollmentId} in program ${programId}`
      );

      const result = await syncProgramTasksFromCurrentDay({
        userId: enrollment.userId,
        enrollmentId,
        mode: 'fill-empty',
        coachUserId,
      });

      if (!result.success) {
        return NextResponse.json(
          { error: 'Failed to sync tasks', details: result.errors },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        enrollmentId,
        tasksCreated: result.tasksCreated,
        tasksSkipped: result.tasksSkipped,
        daysProcessed: result.daysProcessed,
        totalDays: result.totalDays,
        message: `Synced ${result.tasksCreated} tasks for ${result.daysProcessed} days`,
      });
    }

    // Handle cohort sync
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
          totalTasksCreated: 0,
        });
      }

      const enrollments = enrollmentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ProgramEnrollment[];

      console.log(
        `[SYNC_TASKS] Syncing tasks for cohort ${cohortId} with ${enrollments.length} members`
      );

      let totalTasksCreated = 0;
      let totalTasksSkipped = 0;
      let membersProcessed = 0;
      let membersFailed = 0;
      const errors: string[] = [];

      // Process each enrollment
      for (const enrollment of enrollments) {
        try {
          const result = await syncProgramTasksFromCurrentDay({
            userId: enrollment.userId,
            enrollmentId: enrollment.id,
            mode: 'fill-empty',
            coachUserId,
          });

          if (result.success) {
            totalTasksCreated += result.tasksCreated;
            totalTasksSkipped += result.tasksSkipped;
            membersProcessed++;
          } else {
            membersFailed++;
            errors.push(`Enrollment ${enrollment.id}: ${result.errors.join(', ')}`);
          }
        } catch (error) {
          membersFailed++;
          errors.push(
            `Enrollment ${enrollment.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      console.log(
        `[SYNC_TASKS] Cohort sync complete: ${membersProcessed} members, ${totalTasksCreated} tasks created`
      );

      return NextResponse.json({
        success: membersFailed === 0,
        cohortId,
        membersProcessed,
        membersFailed,
        totalTasksCreated,
        totalTasksSkipped,
        message: `Synced ${totalTasksCreated} tasks for ${membersProcessed} members`,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    // Should never reach here
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('[SYNC_TASKS] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to sync tasks' }, { status: 500 });
  }
}
