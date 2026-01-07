/**
 * Coach API: Individual Client Day Management
 *
 * GET /api/coach/org-programs/[programId]/client-days/[clientDayId] - Get a client day
 * PATCH /api/coach/org-programs/[programId]/client-days/[clientDayId] - Update a client day
 * DELETE /api/coach/org-programs/[programId]/client-days/[clientDayId] - Delete a client day
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import { syncProgramTasksToClientDay, calculateDateForProgramDay, getProgramV2 } from '@/lib/program-engine';
import type { ClientProgramDay, ProgramEnrollment, ProgramCohort } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; clientDayId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, clientDayId } = await params;

    // Verify program exists and belongs to this org
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists || programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const clientDayDoc = await adminDb.collection('client_program_days').doc(clientDayId).get();
    if (!clientDayDoc.exists || clientDayDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Client day not found' }, { status: 404 });
    }

    const clientDay = {
      id: clientDayDoc.id,
      ...clientDayDoc.data(),
      createdAt: clientDayDoc.data()?.createdAt?.toDate?.()?.toISOString?.() || clientDayDoc.data()?.createdAt,
      updatedAt: clientDayDoc.data()?.updatedAt?.toDate?.()?.toISOString?.() || clientDayDoc.data()?.updatedAt,
      lastSyncedAt: clientDayDoc.data()?.lastSyncedAt?.toDate?.()?.toISOString?.() || clientDayDoc.data()?.lastSyncedAt,
    } as ClientProgramDay;

    return NextResponse.json({ clientDay });
  } catch (error) {
    console.error('[COACH_CLIENT_DAY_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch client day' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; clientDayId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, clientDayId } = await params;
    const body = await request.json();

    // Verify program exists and belongs to this org
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists || programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const clientDayDoc = await adminDb.collection('client_program_days').doc(clientDayId).get();
    if (!clientDayDoc.exists || clientDayDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Client day not found' }, { status: 404 });
    }

    // Build update object (only include provided fields)
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      hasLocalChanges: true, // Mark as having local changes
    };

    // Content fields
    if (body.title !== undefined) updateData.title = body.title?.trim() || null;
    if (body.summary !== undefined) updateData.summary = body.summary?.trim() || null;
    if (body.dailyPrompt !== undefined) updateData.dailyPrompt = body.dailyPrompt?.trim() || null;
    if (body.tasks !== undefined) updateData.tasks = body.tasks || [];
    if (body.habits !== undefined) updateData.habits = body.habits || [];
    if (body.courseAssignments !== undefined) updateData.courseAssignments = body.courseAssignments || [];
    if (body.fillSource !== undefined) updateData.fillSource = body.fillSource || null;
    if (body.weekId !== undefined) updateData.weekId = body.weekId || null;

    // Note: We don't allow updating positional fields (dayIndex)
    // Those come from the template

    await adminDb.collection('client_program_days').doc(clientDayId).update(updateData);
    console.log(`[COACH_CLIENT_DAY_PATCH] Updated client day ${clientDayId}`);

    // Fetch the updated day
    const savedDoc = await adminDb.collection('client_program_days').doc(clientDayId).get();
    const savedDay = {
      id: savedDoc.id,
      ...savedDoc.data(),
      createdAt: savedDoc.data()?.createdAt?.toDate?.()?.toISOString?.() || savedDoc.data()?.createdAt,
      updatedAt: savedDoc.data()?.updatedAt?.toDate?.()?.toISOString?.() || savedDoc.data()?.updatedAt,
      lastSyncedAt: savedDoc.data()?.lastSyncedAt?.toDate?.()?.toISOString?.() || savedDoc.data()?.lastSyncedAt,
    } as ClientProgramDay;

    // 2-way sync: If tasks were updated, immediately sync to client's Daily Focus
    let syncResult = null;
    if (body.tasks !== undefined && body.syncToClient !== false) {
      try {
        const clientDayData = savedDoc.data() as ClientProgramDay;
        const enrollmentId = clientDayData.enrollmentId;
        const dayIndex = clientDayData.dayIndex;
        
        if (enrollmentId && dayIndex) {
          // Get enrollment to calculate the date
          const enrollmentDoc = await adminDb.collection('program_enrollments').doc(enrollmentId).get();
          if (enrollmentDoc.exists) {
            const enrollment = { id: enrollmentDoc.id, ...enrollmentDoc.data() } as ProgramEnrollment;
            const program = await getProgramV2(enrollment.programId);
            
            if (program) {
              // Get cohort if applicable
              let cohort: ProgramCohort | null = null;
              if (enrollment.cohortId) {
                const cohortDoc = await adminDb.collection('program_cohorts').doc(enrollment.cohortId).get();
                if (cohortDoc.exists) {
                  cohort = { id: cohortDoc.id, ...cohortDoc.data() } as ProgramCohort;
                }
              }
              
              // Calculate the date for this day index
              const dateForDay = calculateDateForProgramDay(enrollment, program, cohort, dayIndex);
              
              if (dateForDay) {
                const { userId } = await requireCoachWithOrg();
                syncResult = await syncProgramTasksToClientDay({
                  userId: enrollment.userId,
                  programEnrollmentId: enrollmentId,
                  date: dateForDay,
                  mode: 'override-program-sourced', // Per-client edits use override mode
                  coachUserId: userId,
                });
                console.log(`[COACH_CLIENT_DAY_PATCH] Synced tasks to client: ${JSON.stringify(syncResult)}`);
              }
            }
          }
        }
      } catch (syncErr) {
        console.error('[COACH_CLIENT_DAY_PATCH] Failed to sync tasks to client:', syncErr);
        // Don't fail the whole request, just log the error
      }
    }

    return NextResponse.json({
      success: true,
      clientDay: savedDay,
      message: 'Client day updated successfully',
      ...(syncResult && { clientSync: syncResult }),
    });
  } catch (error) {
    console.error('[COACH_CLIENT_DAY_PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to update client day' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; clientDayId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, clientDayId } = await params;

    // Verify program exists and belongs to this org
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists || programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const clientDayDoc = await adminDb.collection('client_program_days').doc(clientDayId).get();
    if (!clientDayDoc.exists || clientDayDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Client day not found' }, { status: 404 });
    }

    // Delete the client day
    await adminDb.collection('client_program_days').doc(clientDayId).delete();
    console.log(`[COACH_CLIENT_DAY_DELETE] Deleted client day ${clientDayId}`);

    return NextResponse.json({
      success: true,
      message: 'Client day deleted successfully',
    });
  } catch (error) {
    console.error('[COACH_CLIENT_DAY_DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to delete client day' }, { status: 500 });
  }
}
