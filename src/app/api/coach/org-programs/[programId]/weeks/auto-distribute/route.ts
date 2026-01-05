/**
 * Coach API: Auto-Distribute Program Weeks
 *
 * POST /api/coach/org-programs/[programId]/weeks/auto-distribute
 * Evenly distributes all weeks across modules in order
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import { recalculateWeekDayIndices } from '@/lib/program-utils';

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

    // Get all weeks for this program, ordered by weekNumber
    const weeksSnapshot = await adminDb
      .collection('program_weeks')
      .where('programId', '==', programId)
      .orderBy('weekNumber', 'asc')
      .get();

    if (weeksSnapshot.empty) {
      return NextResponse.json({ error: 'No weeks found in this program' }, { status: 400 });
    }

    const weeks = weeksSnapshot.docs.map(doc => ({
      id: doc.id,
      weekNumber: doc.data().weekNumber as number,
    }));

    // Calculate even distribution
    const numModules = modules.length;
    const numWeeks = weeks.length;
    const weeksPerModule = Math.ceil(numWeeks / numModules);

    // Batch update all weeks with their new module assignments
    const batch = adminDb.batch();

    weeks.forEach((week, index) => {
      const moduleIndex = Math.floor(index / weeksPerModule);
      // Handle edge case where last module might get fewer weeks
      const targetModule = modules[Math.min(moduleIndex, numModules - 1)];
      const orderWithinModule = (index % weeksPerModule) + 1;

      const weekRef = adminDb.collection('program_weeks').doc(week.id);
      batch.update(weekRef, {
        moduleId: targetModule.id,
        order: orderWithinModule,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();
    console.log(`[COACH_ORG_PROGRAM_WEEKS_AUTO_DISTRIBUTE] Distributed ${numWeeks} weeks across ${numModules} modules`);

    // Recalculate day indices for all weeks in the program
    await recalculateWeekDayIndices(programId);

    // Return the new distribution for the frontend to update state
    const distribution = modules.map((module, moduleIndex) => {
      const startIdx = moduleIndex * weeksPerModule;
      const endIdx = Math.min(startIdx + weeksPerModule, numWeeks);
      return {
        moduleId: module.id,
        weekIds: weeks.slice(startIdx, endIdx).map(w => w.id),
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
