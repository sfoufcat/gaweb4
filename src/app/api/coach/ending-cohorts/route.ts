/**
 * GET /api/coach/ending-cohorts
 * 
 * Returns cohorts that are in grace period or recently ended that haven't been
 * converted to community yet. Used to show coaches a banner prompting them
 * to decide what happens to their squads.
 * 
 * Authorization:
 * - Must be a coach with an organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { ProgramCohort, Squad, Program } from '@/types';

interface EndingCohortWithDetails {
  cohort: ProgramCohort;
  program: {
    id: string;
    name: string;
    coverImageUrl?: string;
  };
  squads: {
    id: string;
    name: string;
    memberCount: number;
  }[];
  daysUntilClose: number;
  convertSquadsToCommunity: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Find cohorts that:
    // 1. Belong to this organization
    // 2. Have ended (endDate < today)
    // 3. Are still in grace period OR recently completed
    // 4. Have not been converted to community yet (have squads with programId still set)
    const cohortsSnapshot = await adminDb
      .collection('program_cohorts')
      .where('organizationId', '==', organizationId)
      .where('status', 'in', ['active', 'completed'])
      .get();

    const endingCohorts: EndingCohortWithDetails[] = [];

    for (const doc of cohortsSnapshot.docs) {
      const cohortData = doc.data();
      const cohort: ProgramCohort = {
        id: doc.id,
        ...cohortData,
        createdAt: cohortData.createdAt?.toDate?.()?.toISOString?.() || cohortData.createdAt,
        updatedAt: cohortData.updatedAt?.toDate?.()?.toISOString?.() || cohortData.updatedAt,
      } as ProgramCohort;

      // Check if cohort has ended but is still in grace period
      const endDate = new Date(cohort.endDate);
      const gracePeriodEnd = cohort.gracePeriodEndDate
        ? new Date(cohort.gracePeriodEndDate)
        : new Date(endDate.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Skip if cohort hasn't ended yet
      if (endDate > now) continue;

      // Skip if grace period has passed
      if (gracePeriodEnd < now) continue;

      // Calculate days until close
      const daysUntilClose = Math.ceil(
        (gracePeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );

      // Get program details
      const programDoc = await adminDb
        .collection('programs')
        .doc(cohort.programId)
        .get();

      if (!programDoc.exists) continue;
      const programData = programDoc.data() as Program;

      // Get squads for this cohort that still have programId set
      // (not yet converted to community)
      const squadsSnapshot = await adminDb
        .collection('squads')
        .where('cohortId', '==', cohort.id)
        .where('programId', '==', cohort.programId)
        .get();

      // Skip if no squads to convert
      if (squadsSnapshot.empty) continue;

      const squads = squadsSnapshot.docs.map((squadDoc) => {
        const data = squadDoc.data() as Squad;
        return {
          id: squadDoc.id,
          name: data.name,
          memberCount: data.memberIds?.length || 0,
        };
      });

      endingCohorts.push({
        cohort,
        program: {
          id: programDoc.id,
          name: programData.name,
          coverImageUrl: programData.coverImageUrl,
        },
        squads,
        daysUntilClose,
        convertSquadsToCommunity: cohort.convertSquadsToCommunity || false,
      });
    }

    // Sort by daysUntilClose ascending (most urgent first)
    endingCohorts.sort((a, b) => a.daysUntilClose - b.daysUntilClose);

    return NextResponse.json({
      endingCohorts,
      totalCount: endingCohorts.length,
    });
  } catch (error) {
    console.error('[ENDING_COHORTS_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json(
        { error: 'Forbidden: Coach access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch ending cohorts' },
      { status: 500 }
    );
  }
}

