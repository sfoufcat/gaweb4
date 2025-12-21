/**
 * Coach API: Single Program Day Management (org-scoped)
 * 
 * GET /api/coach/org-starter-programs/[programId]/days/[dayIndex] - Get a specific day
 * PUT /api/coach/org-starter-programs/[programId]/days/[dayIndex] - Update a day
 * DELETE /api/coach/org-starter-programs/[programId]/days/[dayIndex] - Delete a day
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { StarterProgramDay, ProgramTaskTemplate, ProgramHabitTemplate } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; dayIndex: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, dayIndex: dayIndexStr } = await params;
    const dayIndex = parseInt(dayIndexStr, 10);

    if (isNaN(dayIndex)) {
      return NextResponse.json({ error: 'Invalid day index' }, { status: 400 });
    }

    // Verify program exists and belongs to this organization
    const programDoc = await adminDb.collection('starter_programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Starter program not found' }, { status: 404 });
    }
    if (programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    const daySnapshot = await adminDb
      .collection('starter_program_days')
      .where('programId', '==', programId)
      .where('dayIndex', '==', dayIndex)
      .limit(1)
      .get();

    if (daySnapshot.empty) {
      // Return empty day structure instead of 404
      return NextResponse.json({ 
        day: null,
        dayIndex,
        programId,
      });
    }

    const dayDoc = daySnapshot.docs[0];
    const day = {
      id: dayDoc.id,
      ...dayDoc.data(),
      createdAt: dayDoc.data().createdAt?.toDate?.()?.toISOString?.() || dayDoc.data().createdAt,
      updatedAt: dayDoc.data().updatedAt?.toDate?.()?.toISOString?.() || dayDoc.data().updatedAt,
    } as StarterProgramDay;

    return NextResponse.json({ day });
  } catch (error) {
    console.error('[COACH_ORG_PROGRAM_DAY_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch program day' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; dayIndex: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, dayIndex: dayIndexStr } = await params;
    const dayIndex = parseInt(dayIndexStr, 10);
    const body = await request.json();

    if (isNaN(dayIndex)) {
      return NextResponse.json({ error: 'Invalid day index' }, { status: 400 });
    }

    // Verify program exists and belongs to this organization
    const programDoc = await adminDb.collection('starter_programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Starter program not found' }, { status: 404 });
    }
    if (programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    const programLengthDays = programDoc.data()?.lengthDays || 30;

    if (dayIndex < 1 || dayIndex > programLengthDays) {
      return NextResponse.json(
        { error: `dayIndex must be between 1 and ${programLengthDays}` },
        { status: 400 }
      );
    }

    // Validate and process tasks
    const tasks: ProgramTaskTemplate[] = [];
    if (body.tasks && Array.isArray(body.tasks)) {
      for (const task of body.tasks) {
        if (!task.label) continue;
        tasks.push({
          label: task.label,
          type: task.type || 'task',
          isPrimary: task.isPrimary !== false,
          estimatedMinutes: task.estimatedMinutes || undefined,
          notes: task.notes || undefined,
          tag: task.tag || undefined,
        });
      }
    }

    // Validate and process habits
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

    // Check if day exists
    const existingDay = await adminDb
      .collection('starter_program_days')
      .where('programId', '==', programId)
      .where('dayIndex', '==', dayIndex)
      .limit(1)
      .get();

    const dayData = {
      programId,
      dayIndex,
      title: body.title ?? '',
      tasks,
      habits: habits.length > 0 ? habits : FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    let dayId: string;

    if (!existingDay.empty) {
      // Update existing day
      dayId = existingDay.docs[0].id;
      await adminDb.collection('starter_program_days').doc(dayId).update(dayData);
      console.log(`[COACH_ORG_PROGRAM_DAY_PUT] Updated day ${dayIndex} for program ${programId} in org ${organizationId}`);
    } else {
      // Create new day
      const docRef = await adminDb.collection('starter_program_days').add({
        ...dayData,
        habits: habits.length > 0 ? habits : undefined,
        createdAt: FieldValue.serverTimestamp(),
      });
      dayId = docRef.id;
      console.log(`[COACH_ORG_PROGRAM_DAY_PUT] Created day ${dayIndex} for program ${programId} in org ${organizationId}`);
    }

    // Fetch the updated/created day
    const savedDoc = await adminDb.collection('starter_program_days').doc(dayId).get();
    const savedDay = {
      id: savedDoc.id,
      ...savedDoc.data(),
      createdAt: savedDoc.data()?.createdAt?.toDate?.()?.toISOString?.() || savedDoc.data()?.createdAt,
      updatedAt: savedDoc.data()?.updatedAt?.toDate?.()?.toISOString?.() || savedDoc.data()?.updatedAt,
    } as StarterProgramDay;

    return NextResponse.json({ 
      success: true, 
      day: savedDay,
      message: 'Program day updated successfully' 
    });
  } catch (error) {
    console.error('[COACH_ORG_PROGRAM_DAY_PUT] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to update program day' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; dayIndex: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, dayIndex: dayIndexStr } = await params;
    const dayIndex = parseInt(dayIndexStr, 10);

    if (isNaN(dayIndex)) {
      return NextResponse.json({ error: 'Invalid day index' }, { status: 400 });
    }

    // Verify program belongs to this organization
    const programDoc = await adminDb.collection('starter_programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Starter program not found' }, { status: 404 });
    }
    if (programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    // Find and delete the day
    const daySnapshot = await adminDb
      .collection('starter_program_days')
      .where('programId', '==', programId)
      .where('dayIndex', '==', dayIndex)
      .limit(1)
      .get();

    if (daySnapshot.empty) {
      return NextResponse.json({ error: 'Program day not found' }, { status: 404 });
    }

    await adminDb.collection('starter_program_days').doc(daySnapshot.docs[0].id).delete();

    console.log(`[COACH_ORG_PROGRAM_DAY_DELETE] Deleted day ${dayIndex} for program ${programId} in org ${organizationId}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Program day deleted successfully' 
    });
  } catch (error) {
    console.error('[COACH_ORG_PROGRAM_DAY_DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to delete program day' }, { status: 500 });
  }
}

