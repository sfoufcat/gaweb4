import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { requireAdmin, canModifyUserRole } from '@/lib/admin-utils-clerk';
import { createOrganizationForCoach } from '@/lib/clerk-organizations';
import type { UserRole } from '@/types';

/**
 * PATCH /api/admin/users/[userId]/role
 * Updates a user's role in Clerk publicMetadata (admin/super_admin only, with restrictions)
 */
export async function PATCH(
  req: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    // Check authorization (throws if not admin)
    const currentUserRole = await requireAdmin();

    const { userId: targetUserId } = await context.params;
    const body = await req.json();
    const { role: newRole } = body as { role: UserRole };

    if (!newRole) {
      return NextResponse.json({ error: 'Role is required' }, { status: 400 });
    }

    // Validate role value
    const validRoles: UserRole[] = ['user', 'editor', 'coach', 'admin', 'super_admin'];
    if (!validRoles.includes(newRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Fetch target user from Clerk
    const client = await clerkClient();
    const targetUser = await client.users.getUser(targetUserId);
    
    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    const targetUserRole = (targetUser.publicMetadata?.role as UserRole) || 'user';

    // Check if current user can modify target user's role
    if (!canModifyUserRole(currentUserRole, targetUserRole, newRole)) {
      return NextResponse.json(
        { error: 'You do not have permission to make this role change' },
        { status: 403 }
      );
    }

    // Update the role in Clerk publicMetadata
    await client.users.updateUserMetadata(targetUserId, {
      publicMetadata: {
        ...targetUser.publicMetadata,
        role: newRole,
      },
    });

    // If assigning coach role, create an organization for them
    if (newRole === 'coach') {
      try {
        const coachName = targetUser.firstName 
          ? `${targetUser.firstName}${targetUser.lastName ? ' ' + targetUser.lastName : ''}`
          : targetUser.emailAddresses[0]?.emailAddress?.split('@')[0] || 'Coach';
        
        const orgId = await createOrganizationForCoach(targetUserId, coachName);
        console.log(`[ADMIN_USER_ROLE] Created organization ${orgId} for new coach ${targetUserId}`);
      } catch (orgError) {
        // Log but don't fail the role update - org can be created later
        console.error(`[ADMIN_USER_ROLE] Failed to create organization for coach ${targetUserId}:`, orgError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ADMIN_USER_ROLE_UPDATE_ERROR]', error);
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
