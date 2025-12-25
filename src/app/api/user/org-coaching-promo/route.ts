import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { getOrgCoachingPromo, DEFAULT_COACHING_PROMO } from '@/lib/org-channels';

/**
 * Helper to get the coach's profile picture for an organization
 */
async function getCoachImageUrl(organizationId: string): Promise<string | null> {
  try {
    const clerk = await clerkClient();
    
    const memberships = await clerk.organizations.getOrganizationMembershipList({
      organizationId,
    });
    
    // Find super_coach
    const coachMember = memberships.data.find(m => {
      const metadata = m.publicMetadata as { orgRole?: string } | undefined;
      return metadata?.orgRole === 'super_coach';
    });
    
    if (coachMember?.publicUserData?.userId) {
      const coachUser = await clerk.users.getUser(coachMember.publicUserData.userId);
      return coachUser.imageUrl || null;
    }
    
    // Fallback to first org:admin
    const adminMember = memberships.data.find(m => 
      m.role === 'org:admin' && m.publicUserData?.userId
    );
    if (adminMember?.publicUserData?.userId) {
      const adminUser = await clerk.users.getUser(adminMember.publicUserData.userId);
      return adminUser.imageUrl || null;
    }
    
    return null;
  } catch (err) {
    console.error('[USER_ORG_COACHING_PROMO] Error fetching coach image:', err);
    return null;
  }
}

/**
 * GET /api/user/org-coaching-promo
 * 
 * Fetch the coaching promo settings for the current user's organization.
 * Returns default promo if user doesn't belong to an organization.
 * If no custom image is set, resolves to coach's profile picture.
 * 
 * This is used by regular users to display the coaching promo in the chat sidebar.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get org from tenant domain (null on platform domain)
    const organizationId = await getEffectiveOrgId();
    
    if (!organizationId) {
      // User doesn't belong to an org - return default promo
      const now = new Date().toISOString();
      return NextResponse.json({
        promo: {
          id: 'default',
          organizationId: null,
          ...DEFAULT_COACHING_PROMO,
          createdAt: now,
          updatedAt: now,
        },
        organizationId: null,
      });
    }

    // Fetch org coaching promo settings
    const promo = await getOrgCoachingPromo(organizationId);
    
    // If no custom image, resolve to coach's profile picture
    let resolvedImageUrl = promo.imageUrl;
    if (!resolvedImageUrl) {
      resolvedImageUrl = await getCoachImageUrl(organizationId) || '';
    }

    return NextResponse.json({
      promo: {
        ...promo,
        imageUrl: resolvedImageUrl,
      },
      organizationId,
    });
  } catch (error) {
    console.error('[USER_ORG_COACHING_PROMO_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

