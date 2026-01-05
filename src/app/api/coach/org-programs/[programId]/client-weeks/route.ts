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
    const { enrollmentId } = body;

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
    const now = FieldValue.serverTimestamp();

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
        distribution: template.distribution || 'repeat-daily',

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
