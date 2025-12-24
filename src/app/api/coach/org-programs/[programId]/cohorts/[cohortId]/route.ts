/**
 * Coach API: Single Cohort Management
 * 
 * GET /api/coach/org-programs/[programId]/cohorts/[cohortId] - Get cohort details
 * PUT /api/coach/org-programs/[programId]/cohorts/[cohortId] - Update cohort
 * DELETE /api/coach/org-programs/[programId]/cohorts/[cohortId] - Delete cohort
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { ProgramCohort, Squad, ProgramEnrollment } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; cohortId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, cohortId } = await params;

    // Verify program belongs to this organization
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }
    if (programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    // Get cohort
    const cohortDoc = await adminDb.collection('program_cohorts').doc(cohortId).get();
    if (!cohortDoc.exists) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }
    if (cohortDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Cohort does not belong to this program' }, { status: 404 });
    }

    const cohortData = cohortDoc.data();
    const cohort: ProgramCohort = {
      id: cohortDoc.id,
      ...cohortData,
      createdAt: cohortData?.createdAt?.toDate?.()?.toISOString?.() || cohortData?.createdAt,
      updatedAt: cohortData?.updatedAt?.toDate?.()?.toISOString?.() || cohortData?.updatedAt,
    } as ProgramCohort;

    // Get squads for this cohort
    const squadsSnapshot = await adminDb
      .collection('squads')
      .where('cohortId', '==', cohortId)
      .get();

    const squads = squadsSnapshot.docs.map(doc => {
      const data = doc.data() as Squad;
      return {
        id: doc.id,
        name: data.name,
        memberCount: data.memberIds?.length || 0,
        capacity: data.capacity || programDoc.data()?.squadCapacity || 10,
        coachId: data.coachId,
        avatarUrl: data.avatarUrl,
      };
    });

    // Get enrollment stats
    const [activeEnrollments, totalEnrollments] = await Promise.all([
      adminDb
        .collection('program_enrollments')
        .where('cohortId', '==', cohortId)
        .where('status', 'in', ['active', 'upcoming'])
        .count()
        .get(),
      adminDb
        .collection('program_enrollments')
        .where('cohortId', '==', cohortId)
        .count()
        .get(),
    ]);

    return NextResponse.json({ 
      cohort,
      squads,
      stats: {
        totalEnrollments: totalEnrollments.data().count,
        activeEnrollments: activeEnrollments.data().count,
        squadCount: squads.length,
      },
    });
  } catch (error) {
    console.error('[COACH_ORG_COHORT_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch cohort' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; cohortId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, cohortId } = await params;
    const body = await request.json();

    // Verify program belongs to this organization
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }
    if (programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    // Get cohort
    const cohortDoc = await adminDb.collection('program_cohorts').doc(cohortId).get();
    if (!cohortDoc.exists) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }
    if (cohortDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Cohort does not belong to this program' }, { status: 404 });
    }

    const currentData = cohortDoc.data();

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Name update
    if (body.name !== undefined) {
      if (!body.name.trim()) {
        return NextResponse.json({ error: 'Cohort name cannot be empty' }, { status: 400 });
      }
      // Check for duplicate names
      const existingCohort = await adminDb
        .collection('program_cohorts')
        .where('programId', '==', programId)
        .where('name', '==', body.name.trim())
        .limit(1)
        .get();
      if (!existingCohort.empty && existingCohort.docs[0].id !== cohortId) {
        return NextResponse.json(
          { error: `Cohort "${body.name}" already exists for this program` },
          { status: 400 }
        );
      }
      updateData.name = body.name.trim();
    }

    // Date updates
    if (body.startDate !== undefined) {
      const startDate = new Date(body.startDate);
      if (isNaN(startDate.getTime())) {
        return NextResponse.json({ error: 'Invalid start date format' }, { status: 400 });
      }
      updateData.startDate = startDate.toISOString().split('T')[0];
    }

    if (body.endDate !== undefined) {
      const endDate = new Date(body.endDate);
      if (isNaN(endDate.getTime())) {
        return NextResponse.json({ error: 'Invalid end date format' }, { status: 400 });
      }
      updateData.endDate = endDate.toISOString().split('T')[0];
      // Recalculate grace period
      const gracePeriodEndDate = new Date(endDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      updateData.gracePeriodEndDate = gracePeriodEndDate.toISOString().split('T')[0];
    }

    // Enrollment settings
    if (body.enrollmentOpen !== undefined) {
      updateData.enrollmentOpen = body.enrollmentOpen;
    }
    if (body.maxEnrollment !== undefined) {
      updateData.maxEnrollment = body.maxEnrollment || null;
    }

    // Status update (manual override)
    if (body.status !== undefined) {
      if (!['upcoming', 'active', 'completed', 'archived'].includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updateData.status = body.status;
    }

    await adminDb.collection('program_cohorts').doc(cohortId).update(updateData);

    console.log(`[COACH_ORG_COHORT_PUT] Updated cohort: ${cohortId} for program ${programId}`);

    // Fetch updated cohort
    const updatedDoc = await adminDb.collection('program_cohorts').doc(cohortId).get();
    const updatedData = updatedDoc.data();
    const updatedCohort = {
      id: updatedDoc.id,
      ...updatedData,
      createdAt: updatedData?.createdAt?.toDate?.()?.toISOString?.() || updatedData?.createdAt,
      updatedAt: updatedData?.updatedAt?.toDate?.()?.toISOString?.() || updatedData?.updatedAt,
    } as ProgramCohort;

    return NextResponse.json({ 
      success: true, 
      cohort: updatedCohort,
      message: 'Cohort updated successfully' 
    });
  } catch (error) {
    console.error('[COACH_ORG_COHORT_PUT] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to update cohort' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; cohortId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, cohortId } = await params;

    // Verify program belongs to this organization
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }
    if (programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    // Get cohort
    const cohortDoc = await adminDb.collection('program_cohorts').doc(cohortId).get();
    if (!cohortDoc.exists) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }
    if (cohortDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Cohort does not belong to this program' }, { status: 404 });
    }

    const cohortName = cohortDoc.data()?.name;

    // Safety check: Don't allow deleting cohorts with active enrollments
    const activeEnrollments = await adminDb
      .collection('program_enrollments')
      .where('cohortId', '==', cohortId)
      .where('status', 'in', ['active', 'upcoming'])
      .limit(1)
      .get();

    if (!activeEnrollments.empty) {
      return NextResponse.json(
        { error: `Cannot delete cohort "${cohortName}" - it has active enrollments. Archive it instead.` },
        { status: 400 }
      );
    }

    // Delete related data
    const batch = adminDb.batch();

    // Delete squads linked to this cohort
    const squadsSnapshot = await adminDb
      .collection('squads')
      .where('cohortId', '==', cohortId)
      .get();
    squadsSnapshot.docs.forEach(doc => batch.delete(doc.ref));

    // Delete squad members for those squads
    for (const squadDoc of squadsSnapshot.docs) {
      const membersSnapshot = await adminDb
        .collection('squadMembers')
        .where('squadId', '==', squadDoc.id)
        .get();
      membersSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    }

    // Delete past enrollments
    const enrollmentsSnapshot = await adminDb
      .collection('program_enrollments')
      .where('cohortId', '==', cohortId)
      .get();
    enrollmentsSnapshot.docs.forEach(doc => batch.delete(doc.ref));

    // Delete the cohort
    batch.delete(cohortDoc.ref);

    await batch.commit();

    console.log(`[COACH_ORG_COHORT_DELETE] Deleted cohort: ${cohortId} (${cohortName}) with ${squadsSnapshot.size} squads, ${enrollmentsSnapshot.size} enrollments`);

    return NextResponse.json({ 
      success: true, 
      message: 'Cohort deleted successfully',
      deleted: {
        squads: squadsSnapshot.size,
        enrollments: enrollmentsSnapshot.size,
      },
    });
  } catch (error) {
    console.error('[COACH_ORG_COHORT_DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to delete cohort' }, { status: 500 });
  }
}


