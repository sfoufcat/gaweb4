import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/admin-utils-clerk';
import type { UserRole } from '@/types';

/**
 * GET /api/admin/users/available
 * Get users who are NOT in any squad (for adding to squads)
 * Optional query params:
 * - search: Filter by name or email
 * - excludeSquadId: Exclude users already in this squad
 */
export async function GET(req: Request) {
  try {
    await requireAdmin();

    const url = new URL(req.url);
    const search = url.searchParams.get('search') || '';
    const excludeSquadId = url.searchParams.get('excludeSquadId');

    // Get all users who are already in squads
    const membershipsSnapshot = await adminDb.collection('squadMembers').get();
    const usersInSquads = new Set<string>();
    
    membershipsSnapshot.forEach((doc) => {
      const data = doc.data();
      // If excludeSquadId is provided, only exclude users in OTHER squads
      if (!excludeSquadId || data.squadId !== excludeSquadId) {
        usersInSquads.add(data.userId);
      }
    });

    // Fetch all users from Clerk
    const client = await clerkClient();
    const { data: allUsers } = await client.users.getUserList({
      limit: 100,
    });

    // Filter users
    const availableUsers = allUsers
      .filter((user) => !usersInSquads.has(user.id))
      .filter((user) => {
        if (!search) return true;
        const searchLower = search.toLowerCase();
        const name = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
        const email = user.emailAddresses[0]?.emailAddress?.toLowerCase() || '';
        return name.includes(searchLower) || email.includes(searchLower);
      })
      .map((user) => ({
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unnamed User',
        imageUrl: user.imageUrl || '',
        role: (user.publicMetadata?.role as UserRole) || 'user',
      }))
      .slice(0, 50); // Limit results

    return NextResponse.json({ users: availableUsers });
  } catch (error) {
    console.error('[ADMIN_USERS_AVAILABLE_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    if (message.includes('Forbidden')) {
      return new NextResponse('Forbidden', { status: 403 });
    }
    
    return new NextResponse('Internal Error', { status: 500 });
  }
}

