import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import {
  getOrgCoachingPromo,
  updateOrgCoachingPromo,
  type UpdateOrgCoachingPromoInput,
} from '@/lib/org-channels';
import { adminDb } from '@/lib/firebase-admin';
import { 
  syncTenantToEdgeConfig, 
  getTenantBySubdomain,
  type TenantCoachingPromoData,
} from '@/lib/tenant-edge-config';

/**
 * Helper to get the coach's profile picture for an organization
 * Finds the super_coach member and returns their Clerk imageUrl
 */
async function getCoachImageUrl(organizationId: string): Promise<string | null> {
  try {
    const clerk = await clerkClient();
    
    // Get organization members to find the super_coach
    const memberships = await clerk.organizations.getOrganizationMembershipList({
      organizationId,
    });
    
    // Find the member with super_coach orgRole (stored in membership publicMetadata)
    const coachMember = memberships.data.find(m => {
      const metadata = m.publicMetadata as { orgRole?: string } | undefined;
      return metadata?.orgRole === 'super_coach';
    });
    
    if (coachMember?.publicUserData?.userId) {
      const coachUser = await clerk.users.getUser(coachMember.publicUserData.userId);
      return coachUser.imageUrl || null;
    }
    
    // Fallback to first org:admin if no super_coach found
    const adminMember = memberships.data.find(m => 
      m.role === 'org:admin' && m.publicUserData?.userId
    );
    if (adminMember?.publicUserData?.userId) {
      const adminUser = await clerk.users.getUser(adminMember.publicUserData.userId);
      return adminUser.imageUrl || null;
    }
    
    return null;
  } catch (err) {
    console.error('[COACH_ORG_COACHING_PROMO] Error fetching coach image:', err);
    return null;
  }
}

/**
 * GET /api/coach/org-coaching-promo
 * 
 * Fetch coaching promo settings for the coach's organization
 * Also returns the coach's default profile picture for fallback
 */
export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const promo = await getOrgCoachingPromo(organizationId);
    
    // Fetch coach's profile picture as default fallback
    const defaultCoachImageUrl = await getCoachImageUrl(organizationId);

    return NextResponse.json({
      promo,
      organizationId,
      defaultCoachImageUrl, // Coach's profile picture for when no custom image is set
    });
  } catch (error) {
    console.error('[COACH_ORG_COACHING_PROMO_GET_ERROR]', error);
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

/**
 * PUT /api/coach/org-coaching-promo
 * 
 * Update coaching promo settings for the coach's organization
 * 
 * Body:
 * - title?: string
 * - subtitle?: string
 * - imageUrl?: string
 * - isVisible?: boolean
 */
export async function PUT(req: Request) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body = await req.json();
    const {
      title,
      subtitle,
      imageUrl,
      isVisible,
    } = body as UpdateOrgCoachingPromoInput;

    // Build updates object, only including provided fields
    const updates: UpdateOrgCoachingPromoInput = {};
    
    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return NextResponse.json({ error: 'Title must be a non-empty string' }, { status: 400 });
      }
      updates.title = title.trim();
    }
    
    if (subtitle !== undefined) {
      if (typeof subtitle !== 'string') {
        return NextResponse.json({ error: 'Subtitle must be a string' }, { status: 400 });
      }
      updates.subtitle = subtitle.trim();
    }
    
    if (imageUrl !== undefined) {
      if (typeof imageUrl !== 'string') {
        return NextResponse.json({ error: 'Image URL must be a string' }, { status: 400 });
      }
      updates.imageUrl = imageUrl.trim();
    }
    
    if (isVisible !== undefined) {
      if (typeof isVisible !== 'boolean') {
        return NextResponse.json({ error: 'isVisible must be a boolean' }, { status: 400 });
      }
      updates.isVisible = isVisible;
    }

    // Check if any updates were provided
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 });
    }

    const promo = await updateOrgCoachingPromo(organizationId, updates);

    // Sync to Edge Config for instant access (prevents flash of content)
    try {
      // Get org's subdomain from org_domains
      const domainDoc = await adminDb.collection('org_domains').doc(organizationId).get();
      const domainData = domainDoc.data();
      
      if (domainData?.subdomain) {
        // Get existing tenant config to preserve branding
        const existingConfig = await getTenantBySubdomain(domainData.subdomain);
        
        // If no custom image is set, resolve to coach's profile picture for Edge Config
        let resolvedImageUrl = promo.imageUrl;
        if (!resolvedImageUrl) {
          resolvedImageUrl = await getCoachImageUrl(organizationId) || '';
        }
        
        const coachingPromoData: TenantCoachingPromoData = {
          title: promo.title,
          subtitle: promo.subtitle,
          imageUrl: resolvedImageUrl,
          isVisible: promo.isVisible,
        };
        
        await syncTenantToEdgeConfig(
          organizationId,
          domainData.subdomain,
          existingConfig?.branding,
          domainData.verifiedCustomDomain || undefined,
          coachingPromoData
        );
        
        console.log(`[COACH_ORG_COACHING_PROMO] Synced coaching promo to Edge Config for subdomain: ${domainData.subdomain}`);
      }
    } catch (edgeError) {
      // Log but don't fail the request - Edge Config is optimization, not critical
      console.error('[COACH_ORG_COACHING_PROMO] Edge Config sync error (non-fatal):', edgeError);
    }

    return NextResponse.json({
      success: true,
      promo,
    });
  } catch (error) {
    console.error('[COACH_ORG_COACHING_PROMO_PUT_ERROR]', error);
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

