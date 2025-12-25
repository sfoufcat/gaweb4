/**
 * Coach API: Duplicate Cohort
 * 
 * POST /api/coach/org-programs/[programId]/cohorts/[cohortId]/duplicate - Clone a cohort
 * 
 * Creates a copy of the cohort with:
 * - New name: "Original Name (Copy)" or incremented
 * - Start date: 7 days from today
 * - End date: Recalculated based on program length
 * - All settings preserved (maxEnrollment, convertSquadsToCommunity, etc.)
 * - Fresh enrollment count (0)
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { ProgramCohort } from '@/types';

export async function POST(
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
    const programData = programDoc.data();
    if (programData?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    // Get source cohort
    const cohortDoc = await adminDb.collection('program_cohorts').doc(cohortId).get();
    if (!cohortDoc.exists) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }
    if (cohortDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Cohort does not belong to this program' }, { status: 404 });
    }

    const sourceCohort = cohortDoc.data() as ProgramCohort;

    // Generate unique name
    let newName = `${sourceCohort.name} (Copy)`;
    let copyNumber = 1;
    
    // Check if name already exists and increment if needed
    while (true) {
      const existingCohort = await adminDb
        .collection('program_cohorts')
        .where('programId', '==', programId)
        .where('name', '==', newName)
        .limit(1)
        .get();

      if (existingCohort.empty) {
        break;
      }
      
      copyNumber++;
      newName = `${sourceCohort.name} (Copy ${copyNumber})`;
      
      // Safety limit
      if (copyNumber > 100) {
        return NextResponse.json(
          { error: 'Too many copies of this cohort exist' },
          { status: 400 }
        );
      }
    }

    // Calculate new dates (start 7 days from now)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 7);
    startDate.setHours(0, 0, 0, 0);

    // Calculate end date based on program length
    const lengthDays = programData?.lengthDays || 30;
    const endDate = new Date(startDate.getTime() + (lengthDays - 1) * 24 * 60 * 60 * 1000);

    // Calculate grace period end (7 days after end date)
    const gracePeriodEndDate = new Date(endDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Create new cohort with copied settings
    const newCohortData: Omit<ProgramCohort, 'id' | 'createdAt' | 'updatedAt'> & { 
      createdAt: FieldValue; 
      updatedAt: FieldValue 
    } = {
      programId,
      organizationId,
      name: newName,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      enrollmentOpen: true, // New cohort starts with enrollment open
      maxEnrollment: sourceCohort.maxEnrollment,
      currentEnrollment: 0, // Fresh start
      status: 'upcoming', // New cohort is always upcoming
      gracePeriodEndDate: gracePeriodEndDate.toISOString().split('T')[0],
      closingNotificationSent: false,
      convertSquadsToCommunity: sourceCohort.convertSquadsToCommunity ?? false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection('program_cohorts').add(newCohortData);

    console.log(`[COACH_ORG_COHORT_DUPLICATE] Duplicated cohort: ${sourceCohort.name} -> ${newName} (${docRef.id}) for program ${programId}`);

    return NextResponse.json({ 
      success: true, 
      id: docRef.id,
      cohort: { 
        id: docRef.id, 
        ...newCohortData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      message: `Cohort duplicated as "${newName}"`,
    }, { status: 201 });
  } catch (error) {
    console.error('[COACH_ORG_COHORT_DUPLICATE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to duplicate cohort' }, { status: 500 });
  }
}

