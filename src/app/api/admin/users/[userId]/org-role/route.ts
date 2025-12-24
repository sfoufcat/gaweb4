import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { requireSuperAdmin, ClerkPublicMetadata } from '@/lib/admin-utils-clerk';
import type { OrgRole } from '@/types';

interface OrgRoleUpdateBody {
  orgRole: OrgRole;
  organizationId?: string; // Optional - uses user's existing org if not specified
}

/**
 * PATCH /api/admin/users/[userId]/org-role
 * Updates a user's organization role in Clerk publicMetadata (super_admin only)
 * 
 * This allows super_admins to:
 * - Promote users to super_coach
 * - Demote super_coach to coach
 * - Set any org role (super_coach, coach, member)
 * 
 * Body: { orgRole: 'super_coach' | 'coach' | 'member', organizationId?: string }
 */
export async function PATCH(
  req: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    // Check authorization - only super_admin can use this endpoint
    await requireSuperAdmin();

    const { userId: targetUserId } = await context.params;
    const body = await req.json() as OrgRoleUpdateBody;
    const { orgRole: newOrgRole, organizationId: specifiedOrgId } = body;

    if (!newOrgRole) {
      return NextResponse.json({ error: 'orgRole is required' }, { status: 400 });
    }

    // Validate org role value
    const validOrgRoles: OrgRole[] = ['super_coach', 'coach', 'member'];
    if (!validOrgRoles.includes(newOrgRole)) {
      return NextResponse.json({ 
        error: 'Invalid org role. Must be "super_coach", "coach", or "member"' 
      }, { status: 400 });
    }

    // Fetch target user from Clerk
    const client = await clerkClient();
    const targetUser = await client.users.getUser(targetUserId);
    
    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    const currentMetadata = targetUser.publicMetadata as ClerkPublicMetadata;
    const currentOrgRole = currentMetadata?.orgRole;
    const userOrgId = currentMetadata?.organizationId;

    // Determine which organization to use
    const targetOrgId = specifiedOrgId || userOrgId;

    if (!targetOrgId) {
      return NextResponse.json({ 
        error: 'User has no organization. Specify organizationId or assign user to an organization first.' 
      }, { status: 400 });
    }

    // If specifying a different org, update organizationId too
    const shouldUpdateOrgId = specifiedOrgId && specifiedOrgId !== userOrgId;

    // Build the updated metadata
    const updatedMetadata: ClerkPublicMetadata = {
      ...currentMetadata,
      orgRole: newOrgRole,
    };

    // If changing organization, update that too
    if (shouldUpdateOrgId) {
      updatedMetadata.organizationId = specifiedOrgId;
    }

    // Update the user's metadata in Clerk
    await client.users.updateUserMetadata(targetUserId, {
      publicMetadata: updatedMetadata,
    });

    console.log(`[ADMIN_ORG_ROLE] Super admin updated user ${targetUserId} orgRole: ${currentOrgRole || 'none'} -> ${newOrgRole}${shouldUpdateOrgId ? ` (org: ${specifiedOrgId})` : ''}`);

    return NextResponse.json({
      success: true,
      userId: targetUserId,
      orgRole: newOrgRole,
      organizationId: targetOrgId,
      previousOrgRole: currentOrgRole || null,
    });
  } catch (error) {
    console.error('[ADMIN_ORG_ROLE_UPDATE_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Super admin')) {
      return NextResponse.json({ error: 'Forbidden: Super admin access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * GET /api/admin/users/[userId]/org-role
 * Get the current org role for a user
 */
export async function GET(
  _req: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    // Check authorization - only super_admin can use this endpoint
    await requireSuperAdmin();

    const { userId: targetUserId } = await context.params;

    // Fetch target user from Clerk
    const client = await clerkClient();
    const targetUser = await client.users.getUser(targetUserId);
    
    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    const metadata = targetUser.publicMetadata as ClerkPublicMetadata;

    return NextResponse.json({
      userId: targetUserId,
      orgRole: metadata?.orgRole || null,
      organizationId: metadata?.organizationId || null,
    });
  } catch (error) {
    console.error('[ADMIN_ORG_ROLE_GET_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Super admin')) {
      return NextResponse.json({ error: 'Forbidden: Super admin access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}


