import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { isSuperAdmin } from '@/lib/admin-utils-shared';
import type { ClientCoachingData, UserRole, Coach } from '@/types';

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
    const hasCoaching = publicMetadata?.coachingStatus === 'active' || publicMetadata?.coaching === true;
    const isSuperAdminUser = isSuperAdmin(role);

    // Determine which user's data to fetch
    let fetchUserId = userId;
    if (targetUserId && isSuperAdminUser) {
      // Super admin can view any user's coaching data
      fetchUserId = targetUserId;
    } else if (!hasCoaching && !isSuperAdminUser) {
      // Non-coaching users without super admin access
      return NextResponse.json({ error: 'Coaching subscription required' }, { status: 403 });
    }

    // MULTI-TENANCY: Get organization ID from tenant context
    const organizationId = await getEffectiveOrgId();
    
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
            name: `${coachUser.firstName || ''} ${coachUser.lastName || ''}`.trim() || 'Coach',
            email: coachUser.emailAddresses?.[0]?.emailAddress || '',
            imageUrl: coachUser.imageUrl || '',
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


