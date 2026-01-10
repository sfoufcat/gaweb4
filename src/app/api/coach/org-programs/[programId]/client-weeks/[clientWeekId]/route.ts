/**
 * Coach API: Individual Client Week Management
 *
 * GET /api/coach/org-programs/[programId]/client-weeks/[clientWeekId] - Get a client week
 * PATCH /api/coach/org-programs/[programId]/client-weeks/[clientWeekId] - Update a client week
 * DELETE /api/coach/org-programs/[programId]/client-weeks/[clientWeekId] - Delete a client week
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import { syncProgramTasksToClientDay, calculateDateForProgramDay } from '@/lib/program-engine';
import { distributeClientWeeklyTasksToDays } from '@/lib/program-utils';
import type { ClientProgramWeek, Program, ProgramEnrollment } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; clientWeekId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, clientWeekId } = await params;

    // Verify program exists and belongs to this org
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists || programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const clientWeekDoc = await adminDb.collection('client_program_weeks').doc(clientWeekId).get();
    if (!clientWeekDoc.exists || clientWeekDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Client week not found' }, { status: 404 });
    }

    const clientWeek = {
      id: clientWeekDoc.id,
      ...clientWeekDoc.data(),
      createdAt: clientWeekDoc.data()?.createdAt?.toDate?.()?.toISOString?.() || clientWeekDoc.data()?.createdAt,
      updatedAt: clientWeekDoc.data()?.updatedAt?.toDate?.()?.toISOString?.() || clientWeekDoc.data()?.updatedAt,
      lastSyncedAt: clientWeekDoc.data()?.lastSyncedAt?.toDate?.()?.toISOString?.() || clientWeekDoc.data()?.lastSyncedAt,
    } as ClientProgramWeek;

    // Merge completion status from actual user tasks into weeklyTasks
    // This allows the week view to show which weekly tasks have been completed
    if (clientWeek.weeklyTasks && clientWeek.weeklyTasks.length > 0 &&
        clientWeek.enrollmentId && clientWeek.startDayIndex !== undefined && clientWeek.endDayIndex !== undefined) {
      // Fetch user's tasks for this week's day range
      const userTasksSnapshot = await adminDb
        .collection('tasks')
        .where('programEnrollmentId', '==', clientWeek.enrollmentId)
        .where('programDayIndex', '>=', clientWeek.startDayIndex)
        .where('programDayIndex', '<=', clientWeek.endDayIndex)
        .get();

      const userTasks = userTasksSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      // Merge completion status into weeklyTasks
      // Use programTaskId for robust matching (survives renames), fallback to title
      clientWeek.weeklyTasks = clientWeek.weeklyTasks.map(template => {
        const actualTask = userTasks.find(t => {
          const task = t as { title?: string; programTaskId?: string };
          // Prefer programTaskId matching (robust, survives renames)
          if (template.id && task.programTaskId) {
            return task.programTaskId === template.id;
          }
          // Fallback to title matching for backward compatibility
          return task.title === template.label;
        });
        if (actualTask) {
          const taskStatus = (actualTask as { status?: string }).status;
          const clientLocked = (actualTask as { clientLocked?: boolean }).clientLocked;
          const isDeleted = taskStatus === 'deleted';
          return {
            ...template,
            completed: taskStatus === 'completed',
            completedAt: (actualTask as { completedAt?: string }).completedAt,
            taskId: actualTask.id,
            deletedByClient: isDeleted,
            editedByClient: clientLocked && !isDeleted || undefined,
          };
        }
        // No matching task found - return template without completion data
        return template;
      });
    }

    return NextResponse.json({ clientWeek });
  } catch (error) {
    console.error('[COACH_CLIENT_WEEK_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch client week' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; clientWeekId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, clientWeekId } = await params;
    const body = await request.json();

    // DEBUG: Log incoming request
    console.log(`[COACH_CLIENT_WEEK_PATCH] Request received:`, {
      programId,
      clientWeekId,
      distributeTasksNow: body.distributeTasksNow,
      overwriteExisting: body.overwriteExisting,
      syncToClient: body.syncToClient,
      distribution: body.distribution,
      weeklyTasksProvided: body.weeklyTasks !== undefined,
      weeklyTasksCount: body.weeklyTasks?.length ?? 0,
    });

    // Verify program exists and belongs to this org
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists || programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }
    const programData = programDoc.data();

    const clientWeekDoc = await adminDb.collection('client_program_weeks').doc(clientWeekId).get();
    if (!clientWeekDoc.exists || clientWeekDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Client week not found' }, { status: 404 });
    }
    const existingClientWeek = clientWeekDoc.data();

    // Build update object (only include provided fields)
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      hasLocalChanges: true, // Mark as having local changes
    };

    // Content fields
    if (body.name !== undefined) updateData.name = body.name?.trim() || null;
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.theme !== undefined) updateData.theme = body.theme?.trim() || null;
    if (body.weeklyPrompt !== undefined) updateData.weeklyPrompt = body.weeklyPrompt?.trim() || null;
    if (body.weeklyTasks !== undefined) updateData.weeklyTasks = body.weeklyTasks || null;
    if (body.weeklyHabits !== undefined) updateData.weeklyHabits = body.weeklyHabits || null;
    if (body.currentFocus !== undefined) updateData.currentFocus = body.currentFocus || null;
    if (body.notes !== undefined) updateData.notes = body.notes || null;
    if (body.distribution !== undefined) updateData.distribution = body.distribution || 'spread';

    // Client-specific fields
    if (body.linkedSummaryIds !== undefined) updateData.linkedSummaryIds = body.linkedSummaryIds || [];
    if (body.linkedCallEventIds !== undefined) updateData.linkedCallEventIds = body.linkedCallEventIds || [];
    if (body.manualNotes !== undefined) updateData.manualNotes = body.manualNotes?.trim() || null;
    if (body.coachRecordingUrl !== undefined) updateData.coachRecordingUrl = body.coachRecordingUrl?.trim() || null;
    if (body.coachRecordingNotes !== undefined) updateData.coachRecordingNotes = body.coachRecordingNotes?.trim() || null;
    if (body.fillSource !== undefined) updateData.fillSource = body.fillSource || null;

    // Note: We don't allow updating positional fields (weekNumber, moduleId, order, etc.)
    // Those come from the template and are only updated via sync

    await adminDb.collection('client_program_weeks').doc(clientWeekId).update(updateData);
    console.log(`[COACH_CLIENT_WEEK_PATCH] Updated client week ${clientWeekId}`);

    // Fetch the updated week
    const savedDoc = await adminDb.collection('client_program_weeks').doc(clientWeekId).get();
    const savedWeek = {
      id: savedDoc.id,
      ...savedDoc.data(),
      createdAt: savedDoc.data()?.createdAt?.toDate?.()?.toISOString?.() || savedDoc.data()?.createdAt,
      updatedAt: savedDoc.data()?.updatedAt?.toDate?.()?.toISOString?.() || savedDoc.data()?.updatedAt,
      lastSyncedAt: savedDoc.data()?.lastSyncedAt?.toDate?.()?.toISOString?.() || savedDoc.data()?.lastSyncedAt,
    } as ClientProgramWeek;

    // Distribute tasks to client days if requested
    // Note: We run distribution even with empty tasks to clear week-sourced tasks from days
    let distributionResult = null;
    const clientWeekData = savedDoc.data() as ClientProgramWeek;
    const enrollmentId = clientWeekData.enrollmentId;
    
    console.log(`[COACH_CLIENT_WEEK_PATCH] Distribution check:`, {
      distributeTasksNow: body.distributeTasksNow,
      enrollmentId,
      savedWeekDistribution: clientWeekData.distribution,
      programTaskDistribution: programData?.taskDistribution,
      weeklyTasksCount: clientWeekData.weeklyTasks?.length ?? 0,
    });
    
    if (body.distributeTasksNow === true) {
      try {
        if (enrollmentId) {
          console.log(`[COACH_CLIENT_WEEK_PATCH] Calling distributeClientWeeklyTasksToDays...`);
          distributionResult = await distributeClientWeeklyTasksToDays(
            programId,
            clientWeekId,
            enrollmentId,
            {
              overwriteExisting: body.overwriteExisting || false,
              programTaskDistribution: programData?.taskDistribution,
            }
          );
          console.log(`[COACH_CLIENT_WEEK_PATCH] Distribution result: ${JSON.stringify(distributionResult)}`);
        } else {
          console.warn(`[COACH_CLIENT_WEEK_PATCH] No enrollmentId found, skipping distribution`);
        }
      } catch (distErr) {
        console.error('[COACH_CLIENT_WEEK_PATCH] Failed to distribute tasks:', distErr);
      }
    } else {
      console.log(`[COACH_CLIENT_WEEK_PATCH] Skipping distribution (distributeTasksNow=${body.distributeTasksNow})`);
    }

    // Sync the specific days of the edited week to client's tasks collection
    // This ensures tasks appear in the client's Daily Focus regardless of which week is being edited
    let syncResult: { tasksCreated: number; errors: string[] } | null = null;
    const shouldSync = distributionResult && body.syncToClient !== false;

    console.log(`[COACH_CLIENT_WEEK_PATCH] Sync check:`, {
      shouldSync,
      hasDistributionResult: !!distributionResult,
      syncToClient: body.syncToClient,
      startDayIndex: clientWeekData.startDayIndex,
      endDayIndex: clientWeekData.endDayIndex,
    });

    if (shouldSync) {
      try {
        const { startDayIndex, endDayIndex } = clientWeekData;
        if (enrollmentId && startDayIndex !== undefined && endDayIndex !== undefined) {
          console.log(`[COACH_CLIENT_WEEK_PATCH] Syncing days ${startDayIndex}-${endDayIndex} to client tasks...`);
          const { userId: coachUserId } = await requireCoachWithOrg();

          // Get enrollment details for date calculation
          const enrollmentDoc = await adminDb.collection('program_enrollments').doc(enrollmentId).get();
          const enrollment = { id: enrollmentDoc.id, ...enrollmentDoc.data() } as ProgramEnrollment;

          let totalTasksCreated = 0;
          const errors: string[] = [];

          // Sync each day in the week (only today and past days - cron handles future)
          const today = new Date().toISOString().split('T')[0];
          
          for (let dayIndex = startDayIndex; dayIndex <= endDayIndex; dayIndex++) {
            // Calculate the calendar date for this dayIndex
            const dateForDay = calculateDateForProgramDay(
              enrollment,
              programData as Program,
              null, // No cohort for 1:1 programs
              dayIndex
            );

            if (!dateForDay) {
              console.warn(`[COACH_CLIENT_WEEK_PATCH] Could not calculate date for day ${dayIndex}`);
              continue;
            }

            // Skip future days - cron will create tasks when those days arrive
            if (dateForDay > today) {
              console.log(`[COACH_CLIENT_WEEK_PATCH] Skipping future day ${dayIndex} (${dateForDay}) - cron will handle`);
              continue;
            }

            const result = await syncProgramTasksToClientDay({
              userId: enrollment.userId,
              programEnrollmentId: enrollmentId,
              date: dateForDay,
              mode: 'override-program-sourced',
              coachUserId,
              forceDayIndex: dayIndex,
            });

            totalTasksCreated += result.tasksCreated;
            if (result.errors) {
              errors.push(...result.errors);
            }
          }

          syncResult = { tasksCreated: totalTasksCreated, errors };
          console.log(`[COACH_CLIENT_WEEK_PATCH] Sync complete: ${totalTasksCreated} tasks created for days ${startDayIndex}-${endDayIndex}`);
        } else {
          console.warn(`[COACH_CLIENT_WEEK_PATCH] Missing enrollmentId or day indices, skipping sync`);
        }
      } catch (syncErr) {
        console.error('[COACH_CLIENT_WEEK_PATCH] Failed to sync tasks to client:', syncErr);
        // Don't fail the whole request, just log the error
      }
    } else {
      console.log(`[COACH_CLIENT_WEEK_PATCH] Skipping sync (shouldSync=${shouldSync})`);
    }

    return NextResponse.json({
      success: true,
      clientWeek: savedWeek,
      message: 'Client week updated successfully',
      ...(distributionResult && { distribution: distributionResult }),
      ...(syncResult && { clientSync: syncResult }),
    });
  } catch (error) {
    console.error('[COACH_CLIENT_WEEK_PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to update client week' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; clientWeekId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, clientWeekId } = await params;

    // Verify program exists and belongs to this org
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists || programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const clientWeekDoc = await adminDb.collection('client_program_weeks').doc(clientWeekId).get();
    if (!clientWeekDoc.exists || clientWeekDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Client week not found' }, { status: 404 });
    }

    // Delete the client week
    await adminDb.collection('client_program_weeks').doc(clientWeekId).delete();
    console.log(`[COACH_CLIENT_WEEK_DELETE] Deleted client week ${clientWeekId}`);

    return NextResponse.json({
      success: true,
      message: 'Client week deleted successfully',
    });
  } catch (error) {
    console.error('[COACH_CLIENT_WEEK_DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to delete client week' }, { status: 500 });
  }
}
