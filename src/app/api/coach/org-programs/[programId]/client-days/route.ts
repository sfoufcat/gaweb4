/**
 * Coach API: Client-Specific Program Days Management (for 1:1 Programs)
 *
 * GET /api/coach/org-programs/[programId]/client-days - List client days
 *   Query params:
 *   - enrollmentId: Required - Filter by specific enrollment
 *   - dayIndex: Optional - Filter by specific day index
 *
 * POST /api/coach/org-programs/[programId]/client-days - Create/update client day (upsert)
 *   Body: { enrollmentId: string, dayIndex: number, ...dayData }
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import { syncProgramTasksToClientDay, calculateDateForProgramDay, getProgramV2 } from '@/lib/program-engine';
import type { ClientProgramDay, ProgramEnrollment, ProgramCohort, ProgramTaskTemplate } from '@/types';

/**
 * Process tasks to ensure each has a unique ID for robust matching.
 * Preserves existing IDs, generates new UUIDs for tasks without IDs.
 */
function processTasksWithIds(tasks: ProgramTaskTemplate[] | undefined): ProgramTaskTemplate[] {
  if (!tasks || !Array.isArray(tasks)) return [];
  return tasks.map((task) => ({
    ...task,
    id: task.id || crypto.randomUUID(),
  }));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId } = await params;

    // Verify program exists and belongs to this org
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }
    const program = programDoc.data();
    if (program?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    // This API is only for individual programs
    if (program?.type !== 'individual') {
      return NextResponse.json({ error: 'Client days are only available for individual programs' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const enrollmentId = searchParams.get('enrollmentId');
    const dayIndex = searchParams.get('dayIndex');

    if (!enrollmentId) {
      return NextResponse.json({ error: 'enrollmentId query parameter is required' }, { status: 400 });
    }

    let query = adminDb
      .collection('client_program_days')
      .where('programId', '==', programId)
      .where('enrollmentId', '==', enrollmentId);

    if (dayIndex) {
      query = query.where('dayIndex', '==', parseInt(dayIndex, 10));
    }

    const daysSnapshot = await query.orderBy('dayIndex', 'asc').get();

    const days = daysSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
      lastSyncedAt: doc.data().lastSyncedAt?.toDate?.()?.toISOString?.() || doc.data().lastSyncedAt,
    })) as ClientProgramDay[];

    // Fetch enrollment and program data to calculate dates and get completion status
    const enrollmentDoc = await adminDb.collection('program_enrollments').doc(enrollmentId).get();
    if (enrollmentDoc.exists && days.length > 0) {
      const enrollment = { id: enrollmentDoc.id, ...enrollmentDoc.data() } as ProgramEnrollment;
      const programData = await getProgramV2(programId);

      if (programData) {
        // Get cohort if applicable
        let cohort: ProgramCohort | null = null;
        if (enrollment.cohortId) {
          const cohortDoc = await adminDb.collection('program_cohorts').doc(enrollment.cohortId).get();
          if (cohortDoc.exists) {
            cohort = { id: cohortDoc.id, ...cohortDoc.data() } as ProgramCohort;
          }
        }

        // For each day, calculate the date and fetch user's tasks to get completion status
        for (const day of days) {
          const dateForDay = calculateDateForProgramDay(enrollment, programData, cohort, day.dayIndex);
          if (!dateForDay) continue;

          // Fetch user's tasks for this date
          const userTasksSnapshot = await adminDb
            .collection('tasks')
            .where('userId', '==', enrollment.userId)
            .where('date', '==', dateForDay)
            .get();

          const userTasks = userTasksSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

          // Merge completion status into template tasks
          if (day.tasks && Array.isArray(day.tasks)) {
            day.tasks = day.tasks.map(template => {
              const actualTask = userTasks.find(t => (t as { title?: string }).title === template.label);
              if (actualTask) {
                return {
                  ...template,
                  completed: (actualTask as { status?: string }).status === 'completed',
                  completedAt: (actualTask as { completedAt?: string }).completedAt,
                  taskId: actualTask.id,
                };
              }
              return template;
            });
          }
        }
      }
    }

    return NextResponse.json({
      clientDays: days,
      total: days.length,
    });
  } catch (error) {
    console.error('[COACH_CLIENT_DAYS_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch client days' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { organizationId, userId: coachUserId } = await requireCoachWithOrg();
    const { programId } = await params;
    const body = await request.json();
    const { enrollmentId, dayIndex, ...dayData } = body;

    if (!enrollmentId) {
      return NextResponse.json({ error: 'enrollmentId is required' }, { status: 400 });
    }
    if (dayIndex === undefined || dayIndex === null) {
      return NextResponse.json({ error: 'dayIndex is required' }, { status: 400 });
    }

    // Verify program exists, belongs to this org, and is an individual program
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }
    const program = programDoc.data();
    if (program?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }
    if (program?.type !== 'individual') {
      return NextResponse.json({ error: 'Client days are only available for individual programs' }, { status: 400 });
    }

    // Verify enrollment exists and belongs to this program
    const enrollmentDoc = await adminDb.collection('program_enrollments').doc(enrollmentId).get();
    if (!enrollmentDoc.exists) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }
    const enrollment = enrollmentDoc.data() as ProgramEnrollment;
    if (enrollment.programId !== programId) {
      return NextResponse.json({ error: 'Enrollment does not belong to this program' }, { status: 400 });
    }

    const now = FieldValue.serverTimestamp();

    // Check if client day already exists for this enrollment + dayIndex
    const existingDaySnapshot = await adminDb
      .collection('client_program_days')
      .where('enrollmentId', '==', enrollmentId)
      .where('dayIndex', '==', dayIndex)
      .limit(1)
      .get();

    if (!existingDaySnapshot.empty) {
      // Update existing client day
      const existingDoc = existingDaySnapshot.docs[0];

      // Ensure tasks have IDs for robust matching
      const processedTasks = dayData.tasks !== undefined
        ? processTasksWithIds(dayData.tasks)
        : undefined;

      const updateData = {
        ...dayData,
        ...(processedTasks !== undefined && { tasks: processedTasks }),
        hasLocalChanges: true,
        updatedAt: now,
      };

      await existingDoc.ref.update(updateData);

      const updatedDoc = await existingDoc.ref.get();
      const updatedDay = {
        id: updatedDoc.id,
        ...updatedDoc.data(),
        createdAt: updatedDoc.data()?.createdAt?.toDate?.()?.toISOString?.() || updatedDoc.data()?.createdAt,
        updatedAt: updatedDoc.data()?.updatedAt?.toDate?.()?.toISOString?.() || updatedDoc.data()?.updatedAt,
        lastSyncedAt: updatedDoc.data()?.lastSyncedAt?.toDate?.()?.toISOString?.() || updatedDoc.data()?.lastSyncedAt,
      } as ClientProgramDay;

      console.log(`[COACH_CLIENT_DAYS_POST] Updated client day for enrollment ${enrollmentId}, dayIndex ${dayIndex}`);

      // 2-way sync: If tasks were updated, immediately sync to client's Daily Focus
      let syncResult = null;
      if (dayData.tasks !== undefined) {
        try {
          const programData = await getProgramV2(programId);
          if (programData) {
            // Get cohort if applicable
            let cohort: ProgramCohort | null = null;
            if (enrollment.cohortId) {
              const cohortDoc = await adminDb.collection('program_cohorts').doc(enrollment.cohortId).get();
              if (cohortDoc.exists) {
                cohort = { id: cohortDoc.id, ...cohortDoc.data() } as ProgramCohort;
              }
            }

            // Calculate the date for this day index
            const dateForDay = calculateDateForProgramDay(
              { ...enrollment, id: enrollmentId } as ProgramEnrollment,
              programData,
              cohort,
              dayIndex
            );

            if (dateForDay) {
              console.log(`[COACH_CLIENT_DAYS_POST] Syncing dayIndex=${dayIndex} to date=${dateForDay} for user=${enrollment.userId}`);
              syncResult = await syncProgramTasksToClientDay({
                userId: enrollment.userId,
                programEnrollmentId: enrollmentId,
                date: dateForDay,
                mode: 'override-program-sourced',
                coachUserId,
                forceDayIndex: dayIndex,
              });
              console.log(`[COACH_CLIENT_DAYS_POST] Sync result: ${JSON.stringify(syncResult)}`);
            }
          }
        } catch (syncErr) {
          console.error('[COACH_CLIENT_DAYS_POST] Failed to sync tasks to client:', syncErr);
          // Don't fail the whole request, just log the error
        }
      }

      return NextResponse.json({
        success: true,
        clientDay: updatedDay,
        created: false,
        ...(syncResult && { clientSync: syncResult }),
      });
    }

    // Find the template day to get programDayId
    const templateDaySnapshot = await adminDb
      .collection('program_days')
      .where('programId', '==', programId)
      .where('dayIndex', '==', dayIndex)
      .limit(1)
      .get();

    const templateDay = templateDaySnapshot.empty ? null : templateDaySnapshot.docs[0];

    // Create new client day
    const clientDayRef = adminDb.collection('client_program_days').doc();
    const clientDayData = {
      enrollmentId,
      programDayId: templateDay?.id || null,
      programId,
      organizationId,
      userId: enrollment.userId,
      dayIndex,

      // Content from request - ensure tasks have IDs for robust matching
      title: dayData.title || undefined,
      summary: dayData.summary || undefined,
      dailyPrompt: dayData.dailyPrompt || undefined,
      tasks: processTasksWithIds(dayData.tasks),
      habits: dayData.habits || [],
      courseAssignments: dayData.courseAssignments || [],
      fillSource: dayData.fillSource || undefined,
      weekId: dayData.weekId || undefined,

      // Sync tracking
      hasLocalChanges: true,
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await clientDayRef.set(clientDayData);

    const createdDoc = await clientDayRef.get();
    const createdDay = {
      id: createdDoc.id,
      ...createdDoc.data(),
      createdAt: createdDoc.data()?.createdAt?.toDate?.()?.toISOString?.() || createdDoc.data()?.createdAt,
      updatedAt: createdDoc.data()?.updatedAt?.toDate?.()?.toISOString?.() || createdDoc.data()?.updatedAt,
      lastSyncedAt: createdDoc.data()?.lastSyncedAt?.toDate?.()?.toISOString?.() || createdDoc.data()?.lastSyncedAt,
    } as ClientProgramDay;

    console.log(`[COACH_CLIENT_DAYS_POST] Created client day ${clientDayRef.id} for enrollment ${enrollmentId}, dayIndex ${dayIndex}`);

    // 2-way sync: If tasks were created, immediately sync to client's Daily Focus
    let syncResult = null;
    if (dayData.tasks !== undefined && dayData.tasks.length > 0) {
      try {
        const programData = await getProgramV2(programId);
        if (programData) {
          // Get cohort if applicable
          let cohort: ProgramCohort | null = null;
          if (enrollment.cohortId) {
            const cohortDoc = await adminDb.collection('program_cohorts').doc(enrollment.cohortId).get();
            if (cohortDoc.exists) {
              cohort = { id: cohortDoc.id, ...cohortDoc.data() } as ProgramCohort;
            }
          }

          // Calculate the date for this day index
          const dateForDay = calculateDateForProgramDay(
            { ...enrollment, id: enrollmentId } as ProgramEnrollment,
            programData,
            cohort,
            dayIndex
          );

          if (dateForDay) {
            console.log(`[COACH_CLIENT_DAYS_POST] Syncing new dayIndex=${dayIndex} to date=${dateForDay} for user=${enrollment.userId}`);
            syncResult = await syncProgramTasksToClientDay({
              userId: enrollment.userId,
              programEnrollmentId: enrollmentId,
              date: dateForDay,
              mode: 'override-program-sourced',
              coachUserId,
              forceDayIndex: dayIndex,
            });
            console.log(`[COACH_CLIENT_DAYS_POST] Sync result: ${JSON.stringify(syncResult)}`);
          }
        }
      } catch (syncErr) {
        console.error('[COACH_CLIENT_DAYS_POST] Failed to sync tasks to client:', syncErr);
        // Don't fail the whole request, just log the error
      }
    }

    return NextResponse.json({
      success: true,
      clientDay: createdDay,
      created: true,
      ...(syncResult && { clientSync: syncResult }),
    });
  } catch (error) {
    console.error('[COACH_CLIENT_DAYS_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to save client day' }, { status: 500 });
  }
}
