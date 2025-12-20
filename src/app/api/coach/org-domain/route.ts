/**
 * Coach API: Organization Domain Management
 * 
 * GET /api/coach/org-domain - Get current org domain settings
 * PATCH /api/coach/org-domain - Update subdomain
 */

import { NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { 
  getOrgDomain, 
  updateOrgSubdomain, 
  isSubdomainAvailable,
  getOrgCustomDomains,
} from '@/lib/tenant/resolveTenant';
import { validateSubdomain } from '@/types';
import { isSuperCoach } from '@/lib/admin-utils-shared';
import { auth } from '@clerk/nextjs/server';
import type { OrgRole } from '@/types';

interface ClerkPublicMetadata {
  orgRole?: OrgRole;
  [key: string]: unknown;
}

/**
 * GET /api/coach/org-domain
 * Returns the organization's current domain settings
 */
export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();
    
    // Get subdomain mapping
    const orgDomain = await getOrgDomain(organizationId);
    
    // Get custom domains
    const customDomains = await getOrgCustomDomains(organizationId);
    
    return NextResponse.json({
      subdomain: orgDomain?.subdomain || null,
      primaryDomain: orgDomain?.primaryDomain || null,
      tenantUrl: orgDomain?.subdomain 
        ? `https://${orgDomain.subdomain}.growthaddicts.app`
        : null,
      customDomains: customDomains.map(d => ({
        id: d.id,
        domain: d.domain,
        status: d.status,
        verificationToken: d.verificationToken,
        verifiedAt: d.verifiedAt,
      })),
      organizationId,
    });
  } catch (error) {
    console.error('[COACH_ORG_DOMAIN_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch domain settings' }, { status: 500 });
  }
}

/**
 * PATCH /api/coach/org-domain
 * Update the organization's subdomain
 * Only super_coach can update subdomain
 */
export async function PATCH(request: Request) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    
    // Check if user is super_coach
    const { sessionClaims } = await auth();
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const orgRole = publicMetadata?.orgRole;
    
    if (!isSuperCoach(orgRole)) {
      return NextResponse.json(
        { error: 'Only the Super Coach can update the subdomain' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { subdomain } = body as { subdomain: string };
    
    if (!subdomain) {
      return NextResponse.json({ error: 'Subdomain is required' }, { status: 400 });
    }
    
    // Validate subdomain format
    const validation = validateSubdomain(subdomain);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    
    const normalizedSubdomain = subdomain.toLowerCase().trim();
    
    // Check if this is the same subdomain (no change needed)
    const currentDomain = await getOrgDomain(organizationId);
    if (currentDomain?.subdomain === normalizedSubdomain) {
      return NextResponse.json({
        success: true,
        subdomain: normalizedSubdomain,
        tenantUrl: `https://${normalizedSubdomain}.growthaddicts.app`,
        message: 'No change needed',
      });
    }
    
    // Check availability
    const isAvailable = await isSubdomainAvailable(normalizedSubdomain);
    if (!isAvailable) {
      return NextResponse.json({ error: 'This subdomain is already taken' }, { status: 400 });
    }
    
    // Update subdomain
    await updateOrgSubdomain(organizationId, normalizedSubdomain);
    
    console.log(`[COACH_ORG_DOMAIN] Updated subdomain to ${normalizedSubdomain} for org ${organizationId}`);
    
    return NextResponse.json({
      success: true,
      subdomain: normalizedSubdomain,
      tenantUrl: `https://${normalizedSubdomain}.growthaddicts.app`,
    });
  } catch (error) {
    console.error('[COACH_ORG_DOMAIN_PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to update subdomain' }, { status: 500 });
  }
}
