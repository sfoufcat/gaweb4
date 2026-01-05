/**
 * Coach API: Bulk Reorder Program Modules
 *
 * PUT /api/coach/org-programs/[programId]/modules/reorder - Reorder modules
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId } = await params;
    const body = await request.json();

    // Validate input
    if (!Array.isArray(body.moduleIds) || body.moduleIds.length === 0) {
      return NextResponse.json({ error: 'moduleIds array is required' }, { status: 400 });
    }

    // Verify program exists and belongs to this org
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }
    if (programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    // Verify all modules exist and belong to this program
    const moduleIds: string[] = body.moduleIds;
    const modulesSnapshot = await adminDb
      .collection('program_modules')
      .where('programId', '==', programId)
      .get();

    const existingModuleIds = new Set(modulesSnapshot.docs.map(doc => doc.id));
    for (const moduleId of moduleIds) {
      if (!existingModuleIds.has(moduleId)) {
        return NextResponse.json(
          { error: `Module ${moduleId} not found in this program` },
          { status: 400 }
        );
      }
    }

    // Batch update all module orders
    const batch = adminDb.batch();
    moduleIds.forEach((moduleId, index) => {
      const moduleRef = adminDb.collection('program_modules').doc(moduleId);
      batch.update(moduleRef, {
        order: index + 1, // 1-based ordering
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();
    console.log(`[COACH_ORG_PROGRAM_MODULES_REORDER] Reordered ${moduleIds.length} modules for program ${programId}`);

    return NextResponse.json({
      success: true,
      message: 'Modules reordered successfully',
    });
  } catch (error) {
    console.error('[COACH_ORG_PROGRAM_MODULES_REORDER] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to reorder modules' }, { status: 500 });
  }
}
