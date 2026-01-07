import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * GET /api/funnel/validate-cohort
 * 
 * Validates if a cohort is valid for enrollment (exists and hasn't passed).
 * Used by funnel to determine if upsell/downsell steps should be shown.
 * 
 * Query params:
 * - cohortId: Specific cohort ID to validate (for 'specific' mode)
 * - programId: Program ID to check for available cohorts (for 'next_available' mode)
 * - mode: 'specific' | 'next_available' (default: 'specific' if cohortId provided)
 * 
 * Returns:
 * - valid: boolean - Whether the cohort is valid
 * - reason: string - Reason if invalid
 * - cohortId?: string - The valid cohort ID (for 'next_available' mode)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cohortId = searchParams.get('cohortId');
  const programId = searchParams.get('programId');
  const mode = searchParams.get('mode') || (cohortId ? 'specific' : 'next_available');

  try {
    if (mode === 'specific') {
      // Validate specific cohort
      if (!cohortId) {
        return NextResponse.json({ 
          valid: false, 
          reason: 'No cohort ID provided' 
        });
      }

      const cohortDoc = await adminDb.collection('program_cohorts').doc(cohortId).get();
      
      if (!cohortDoc.exists) {
        return NextResponse.json({ 
          valid: false, 
          reason: 'Cohort not found' 
        });
      }

      const cohort = cohortDoc.data();
      
      // Check if cohort enrollment is open
      if (!cohort?.enrollmentOpen) {
        return NextResponse.json({ 
          valid: false, 
          reason: 'Cohort enrollment is closed' 
        });
      }

      // Check if cohort status is valid
      if (cohort.status !== 'upcoming' && cohort.status !== 'active') {
        return NextResponse.json({ 
          valid: false, 
          reason: `Cohort status is ${cohort.status}` 
        });
      }

      // Check if cohort start date has passed (for upcoming cohorts, this is fine)
      // For active cohorts, users can still join during the program
      const startDate = new Date(cohort.startDate);
      const now = new Date();
      
      // If cohort has ended (endDate passed), it's invalid
      if (cohort.endDate) {
        const endDate = new Date(cohort.endDate);
        if (endDate < now) {
          return NextResponse.json({ 
            valid: false, 
            reason: 'Cohort has ended' 
          });
        }
      }

      return NextResponse.json({ 
        valid: true,
        cohortId,
        startDate: cohort.startDate,
        status: cohort.status,
      });
    } else {
      // Find next available cohort for program
      if (!programId) {
        return NextResponse.json({ 
          valid: false, 
          reason: 'No program ID provided' 
        });
      }

      // Check if this is a group program
      const programDoc = await adminDb.collection('programs').doc(programId).get();
      if (!programDoc.exists) {
        return NextResponse.json({ 
          valid: false, 
          reason: 'Program not found' 
        });
      }

      const program = programDoc.data();
      if (program?.type !== 'group') {
        // Individual programs don't need cohorts - always valid
        return NextResponse.json({ 
          valid: true,
          reason: 'Individual program - no cohort needed'
        });
      }

      // Find cohorts with upcoming start dates and enrollment open
      const now = new Date().toISOString();
      const cohortsSnapshot = await adminDb
        .collection('program_cohorts')
        .where('programId', '==', programId)
        .where('enrollmentOpen', '==', true)
        .where('status', 'in', ['upcoming', 'active'])
        .orderBy('startDate', 'asc')
        .limit(10)
        .get();

      if (cohortsSnapshot.empty) {
        return NextResponse.json({ 
          valid: false, 
          reason: 'No available cohorts for this program' 
        });
      }

      // Find first cohort that hasn't ended
      for (const doc of cohortsSnapshot.docs) {
        const cohort = doc.data();
        
        // Skip if cohort has ended
        if (cohort.endDate && new Date(cohort.endDate) < new Date()) {
          continue;
        }

        return NextResponse.json({ 
          valid: true,
          cohortId: doc.id,
          startDate: cohort.startDate,
          status: cohort.status,
        });
      }

      return NextResponse.json({ 
        valid: false, 
        reason: 'All cohorts have ended' 
      });
    }
  } catch (error) {
    console.error('[VALIDATE_COHORT] Error:', error);
    return NextResponse.json(
      { valid: false, reason: 'Server error' },
      { status: 500 }
    );
  }
}










