/**
 * Coach API: Program Modules Management
 *
 * GET /api/coach/org-programs/[programId]/modules - List all modules for a program
 * POST /api/coach/org-programs/[programId]/modules - Create a new module
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { ProgramModule } from '@/types';

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

    const modulesSnapshot = await adminDb
      .collection('program_modules')
      .where('programId', '==', programId)
      .get();

    const modules = modulesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
    })) as ProgramModule[];

    // Sort by order in memory (avoids composite index requirement)
    modules.sort((a, b) => (a.order || 0) - (b.order || 0));

    return NextResponse.json({
      modules,
      totalModules: modules.length,
    });
  } catch (error) {
    console.error('[COACH_ORG_PROGRAM_MODULES_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch program modules' }, { status: 500 });
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

    // Validate required fields
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Module name is required' }, { status: 400 });
    }
    if (typeof body.startDayIndex !== 'number' || typeof body.endDayIndex !== 'number') {
      return NextResponse.json({ error: 'startDayIndex and endDayIndex are required' }, { status: 400 });
    }
    if (body.startDayIndex > body.endDayIndex) {
      return NextResponse.json({ error: 'startDayIndex must be <= endDayIndex' }, { status: 400 });
    }

    // Get next order number (simple query without orderBy to avoid index requirement)
    const existingModules = await adminDb
      .collection('program_modules')
      .where('programId', '==', programId)
      .get();

    // Calculate next order from existing modules
    let maxOrder = 0;
    existingModules.docs.forEach(doc => {
      const order = doc.data().order || 0;
      if (order > maxOrder) maxOrder = order;
    });
    const nextOrder = maxOrder + 1;

    const moduleData = {
      programId,
      organizationId,
      order: body.order ?? nextOrder,
      name: body.name.trim(),
      description: body.description?.trim() || undefined,
      startDayIndex: body.startDayIndex,
      endDayIndex: body.endDayIndex,
      habits: body.habits || [],
      linkedCourseIds: body.linkedCourseIds || undefined,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection('program_modules').add(moduleData);
    console.log(`[COACH_ORG_PROGRAM_MODULES_POST] Created module ${body.name} for program ${programId}`);

    // Update program to indicate it has modules
    await adminDb.collection('programs').doc(programId).update({
      hasModules: true,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Fetch the created module
    const savedDoc = await adminDb.collection('program_modules').doc(docRef.id).get();
    const savedModule = {
      id: savedDoc.id,
      ...savedDoc.data(),
      createdAt: savedDoc.data()?.createdAt?.toDate?.()?.toISOString?.() || savedDoc.data()?.createdAt,
      updatedAt: savedDoc.data()?.updatedAt?.toDate?.()?.toISOString?.() || savedDoc.data()?.updatedAt,
    } as ProgramModule;

    return NextResponse.json({
      success: true,
      module: savedModule,
      message: 'Program module created successfully',
    });
  } catch (error) {
    console.error('[COACH_ORG_PROGRAM_MODULES_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    const stack = error instanceof Error ? error.stack : '';

    // Log full error for debugging
    console.error('[COACH_ORG_PROGRAM_MODULES_POST] Full error:', { message, stack });

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    // Return detailed error in development
    return NextResponse.json({
      error: 'Failed to create program module',
      details: process.env.NODE_ENV === 'development' ? message : undefined,
    }, { status: 500 });
  }
}
