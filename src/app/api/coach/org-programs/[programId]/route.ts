/**
 * Coach API: Single Program Management (org-scoped)
 * 
 * GET /api/coach/org-programs/[programId] - Get program details with days
 * PUT /api/coach/org-programs/[programId] - Update program
 * DELETE /api/coach/org-programs/[programId] - Delete program
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { Program, ProgramDay, ProgramCohort, ProgramHabitTemplate } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId } = await params;
    
    const programDoc = await adminDb.collection('programs').doc(programId).get();

    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const programData = programDoc.data();
    
    // Verify program belongs to this organization
    if (programData?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    const program = {
      id: programDoc.id,
      ...programData,
      createdAt: programData?.createdAt?.toDate?.()?.toISOString?.() || programData?.createdAt,
      updatedAt: programData?.updatedAt?.toDate?.()?.toISOString?.() || programData?.updatedAt,
    } as Program;

    // Fetch program days
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

    // For group programs, also fetch cohorts
    let cohorts: ProgramCohort[] = [];
    if (program.type === 'group') {
      const cohortsSnapshot = await adminDb
        .collection('program_cohorts')
        .where('programId', '==', programId)
        .orderBy('startDate', 'desc')
        .get();

      cohorts = cohortsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
      })) as ProgramCohort[];
    }

    // Count enrollments
    const [activeEnrollments, totalEnrollments] = await Promise.all([
      adminDb
        .collection('program_enrollments')
        .where('programId', '==', programId)
        .where('status', 'in', ['active', 'upcoming'])
        .count()
        .get(),
      adminDb
        .collection('program_enrollments')
        .where('programId', '==', programId)
        .count()
        .get(),
    ]);

    return NextResponse.json({ 
      program, 
      days,
      cohorts,
      stats: {
        totalEnrollments: totalEnrollments.data().count,
        activeEnrollments: activeEnrollments.data().count,
        cohortCount: cohorts.length,
        dayCount: days.length,
      },
    });
  } catch (error) {
    console.error('[COACH_ORG_PROGRAM_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch program' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId } = await params;
    const body = await request.json();

    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const currentData = programDoc.data();
    
    // Verify program belongs to this organization
    if (currentData?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    // Validate type if being changed (not allowed to change type after creation)
    if (body.type !== undefined && body.type !== currentData?.type) {
      return NextResponse.json(
        { error: 'Cannot change program type after creation' },
        { status: 400 }
      );
    }

    // Validate lengthDays if being changed
    if (body.lengthDays !== undefined) {
      if (typeof body.lengthDays !== 'number' || body.lengthDays < 1 || body.lengthDays > 365) {
        return NextResponse.json(
          { error: 'lengthDays must be a number between 1 and 365' },
          { status: 400 }
        );
      }
    }

    // If slug is being changed, check it doesn't conflict within the org
    if (body.slug && body.slug !== currentData?.slug) {
      const existingProgram = await adminDb
        .collection('programs')
        .where('organizationId', '==', organizationId)
        .where('slug', '==', body.slug)
        .limit(1)
        .get();

      if (!existingProgram.empty && existingProgram.docs[0].id !== programId) {
        return NextResponse.json(
          { error: `Program with slug "${body.slug}" already exists in your organization` },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    // String fields
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.description !== undefined) updateData.description = body.description.trim();
    if (body.coverImageUrl !== undefined) updateData.coverImageUrl = body.coverImageUrl || null;
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.stripePriceId !== undefined) updateData.stripePriceId = body.stripePriceId || null;
    
    // Number fields
    if (body.lengthDays !== undefined) updateData.lengthDays = body.lengthDays;
    if (body.priceInCents !== undefined) updateData.priceInCents = body.priceInCents;
    if (body.squadCapacity !== undefined && currentData?.type === 'group') {
      updateData.squadCapacity = body.squadCapacity;
    }
    
    // Boolean fields
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.isPublished !== undefined) updateData.isPublished = body.isPublished;
    if (body.coachInSquads !== undefined && currentData?.type === 'group') {
      updateData.coachInSquads = body.coachInSquads;
    }

    // Handle default habits
    if (body.defaultHabits !== undefined) {
      const defaultHabits: ProgramHabitTemplate[] = [];
      if (Array.isArray(body.defaultHabits)) {
        for (const habit of body.defaultHabits) {
          if (!habit.title) continue;
          defaultHabits.push({
            title: habit.title,
            description: habit.description || '',
            frequency: habit.frequency || 'daily',
          });
        }
      }
      updateData.defaultHabits = defaultHabits.length > 0 ? defaultHabits : null;
    }

    await adminDb.collection('programs').doc(programId).update(updateData);

    console.log(`[COACH_ORG_PROGRAM_PUT] Updated program: ${programId} in org ${organizationId}`);

    // Fetch updated program
    const updatedDoc = await adminDb.collection('programs').doc(programId).get();
    const updatedData = updatedDoc.data();
    const updatedProgram = {
      id: updatedDoc.id,
      ...updatedData,
      createdAt: updatedData?.createdAt?.toDate?.()?.toISOString?.() || updatedData?.createdAt,
      updatedAt: updatedData?.updatedAt?.toDate?.()?.toISOString?.() || updatedData?.updatedAt,
    } as Program;

    return NextResponse.json({ 
      success: true, 
      program: updatedProgram,
      message: 'Program updated successfully' 
    });
  } catch (error) {
    console.error('[COACH_ORG_PROGRAM_PUT] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to update program' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId } = await params;
    
    const programDoc = await adminDb.collection('programs').doc(programId).get();

    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const programData = programDoc.data();
    
    // Verify program belongs to this organization
    if (programData?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    // Safety check: Don't allow deleting programs that have active enrollments
    const activeEnrollments = await adminDb
      .collection('program_enrollments')
      .where('programId', '==', programId)
      .where('status', 'in', ['active', 'upcoming'])
      .limit(1)
      .get();

    if (!activeEnrollments.empty) {
      return NextResponse.json(
        { error: `Cannot delete program "${programData?.name}" - it has active enrollments. Deactivate it instead.` },
        { status: 400 }
      );
    }

    // Delete in order: cohorts, days, enrollments (completed/stopped), then program
    const batch = adminDb.batch();

    // Delete cohorts
    const cohortsSnapshot = await adminDb
      .collection('program_cohorts')
      .where('programId', '==', programId)
      .get();
    cohortsSnapshot.docs.forEach(doc => batch.delete(doc.ref));

    // Delete program days
    const daysSnapshot = await adminDb
      .collection('program_days')
      .where('programId', '==', programId)
      .get();
    daysSnapshot.docs.forEach(doc => batch.delete(doc.ref));

    // Delete past enrollments
    const enrollmentsSnapshot = await adminDb
      .collection('program_enrollments')
      .where('programId', '==', programId)
      .get();
    enrollmentsSnapshot.docs.forEach(doc => batch.delete(doc.ref));

    // Delete the program
    batch.delete(programDoc.ref);

    await batch.commit();

    console.log(`[COACH_ORG_PROGRAM_DELETE] Deleted program: ${programId} (${programData?.name}) with ${cohortsSnapshot.size} cohorts, ${daysSnapshot.size} days, ${enrollmentsSnapshot.size} enrollments`);

    return NextResponse.json({ 
      success: true, 
      message: 'Program deleted successfully',
      deleted: {
        cohorts: cohortsSnapshot.size,
        days: daysSnapshot.size,
        enrollments: enrollmentsSnapshot.size,
      },
    });
  } catch (error) {
    console.error('[COACH_ORG_PROGRAM_DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to delete program' }, { status: 500 });
  }
}

