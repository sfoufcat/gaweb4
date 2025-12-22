/**
 * Coach API: Program Enrollments
 * 
 * GET /api/coach/org-programs/[programId]/enrollments - List enrollments for a program
 * 
 * This allows coaches to see who is enrolled in their program.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getCurrentUserOrganizationId, isUserOrgAdmin } from '@/lib/clerk-organizations';
import type { ProgramEnrollment, Program } from '@/types';

interface EnrollmentWithUser extends ProgramEnrollment {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    imageUrl: string;
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { userId } = await auth();
    const { programId } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const organizationId = await getCurrentUserOrganizationId();
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 403 });
    }

    // Verify user is an admin (coach) of the organization
    const isCoach = await isUserOrgAdmin(userId, organizationId);
    if (!isCoach) {
      return NextResponse.json({ error: 'Not authorized - coaches only' }, { status: 403 });
    }

    // Verify program belongs to this organization
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const program = programDoc.data() as Program;
    if (program.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program does not belong to your organization' }, { status: 403 });
    }

    // Get status filter from query params
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status'); // 'active', 'upcoming', 'completed', 'stopped', or null for all

    // Build query
    let query: FirebaseFirestore.Query = adminDb
      .collection('program_enrollments')
      .where('programId', '==', programId);

    if (statusFilter && ['active', 'upcoming', 'completed', 'stopped'].includes(statusFilter)) {
      query = query.where('status', '==', statusFilter);
    }

    const enrollmentsSnapshot = await query.get();

    // Get user info for each enrollment
    const clerk = await clerkClient();
    const enrollments: EnrollmentWithUser[] = await Promise.all(
      enrollmentsSnapshot.docs.map(async (doc) => {
        const enrollment = { id: doc.id, ...doc.data() } as ProgramEnrollment;
        
        try {
          const clerkUser = await clerk.users.getUser(enrollment.userId);
          return {
            ...enrollment,
            user: {
              id: clerkUser.id,
              firstName: clerkUser.firstName || '',
              lastName: clerkUser.lastName || '',
              email: clerkUser.emailAddresses[0]?.emailAddress || '',
              imageUrl: clerkUser.imageUrl || '',
            },
          };
        } catch {
          // User might not exist in Clerk anymore
          return {
            ...enrollment,
            user: undefined,
          };
        }
      })
    );

    // Sort by createdAt descending
    enrollments.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({
      enrollments,
      total: enrollments.length,
    });
  } catch (error) {
    console.error('[COACH_PROGRAM_ENROLLMENTS_GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch enrollments' }, { status: 500 });
  }
}

