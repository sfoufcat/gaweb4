import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import type { ClientCoachingData, UserRole, FirebaseUser } from '@/types';

/**
 * GET /api/coaching/clients
 * Fetches all coaching clients for a coach
 * 
 * - For coach: Returns only clients where coachId === currentUser.id
 * - For admin/super_admin: Returns ALL coaching clients
 */
export async function GET() {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get role from session claims
    const role = (sessionClaims?.publicMetadata as { role?: UserRole })?.role;

    // Check if user can access coach dashboard
    if (!canAccessCoachDashboard(role)) {
      return NextResponse.json({ error: 'Coach, Admin, or Super Admin access required' }, { status: 403 });
    }

    let clientsQuery;

    if (role === 'coach') {
      // Coach: only fetch clients assigned to them
      clientsQuery = adminDb.collection('clientCoachingData').where('coachId', '==', userId);
    } else {
      // Admin/Super Admin: fetch all coaching clients
      clientsQuery = adminDb.collection('clientCoachingData');
    }

    const clientsSnapshot = await clientsQuery.get();
    const clients: (Omit<ClientCoachingData, 'privateNotes'> & { user?: Partial<FirebaseUser> })[] = [];

    // Fetch user details for each client
    const userIds = clientsSnapshot.docs.map(doc => doc.data().userId);
    const userDocs = await Promise.all(
      userIds.map(id => adminDb.collection('users').doc(id).get())
    );

    const userMap = new Map<string, Partial<FirebaseUser>>();
    userDocs.forEach(doc => {
      if (doc.exists) {
        const userData = doc.data() as FirebaseUser;
        userMap.set(doc.id, {
          id: doc.id,
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          imageUrl: userData.imageUrl,
          timezone: userData.timezone,
        });
      }
    });

    clientsSnapshot.forEach((doc) => {
      // Use destructuring to exclude privateNotes from the response
      const rawData = { id: doc.id, ...doc.data() } as ClientCoachingData;
      const { privateNotes: _notes, ...data } = rawData;
      
      clients.push({
        ...data,
        user: userMap.get(data.userId),
      } as Omit<ClientCoachingData, 'privateNotes'> & { user?: Partial<FirebaseUser> });
    });

    // Sort by start date (newest first)
    clients.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    return NextResponse.json({ clients });
  } catch (error) {
    console.error('[COACHING_CLIENTS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}









