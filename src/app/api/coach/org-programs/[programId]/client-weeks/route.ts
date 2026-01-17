/**
 * Coach API: Client-Specific Program Weeks Management (Using program_instances)
 *
 * GET /api/coach/org-programs/[programId]/client-weeks - List client weeks from program_instances
 *   Query params:
 *   - enrollmentId: Filter by specific enrollment (required for 1:1)
 *   - weekNumber: Filter by week number
 *
 * POST /api/coach/org-programs/[programId]/client-weeks - Initialize/update client content
 *   Body: { enrollmentId: string, weekNumber?: number, ... }
 *
 * NEW: Uses program_instances with type='individual' instead of client_program_weeks collection
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { ProgramInstance, ProgramInstanceWeek, ProgramInstanceDay, ProgramEnrollment, Program, ProgramTaskTemplate } from '@/types';
import { calculateCalendarWeeks, type CalendarWeek } from '@/lib/calendar-weeks';

/**
 * Process tasks to ensure each has a unique ID
 */
function processTasksWithIds(tasks: ProgramTaskTemplate[] | undefined): ProgramTaskTemplate[] {
  if (!tasks || !Array.isArray(tasks)) return [];
  return tasks.map((task) => {
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

/**
 * Find or create the program instance for an individual enrollment
 */
async function getOrCreateIndividualInstance(
  programId: string,
  enrollmentId: string,
  userId: string,
  organizationId: string,
  programData: Program,
  enrollment: ProgramEnrollment
): Promise<{ instanceId: string; instance: ProgramInstance }> {
  // Try to find existing instance
  const instanceQuery = await adminDb
    .collection('program_instances')
    .where('enrollmentId', '==', enrollmentId)
    .where('programId', '==', programId)
    .limit(1)
    .get();

  if (!instanceQuery.empty) {
    const doc = instanceQuery.docs[0];
    return {
      instanceId: doc.id,
      instance: { id: doc.id, ...doc.data() } as ProgramInstance,
    };
  }

  // Create new instance from template
  console.log(`[CLIENT_WEEKS] Auto-creating instance for enrollment ${enrollmentId}`);
  const includeWeekends = programData.includeWeekends !== false;
  const daysPerWeek = includeWeekends ? 7 : 5;
  const totalDays = programData.lengthDays || 28;

  // Calculate calendar weeks from enrollment start date
  let calendarWeeks: CalendarWeek[] = [];
  if (enrollment.startedAt) {
    calendarWeeks = calculateCalendarWeeks(enrollment.startedAt, totalDays, includeWeekends);
  }
  const regularCalendarWeeks = calendarWeeks
    .filter(w => w.weekNumber > 0)
    .sort((a, b) => a.startDayIndex - b.startDayIndex);

  // Helper to get calendar date for a day
  const getCalendarDateForDay = (weekPosition: number, dayOffset: number): string | undefined => {
    const calendarWeek = regularCalendarWeeks[weekPosition];
    if (!calendarWeek?.startDate) return undefined;
    const startDate = new Date(calendarWeek.startDate);
    startDate.setDate(startDate.getDate() + dayOffset);
    return startDate.toISOString().split('T')[0];
  };

  // Read weeks from programs.weeks[] or fallback to program_weeks collection
  let weeks: ProgramInstanceWeek[] = [];

  if (programData.weeks && Array.isArray(programData.weeks) && programData.weeks.length > 0) {
    weeks = programData.weeks.map((weekData, weekPosition) => {
      const calendarWeek = regularCalendarWeeks[weekPosition];
      const startDayIndex = calendarWeek?.startDayIndex ?? ((weekData.weekNumber - 1) * daysPerWeek + 1);
      const endDayIndex = calendarWeek?.endDayIndex ?? (startDayIndex + daysPerWeek - 1);

      const days: ProgramInstanceDay[] = [];
      for (let i = 0; i <= endDayIndex - startDayIndex; i++) {
        days.push({
          dayIndex: i + 1,
          globalDayIndex: startDayIndex + i,
          calendarDate: getCalendarDateForDay(weekPosition, i),
          tasks: [],
          habits: [],
        });
      }

      return {
        id: weekData.id || crypto.randomUUID(),
        weekNumber: weekData.weekNumber,
        moduleId: weekData.moduleId,
        name: weekData.name,
        theme: weekData.theme,
        weeklyTasks: (weekData.weeklyTasks || []).map((t) => ({
          ...t,
          id: t.id || crypto.randomUUID(),
        })),
        weeklyHabits: weekData.weeklyHabits || [],
        weeklyPrompt: weekData.weeklyPrompt,
        distribution: weekData.distribution,
        startDayIndex,
        endDayIndex,
        days,
      } as ProgramInstanceWeek;
    });
  } else {
    // Fallback to program_weeks collection
    const weeksSnapshot = await adminDb.collection('program_weeks')
      .where('programId', '==', programId)
      .orderBy('weekNumber', 'asc')
      .get();

    weeks = weeksSnapshot.docs.map((weekDoc, weekPosition) => {
      const weekData = weekDoc.data();
      const calendarWeek = regularCalendarWeeks[weekPosition];
      const startDayIndex = calendarWeek?.startDayIndex ?? ((weekData.weekNumber - 1) * daysPerWeek + 1);
      const endDayIndex = calendarWeek?.endDayIndex ?? (startDayIndex + daysPerWeek - 1);

      const days: ProgramInstanceDay[] = [];
      for (let i = 0; i <= endDayIndex - startDayIndex; i++) {
        days.push({
          dayIndex: i + 1,
          globalDayIndex: startDayIndex + i,
          calendarDate: getCalendarDateForDay(weekPosition, i),
          tasks: [],
          habits: [],
        });
      }

      return {
        id: weekDoc.id,
        weekNumber: weekData.weekNumber,
        moduleId: weekData.moduleId,
        name: weekData.name,
        theme: weekData.theme,
        weeklyTasks: (weekData.weeklyTasks || []).map((t: { id?: string; label: string }) => ({
          ...t,
          id: t.id || crypto.randomUUID(),
        })),
        weeklyHabits: weekData.weeklyHabits || [],
        weeklyPrompt: weekData.weeklyPrompt,
        distribution: weekData.distribution,
        startDayIndex,
        endDayIndex,
        days,
      } as ProgramInstanceWeek;
    });
  }

  // Calculate end date from start date + program length
  const startDate = enrollment.startedAt;
  let endDate: string | undefined;
  if (startDate && programData.lengthDays) {
    const start = new Date(startDate);
    start.setDate(start.getDate() + programData.lengthDays);
    endDate = start.toISOString().split('T')[0];
  }

  const instanceData = {
    programId,
    organizationId,
    type: 'individual' as const,
    enrollmentId,
    userId,
    startDate,
    endDate,
    includeWeekends: programData.includeWeekends !== false,
    dailyFocusSlots: programData.dailyFocusSlots || 3,
    weeks,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const newInstanceRef = await adminDb.collection('program_instances').add(instanceData);
  console.log(`[CLIENT_WEEKS] Created instance ${newInstanceRef.id} for enrollment ${enrollmentId}`);

  return {
    instanceId: newInstanceRef.id,
    instance: { id: newInstanceRef.id, ...instanceData } as ProgramInstance,
  };
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
    const program = programDoc.data() as Program;
    if (program.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    // This API is only for individual programs
    if (program.type !== 'individual') {
      return NextResponse.json({ error: 'Client weeks are only available for individual programs' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const enrollmentId = searchParams.get('enrollmentId');
    const weekNumber = searchParams.get('weekNumber');

    if (!enrollmentId) {
      return NextResponse.json({ error: 'enrollmentId is required' }, { status: 400 });
    }

    // Verify enrollment exists
    const enrollmentDoc = await adminDb.collection('program_enrollments').doc(enrollmentId).get();
    if (!enrollmentDoc.exists) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }
    const enrollment = enrollmentDoc.data() as ProgramEnrollment;
    if (enrollment.programId !== programId) {
      return NextResponse.json({ error: 'Enrollment does not belong to this program' }, { status: 400 });
    }

    // Get or create the instance
    const { instance } = await getOrCreateIndividualInstance(
      programId,
      enrollmentId,
      enrollment.userId,
      organizationId,
      program,
      enrollment
    );

    // Get weeks from instance
    let weeks = (instance.weeks || []).map(week => ({
      id: week.id || `week-${week.weekNumber}`,
      enrollmentId,
      programWeekId: week.id,
      programId,
      organizationId,
      userId: enrollment.userId,
      weekNumber: week.weekNumber,
      moduleId: week.moduleId,
      order: week.weekNumber,
      startDayIndex: week.startDayIndex,
      endDayIndex: week.endDayIndex,
      name: week.name,
      theme: week.theme,
      description: week.description,
      weeklyPrompt: week.weeklyPrompt,
      weeklyTasks: week.weeklyTasks || [],
      weeklyHabits: week.weeklyHabits || [],
      currentFocus: week.currentFocus,
      notes: week.notes,
      distribution: week.distribution,
      linkedSummaryIds: week.linkedSummaryIds || [],
      linkedCallEventIds: week.linkedCallEventIds || [],
      coachRecordingUrl: week.coachRecordingUrl,
      coachRecordingNotes: week.coachRecordingNotes,
      manualNotes: week.manualNotes,
      hasLocalChanges: false,
      createdAt: instance.createdAt,
      updatedAt: week.updatedAt || instance.updatedAt,
    }));

    // Filter by weekNumber if provided
    if (weekNumber) {
      const weekNum = parseInt(weekNumber, 10);
      weeks = weeks.filter(w => w.weekNumber === weekNum);
    }

    // Merge completion status from actual user tasks
    for (const week of weeks) {
      if (week.weeklyTasks && week.weeklyTasks.length > 0 && week.startDayIndex !== undefined && week.endDayIndex !== undefined) {
        // Fetch user's tasks for this week's day range
        const userTasksSnapshot = await adminDb
          .collection('tasks')
          .where('programEnrollmentId', '==', enrollmentId)
          .where('programDayIndex', '>=', week.startDayIndex)
          .where('programDayIndex', '<=', week.endDayIndex)
          .get();

        const userTasks = userTasksSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        // Merge completion status
        week.weeklyTasks = week.weeklyTasks.map((template: ProgramTaskTemplate) => {
          const actualTask = userTasks.find(t => {
            const task = t as { title?: string; originalTitle?: string };
            return task.title === template.label || task.originalTitle === template.label;
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
          return template;
        });
      }
    }

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
    const { enrollmentId, weekNumber, ...weekContent } = body;

    if (!enrollmentId) {
      return NextResponse.json({ error: 'enrollmentId is required' }, { status: 400 });
    }

    // Verify program exists and is an individual program
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }
    const program = programDoc.data() as Program;
    if (program.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }
    if (program.type !== 'individual') {
      return NextResponse.json({ error: 'Client content can only be set for individual programs' }, { status: 400 });
    }

    // Verify enrollment exists
    const enrollmentDoc = await adminDb.collection('program_enrollments').doc(enrollmentId).get();
    if (!enrollmentDoc.exists) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }
    const enrollment = enrollmentDoc.data() as ProgramEnrollment;
    if (enrollment.programId !== programId) {
      return NextResponse.json({ error: 'Enrollment does not belong to this program' }, { status: 400 });
    }

    // Get or create the instance
    const { instanceId, instance } = await getOrCreateIndividualInstance(
      programId,
      enrollmentId,
      enrollment.userId,
      organizationId,
      program,
      enrollment
    );

    // If weekNumber is provided, update that specific week
    if (typeof weekNumber === 'number') {
      const weeks = [...(instance.weeks || [])];
      let weekIndex = weeks.findIndex(w => w.weekNumber === weekNumber);

      const now = new Date().toISOString();
      const daysPerWeek = program.includeWeekends !== false ? 7 : 5;

      if (weekIndex === -1) {
        // Create new week if doesn't exist
        const startDayIndex = weekContent.startDayIndex ?? (weekNumber - 1) * daysPerWeek + 1;
        const endDayIndex = weekContent.endDayIndex ?? Math.min(startDayIndex + daysPerWeek - 1, program.lengthDays || 30);

        const days = [];
        for (let dayIndex = startDayIndex; dayIndex <= endDayIndex; dayIndex++) {
          days.push({
            dayIndex,
            globalDayIndex: dayIndex,
            tasks: [],
            habits: [],
          });
        }

        const newWeek: ProgramInstanceWeek = {
          id: crypto.randomUUID(),
          weekNumber,
          moduleId: weekContent.moduleId,
          name: weekContent.name,
          theme: weekContent.theme,
          description: weekContent.description,
          weeklyPrompt: weekContent.weeklyPrompt,
          weeklyTasks: processTasksWithIds(weekContent.weeklyTasks),
          weeklyHabits: weekContent.weeklyHabits || [],
          currentFocus: weekContent.currentFocus,
          notes: weekContent.notes,
          distribution: weekContent.distribution,
          startDayIndex,
          endDayIndex,
          linkedSummaryIds: weekContent.linkedSummaryIds || [],
          linkedCallEventIds: weekContent.linkedCallEventIds || [],
          coachRecordingUrl: weekContent.coachRecordingUrl,
          coachRecordingNotes: weekContent.coachRecordingNotes,
          manualNotes: weekContent.manualNotes,
          fillSource: weekContent.fillSource,
          days,
          createdAt: now,
          updatedAt: now,
        };

        weeks.push(newWeek);
        weeks.sort((a, b) => a.weekNumber - b.weekNumber);
        weekIndex = weeks.findIndex(w => w.weekNumber === weekNumber);
      } else {
        // Update existing week
        const existingWeek = weeks[weekIndex];
        weeks[weekIndex] = {
          ...existingWeek,
          name: weekContent.name ?? existingWeek.name,
          theme: weekContent.theme ?? existingWeek.theme,
          description: weekContent.description ?? existingWeek.description,
          weeklyPrompt: weekContent.weeklyPrompt ?? existingWeek.weeklyPrompt,
          weeklyTasks: weekContent.weeklyTasks !== undefined ? processTasksWithIds(weekContent.weeklyTasks) : existingWeek.weeklyTasks,
          weeklyHabits: weekContent.weeklyHabits ?? existingWeek.weeklyHabits,
          currentFocus: weekContent.currentFocus ?? existingWeek.currentFocus,
          notes: weekContent.notes ?? existingWeek.notes,
          distribution: weekContent.distribution ?? existingWeek.distribution,
          linkedSummaryIds: weekContent.linkedSummaryIds ?? existingWeek.linkedSummaryIds,
          linkedCallEventIds: weekContent.linkedCallEventIds ?? existingWeek.linkedCallEventIds,
          coachRecordingUrl: weekContent.coachRecordingUrl ?? existingWeek.coachRecordingUrl,
          coachRecordingNotes: weekContent.coachRecordingNotes ?? existingWeek.coachRecordingNotes,
          manualNotes: weekContent.manualNotes ?? existingWeek.manualNotes,
          fillSource: weekContent.fillSource ?? existingWeek.fillSource,
          updatedAt: now,
        };
      }

      // Update the instance
      await adminDb.collection('program_instances').doc(instanceId).update({
        weeks,
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(`[COACH_CLIENT_WEEKS_POST] Updated week ${weekNumber} in instance ${instanceId}`);

      const savedWeek = weeks[weekIndex];
      const clientWeek = {
        ...savedWeek,
        id: savedWeek.id || `week-${savedWeek.weekNumber}`,
        enrollmentId,
        programWeekId: savedWeek.id,
        programId,
        organizationId,
        userId: enrollment.userId,
        weekNumber: savedWeek.weekNumber,
        hasLocalChanges: true,
        createdAt: savedWeek.createdAt || instance.createdAt,
        updatedAt: savedWeek.updatedAt,
      };

      return NextResponse.json({
        success: true,
        clientWeek,
        created: weekIndex === weeks.length - 1,
      });
    }

    // No weekNumber - just return success (instance was already created/retrieved)
    return NextResponse.json({
      success: true,
      message: `Instance ready for enrollment ${enrollmentId}`,
      weeksCreated: instance.weeks?.length || 0,
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
