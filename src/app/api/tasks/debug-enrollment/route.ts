/**
 * Debug API: Check specific enrollment and related data
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const enrollmentId = searchParams.get('enrollmentId');
    const instanceId = searchParams.get('instanceId');

    const result: Record<string, unknown> = {
      currentUserId: userId,
    };

    // Check enrollment if provided
    if (enrollmentId) {
      const enrollmentDoc = await adminDb.collection('program_enrollments').doc(enrollmentId).get();
      if (enrollmentDoc.exists) {
        const data = enrollmentDoc.data()!;
        result.enrollment = {
          id: enrollmentDoc.id,
          userId: data.userId,
          status: data.status,
          programId: data.programId,
          cohortId: data.cohortId,
          organizationId: data.organizationId,
          createdAt: data.createdAt,
          isYourEnrollment: data.userId === userId,
        };
      } else {
        result.enrollment = 'NOT FOUND';
      }
    }

    // Check instance if provided
    if (instanceId) {
      const instanceDoc = await adminDb.collection('program_instances').doc(instanceId).get();
      if (instanceDoc.exists) {
        const data = instanceDoc.data()!;
        result.instance = {
          id: instanceDoc.id,
          type: data.type,
          programId: data.programId,
          cohortId: data.cohortId,
          enrollmentId: data.enrollmentId,
          status: data.status,
          createdAt: data.createdAt,
        };

        // If it's a cohort instance, check who's in the cohort
        if (data.cohortId) {
          const cohortEnrollments = await adminDb
            .collection('program_enrollments')
            .where('cohortId', '==', data.cohortId)
            .get();

          result.cohortMembers = cohortEnrollments.docs.map(doc => ({
            enrollmentId: doc.id,
            userId: doc.data().userId,
            status: doc.data().status,
            isYou: doc.data().userId === userId,
          }));
        }

        // If it's an individual instance, check the enrollment
        if (data.enrollmentId) {
          const linkedEnrollment = await adminDb
            .collection('program_enrollments')
            .doc(data.enrollmentId)
            .get();

          if (linkedEnrollment.exists) {
            const enrollData = linkedEnrollment.data()!;
            result.linkedEnrollment = {
              id: linkedEnrollment.id,
              userId: enrollData.userId,
              status: enrollData.status,
              isYou: enrollData.userId === userId,
            };
          }
        }
      } else {
        result.instance = 'NOT FOUND';
      }
    }

    // Find all enrollments for this user (active and inactive)
    const allUserEnrollments = await adminDb
      .collection('program_enrollments')
      .where('userId', '==', userId)
      .get();

    result.allYourEnrollments = allUserEnrollments.docs.map(doc => ({
      id: doc.id,
      status: doc.data().status,
      programId: doc.data().programId,
      cohortId: doc.data().cohortId,
      organizationId: doc.data().organizationId,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('[DEBUG_ENROLLMENT] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
