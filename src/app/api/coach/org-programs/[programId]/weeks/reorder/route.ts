/**
 * Coach API: Bulk Reorder Program Weeks
 *
 * PUT /api/coach/org-programs/[programId]/weeks/reorder - Reorder weeks within a module
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import { recalculateWeekDayIndices } from '@/lib/program-utils';

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

    // Verify module exists
    const moduleDoc = await adminDb.collection('program_modules').doc(body.moduleId).get();
    if (!moduleDoc.exists || moduleDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    // Verify all weeks exist and belong to this program
    const weekIds: string[] = body.weekIds;
    const weeksSnapshot = await adminDb
      .collection('program_weeks')
      .where('programId', '==', programId)
      .get();

    const existingWeekIds = new Set(weeksSnapshot.docs.map(doc => doc.id));
    for (const weekId of weekIds) {
      if (!existingWeekIds.has(weekId)) {
        return NextResponse.json(
          { error: `Week ${weekId} not found in this program` },
          { status: 400 }
        );
      }
    }

    // Batch update all week orders and moduleIds
    const batch = adminDb.batch();
    weekIds.forEach((weekId, index) => {
      const weekRef = adminDb.collection('program_weeks').doc(weekId);
      batch.update(weekRef, {
        moduleId: body.moduleId,
        order: index + 1, // 1-based ordering within module
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();
    console.log(`[COACH_ORG_PROGRAM_WEEKS_REORDER] Reordered ${weekIds.length} weeks in module ${body.moduleId}`);

    // Recalculate day indices for all weeks in the program
    await recalculateWeekDayIndices(programId);

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
