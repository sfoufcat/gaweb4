import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { requireCoachWithOrg, ClerkPublicMetadata } from '@/lib/admin-utils-clerk';
import { isSuperCoach, canAssignOrgRole } from '@/lib/admin-utils-shared';
import type { OrgRole } from '@/types';

/**
 * PATCH /api/coach/org-users/[userId]/org-role
 * Updates a user's organization role within the coach's organization
 * 
 * Authorization:
 * - Only super_coach can modify org roles
 * - Cannot demote self from super_coach
 * - Can only modify users in the same organization
 * 
 * Body: { orgRole: 'coach' | 'member' }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: targetUserId } = await params;
    const { userId: currentUserId, organizationId } = await requireCoachWithOrg();

    // Get current user's org role
    const client = await clerkClient();
    const currentUser = await client.users.getUser(currentUserId);
    const currentUserMetadata = currentUser.publicMetadata as ClerkPublicMetadata & { orgRole?: OrgRole };
    const currentUserOrgRole = currentUserMetadata?.orgRole;

    // Only super_coach can modify org roles
    if (!isSuperCoach(currentUserOrgRole)) {
      return NextResponse.json(
        { error: 'Forbidden: Only Super Coach can modify organization roles' },
        { status: 403 }
      );
    }

    // Cannot demote yourself from super_coach
    if (targetUserId === currentUserId) {
      return NextResponse.json(
        { error: 'Cannot modify your own organization role' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const newOrgRole = body.orgRole as OrgRole;

    // Validate the new role
    if (!newOrgRole || !['coach', 'member'].includes(newOrgRole)) {
      return NextResponse.json(
        { error: 'Invalid org role. Must be "coach" or "member"' },
        { status: 400 }
      );
    }

    // Check if the role can be assigned
    if (!canAssignOrgRole(currentUserOrgRole, newOrgRole)) {
      return NextResponse.json(
        { error: 'Cannot assign this organization role' },
        { status: 403 }
      );
    }

    // Get target user and verify they're in the same organization
    const targetUser = await client.users.getUser(targetUserId);
    const targetUserMetadata = targetUser.publicMetadata as ClerkPublicMetadata & { organizationId?: string };
    
    // Verify target user is in the same organization
    if (targetUserMetadata?.organizationId !== organizationId) {
      // Also check Clerk's native org membership
      const memberships = await client.organizations.getOrganizationMembershipList({
        organizationId,
      });
      const isMember = memberships.data.some(m => m.publicUserData?.userId === targetUserId);
      
      if (!isMember) {
        return NextResponse.json(
          { error: 'User is not a member of your organization' },
          { status: 404 }
        );
      }
    }

    // Update the user's org role in Clerk publicMetadata
    await client.users.updateUserMetadata(targetUserId, {
      publicMetadata: {
        ...targetUser.publicMetadata,
        orgRole: newOrgRole,
      },
    });

    console.log(`[ORG_ROLE] Super Coach ${currentUserId} updated user ${targetUserId} org role to ${newOrgRole} in org ${organizationId}`);

    return NextResponse.json({
      success: true,
      userId: targetUserId,
      orgRole: newOrgRole,
    });
  } catch (error) {
    console.error('[ORG_ROLE_UPDATE_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    if (message.includes('Organization not found')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
