/**
 * Coach API: Auto-Distribute Program Weeks (Embedded in programs.weeks[])
 *
 * POST /api/coach/org-programs/[programId]/weeks/auto-distribute
 * Evenly distributes all weeks across modules in order
 *
 * NEW: Uses embedded weeks in programs.weeks[] instead of separate program_weeks collection
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { ProgramWeek, Program } from '@/types';

export async function POST(
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

    const programData = programDoc.data() as Program;

    // Get all modules for this program, ordered by their order field
    const modulesSnapshot = await adminDb
      .collection('program_modules')
      .where('programId', '==', programId)
      .orderBy('order', 'asc')
      .get();

    if (modulesSnapshot.empty) {
      return NextResponse.json({ error: 'No modules found in this program' }, { status: 400 });
    }

    const modules = modulesSnapshot.docs.map(doc => ({
      id: doc.id,
      order: doc.data().order as number,
    }));

    // Get all weeks from embedded array, sorted by weekNumber
    let weeks: ProgramWeek[] = (programData.weeks || []).map((week, index) => ({
      ...week,
      id: week.id || `week-${index + 1}`,
      programId,
      organizationId,
    }));

    // If no weeks exist, create them
    if (weeks.length === 0) {
      console.log(`[COACH_ORG_PROGRAM_WEEKS_AUTO_DISTRIBUTE] No weeks found, creating them first`);
      const lengthDays = programData.lengthDays || 28;
      const daysPerWeek = programData.includeWeekends !== false ? 7 : 5;
      const numWeeks = Math.ceil(lengthDays / daysPerWeek);
      const now = new Date().toISOString();

      weeks = [];
      for (let i = 0; i < numWeeks; i++) {
        const weekNumber = i + 1;
        const startDay = i * daysPerWeek + 1;
        const endDay = Math.min(startDay + daysPerWeek - 1, lengthDays);

        weeks.push({
          id: crypto.randomUUID(),
          programId,
          moduleId: '', // Will be assigned below
          organizationId,
          order: weekNumber,
          weekNumber,
          startDayIndex: startDay,
          endDayIndex: endDay,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // Sort by weekNumber: 0 (onboarding), 1+ (regular), -1 (closing) last
    weeks.sort((a, b) => {
      if (a.weekNumber === -1) return 1;
      if (b.weekNumber === -1) return -1;
      return a.weekNumber - b.weekNumber;
    });

    // Calculate even distribution
    const numModules = modules.length;
    const numWeeks = weeks.length;
    const weeksPerModule = Math.ceil(numWeeks / numModules);
    const now = new Date().toISOString();

    // Update weeks with their new module assignments
    const updatedWeeks = weeks.map((week, index) => {
      const moduleIndex = Math.floor(index / weeksPerModule);
      // Handle edge case where last module might get fewer weeks
      const targetModule = modules[Math.min(moduleIndex, numModules - 1)];
      const orderWithinModule = (index % weeksPerModule) + 1;

      return {
        ...week,
        moduleId: targetModule.id,
        order: orderWithinModule,
        updatedAt: now,
      };
    });

    // Update the program document with new weeks array
    await adminDb.collection('programs').doc(programId).update({
      weeks: updatedWeeks,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[COACH_ORG_PROGRAM_WEEKS_AUTO_DISTRIBUTE] Distributed ${numWeeks} weeks across ${numModules} modules`);

    // Return the new distribution for the frontend to update state
    const distribution = modules.map((module, moduleIndex) => {
      const startIdx = moduleIndex * weeksPerModule;
      const endIdx = Math.min(startIdx + weeksPerModule, numWeeks);
      return {
        moduleId: module.id,
        weekIds: updatedWeeks.slice(startIdx, endIdx).map(w => w.id),
      };
    });

    return NextResponse.json({
      success: true,
      message: `Distributed ${numWeeks} weeks across ${numModules} modules`,
      distribution,
    });
  } catch (error) {
    console.error('[COACH_ORG_PROGRAM_WEEKS_AUTO_DISTRIBUTE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    // Check for Firestore index errors
    if (message.includes('index') || message.includes('The query requires an index')) {
      return NextResponse.json({
        error: 'Database index required. Please contact support or check Firestore console.'
      }, { status: 500 });
    }

    return NextResponse.json({ error: `Failed to auto-distribute weeks: ${message}` }, { status: 500 });
  }
}
