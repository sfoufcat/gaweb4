/**
 * Coach API: Program Cohorts Management
 * 
 * GET /api/coach/org-programs/[programId]/cohorts - List cohorts for a program
 * POST /api/coach/org-programs/[programId]/cohorts - Create new cohort
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { ProgramCohort, CohortWithSquads, Squad } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId } = await params;
    const { searchParams } = new URL(request.url);
    
    // Optional filters
    const status = searchParams.get('status');
    const includeSquads = searchParams.get('includeSquads') === 'true';

    // Verify program belongs to this organization
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }
    if (programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }
    if (programDoc.data()?.type !== 'group') {
      return NextResponse.json({ error: 'Cohorts are only available for group programs' }, { status: 400 });
    }

    // Build query
    let query = adminDb
      .collection('program_cohorts')
      .where('programId', '==', programId);

    // Parse comma-separated status values (e.g., "upcoming,active")
    const statusValues = status ? status.split(',').map(s => s.trim()).filter(Boolean) : [];

    // Note: We filter by status AFTER fetching because we calculate status dynamically
    // based on dates, not stored status. The stored status might be stale.
    const cohortsSnapshot = await query.get();

    // Helper to calculate current status based on dates
    const calculateCohortStatus = (startDate: string, endDate: string, storedStatus: string): 'upcoming' | 'active' | 'completed' | 'archived' => {
      // If manually archived, keep it archived
      if (storedStatus === 'archived') return 'archived';
      
      const now = new Date();
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (end <= now) return 'completed';
      if (start <= now && end > now) return 'active';
      return 'upcoming';
    };

    let cohorts: (ProgramCohort | CohortWithSquads)[] = cohortsSnapshot.docs.map(doc => {
      const data = doc.data();
      const calculatedStatus = calculateCohortStatus(
        data.startDate,
        data.endDate,
        data.status
      );
      return {
        id: doc.id,
        ...data,
        status: calculatedStatus, // Use calculated status instead of stored
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt,
      };
    }) as ProgramCohort[];

    // Filter by status if specified (using calculated status, not stored)
    if (statusValues.length > 0) {
      cohorts = cohorts.filter(c => statusValues.includes(c.status));
    }

    // Sort by startDate descending (in memory to avoid composite index requirement)
    cohorts.sort((a, b) =>
      new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );

    // Optionally include squads for each cohort
    if (includeSquads) {
      cohorts = await Promise.all(
        cohorts.map(async (cohort) => {
          const squadsSnapshot = await adminDb
            .collection('squads')
            .where('cohortId', '==', cohort.id)
            .get();

          const squads = squadsSnapshot.docs.map(doc => {
            const data = doc.data() as Squad;
            return {
              id: doc.id,
              name: data.name,
              memberCount: data.memberIds?.length || 0,
              capacity: data.capacity || programDoc.data()?.squadCapacity || 10,
            };
          });

          return {
            ...cohort,
            squads,
          } as CohortWithSquads;
        })
      );
    }

    return NextResponse.json({ 
      cohorts,
      totalCount: cohorts.length,
      programId,
    });
  } catch (error) {
    console.error('[COACH_ORG_COHORTS_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch cohorts' }, { status: 500 });
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

    // Verify program belongs to this organization
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }
    const programData = programDoc.data();
    if (programData?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }
    if (programData?.type !== 'group') {
      return NextResponse.json({ error: 'Cohorts can only be created for group programs' }, { status: 400 });
    }

    // Validate required fields
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Cohort name is required' }, { status: 400 });
    }
    if (!body.startDate) {
      return NextResponse.json({ error: 'Start date is required' }, { status: 400 });
    }

    // Validate dates
    const startDate = new Date(body.startDate);
    if (isNaN(startDate.getTime())) {
      return NextResponse.json({ error: 'Invalid start date format' }, { status: 400 });
    }

    // Calculate end date based on program length
    const endDate = body.endDate 
      ? new Date(body.endDate)
      : new Date(startDate.getTime() + (programData.lengthDays - 1) * 24 * 60 * 60 * 1000);

    if (isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid end date format' }, { status: 400 });
    }

    if (endDate <= startDate) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
    }

    // Check for overlapping cohort names
    const existingCohort = await adminDb
      .collection('program_cohorts')
      .where('programId', '==', programId)
      .where('name', '==', body.name.trim())
      .limit(1)
      .get();

    if (!existingCohort.empty) {
      return NextResponse.json(
        { error: `Cohort "${body.name}" already exists for this program` },
        { status: 400 }
      );
    }

    // Determine initial status
    const now = new Date();
    let status: 'upcoming' | 'active' | 'completed' = 'upcoming';
    if (startDate <= now && endDate > now) {
      status = 'active';
    } else if (endDate <= now) {
      status = 'completed';
    }

    // Calculate grace period end (7 days after end date)
    const gracePeriodEndDate = new Date(endDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Get org default for convert to community if not explicitly set
    let convertSquadsToCommunity = body.convertSquadsToCommunity;
    if (convertSquadsToCommunity === undefined) {
      const orgSettingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
      if (orgSettingsDoc.exists) {
        convertSquadsToCommunity = orgSettingsDoc.data()?.defaultConvertToCommunity === true;
      } else {
        convertSquadsToCommunity = false;
      }
    }

    const cohortData: Omit<ProgramCohort, 'id' | 'createdAt' | 'updatedAt'> & { createdAt: FieldValue; updatedAt: FieldValue } = {
      programId,
      organizationId,
      name: body.name.trim(),
      startDate: startDate.toISOString().split('T')[0], // Store as YYYY-MM-DD
      endDate: endDate.toISOString().split('T')[0],
      enrollmentOpen: body.enrollmentOpen !== false,
      maxEnrollment: body.maxEnrollment || undefined,
      currentEnrollment: 0,
      status,
      gracePeriodEndDate: gracePeriodEndDate.toISOString().split('T')[0],
      closingNotificationSent: false,
      convertSquadsToCommunity: convertSquadsToCommunity === true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection('program_cohorts').add(cohortData);

    console.log(`[COACH_ORG_COHORTS_POST] Created cohort: ${body.name} (${docRef.id}) for program ${programId}`);

    return NextResponse.json({ 
      success: true, 
      id: docRef.id,
      cohort: { 
        id: docRef.id, 
        ...cohortData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      message: 'Cohort created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('[COACH_ORG_COHORTS_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to create cohort' }, { status: 500 });
  }
}

