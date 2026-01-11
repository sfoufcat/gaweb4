/**
 * Coach API: Bulk Reorder Program Weeks (Embedded in programs.weeks[])
 *
 * PUT /api/coach/org-programs/[programId]/weeks/reorder - Reorder weeks within a module
 *
 * NEW: Uses embedded weeks in programs.weeks[] instead of separate program_weeks collection
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { ProgramWeek, Program } from '@/types';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId } = await params;
    const body = await request.json();

    // Validate input
    if (!body.moduleId) {
      return NextResponse.json({ error: 'moduleId is required' }, { status: 400 });
    }
    if (!Array.isArray(body.weekIds) || body.weekIds.length === 0) {
      return NextResponse.json({ error: 'weekIds array is required' }, { status: 400 });
    }

    // Verify program exists and belongs to this org
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }
    if (programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    const programData = programDoc.data() as Program;

    // Verify module exists
    const moduleDoc = await adminDb.collection('program_modules').doc(body.moduleId).get();
    if (!moduleDoc.exists || moduleDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    // Get existing weeks from embedded array
    const weeks: ProgramWeek[] = programData.weeks || [];
    const existingWeekIds = new Set(weeks.map(w => w.id));

    // Verify all requested weekIds exist
    const weekIds: string[] = body.weekIds;
    for (const weekId of weekIds) {
      if (!existingWeekIds.has(weekId)) {
        return NextResponse.json(
          { error: `Week ${weekId} not found in this program` },
          { status: 400 }
        );
      }
    }

    // Update weeks with their new module assignments and order
    const now = new Date().toISOString();
    const updatedWeeks = weeks.map(week => {
      const orderIndex = weekIds.indexOf(week.id);
      if (orderIndex !== -1) {
        // This week is being reordered
        return {
          ...week,
          moduleId: body.moduleId,
          order: orderIndex + 1, // 1-based ordering within module
          updatedAt: now,
        };
      }
      return week;
    });

    // Update the program document with new weeks array
    await adminDb.collection('programs').doc(programId).update({
      weeks: updatedWeeks,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[COACH_ORG_PROGRAM_WEEKS_REORDER] Reordered ${weekIds.length} weeks in module ${body.moduleId}`);

    return NextResponse.json({
      success: true,
      message: 'Weeks reordered successfully',
    });
  } catch (error) {
    console.error('[COACH_ORG_PROGRAM_WEEKS_REORDER] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to reorder weeks' }, { status: 500 });
  }
}
