/**
 * Coach API: Program Weeks Management
 *
 * GET /api/coach/org-programs/[programId]/weeks - List all weeks for a program
 * POST /api/coach/org-programs/[programId]/weeks - Create a new week
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { ProgramWeek } from '@/types';

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
    if (programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    // Optional filter by moduleId
    const { searchParams } = new URL(request.url);
    const moduleId = searchParams.get('moduleId');

    let query = adminDb
      .collection('program_weeks')
      .where('programId', '==', programId);

    if (moduleId) {
      query = query.where('moduleId', '==', moduleId);
    }

    const weeksSnapshot = await query.orderBy('weekNumber', 'asc').get();

    const weeks = weeksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
    })) as ProgramWeek[];

    return NextResponse.json({
      weeks,
      totalWeeks: weeks.length,
    });
  } catch (error) {
    console.error('[COACH_ORG_PROGRAM_WEEKS_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch program weeks' }, { status: 500 });
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

    // Verify program exists and belongs to this organization
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }
    if (programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    // Validate required fields
    if (!body.moduleId) {
      return NextResponse.json({ error: 'moduleId is required' }, { status: 400 });
    }
    if (typeof body.startDayIndex !== 'number' || typeof body.endDayIndex !== 'number') {
      return NextResponse.json({ error: 'startDayIndex and endDayIndex are required' }, { status: 400 });
    }
    if (body.startDayIndex > body.endDayIndex) {
      return NextResponse.json({ error: 'startDayIndex must be <= endDayIndex' }, { status: 400 });
    }

    // Verify module exists
    const moduleDoc = await adminDb.collection('program_modules').doc(body.moduleId).get();
    if (!moduleDoc.exists || moduleDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    // Get next week number (global in program)
    const existingWeeks = await adminDb
      .collection('program_weeks')
      .where('programId', '==', programId)
      .orderBy('weekNumber', 'desc')
      .limit(1)
      .get();

    const nextWeekNumber = existingWeeks.empty ? 1 : (existingWeeks.docs[0].data().weekNumber || 0) + 1;

    // Get next order number within module
    const moduleWeeks = await adminDb
      .collection('program_weeks')
      .where('moduleId', '==', body.moduleId)
      .orderBy('order', 'desc')
      .limit(1)
      .get();

    const nextOrder = moduleWeeks.empty ? 1 : (moduleWeeks.docs[0].data().order || 0) + 1;

    const weekData = {
      programId,
      moduleId: body.moduleId,
      organizationId,
      order: body.order ?? nextOrder,
      weekNumber: body.weekNumber ?? nextWeekNumber,
      name: body.name?.trim() || undefined,
      description: body.description?.trim() || undefined,
      theme: body.theme?.trim() || undefined,
      startDayIndex: body.startDayIndex,
      endDayIndex: body.endDayIndex,
      weeklyTasks: body.weeklyTasks || undefined,
      weeklyHabits: body.weeklyHabits || undefined,
      weeklyPrompt: body.weeklyPrompt?.trim() || undefined,
      distribution: body.distribution || 'repeat-daily', // Default: repeat tasks daily
      currentFocus: body.currentFocus || undefined,
      notes: body.notes || undefined,
      scheduledCallEventId: body.scheduledCallEventId || undefined,
      linkedCourseModuleIds: body.linkedCourseModuleIds || undefined,
      coachRecordingUrl: body.coachRecordingUrl?.trim() || undefined,
      coachRecordingNotes: body.coachRecordingNotes?.trim() || undefined,
      fillSource: body.fillSource || undefined,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection('program_weeks').add(weekData);
    console.log(`[COACH_ORG_PROGRAM_WEEKS_POST] Created week ${nextWeekNumber} for program ${programId}`);

    // Fetch the created week
    const savedDoc = await adminDb.collection('program_weeks').doc(docRef.id).get();
    const savedWeek = {
      id: savedDoc.id,
      ...savedDoc.data(),
      createdAt: savedDoc.data()?.createdAt?.toDate?.()?.toISOString?.() || savedDoc.data()?.createdAt,
      updatedAt: savedDoc.data()?.updatedAt?.toDate?.()?.toISOString?.() || savedDoc.data()?.updatedAt,
    } as ProgramWeek;

    return NextResponse.json({
      success: true,
      week: savedWeek,
      message: 'Program week created successfully',
    });
  } catch (error) {
    console.error('[COACH_ORG_PROGRAM_WEEKS_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to create program week' }, { status: 500 });
  }
}
