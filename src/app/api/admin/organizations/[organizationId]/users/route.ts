import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireSuperAdmin } from '@/lib/admin-utils-clerk';
import type { UserRole, UserTier, CoachingStatus, OrgRole } from '@/types';

interface ClerkPublicMetadataWithOrgRoles {
  role?: UserRole;
  orgRole?: OrgRole; // Legacy single-org field
  organizationId?: string; // Legacy single-org field
  primaryOrganizationId?: string;
  orgRolesByOrgId?: Record<string, OrgRole>; // New per-org structure
  coaching?: boolean;
  coachingStatus?: CoachingStatus;
}

interface FirebaseUserData {
  tier?: UserTier;
  coaching?: {
    status?: CoachingStatus;
  };
  invitedBy?: string;
  inviteCode?: string;
  invitedAt?: string;
}

interface OrgUserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  imageUrl: string;
  role: UserRole; // Global platform role
  orgRoleForOrg: OrgRole; // Org role for this specific org
  tier: UserTier;
  coachingStatus: CoachingStatus;
  coaching?: boolean;
  primaryOrganizationId: string | null;
  isInThisOrg: boolean; // Whether this org is their primary org
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /api/admin/organizations/[organizationId]/users
 * Lists all users in a specific organization with their org role for that org (super_admin only)
 * 
 * The org role is determined from:
 * 1. publicMetadata.orgRolesByOrgId[organizationId] (new per-org structure)
 * 2. Fallback to publicMetadata.orgRole if organizationId matches user's primary org (legacy)
 * 3. Default to 'member' if no role found
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> }
) {
  try {
    // Check authorization - only super_admin can access
    await requireSuperAdmin();

    const { organizationId } = await context.params;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    }

    const client = await clerkClient();

    // Verify org exists
    try {
      await client.organizations.getOrganization({ organizationId });
    } catch {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get all members of this organization from Clerk
    const memberships = await client.organizations.getOrganizationMembershipList({
      organizationId,
      limit: 500,
    });

    // Get user IDs from memberships
    const memberUserIds = memberships.data
      .map(m => m.publicUserData?.userId)
      .filter((id): id is string => !!id);

    if (memberUserIds.length === 0) {
      return NextResponse.json({
        users: [],
        totalCount: 0,
        organizationId,
      });
    }

    // Fetch full user data for members
    const { data: users } = await client.users.getUserList({
      userId: memberUserIds,
      limit: 500,
    });

    // Fetch additional data from Firebase
    const firebaseUserData = new Map<string, FirebaseUserData>();
    
    // Batch fetch in chunks of 10 (Firestore 'in' query limit)
    for (let i = 0; i < memberUserIds.length; i += 10) {
      const chunk = memberUserIds.slice(i, i + 10);
      const snapshot = await adminDb
        .collection('users')
        .where('__name__', 'in', chunk)
        .get();
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        firebaseUserData.set(doc.id, {
          tier: data.tier as UserTier | undefined,
          coaching: data.coaching,
          invitedBy: data.invitedBy,
          inviteCode: data.inviteCode,
          invitedAt: data.invitedAt,
        });
      });
    }

    // Transform to our format
    const transformedUsers: OrgUserResponse[] = users.map((user) => {
      const fbData = firebaseUserData.get(user.id);
      const metadata = user.publicMetadata as ClerkPublicMetadataWithOrgRoles;
      
      // Determine org role for this specific organization
      // Priority: orgRolesByOrgId[orgId] > legacy orgRole (if primary org) > 'member'
      let orgRoleForOrg: OrgRole = 'member';
      
      if (metadata?.orgRolesByOrgId?.[organizationId]) {
        // New per-org structure
        orgRoleForOrg = metadata.orgRolesByOrgId[organizationId];
      } else if (
        metadata?.orgRole && 
        (metadata.organizationId === organizationId || metadata.primaryOrganizationId === organizationId)
      ) {
        // Legacy fallback: use orgRole if this is user's primary/single org
        orgRoleForOrg = metadata.orgRole;
      }
      
      const primaryOrgId = metadata?.primaryOrganizationId || metadata?.organizationId || null;
      
      return {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unnamed User',
        imageUrl: user.imageUrl || '',
        role: (metadata?.role as UserRole) || 'user',
        orgRoleForOrg,
        tier: fbData?.tier || 'standard',
        coachingStatus: metadata?.coachingStatus || fbData?.coaching?.status || 'none',
        coaching: metadata?.coaching,
        primaryOrganizationId: primaryOrgId,
        isInThisOrg: primaryOrgId === organizationId,
        createdAt: new Date(user.createdAt).toISOString(),
        updatedAt: new Date(user.updatedAt).toISOString(),
      };
    });

    // Sort: super_coach first, then coach, then member, then by name
    const roleOrder: Record<OrgRole, number> = { super_coach: 0, coach: 1, member: 2 };
    transformedUsers.sort((a, b) => {
      const roleCompare = roleOrder[a.orgRoleForOrg] - roleOrder[b.orgRoleForOrg];
      if (roleCompare !== 0) return roleCompare;
      return a.name.localeCompare(b.name);
    });

    console.log(`[ADMIN_ORG_USERS] Found ${transformedUsers.length} users in organization ${organizationId}`);

    return NextResponse.json({
      users: transformedUsers,
      totalCount: transformedUsers.length,
      organizationId,
    });
  } catch (error) {
    console.error('[ADMIN_ORG_USERS_ERROR]', error);
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


