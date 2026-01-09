/**
 * Coach API: Client-Specific Program Weeks Management (for 1:1 Programs)
 *
 * GET /api/coach/org-programs/[programId]/client-weeks - List client weeks
 *   Query params:
 *   - enrollmentId: Filter by specific enrollment
 *   - weekNumber: Filter by week number
 *
 * POST /api/coach/org-programs/[programId]/client-weeks - Initialize client content for an enrollment
 *   Body: { enrollmentId: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import { distributeClientWeeklyTasksToDays } from '@/lib/program-utils';
import { syncProgramTasksForDateRange } from '@/lib/program-engine';
import type { ClientProgramWeek, ProgramWeek, ProgramEnrollment } from '@/types';

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
      return NextResponse.json({ error: 'Client weeks are only available for individual programs' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const enrollmentId = searchParams.get('enrollmentId');
    const weekNumber = searchParams.get('weekNumber');

    let query = adminDb
      .collection('client_program_weeks')
      .where('programId', '==', programId);

    if (enrollmentId) {
      query = query.where('enrollmentId', '==', enrollmentId);
    }

    if (weekNumber) {
      query = query.where('weekNumber', '==', parseInt(weekNumber, 10));
    }

    const weeksSnapshot = await query.orderBy('weekNumber', 'asc').get();

    const weeks = weeksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
      lastSyncedAt: doc.data().lastSyncedAt?.toDate?.()?.toISOString?.() || doc.data().lastSyncedAt,
    })) as ClientProgramWeek[];

    return NextResponse.json({
      clientWeeks: weeks,
      total: weeks.length,
    });
  } catch (error) {
    console.error('[COACH_CLIENT_WEEKS_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch client weeks' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId } = await params;
    const body = await request.json();
    const { enrollmentId, weekNumber, startDayIndex, endDayIndex, moduleId, ...weekContent } = body;

    if (!enrollmentId) {
      return NextResponse.json({ error: 'enrollmentId is required' }, { status: 400 });
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
      return NextResponse.json({ error: 'Client content can only be initialized for individual programs' }, { status: 400 });
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

    // SINGLE WEEK MODE: If weekNumber is provided, create just that one week
    if (typeof weekNumber === 'number') {
      // Check if this specific week already exists
      const existingWeekSnapshot = await adminDb
        .collection('client_program_weeks')
        .where('enrollmentId', '==', enrollmentId)
        .where('weekNumber', '==', weekNumber)
        .limit(1)
        .get();

      if (!existingWeekSnapshot.empty) {
        // Week exists - update it instead
        const existingDoc = existingWeekSnapshot.docs[0];
        const updateData = {
          ...weekContent,
          hasLocalChanges: true,
          updatedAt: now,
        };
        await existingDoc.ref.update(updateData);
        
        const updatedDoc = await existingDoc.ref.get();
        const updatedWeek = {
          id: updatedDoc.id,
          ...updatedDoc.data(),
          createdAt: updatedDoc.data()?.createdAt?.toDate?.()?.toISOString?.() || updatedDoc.data()?.createdAt,
          updatedAt: updatedDoc.data()?.updatedAt?.toDate?.()?.toISOString?.() || updatedDoc.data()?.updatedAt,
          lastSyncedAt: updatedDoc.data()?.lastSyncedAt?.toDate?.()?.toISOString?.() || updatedDoc.data()?.lastSyncedAt,
        } as ClientProgramWeek;

        return NextResponse.json({
          success: true,
          clientWeek: updatedWeek,
          created: false,
        });
      }

      // Find template week for this week number (if exists)
      const templateWeekSnapshot = await adminDb
        .collection('program_weeks')
        .where('programId', '==', programId)
        .where('weekNumber', '==', weekNumber)
        .limit(1)
        .get();

      const template = templateWeekSnapshot.empty ? null : templateWeekSnapshot.docs[0].data() as ProgramWeek;

      // Create the client week
      const clientWeekRef = adminDb.collection('client_program_weeks').doc();
      const clientWeekData = {
        enrollmentId,
        programWeekId: templateWeekSnapshot.empty ? null : templateWeekSnapshot.docs[0].id,
        programId,
        organizationId,
        userId: enrollment.userId,

        // Positional info
        weekNumber,
        moduleId: moduleId || template?.moduleId || null,
        order: template?.order || weekNumber,
        startDayIndex: startDayIndex ?? template?.startDayIndex ?? ((weekNumber - 1) * 7 + 1),
        endDayIndex: endDayIndex ?? template?.endDayIndex ?? (weekNumber * 7),

        // Content from request or template
        name: weekContent.name ?? template?.name ?? undefined,
        theme: weekContent.theme ?? template?.theme ?? undefined,
        description: weekContent.description ?? template?.description ?? undefined,
        weeklyPrompt: weekContent.weeklyPrompt ?? template?.weeklyPrompt ?? undefined,
        weeklyTasks: weekContent.weeklyTasks ?? template?.weeklyTasks ?? undefined,
        weeklyHabits: weekContent.weeklyHabits ?? template?.weeklyHabits ?? undefined,
        currentFocus: weekContent.currentFocus ?? template?.currentFocus ?? undefined,
        notes: weekContent.notes ?? template?.notes ?? undefined,
        distribution: weekContent.distribution ?? undefined, // Let it inherit from program setting via distributeClientWeeklyTasksToDays
        manualNotes: weekContent.manualNotes ?? undefined,
        coachRecordingUrl: weekContent.coachRecordingUrl ?? undefined,
        coachRecordingNotes: weekContent.coachRecordingNotes ?? undefined,
        linkedSummaryIds: weekContent.linkedSummaryIds ?? [],
        linkedCallEventIds: weekContent.linkedCallEventIds ?? [],
        fillSource: weekContent.fillSource ?? undefined,

        // Sync tracking
        hasLocalChanges: true,
        createdAt: now,
        updatedAt: now,
        lastSyncedAt: now,
      };

      await clientWeekRef.set(clientWeekData);
      const clientWeekId = clientWeekRef.id;
      console.log(`[COACH_CLIENT_WEEKS_POST] Created single client week ${weekNumber} for enrollment ${enrollmentId}`);

      const savedDoc = await clientWeekRef.get();
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
      if (body.distributeTasksNow === true) {
        try {
          distributionResult = await distributeClientWeeklyTasksToDays(
            programId,
            clientWeekId,
            enrollmentId,
            {
              overwriteExisting: body.overwriteExisting || false,
              programTaskDistribution: program?.taskDistribution,
            }
          );
          console.log(`[COACH_CLIENT_WEEKS_POST] Distributed tasks: ${JSON.stringify(distributionResult)}`);
        } catch (distErr) {
          console.error('[COACH_CLIENT_WEEKS_POST] Failed to distribute tasks:', distErr);
        }
      }

      // Sync tasks to client's Daily Focus
      // Note: Sync when distribution happened OR tasks provided (even empty for clearing)
      let syncResult = null;
      if ((distributionResult || weekContent.weeklyTasks !== undefined) && body.syncToClient !== false) {
        try {
          const { userId: coachUserId } = await requireCoachWithOrg();
          syncResult = await syncProgramTasksForDateRange(programId, {
            mode: 'override-program-sourced',
            horizonDays: 7,
            coachUserId,
            specificEnrollmentId: enrollmentId,
          });
          console.log(`[COACH_CLIENT_WEEKS_POST] Synced tasks to client: ${JSON.stringify(syncResult)}`);
        } catch (syncErr) {
          console.error('[COACH_CLIENT_WEEKS_POST] Failed to sync tasks:', syncErr);
        }
      }

      return NextResponse.json({
        success: true,
        clientWeek: savedWeek,
        created: true,
        ...(distributionResult && { distribution: distributionResult }),
        ...(syncResult && { clientSync: syncResult }),
      });
    }

    // BATCH INITIALIZATION MODE: Initialize all weeks from template
    // Check if client weeks already exist for this enrollment
    const existingWeeks = await adminDb
      .collection('client_program_weeks')
      .where('enrollmentId', '==', enrollmentId)
      .limit(1)
      .get();

    if (!existingWeeks.empty) {
      return NextResponse.json({
        error: 'Client content already initialized for this enrollment',
        existingCount: existingWeeks.size,
      }, { status: 409 });
    }

    // Fetch all template weeks for this program
    const templateWeeksSnapshot = await adminDb
      .collection('program_weeks')
      .where('programId', '==', programId)
      .orderBy('weekNumber', 'asc')
      .get();

    if (templateWeeksSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'No template weeks to copy',
        weeksCreated: 0,
      });
    }

    // Create client weeks by copying template weeks
    const batch = adminDb.batch();
    const createdWeekIds: string[] = [];

    for (const templateDoc of templateWeeksSnapshot.docs) {
      const template = templateDoc.data() as ProgramWeek;
      const clientWeekRef = adminDb.collection('client_program_weeks').doc();

      const clientWeekData: Omit<ClientProgramWeek, 'id' | 'createdAt' | 'updatedAt' | 'lastSyncedAt'> & {
        createdAt: FieldValue;
        updatedAt: FieldValue;
        lastSyncedAt: FieldValue;
      } = {
        enrollmentId,
        programWeekId: templateDoc.id,
        programId,
        organizationId,
        userId: enrollment.userId,

        // Positional info
        weekNumber: template.weekNumber,
        moduleId: template.moduleId,
        order: template.order,
        startDayIndex: template.startDayIndex,
        endDayIndex: template.endDayIndex,

        // Content (copied from template)
        name: template.name || undefined,
        theme: template.theme || undefined,
        description: template.description || undefined,
        weeklyPrompt: template.weeklyPrompt || undefined,
        weeklyTasks: template.weeklyTasks || undefined,
        weeklyHabits: template.weeklyHabits || undefined,
        currentFocus: template.currentFocus || undefined,
        notes: template.notes || undefined,
        distribution: undefined, // Let it inherit from program setting via distributeClientWeeklyTasksToDays

        // Client-specific fields (start empty)
        linkedSummaryIds: [],
        linkedCallEventIds: [],
        coachRecordingUrl: undefined,
        coachRecordingNotes: undefined,
        manualNotes: undefined,
        fillSource: undefined,

        // Sync tracking
        hasLocalChanges: false,

        createdAt: now,
        updatedAt: now,
        lastSyncedAt: now,
      };

      batch.set(clientWeekRef, clientWeekData);
      createdWeekIds.push(clientWeekRef.id);
    }

    await batch.commit();
    console.log(`[COACH_CLIENT_WEEKS_POST] Initialized ${createdWeekIds.length} client weeks for enrollment ${enrollmentId}`);

    return NextResponse.json({
      success: true,
      message: `Initialized ${createdWeekIds.length} client weeks`,
      weeksCreated: createdWeekIds.length,
      weekIds: createdWeekIds,
    });
  } catch (error) {
    console.error('[COACH_CLIENT_WEEKS_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to initialize client weeks' }, { status: 500 });
  }
}
