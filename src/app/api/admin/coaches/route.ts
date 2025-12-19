import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-utils-clerk';
import type { UserRole } from '@/types';

/**
 * GET /api/admin/coaches
 * Fetches all users with coach role from Clerk (admin/super_admin only)
 */
export async function GET() {
  try {
    // Check authorization (throws if not admin)
    await requireAdmin();

    // Fetch all users from Clerk
    const client = await clerkClient();
    const { data: allUsers } = await client.users.getUserList({
      limit: 500,
    });

    // Filter users with coach role
    const coaches = allUsers
      .filter((user) => (user.publicMetadata?.role as UserRole) === 'coach')
      .map((user) => ({
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unnamed Coach',
        imageUrl: user.imageUrl || '',
        role: 'coach' as UserRole,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ coaches });
  } catch (error) {
    console.error('[ADMIN_COACHES_GET_ERROR]', error);
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
