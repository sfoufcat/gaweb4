/**
 * Admin API: Organization Custom Domain Management
 * 
 * DELETE /api/admin/organizations/[organizationId]/domains/[domainId]
 * Allows super_admin to remove any organization's custom domain
 */

import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin-utils-clerk';
import { adminDb } from '@/lib/firebase-admin';
import { removeCustomDomain } from '@/lib/tenant/resolveTenant';
import { removeDomainFromVercel, isVercelDomainApiConfigured } from '@/lib/vercel-domains';
import { removeDomainFromClerk } from '@/lib/clerk-domains';
import { removeDomainFromApplePay } from '@/lib/stripe-domains';
import { 
  invalidateTenantByCustomDomain,
  syncTenantToEdgeConfig,
  type TenantBrandingData,
  DEFAULT_TENANT_BRANDING,
} from '@/lib/tenant-edge-config';
import type { OrgCustomDomain } from '@/types';

/**
 * DELETE /api/admin/organizations/[organizationId]/domains/[domainId]
 * Remove a custom domain from an organization (super_admin only)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ organizationId: string; domainId: string }> }
) {
  try {
    // Check authorization - only super_admin can access
    await requireSuperAdmin();
    
    const { organizationId, domainId } = await params;

    console.log(`[ADMIN_DOMAIN_DELETE] Super admin removing domain ${domainId} from org ${organizationId}`);

    // Get the domain data
    const domainDoc = await adminDb.collection('org_custom_domains').doc(domainId).get();
    
    if (!domainDoc.exists) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
    }
    
    const domainData = domainDoc.data() as OrgCustomDomain;
    
    // Verify the domain belongs to the specified organization
    if (domainData.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Domain does not belong to this organization' },
        { status: 400 }
      );
    }

    // 1. Invalidate Edge Config entry for this custom domain FIRST
    try {
      await invalidateTenantByCustomDomain(domainData.domain);
      console.log(`[ADMIN_DOMAIN_DELETE] Invalidated Edge Config for custom domain: ${domainData.domain}`);
    } catch (edgeError) {
      console.error('[ADMIN_DOMAIN_DELETE] Edge Config invalidation error (non-fatal):', edgeError);
    }

    // 2. Remove from Vercel (if configured)
    if (isVercelDomainApiConfigured()) {
      const vercelResult = await removeDomainFromVercel(domainData.domain);
      if (!vercelResult.success) {
        console.error(`[ADMIN_DOMAIN_DELETE] Failed to remove from Vercel: ${vercelResult.error}`);
      } else {
        console.log(`[ADMIN_DOMAIN_DELETE] Removed from Vercel`);
      }
    }

    // 3. Remove from Clerk (if it was added)
    if (domainData.clerkDomainId) {
      const clerkResult = await removeDomainFromClerk(domainData.clerkDomainId);
      if (!clerkResult.success) {
        console.error(`[ADMIN_DOMAIN_DELETE] Failed to remove from Clerk: ${clerkResult.error}`);
      } else {
        console.log(`[ADMIN_DOMAIN_DELETE] Removed from Clerk`);
      }
    }

    // 4. Remove from Stripe Apple Pay (if connected account exists)
    const settingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
    const settings = settingsDoc.data();
    if (settings?.stripeConnectAccountId) {
      const stripeResult = await removeDomainFromApplePay(
        domainData.domain,
        settings.stripeConnectAccountId
      );
      if (!stripeResult.success) {
        console.error(`[ADMIN_DOMAIN_DELETE] Failed to remove from Stripe: ${stripeResult.error}`);
      } else {
        console.log(`[ADMIN_DOMAIN_DELETE] Removed from Stripe Apple Pay`);
      }
    }

    // 5. Remove the domain from our database
    await removeCustomDomain(domainId);
    console.log(`[ADMIN_DOMAIN_DELETE] Removed from database`);

    // 6. Update subdomain Edge Config entry to remove verifiedCustomDomain redirect
    const orgDomainSnapshot = await adminDb
      .collection('org_domains')
      .where('organizationId', '==', organizationId)
      .limit(1)
      .get();
    
    const subdomain = orgDomainSnapshot.empty ? null : orgDomainSnapshot.docs[0].data().subdomain;
    
    if (subdomain) {
      try {
        const brandingDoc = await adminDb.collection('org_branding').doc(organizationId).get();
        const brandingData = brandingDoc.data();
        
        const edgeBranding: TenantBrandingData = brandingData ? {
          logoUrl: brandingData.logoUrl || null,
          horizontalLogoUrl: brandingData.horizontalLogoUrl || null,
          appTitle: brandingData.appTitle || DEFAULT_TENANT_BRANDING.appTitle,
          colors: brandingData.colors || DEFAULT_TENANT_BRANDING.colors,
          menuTitles: brandingData.menuTitles || DEFAULT_TENANT_BRANDING.menuTitles,
        } : DEFAULT_TENANT_BRANDING;
        
        // Sync WITHOUT verifiedCustomDomain to remove the redirect
        await syncTenantToEdgeConfig(organizationId, subdomain, edgeBranding, undefined);
        console.log(`[ADMIN_DOMAIN_DELETE] Updated subdomain Edge Config to remove custom domain redirect`);
      } catch (edgeError) {
        console.error('[ADMIN_DOMAIN_DELETE] Edge Config subdomain update error (non-fatal):', edgeError);
      }
    }

    console.log(`[ADMIN_DOMAIN_DELETE] Successfully removed domain ${domainData.domain} from org ${organizationId}`);

    return NextResponse.json({ 
      success: true,
      removedDomain: domainData.domain,
      organizationId,
    });
  } catch (error) {
    console.error('[ADMIN_DOMAIN_DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Super admin')) {
      return NextResponse.json({ error: 'Forbidden: Super admin access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to remove domain' }, { status: 500 });
  }
}

