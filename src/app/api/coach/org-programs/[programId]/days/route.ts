/**
 * Coach API: Program Days Management (TEMPLATE LAYER)
 *
 * =============================================================================
 * ARCHITECTURE NOTE:
 * This is the TEMPLATE LAYER (program_days collection).
 * This is the BASE program design that coaches create once.
 *
 * Data flow: THIS TEMPLATE → "Sync from Template" → Editor → Cron → Daily Focus
 *
 * Template content is synced to cohort/client editors via "Sync from Template" button.
 * The editor layers (cohort_program_days, client_program_days) are the actual
 * source of truth for what gets synced to users.
 *
 * KEY RULE: Day editor is SOURCE OF TRUTH.
 * If coach deletes a task here, it stays deleted. No "smart merge" or preservation.
 * =============================================================================
 *
 * GET /api/coach/org-programs/[programId]/days - List all days for a program
 * POST /api/coach/org-programs/[programId]/days - Create/update a program day
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import { syncProgramTasksToAllCohorts } from '@/lib/sync-cohort-tasks';
import type { ProgramDay, ProgramTaskTemplate, ProgramHabitTemplate, DayCourseAssignment } from '@/types';

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

    const daysSnapshot = await adminDb
      .collection('program_days')
      .where('programId', '==', programId)
      .orderBy('dayIndex', 'asc')
      .get();

    const days = daysSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
    })) as ProgramDay[];

    return NextResponse.json({ 
      days,
      programLengthDays: programDoc.data()?.lengthDays || 30,
      totalDays: days.length,
    });
  } catch (error) {
    console.error('[COACH_ORG_PROGRAM_DAYS_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch program days' }, { status: 500 });
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

    const programLengthDays = programDoc.data()?.lengthDays || 30;

    // Validate required fields
    if (!body.dayIndex || typeof body.dayIndex !== 'number') {
      return NextResponse.json(
        { error: 'dayIndex is required and must be a number' },
        { status: 400 }
      );
    }

    if (body.dayIndex < 1 || body.dayIndex > programLengthDays) {
      return NextResponse.json(
        { error: `dayIndex must be between 1 and ${programLengthDays}` },
        { status: 400 }
      );
    }

    // Validate and process tasks
    let tasks: ProgramTaskTemplate[] = [];
    if (body.tasks && Array.isArray(body.tasks)) {
      for (const task of body.tasks) {
        if (!task.label) continue;
        tasks.push({
          id: task.id || crypto.randomUUID(), // Unique ID for robust task matching
          label: task.label,
          type: task.type || 'task',
          isPrimary: task.isPrimary !== false, // Default to true
          estimatedMinutes: task.estimatedMinutes || undefined,
          notes: task.notes || undefined,
          tag: task.tag || undefined,
          source: task.source || 'day', // Preserve existing source or mark as day-level
        });
      }
    }

    // Check if day already exists (query early for merge logic)
    const existingDay = await adminDb
      .collection('program_days')
      .where('programId', '==', programId)
      .where('dayIndex', '==', body.dayIndex)
      .limit(1)
      .get();

    // Day editor is source of truth - if user deletes a task, it stays deleted
    // No "smart merge" - whatever tasks are sent are the final set

    // Validate and process habits (optional, typically on Day 1)
    const habits: ProgramHabitTemplate[] = [];
    if (body.habits && Array.isArray(body.habits)) {
      for (const habit of body.habits) {
        if (!habit.title) continue;
        habits.push({
          title: habit.title,
          description: habit.description || '',
          frequency: habit.frequency || 'daily',
        });
      }
    }

    // Validate and process course assignments
    const courseAssignments: DayCourseAssignment[] = [];
    if (body.courseAssignments && Array.isArray(body.courseAssignments)) {
      for (const assignment of body.courseAssignments) {
        if (!assignment.courseId) continue;
        courseAssignments.push({
          courseId: assignment.courseId,
          moduleIds: assignment.moduleIds?.length > 0 ? assignment.moduleIds : undefined,
          lessonIds: assignment.lessonIds?.length > 0 ? assignment.lessonIds : undefined,
        });
      }
    }

    const dayData = {
      programId,
      dayIndex: body.dayIndex,
      title: body.title?.trim() || '',
      summary: body.summary?.trim() || '',
      dailyPrompt: body.dailyPrompt?.trim() || '',
      tasks,
      habits: habits.length > 0 ? habits : undefined,
      courseAssignments: courseAssignments.length > 0 ? courseAssignments : undefined,
      updatedAt: FieldValue.serverTimestamp(),
    };

    let dayId: string;
    let isUpdate = false;

    if (!existingDay.empty) {
      // Update existing day
      dayId = existingDay.docs[0].id;
      await adminDb.collection('program_days').doc(dayId).update(dayData);
      isUpdate = true;
      console.log(`[COACH_ORG_PROGRAM_DAYS_POST] Updated day ${body.dayIndex} for program ${programId}`);
    } else {
      // Create new day
      const docRef = await adminDb.collection('program_days').add({
        ...dayData,
        createdAt: FieldValue.serverTimestamp(),
      });
      dayId = docRef.id;
      console.log(`[COACH_ORG_PROGRAM_DAYS_POST] Created day ${body.dayIndex} for program ${programId}`);
    }

    // Fetch the updated/created day
    const savedDoc = await adminDb.collection('program_days').doc(dayId).get();
    const savedDay = {
      id: savedDoc.id,
      ...savedDoc.data(),
      createdAt: savedDoc.data()?.createdAt?.toDate?.()?.toISOString?.() || savedDoc.data()?.createdAt,
      updatedAt: savedDoc.data()?.updatedAt?.toDate?.()?.toISOString?.() || savedDoc.data()?.updatedAt,
    } as ProgramDay;

    // NOTE: Template day saves do NOT auto-sync to user tasks.
    // Sync only happens via manual "Sync to Cohort" button or daily cron job.

    return NextResponse.json({ 
      success: true, 
      day: savedDay,
      message: isUpdate ? 'Program day updated successfully' : 'Program day created successfully' 
    });
  } catch (error) {
    console.error('[COACH_ORG_PROGRAM_DAYS_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to save program day' }, { status: 500 });
  }
}











