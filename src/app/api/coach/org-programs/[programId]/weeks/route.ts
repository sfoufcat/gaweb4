/**
 * Coach API: Program Weeks Management (Embedded in programs.weeks[])
 *
 * GET /api/coach/org-programs/[programId]/weeks - List all weeks for a program
 * POST /api/coach/org-programs/[programId]/weeks - Create a new week
 *
 * NEW: Uses embedded weeks in programs.weeks[] instead of separate program_weeks collection
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { ProgramWeek, ProgramTaskTemplate, Program } from '@/types';

/**
 * Process tasks to ensure each has a unique ID for robust matching.
 * Preserves existing IDs, generates new UUIDs for tasks without IDs.
 * Also strips runtime completion data that should never be stored in templates.
 */
function processTasksWithIds(tasks: ProgramTaskTemplate[] | undefined): ProgramTaskTemplate[] {
  if (!tasks || !Array.isArray(tasks)) return [];
  return tasks.map((task) => {
    // Strip runtime completion data - should never be stored in templates
    const { completed, completedAt, taskId, ...cleanTask } = task as ProgramTaskTemplate & {
      completed?: boolean;
      completedAt?: string;
      taskId?: string;
    };
    return {
      ...cleanTask,
      id: task.id || crypto.randomUUID(),
    };
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId } = await params;

    // Fetch program with embedded weeks
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }
    if (programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    const programData = programDoc.data() as Program;

    // Optional filter by moduleId
    const { searchParams } = new URL(request.url);
    const moduleId = searchParams.get('moduleId');

    // Get weeks from embedded array (new architecture)
    let weeks: ProgramWeek[] = (programData.weeks || []).map((week, index) => ({
      ...week,
      id: week.id || `week-${index + 1}`, // Ensure ID exists
      programId,
      organizationId,
    }));

    // Filter by moduleId if provided
    if (moduleId) {
      weeks = weeks.filter(w => w.moduleId === moduleId);
    }

    // Sort by weekNumber
    weeks.sort((a, b) => a.weekNumber - b.weekNumber);

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

    // Fetch program
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }
    if (programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    const programData = programDoc.data() as Program;

    // Validate required fields
    if (typeof body.startDayIndex !== 'number' || typeof body.endDayIndex !== 'number') {
      return NextResponse.json({ error: 'startDayIndex and endDayIndex are required' }, { status: 400 });
    }
    if (body.startDayIndex > body.endDayIndex) {
      return NextResponse.json({ error: 'startDayIndex must be <= endDayIndex' }, { status: 400 });
    }

    // Verify module exists (if provided - moduleId is now optional)
    if (body.moduleId) {
      const moduleDoc = await adminDb.collection('program_modules').doc(body.moduleId).get();
      if (!moduleDoc.exists || moduleDoc.data()?.programId !== programId) {
        return NextResponse.json({ error: 'Module not found' }, { status: 404 });
      }
    }

    // Get existing weeks from embedded array
    const existingWeeks: ProgramWeek[] = programData.weeks || [];

    // Get next week number (max + 1)
    const nextWeekNumber = existingWeeks.length > 0
      ? Math.max(...existingWeeks.map(w => w.weekNumber || 0)) + 1
      : 1;

    // Get next order number (within module if provided, otherwise use weekNumber)
    let nextOrder = 1;
    if (body.moduleId) {
      const moduleWeeks = existingWeeks.filter(w => w.moduleId === body.moduleId);
      nextOrder = moduleWeeks.length > 0
        ? Math.max(...moduleWeeks.map(w => w.order || 0)) + 1
        : 1;
    } else {
      nextOrder = body.weekNumber ?? nextWeekNumber;
    }

    // Create new week with generated ID
    const weekId = crypto.randomUUID();
    const now = new Date().toISOString();

    const newWeek: ProgramWeek = {
      id: weekId,
      programId,
      moduleId: body.moduleId || '', // moduleId is optional
      organizationId,
      order: body.order ?? nextOrder,
      weekNumber: body.weekNumber ?? nextWeekNumber,
      name: body.name?.trim() || undefined,
      description: body.description?.trim() || undefined,
      theme: body.theme?.trim() || undefined,
      startDayIndex: body.startDayIndex,
      endDayIndex: body.endDayIndex,
      weeklyTasks: processTasksWithIds(body.weeklyTasks),
      weeklyHabits: body.weeklyHabits || undefined,
      weeklyPrompt: body.weeklyPrompt?.trim() || undefined,
      distribution: body.distribution || 'spread',
      currentFocus: body.currentFocus || undefined,
      notes: body.notes || undefined,
      scheduledCallEventId: body.scheduledCallEventId || undefined,
      linkedCourseModuleIds: body.linkedCourseModuleIds || undefined,
      linkedArticleIds: body.linkedArticleIds || [],
      linkedDownloadIds: body.linkedDownloadIds || [],
      linkedLinkIds: body.linkedLinkIds || [],
      linkedQuestionnaireIds: body.linkedQuestionnaireIds || [],
      linkedCourseIds: body.linkedCourseIds || [],
      coachRecordingUrl: body.coachRecordingUrl?.trim() || undefined,
      coachRecordingNotes: body.coachRecordingNotes?.trim() || undefined,
      fillSource: body.fillSource || undefined,
      createdAt: now,
      updatedAt: now,
    };

    // Add to embedded weeks array
    const updatedWeeks = [...existingWeeks, newWeek];

    // Update the program document
    await adminDb.collection('programs').doc(programId).update({
      weeks: updatedWeeks,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[COACH_ORG_PROGRAM_WEEKS_POST] Created week ${nextWeekNumber} (id: ${weekId}) for program ${programId}`);

    return NextResponse.json({
      success: true,
      week: newWeek,
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
