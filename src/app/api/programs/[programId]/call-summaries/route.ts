/**
 * Program Call Summaries API
 *
 * GET /api/programs/[programId]/call-summaries - Fetch call summaries for client
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { CallSummary } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { programId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5', 10);
    const enrollmentId = searchParams.get('enrollmentId');

    // Verify user is enrolled in this program
    let enrollmentQuery = adminDb
      .collection('enrollments')
      .where('userId', '==', userId)
      .where('programId', '==', programId)
      .where('status', 'in', ['active', 'completed']);

    if (enrollmentId) {
      enrollmentQuery = enrollmentQuery.where('__name__', '==', enrollmentId);
    }

    const enrollmentsSnapshot = await enrollmentQuery.limit(1).get();

    if (enrollmentsSnapshot.empty) {
      return NextResponse.json({ error: 'Not enrolled in this program' }, { status: 403 });
    }

    const enrollmentDoc = enrollmentsSnapshot.docs[0];

    // Fetch call summaries for this enrollment
    const summariesSnapshot = await adminDb
      .collection('call_summaries')
      .where('enrollmentId', '==', enrollmentDoc.id)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const summaries = summariesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
    })) as CallSummary[];

    // Get total count
    const countSnapshot = await adminDb
      .collection('call_summaries')
      .where('enrollmentId', '==', enrollmentDoc.id)
      .count()
      .get();

    return NextResponse.json({
      summaries,
      totalCount: countSnapshot.data().count,
    });
  } catch (error) {
    console.error('[PROGRAM_CALL_SUMMARIES_GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch call summaries' }, { status: 500 });
  }
}
