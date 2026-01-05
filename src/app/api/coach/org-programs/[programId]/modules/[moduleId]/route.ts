/**
 * Coach API: Individual Program Module Management
 *
 * GET /api/coach/org-programs/[programId]/modules/[moduleId] - Get a module
 * PATCH /api/coach/org-programs/[programId]/modules/[moduleId] - Update a module
 * DELETE /api/coach/org-programs/[programId]/modules/[moduleId] - Delete a module
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { ProgramModule } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; moduleId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, moduleId } = await params;

    // Verify program exists and belongs to this org
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists || programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const moduleDoc = await adminDb.collection('program_modules').doc(moduleId).get();
    if (!moduleDoc.exists || moduleDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    const module = {
      id: moduleDoc.id,
      ...moduleDoc.data(),
      createdAt: moduleDoc.data()?.createdAt?.toDate?.()?.toISOString?.() || moduleDoc.data()?.createdAt,
      updatedAt: moduleDoc.data()?.updatedAt?.toDate?.()?.toISOString?.() || moduleDoc.data()?.updatedAt,
    } as ProgramModule;

    return NextResponse.json({ module });
  } catch (error) {
    console.error('[COACH_ORG_PROGRAM_MODULE_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch module' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; moduleId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, moduleId } = await params;
    const body = await request.json();

    // Verify program exists and belongs to this org
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists || programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const moduleDoc = await adminDb.collection('program_modules').doc(moduleId).get();
    if (!moduleDoc.exists || moduleDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    // Build update object (only include provided fields)
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.previewTitle !== undefined) updateData.previewTitle = body.previewTitle?.trim() || null;
    if (body.previewDescription !== undefined) updateData.previewDescription = body.previewDescription?.trim() || null;
    if (body.order !== undefined) updateData.order = body.order;
    if (body.startDayIndex !== undefined) updateData.startDayIndex = body.startDayIndex;
    if (body.endDayIndex !== undefined) updateData.endDayIndex = body.endDayIndex;
    if (body.linkedCourseIds !== undefined) updateData.linkedCourseIds = body.linkedCourseIds || null;

    await adminDb.collection('program_modules').doc(moduleId).update(updateData);
    console.log(`[COACH_ORG_PROGRAM_MODULE_PATCH] Updated module ${moduleId}`);

    // Fetch the updated module
    const savedDoc = await adminDb.collection('program_modules').doc(moduleId).get();
    const savedModule = {
      id: savedDoc.id,
      ...savedDoc.data(),
      createdAt: savedDoc.data()?.createdAt?.toDate?.()?.toISOString?.() || savedDoc.data()?.createdAt,
      updatedAt: savedDoc.data()?.updatedAt?.toDate?.()?.toISOString?.() || savedDoc.data()?.updatedAt,
    } as ProgramModule;

    return NextResponse.json({
      success: true,
      module: savedModule,
      message: 'Module updated successfully',
    });
  } catch (error) {
    console.error('[COACH_ORG_PROGRAM_MODULE_PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to update module' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; moduleId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, moduleId } = await params;

    // Verify program exists and belongs to this org
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists || programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const moduleDoc = await adminDb.collection('program_modules').doc(moduleId).get();
    if (!moduleDoc.exists || moduleDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    // Delete all weeks in this module
    const weeksSnapshot = await adminDb
      .collection('program_weeks')
      .where('moduleId', '==', moduleId)
      .get();

    const batch = adminDb.batch();

    // Delete weeks
    for (const weekDoc of weeksSnapshot.docs) {
      batch.delete(weekDoc.ref);
    }

    // Delete the module
    batch.delete(adminDb.collection('program_modules').doc(moduleId));

    await batch.commit();
    console.log(`[COACH_ORG_PROGRAM_MODULE_DELETE] Deleted module ${moduleId} and ${weeksSnapshot.size} weeks`);

    // Check if there are any remaining modules
    const remainingModules = await adminDb
      .collection('program_modules')
      .where('programId', '==', programId)
      .limit(1)
      .get();

    if (remainingModules.empty) {
      // Update program to indicate it no longer has modules
      await adminDb.collection('programs').doc(programId).update({
        hasModules: false,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Module deleted successfully',
      deletedWeeks: weeksSnapshot.size,
    });
  } catch (error) {
    console.error('[COACH_ORG_PROGRAM_MODULE_DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to delete module' }, { status: 500 });
  }
}
