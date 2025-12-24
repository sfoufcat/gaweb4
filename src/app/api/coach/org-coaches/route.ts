import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { isOrgCoach } from '@/lib/admin-utils-shared';
import type { OrgRole } from '@/types';

interface ClerkUserMetadata {
  orgRole?: OrgRole;
  organizationId?: string;
}

interface OrgCoach {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  imageUrl: string;
  orgRole: OrgRole;
}

/**
 * GET /api/coach/org-coaches
 * Fetches organization members who can be assigned as squad coaches
 * 
 * Returns users with orgRole of 'super_coach' or 'coach'
 * Used by SquadFormDialog for coach selection dropdown
 */
export async function GET() {
  try {
    // Check authorization and get organizationId
    const { organizationId } = await requireCoachWithOrg();

    console.log(`[ORG_COACHES] Fetching coaches for organization: ${organizationId}`);

    const client = await clerkClient();
    
    // Get organization members
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
        coaches: [],
        totalCount: 0,
        organizationId,
      });
    }

    // Fetch full user data for members
    const { data: orgUsers } = await client.users.getUserList({
      userId: memberUserIds,
      limit: 500,
    });

    // Also check users with publicMetadata.organizationId for backward compatibility
    const { data: allUsers } = await client.users.getUserList({
      limit: 500,
      orderBy: '-created_at',
    });
    
    const metadataOrgUsers = allUsers.filter((user) => {
      const metadata = user.publicMetadata as ClerkUserMetadata;
      return metadata?.organizationId === organizationId && !memberUserIds.includes(user.id);
    });
    
    // Combine both sets
    const combinedUsers = [...orgUsers, ...metadataOrgUsers];

    // Filter to only users who can be coaches (orgRole: super_coach or coach)
    const coaches: OrgCoach[] = combinedUsers
      .filter((user) => {
        const metadata = user.publicMetadata as ClerkUserMetadata;
        return isOrgCoach(metadata?.orgRole);
      })
      .map((user) => {
        const metadata = user.publicMetadata as ClerkUserMetadata;
        return {
          id: user.id,
          email: user.emailAddresses[0]?.emailAddress || '',
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unnamed User',
          imageUrl: user.imageUrl || '',
          orgRole: metadata?.orgRole || 'member',
        };
      });

    // Sort: super_coach first, then by name
    coaches.sort((a, b) => {
      if (a.orgRole === 'super_coach' && b.orgRole !== 'super_coach') return -1;
      if (a.orgRole !== 'super_coach' && b.orgRole === 'super_coach') return 1;
      return a.name.localeCompare(b.name);
    });

    console.log(`[ORG_COACHES] Found ${coaches.length} coaches in organization ${organizationId}`);

    return NextResponse.json({
      coaches,
      totalCount: coaches.length,
      organizationId,
    });
  } catch (error) {
    console.error('[ORG_COACHES_ERROR]', error);
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


