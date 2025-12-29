/**
 * Program Enrollment Check API
 * 
 * GET /api/programs/enrollments/check?programId=xxx
 * Returns the current user's enrollment status for a specific program,
 * including subscription information for recurring programs.
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { ProgramEnrollment } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('programId');

    if (!programId) {
      return NextResponse.json({ error: 'Program ID is required' }, { status: 400 });
    }

    // Get program to verify it exists
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    // Find user's enrollment in this program
    const enrollmentQuery = await adminDb
      .collection('program_enrollments')
      .where('userId', '==', userId)
      .where('programId', '==', programId)
      .where('status', 'in', ['active', 'upcoming'])
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (enrollmentQuery.empty) {
      return NextResponse.json({
        isEnrolled: false,
        subscriptionStatus: 'none',
        subscriptionId: null,
        currentPeriodEnd: null,
        accessEndsAt: null,
        cancelAtPeriodEnd: false,
      });
    }

    const enrollmentDoc = enrollmentQuery.docs[0];
    const enrollment = enrollmentDoc.data() as ProgramEnrollment;

    // Return enrollment with subscription info
    return NextResponse.json({
      isEnrolled: true,
      enrollmentId: enrollmentDoc.id,
      status: enrollment.status,
      subscriptionStatus: enrollment.subscriptionStatus || 'none',
      subscriptionId: enrollment.subscriptionId || null,
      currentPeriodEnd: enrollment.currentPeriodEnd || null,
      accessEndsAt: enrollment.accessEndsAt || null,
      cancelAtPeriodEnd: enrollment.cancelAtPeriodEnd || false,
      startedAt: enrollment.startedAt,
      cohortId: enrollment.cohortId || null,
    });
  } catch (error) {
    console.error('[PROGRAM_ENROLLMENT_CHECK] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

