import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireSuperAdmin } from '@/lib/admin-utils-clerk';
import type { OrgRole, UserRole } from '@/types';

interface ClerkPublicMetadataWithOrgRoles {
  role?: UserRole;
  orgRole?: OrgRole; // Legacy single-org field
  organizationId?: string; // Legacy single-org field
  primaryOrganizationId?: string;
  orgRolesByOrgId?: Record<string, OrgRole>; // New per-org structure
  [key: string]: unknown;
}

interface OrgRoleUpdateBody {
  orgRole: OrgRole;
}

/**
 * PATCH /api/admin/organizations/[organizationId]/users/[userId]/org-role
 * Updates a user's org role for a specific organization (super_admin only)
 * 
 * - Updates Clerk publicMetadata.orgRolesByOrgId[organizationId]
 * - If this org is the user's primary org, also syncs legacy orgRole field
 * - Mirrors to Firestore org_memberships for apps that read from there
 * 
 * Body: { orgRole: 'super_coach' | 'coach' | 'member' }
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string; userId: string }> }
) {
  try {
    // Check authorization - only super_admin can access
    await requireSuperAdmin();

    const { organizationId, userId } = await context.params;

    if (!organizationId || !userId) {
      return NextResponse.json({ error: 'Organization ID and User ID are required' }, { status: 400 });
    }

    const body = await request.json() as OrgRoleUpdateBody;
    const { orgRole: newOrgRole } = body;

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

    const client = await clerkClient();

    // Verify org exists
    try {
      await client.organizations.getOrganization({ organizationId });
    } catch {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Verify user exists and is a member of this org
    const user = await client.users.getUser(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is actually a member of this organization
    const memberships = await client.organizations.getOrganizationMembershipList({
      organizationId,
    });
    const isMember = memberships.data.some(m => m.publicUserData?.userId === userId);
    
    if (!isMember) {
      return NextResponse.json({ error: 'User is not a member of this organization' }, { status: 400 });
    }

    const currentMetadata = user.publicMetadata as ClerkPublicMetadataWithOrgRoles;
    const currentOrgRolesByOrgId = currentMetadata.orgRolesByOrgId || {};
    const previousOrgRole = currentOrgRolesByOrgId[organizationId] || currentMetadata.orgRole || 'member';

    // Build the new orgRolesByOrgId object
    const newOrgRolesByOrgId: Record<string, OrgRole> = {
      ...currentOrgRolesByOrgId,
      [organizationId]: newOrgRole,
    };

    // Determine if we need to sync legacy fields
    // Sync if this org is the user's primary org (or if no primary org is set)
    const primaryOrgId = currentMetadata.primaryOrganizationId || currentMetadata.organizationId;
    const shouldSyncLegacy = !primaryOrgId || primaryOrgId === organizationId;

    // Build updated metadata
    const updatedMetadata: ClerkPublicMetadataWithOrgRoles = {
      ...currentMetadata,
      orgRolesByOrgId: newOrgRolesByOrgId,
    };

    // Sync legacy fields if this is the user's primary org
    if (shouldSyncLegacy) {
      updatedMetadata.orgRole = newOrgRole;
      updatedMetadata.organizationId = organizationId;
      if (!updatedMetadata.primaryOrganizationId) {
        updatedMetadata.primaryOrganizationId = organizationId;
      }
    }

    // Update Clerk user metadata
    await client.users.updateUserMetadata(userId, {
      publicMetadata: updatedMetadata,
    });

    console.log(`[ADMIN_ORG_ROLE] Updated user ${userId} orgRole in org ${organizationId}: ${previousOrgRole} -> ${newOrgRole}${shouldSyncLegacy ? ' (synced legacy fields)' : ''}`);

    // Mirror to Firestore org_memberships
    const now = new Date().toISOString();
    try {
      // Find existing membership
      const membershipSnapshot = await adminDb
        .collection('org_memberships')
        .where('userId', '==', userId)
        .where('organizationId', '==', organizationId)
        .limit(1)
        .get();

      if (!membershipSnapshot.empty) {
        // Update existing membership
        await membershipSnapshot.docs[0].ref.update({
          orgRole: newOrgRole,
          updatedAt: now,
        });
        console.log(`[ADMIN_ORG_ROLE] Updated Firestore org_membership for user ${userId} in org ${organizationId}`);
      } else {
        // Create new membership if doesn't exist
        await adminDb.collection('org_memberships').add({
          userId,
          organizationId,
          orgRole: newOrgRole,
          tier: 'standard',
          track: null,
          squadId: null,
          premiumSquadId: null,
          accessSource: 'manual',
          accessExpiresAt: null,
          inviteCodeUsed: null,
          isActive: true,
          joinedAt: now,
          createdAt: now,
          updatedAt: now,
        });
        console.log(`[ADMIN_ORG_ROLE] Created Firestore org_membership for user ${userId} in org ${organizationId}`);
      }
    } catch (firestoreError) {
      // Log but don't fail - Clerk is the source of truth
      console.error(`[ADMIN_ORG_ROLE] Failed to mirror to Firestore:`, firestoreError);
    }

    return NextResponse.json({
      success: true,
      userId,
      organizationId,
      orgRole: newOrgRole,
      previousOrgRole,
      legacySynced: shouldSyncLegacy,
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
 * GET /api/admin/organizations/[organizationId]/users/[userId]/org-role
 * Get a user's org role for a specific organization (super_admin only)
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string; userId: string }> }
) {
  try {
    // Check authorization - only super_admin can access
    await requireSuperAdmin();

    const { organizationId, userId } = await context.params;

    if (!organizationId || !userId) {
      return NextResponse.json({ error: 'Organization ID and User ID are required' }, { status: 400 });
    }

    const client = await clerkClient();

    // Get user
    const user = await client.users.getUser(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const metadata = user.publicMetadata as ClerkPublicMetadataWithOrgRoles;

    // Determine org role for this specific organization
    let orgRoleForOrg: OrgRole = 'member';
    
    if (metadata?.orgRolesByOrgId?.[organizationId]) {
      orgRoleForOrg = metadata.orgRolesByOrgId[organizationId];
    } else if (
      metadata?.orgRole && 
      (metadata.organizationId === organizationId || metadata.primaryOrganizationId === organizationId)
    ) {
      orgRoleForOrg = metadata.orgRole;
    }

    return NextResponse.json({
      userId,
      organizationId,
      orgRole: orgRoleForOrg,
      primaryOrganizationId: metadata?.primaryOrganizationId || metadata?.organizationId || null,
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


