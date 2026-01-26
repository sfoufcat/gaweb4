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

    // Get all modules for this program (sort in memory to avoid index requirement)
    const modulesSnapshot = await adminDb
      .collection('program_modules')
      .where('programId', '==', programId)
      .get();

    if (modulesSnapshot.empty) {
      return NextResponse.json({ error: 'No modules found in this program' }, { status: 400 });
    }

    const modules = modulesSnapshot.docs
      .map(doc => ({
        id: doc.id,
        order: doc.data().order as number,
      }))
      .sort((a, b) => a.order - b.order);

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

    // Calculate even distribution
    const numModules = modules.length;
    const numWeeks = weeks.length;
    const daysPerWeek = programData.includeWeekends !== false ? 7 : 5;
    const now = new Date().toISOString();

    // Recalculate all weeks with proper indices and module assignments
    const updatedWeeks = weeks.map((week, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === numWeeks - 1;

      // Calculate weekNumber: 0 for first (Onboarding), -1 for last (Closing), else sequential
      let newWeekNumber: number;
      if (isFirst) {
        newWeekNumber = 0;
      } else if (isLast && numWeeks > 2) {
        newWeekNumber = -1;
      } else {
        newWeekNumber = idx;
      }

      // Calculate day indices
      const newStartDayIndex = idx * daysPerWeek + 1;
      const newEndDayIndex = newStartDayIndex + daysPerWeek - 1;

      // Calculate module assignment (even distribution)
      const baseWeeksPerModule = Math.floor(numWeeks / numModules);
      const extraWeeks = numWeeks % numModules;
      let moduleIdx = 0;
      let weekCount = 0;
      for (let m = 0; m < numModules; m++) {
        const weeksForModule = baseWeeksPerModule + (m < extraWeeks ? 1 : 0);
        if (idx < weekCount + weeksForModule) {
          moduleIdx = m;
          break;
        }
        weekCount += weeksForModule;
      }
      const targetModule = modules[moduleIdx];

      return {
        ...week,
        weekNumber: newWeekNumber,
        startDayIndex: newStartDayIndex,
        endDayIndex: newEndDayIndex,
        moduleId: targetModule.id,
        order: idx - weekCount + 1,
        updatedAt: now,
      };
    });

    // Calculate new lengthDays
    const newLengthDays = numWeeks * daysPerWeek;

    // Update the program document with recalculated weeks and lengthDays
    await adminDb.collection('programs').doc(programId).update({
      weeks: updatedWeeks,
      lengthDays: newLengthDays,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[COACH_ORG_PROGRAM_WEEKS_AUTO_DISTRIBUTE] Distributed ${numWeeks} weeks across ${numModules} modules`);

    return NextResponse.json({
      success: true,
      message: `Distributed ${numWeeks} weeks across ${numModules} modules`,
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
