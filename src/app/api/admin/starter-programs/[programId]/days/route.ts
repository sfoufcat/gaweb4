/**
 * Admin API: Starter Program Days Management
 * 
 * GET /api/admin/starter-programs/[programId]/days - List all days for a program
 * POST /api/admin/starter-programs/[programId]/days - Create/update a program day
 * 
 * Editor and Super Admin can access these endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessEditorSection } from '@/lib/admin-utils-shared';
import { FieldValue } from 'firebase-admin/firestore';
import type { StarterProgramDay, ProgramTaskTemplate, ProgramHabitTemplate, ClerkPublicMetadata } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as ClerkPublicMetadata)?.role;
    
    if (!canAccessEditorSection(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { programId } = await params;

    // Verify program exists
    const programDoc = await adminDb.collection('starter_programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Starter program not found' }, { status: 404 });
    }

    const daysSnapshot = await adminDb
      .collection('starter_program_days')
      .where('programId', '==', programId)
      .orderBy('dayIndex', 'asc')
      .get();

    const days = daysSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
    })) as StarterProgramDay[];

    return NextResponse.json({ 
      days,
      programLengthDays: programDoc.data()?.lengthDays || 30,
    });
  } catch (error) {
    console.error('[ADMIN_PROGRAM_DAYS_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch program days' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as ClerkPublicMetadata)?.role;
    
    if (!canAccessEditorSection(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { programId } = await params;
    const body = await request.json();

    // Verify program exists
    const programDoc = await adminDb.collection('starter_programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Starter program not found' }, { status: 404 });
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
      .collection('starter_program_days')
      .where('programId', '==', programId)
      .where('dayIndex', '==', body.dayIndex)
      .limit(1)
      .get();

    const dayData = {
      programId,
      dayIndex: body.dayIndex,
      title: body.title || '',
      tasks,
      habits: habits.length > 0 ? habits : undefined,
      updatedAt: FieldValue.serverTimestamp(),
    };

    let dayId: string;
    let isUpdate = false;

    if (!existingDay.empty) {
      // Update existing day
      dayId = existingDay.docs[0].id;
      await adminDb.collection('starter_program_days').doc(dayId).update(dayData);
      isUpdate = true;
      console.log(`[ADMIN_PROGRAM_DAYS_POST] Updated day ${body.dayIndex} for program ${programId}`);
    } else {
      // Create new day
      const docRef = await adminDb.collection('starter_program_days').add({
        ...dayData,
        createdAt: FieldValue.serverTimestamp(),
      });
      dayId = docRef.id;
      console.log(`[ADMIN_PROGRAM_DAYS_POST] Created day ${body.dayIndex} for program ${programId}`);
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
      message: isUpdate ? 'Program day updated successfully' : 'Program day created successfully' 
    });
  } catch (error) {
    console.error('[ADMIN_PROGRAM_DAYS_POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save program day' },
      { status: 500 }
    );
  }
}



