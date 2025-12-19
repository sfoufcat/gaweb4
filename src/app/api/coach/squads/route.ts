import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import type { Squad, UserRole, ClerkPublicMetadata } from '@/types';

/**
 * GET /api/coach/squads
 * Fetches squads for the Coach Dashboard
 * 
 * - For coach: Returns only squads where coachId === currentUser.id
 * - For admin/super_admin: Returns ALL squads
 */
export async function GET() {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get role from session claims
    const role = (sessionClaims?.publicMetadata as ClerkPublicMetadata)?.role;

    // Check if user can access coach dashboard
    if (!canAccessCoachDashboard(role)) {
      return new NextResponse('Forbidden - Coach, Admin, or Super Admin access required', { status: 403 });
    }

    let squadsQuery;

    if (role === 'coach') {
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

