import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { isSuperAdmin } from '@/lib/admin-utils-shared';
import type { ClientCoachingData, UserRole, Coach } from '@/types';

/**
 * GET /api/coaching/data
 * Fetches coaching data for the authenticated user
 * 
 * Query params:
 * - userId: (optional, super admin only) fetch data for a specific user
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

    // Fetch coaching data
    const coachingDoc = await adminDb.collection('clientCoachingData').doc(fetchUserId).get();

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
      const coachDoc = await adminDb.collection('coaches').doc(coachingData.coachId).get();
      if (coachDoc.exists) {
        coach = { id: coachDoc.id, ...coachDoc.data() } as Coach;
        // Remove sensitive fields from coach data
        delete (coach as any).privateNotes;
      }
    }

    // Remove private notes from client-facing response (unless super admin)
    if (!isSuperAdminUser) {
      delete (coachingData as any).privateNotes;
    }

    return NextResponse.json({
      exists: true,
      data: coachingData,
      coach,
    });
  } catch (error) {
    console.error('[COACHING_DATA_GET_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}


