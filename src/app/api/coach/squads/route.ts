import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import type { Squad, ClerkPublicMetadata, OrgRole } from '@/types';

/**
 * GET /api/coach/squads
 * Fetches squads for the Coach Dashboard
 * 
 * - For global coach (role === 'coach'): Returns only squads where coachId === currentUser.id
 * - For org-level coach (orgRole === 'coach'): Returns only squads where coachId === currentUser.id
 * - For admin/super_admin: Returns ALL squads
 * 
 * Note: Super coaches should use /api/coach/org-squads to see all org squads
 */
export async function GET() {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get role and orgRole from session claims
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata;
    const role = publicMetadata?.role;
    const orgRole = publicMetadata?.orgRole as OrgRole | undefined;

    // Check if user can access coach dashboard (supports both global and org-level roles)
    if (!canAccessCoachDashboard(role, orgRole)) {
      return new NextResponse('Forbidden - Coach, Admin, or Super Admin access required', { status: 403 });
    }

    let squadsQuery;

    // Coaches (global or org-level) see only squads they coach
    // Admin/Super Admin see all squads
    const isCoachRole = role === 'coach' || orgRole === 'coach' || orgRole === 'super_coach';
    
    if (isCoachRole && role !== 'admin' && role !== 'super_admin') {
      // Coach: only fetch squads where they are the coach
      squadsQuery = adminDb.collection('squads').where('coachId', '==', userId);
    } else {
      // Admin/Super Admin: fetch all squads
      squadsQuery = adminDb.collection('squads');
    }

    const squadsSnapshot = await squadsQuery.get();
    const squads: Squad[] = [];

    squadsSnapshot.forEach((doc) => {
      squads.push({ id: doc.id, ...doc.data() } as Squad);
    });

    // Sort by creation date (newest first)
    squads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ squads });
  } catch (error) {
    console.error('[COACH_SQUADS_GET_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

