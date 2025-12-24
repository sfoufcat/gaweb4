/**
 * Coach API: Organization Domain Management
 * 
 * GET /api/coach/org-domain - Get current org domain settings
 * PATCH /api/coach/org-domain - Update subdomain
 */

import { NextResponse } from 'next/server';
import { requireCoachWithOrg, isUserOrgAdminInOrg, TenantRequiredError } from '@/lib/admin-utils-clerk';
import { 
  getOrgDomain, 
  updateOrgSubdomain, 
  isSubdomainAvailable,
  getOrgCustomDomains,
} from '@/lib/tenant/resolveTenant';
import { validateSubdomain } from '@/types';
import { isSuperCoach } from '@/lib/admin-utils-shared';
import { adminDb } from '@/lib/firebase-admin';
import { 
  invalidateTenantBySubdomain, 
  syncTenantToEdgeConfig, 
  type TenantBrandingData,
  DEFAULT_TENANT_BRANDING,
} from '@/lib/tenant-edge-config';

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
        ? `https://${orgDomain.subdomain}.growthaddicts.com`
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
    // Handle tenant required error
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    
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
    const { userId, organizationId, orgRole } = await requireCoachWithOrg();
    
    // Check if user is authorized (super_coach)
    // First check metadata (fast), then fall back to Clerk API lookup (handles tenant subdomain routing)
    let isAuthorized = isSuperCoach(orgRole);
    
    if (!isAuthorized) {
      // Check Clerk organization membership directly (handles subdomain tenant routing)
      isAuthorized = await isUserOrgAdminInOrg(userId, organizationId);
    }
    
    if (!isAuthorized) {
      console.log(`[COACH_ORG_DOMAIN] Unauthorized update attempt. userId=${userId}, orgRole=${orgRole}, orgId=${organizationId}`);
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
        tenantUrl: `https://${normalizedSubdomain}.growthaddicts.com`,
        message: 'No change needed',
      });
    }
    
    // Check availability
    const isAvailable = await isSubdomainAvailable(normalizedSubdomain);
    if (!isAvailable) {
      return NextResponse.json({ error: 'This subdomain is already taken' }, { status: 400 });
    }
    
    // Get the old subdomain before updating
    const oldSubdomain = currentDomain?.subdomain;
    
    // Update subdomain in Firestore
    await updateOrgSubdomain(organizationId, normalizedSubdomain);
    
    console.log(`[COACH_ORG_DOMAIN] Updated subdomain to ${normalizedSubdomain} for org ${organizationId}`);
    
    // Sync to Edge Config
    try {
      // Invalidate old subdomain key if different
      if (oldSubdomain && oldSubdomain !== normalizedSubdomain) {
        await invalidateTenantBySubdomain(oldSubdomain);
        console.log(`[COACH_ORG_DOMAIN] Invalidated old Edge Config entry for subdomain: ${oldSubdomain}`);
      }
      
      // Get branding to populate new Edge Config entry
      const brandingDoc = await adminDb.collection('org_branding').doc(organizationId).get();
      const brandingData = brandingDoc.data();
      
      const edgeBranding: TenantBrandingData = brandingData ? {
        logoUrl: brandingData.logoUrl || null,
        horizontalLogoUrl: brandingData.horizontalLogoUrl || null,
        appTitle: brandingData.appTitle || DEFAULT_TENANT_BRANDING.appTitle,
        colors: brandingData.colors || DEFAULT_TENANT_BRANDING.colors,
        menuTitles: brandingData.menuTitles || DEFAULT_TENANT_BRANDING.menuTitles,
        menuIcons: brandingData.menuIcons || DEFAULT_TENANT_BRANDING.menuIcons,
      } : DEFAULT_TENANT_BRANDING;
      
      // Get verified custom domain if exists
      const domainDoc = await adminDb.collection('org_domains').doc(organizationId).get();
      const verifiedCustomDomain = domainDoc.data()?.verifiedCustomDomain;
      
      // Set new Edge Config entry
      await syncTenantToEdgeConfig(
        organizationId,
        normalizedSubdomain,
        edgeBranding,
        verifiedCustomDomain || undefined
      );
      
      console.log(`[COACH_ORG_DOMAIN] Synced new Edge Config entry for subdomain: ${normalizedSubdomain}`);
    } catch (edgeError) {
      // Log but don't fail the request - Edge Config is optimization, not critical
      console.error('[COACH_ORG_DOMAIN] Edge Config sync error (non-fatal):', edgeError);
    }
    
    return NextResponse.json({
      success: true,
      subdomain: normalizedSubdomain,
      tenantUrl: `https://${normalizedSubdomain}.growthaddicts.com`,
    });
  } catch (error) {
    // Handle tenant required error
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    
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

