/**
 * Program Structure API
 *
 * GET /api/programs/[programId]/structure - Fetch program's hierarchical structure
 * Returns modules, weeks, and days for client-side display.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { ProgramModule, ProgramWeek, ProgramDay } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { programId } = await params;

    // Verify user is enrolled in this program
    const enrollmentsSnapshot = await adminDb
      .collection('enrollments')
      .where('userId', '==', userId)
      .where('programId', '==', programId)
      .where('status', 'in', ['active', 'completed'])
      .limit(1)
      .get();

    if (enrollmentsSnapshot.empty) {
      return NextResponse.json({ error: 'Not enrolled in this program' }, { status: 403 });
    }

    // Get program data
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const programData = programDoc.data();
    const hasModules = programData?.hasModules || false;

    // Fetch modules (if any)
    let modules: ProgramModule[] = [];
    if (hasModules) {
      const modulesSnapshot = await adminDb
        .collection('program_modules')
        .where('programId', '==', programId)
        .orderBy('order', 'asc')
        .get();

      modules = modulesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
      })) as ProgramModule[];
    }

    // Fetch weeks (if any)
    let weeks: ProgramWeek[] = [];
    if (hasModules) {
      const weeksSnapshot = await adminDb
        .collection('program_weeks')
        .where('programId', '==', programId)
        .orderBy('weekNumber', 'asc')
        .get();

      weeks = weeksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
      })) as ProgramWeek[];
    }

    // Fetch days
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
      modules,
      weeks,
      days,
      hasModules,
      programLengthDays: programData?.lengthDays || 30,
    });
  } catch (error) {
    console.error('[PROGRAM_STRUCTURE_GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch program structure' }, { status: 500 });
  }
}
