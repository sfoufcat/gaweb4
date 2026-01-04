import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { isSuperAdmin } from '@/lib/admin-utils-shared';
import type { ClientCoachingData, UserRole, Coach, Program, ProgramEnrollment } from '@/types';

/**
 * Helper to check if user has an active individual program enrollment
 * This allows users enrolled in 1:1 programs to access their coaching data
 * even if they don't have coachingStatus metadata set
 */
async function checkActiveIndividualEnrollment(
  userId: string,
  organizationId: string
): Promise<boolean> {
  try {
    const enrollmentsSnapshot = await adminDb.collection('program_enrollments')
      .where('userId', '==', userId)
      .where('organizationId', '==', organizationId)
      .where('status', 'in', ['active', 'upcoming'])
      .get();

    if (enrollmentsSnapshot.empty) {
      return false;
    }

    // Check if any enrollment is for an individual program
    for (const doc of enrollmentsSnapshot.docs) {
      const enrollment = doc.data() as ProgramEnrollment;
      const programDoc = await adminDb.collection('programs').doc(enrollment.programId).get();
      if (programDoc.exists) {
        const program = programDoc.data() as Program;
        if (program.type === 'individual') {
          return true;
        }
      }
    }

    return false;
  } catch (err) {
    console.error('[COACHING_DATA] Error checking active enrollment:', err);
    return false;
  }
}

/**
 * GET /api/coaching/data
 * Fetches coaching data for the authenticated user
 * 
 * Query params:
 * - userId: (optional, super admin only) fetch data for a specific user
 * 
 * MULTI-TENANCY: Coaching data is stored with org-scoped IDs: ${organizationId}_${userId}
 */
export async function GET(request: Request) {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');

    // Check if user has coaching access
    const publicMetadata = sessionClaims?.publicMetadata as {
      coaching?: boolean; // Legacy flag
      coachingStatus?: 'none' | 'active' | 'canceled' | 'past_due'; // New field
      coachId?: string;
      role?: UserRole;
    } | undefined;

    const role = publicMetadata?.role;
    // Check both new coachingStatus and legacy coaching flag for backward compatibility
    const hasCoachingMetadata = publicMetadata?.coachingStatus === 'active' || publicMetadata?.coaching === true;
    const isSuperAdminUser = isSuperAdmin(role);

    // MULTI-TENANCY: Get organization ID from tenant context (needed for enrollment check)
    const organizationId = await getEffectiveOrgId();

    // Determine which user's data to fetch
    let fetchUserId = userId;
    if (targetUserId && isSuperAdminUser) {
      // Super admin can view any user's coaching data
      fetchUserId = targetUserId;
    } else if (!hasCoachingMetadata && !isSuperAdminUser) {
      // No coaching metadata - check for active individual program enrollment as fallback
      if (organizationId) {
        const hasIndividualEnrollment = await checkActiveIndividualEnrollment(userId, organizationId);
        if (!hasIndividualEnrollment) {
          return NextResponse.json({ error: 'Coaching subscription required' }, { status: 403 });
        }
        // User has individual program enrollment - allow access
      } else {
        // No org context and no coaching metadata
        return NextResponse.json({ error: 'Coaching subscription required' }, { status: 403 });
      }
    }
    
    if (!organizationId) {
      // On platform domain, return empty state
      return NextResponse.json({
        exists: false,
        data: null,
        coach: null,
        message: 'Organization context required for coaching data',
      });
    }

    // Fetch coaching data using org-scoped document ID
    const coachingDocId = `${organizationId}_${fetchUserId}`;
    let coachingDoc = await adminDb.collection('clientCoachingData').doc(coachingDocId).get();

    // Legacy fallback: try without org prefix (for data created before multi-tenancy)
    if (!coachingDoc.exists) {
      coachingDoc = await adminDb.collection('clientCoachingData').doc(fetchUserId).get();
    }

    if (!coachingDoc.exists) {
      // Return empty state - coach not yet assigned
      return NextResponse.json({
        exists: false,
        data: null,
        coach: null,
      });
    }

    const coachingData = { id: coachingDoc.id, ...coachingDoc.data() } as ClientCoachingData;

    // Fetch coach info if assigned
    let coach: Coach | null = null;
    if (coachingData.coachId) {
      // Try coaches collection first
      const coachDoc = await adminDb.collection('coaches').doc(coachingData.coachId).get();
      if (coachDoc.exists) {
        // Use destructuring to exclude privateNotes from coach data
        const { privateNotes: _coachNotes, ...coachData } = { id: coachDoc.id, ...coachDoc.data() } as Coach & { privateNotes?: string };
        coach = coachData as Coach;
      } else {
        // Fallback: Get coach info from Clerk (coaches are org members)
        try {
          const clerk = await clerkClient();
          const coachUser = await clerk.users.getUser(coachingData.coachId);
          coach = {
            id: coachingData.coachId,
            userId: coachingData.coachId,
            firstName: coachUser.firstName || '',
            lastName: coachUser.lastName || '',
            name: `${coachUser.firstName || ''} ${coachUser.lastName || ''}`.trim() || 'Coach',
            email: coachUser.emailAddresses?.[0]?.emailAddress || '',
            imageUrl: coachUser.imageUrl || '',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as Coach;
        } catch (clerkError) {
          console.warn('[COACHING_DATA] Could not fetch coach from Clerk:', clerkError);
        }
      }
    }

    // Remove private notes from client-facing response (unless super admin)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { privateNotes: _clientNotes, ...cleanCoachingData } = coachingData;
    const responseCoachingData = isSuperAdminUser ? coachingData : cleanCoachingData;

    return NextResponse.json({
      exists: true,
      data: responseCoachingData,
      coach,
    });
  } catch (error) {
    console.error('[COACHING_DATA_GET_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}


