/**
 * Coach API: Program Days Management
 * 
 * GET /api/coach/org-programs/[programId]/days - List all days for a program
 * POST /api/coach/org-programs/[programId]/days - Create/update a program day
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { ProgramDay, ProgramTaskTemplate, ProgramHabitTemplate } from '@/types';

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
    const tasks: ProgramTaskTemplate[] = [];
    if (body.tasks && Array.isArray(body.tasks)) {
      for (const task of body.tasks) {
        if (!task.label) continue;
        tasks.push({
          label: task.label,
          type: task.type || 'task',
          isPrimary: task.isPrimary !== false, // Default to true
          estimatedMinutes: task.estimatedMinutes || undefined,
          notes: task.notes || undefined,
          tag: task.tag || undefined,
        });
      }
    }

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

    // Check if day already exists
    const existingDay = await adminDb
      .collection('program_days')
      .where('programId', '==', programId)
      .where('dayIndex', '==', body.dayIndex)
      .limit(1)
      .get();

    const dayData = {
      programId,
      dayIndex: body.dayIndex,
      title: body.title?.trim() || '',
      summary: body.summary?.trim() || '',
      dailyPrompt: body.dailyPrompt?.trim() || '',
      tasks,
      habits: habits.length > 0 ? habits : undefined,
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








