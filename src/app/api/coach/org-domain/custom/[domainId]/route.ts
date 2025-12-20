/**
 * Coach API: Custom Domain Management (Single Domain)
 * 
 * PATCH /api/coach/org-domain/custom/[domainId] - Re-verify a custom domain
 * DELETE /api/coach/org-domain/custom/[domainId] - Remove a custom domain
 */

import { NextResponse } from 'next/server';
import { requireCoachWithOrg, isUserOrgAdminInOrg } from '@/lib/admin-utils-clerk';
import { adminDb } from '@/lib/firebase-admin';
import { removeCustomDomain } from '@/lib/tenant/resolveTenant';
import { 
  removeDomainFromVercel, 
  verifyDomainInVercel, 
  getDomainVerificationStatus,
  isVercelDomainApiConfigured 
} from '@/lib/vercel-domains';
import { removeDomainFromClerk } from '@/lib/clerk-domains';
import { isSuperCoach } from '@/lib/admin-utils-shared';
import type { OrgCustomDomain, CustomDomainStatus } from '@/types';
import { 
  syncTenantToEdgeConfig, 
  invalidateTenantByCustomDomain,
  type TenantBrandingData,
  DEFAULT_TENANT_BRANDING,
} from '@/lib/tenant-edge-config';
import dns from 'dns';
import { promisify } from 'util';

const resolveCname = promisify(dns.resolveCname);

// Note: resolveTxt removed - we no longer use custom TXT verification
// Verification is now done via Vercel API (routing) + Clerk CNAME (auth)

/**
 * Check if domain has Vercel CNAME configured (for routing)
 * @ or domain should point to cname.vercel-dns.com
 */
async function checkVercelCname(domain: string): Promise<boolean> {
  try {
    const records = await resolveCname(domain);
    return records.some(record => 
      record.toLowerCase().includes('vercel') || 
      record.toLowerCase().includes('cname.vercel-dns.com')
    );
  } catch {
    return false;
  }
}

/**
 * Check if domain has Clerk CNAME configured (for authentication)
 * clerk.{domain} should point to frontend-api.clerk.services
 */
async function checkClerkCname(domain: string): Promise<boolean> {
  try {
    const clerkSubdomain = `clerk.${domain}`;
    const records = await resolveCname(clerkSubdomain);
    return records.some(record => 
      record.toLowerCase().includes('clerk') || 
      record.toLowerCase().includes('frontend-api.clerk.services')
    );
  } catch {
    return false;
  }
}

/**
 * Verify domain DNS configuration
 * Requires BOTH Vercel CNAME (routing) AND Clerk CNAME (auth) to be fully verified
 */
async function verifyDomainDns(domain: string): Promise<{
  verified: boolean;
  routingConfigured: boolean;
  authConfigured: boolean;
}> {
  // Check both CNAMEs in parallel
  const [routingConfigured, authConfigured] = await Promise.all([
    checkVercelCname(domain),
    checkClerkCname(domain),
  ]);
  
  // Both must be configured for full verification
  const verified = routingConfigured && authConfigured;
  
  return { verified, routingConfigured, authConfigured };
}

/**
 * PATCH /api/coach/org-domain/custom/[domainId]
 * Re-verify a custom domain's DNS configuration
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ domainId: string }> }
) {
  try {
    const { domainId } = await params;
    const { organizationId } = await requireCoachWithOrg();
    
    // Verify the domain belongs to this organization
    const domainDoc = await adminDb.collection('org_custom_domains').doc(domainId).get();
    
    if (!domainDoc.exists) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
    }
    
    const domainData = domainDoc.data() as OrgCustomDomain;
    if (domainData.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Domain does not belong to your organization' },
        { status: 403 }
      );
    }
    
    let routingConfigured = false;
    let authConfigured = false;
    
    // Check Vercel API for routing verification if configured
    if (isVercelDomainApiConfigured()) {
      // First trigger verification in Vercel
      const verifyResult = await verifyDomainInVercel(domainData.domain);
      
      if (verifyResult.success) {
        routingConfigured = verifyResult.verified || false;
      } else {
        // Domain might not be in Vercel, try to get its status
        const statusResult = await getDomainVerificationStatus(domainData.domain);
        if (statusResult.success) {
          routingConfigured = (statusResult.verified && statusResult.configured) || false;
        }
      }
    } else {
      // Fallback to manual DNS check for routing
      routingConfigured = await checkVercelCname(domainData.domain);
    }
    
    // Always check Clerk CNAME for authentication (via DNS lookup)
    authConfigured = await checkClerkCname(domainData.domain);
    
    // Both routing AND auth must be configured for full verification
    const verified = routingConfigured && authConfigured;
    
    const now = new Date().toISOString();
    const newStatus: CustomDomainStatus = verified ? 'verified' : 'pending';
    
    // Update domain status
    const updateData: Record<string, string> = {
      status: newStatus,
      lastCheckedAt: now,
      updatedAt: now,
    };
    
    if (verified) {
      updateData.verifiedAt = now;
    }
    
    await adminDb.collection('org_custom_domains').doc(domainId).update(updateData);
    
    console.log(`[COACH_CUSTOM_DOMAIN] Re-verified domain ${domainData.domain}: routing=${routingConfigured}, auth=${authConfigured}, verified=${verified}`);
    
    // Sync to Edge Config when domain is verified
    if (verified) {
      try {
        // Get org subdomain
        const orgDomainSnapshot = await adminDb
          .collection('org_domains')
          .where('organizationId', '==', organizationId)
          .limit(1)
          .get();
        
        const subdomain = orgDomainSnapshot.empty 
          ? '' 
          : orgDomainSnapshot.docs[0].data().subdomain;
        
        if (subdomain) {
          // Get branding to populate Edge Config entry
          const brandingDoc = await adminDb.collection('org_branding').doc(organizationId).get();
          const brandingData = brandingDoc.data();
          
          const edgeBranding: TenantBrandingData = brandingData ? {
            logoUrl: brandingData.logoUrl || null,
            horizontalLogoUrl: brandingData.horizontalLogoUrl || null,
            appTitle: brandingData.appTitle || DEFAULT_TENANT_BRANDING.appTitle,
            colors: brandingData.colors || DEFAULT_TENANT_BRANDING.colors,
            menuTitles: brandingData.menuTitles || DEFAULT_TENANT_BRANDING.menuTitles,
          } : DEFAULT_TENANT_BRANDING;
          
          // Sync with verified custom domain
          await syncTenantToEdgeConfig(
            organizationId,
            subdomain,
            edgeBranding,
            domainData.domain  // This is the verified custom domain
          );
          
          console.log(`[COACH_CUSTOM_DOMAIN] Synced Edge Config for verified custom domain: ${domainData.domain}`);
        }
      } catch (edgeError) {
        // Log but don't fail the request - Edge Config is optimization, not critical
        console.error('[COACH_CUSTOM_DOMAIN] Edge Config sync error (non-fatal):', edgeError);
      }
    }
    
    return NextResponse.json({
      success: true,
      domain: {
        id: domainId,
        domain: domainData.domain,
        status: newStatus,
        verificationToken: domainData.verificationToken,
        verifiedAt: verified ? now : domainData.verifiedAt,
        lastCheckedAt: now,
      },
      verified,
      routingConfigured,
      authConfigured,
    });
  } catch (error) {
    console.error('[COACH_CUSTOM_DOMAIN_PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to verify domain' }, { status: 500 });
  }
}

/**
 * DELETE /api/coach/org-domain/custom/[domainId]
 * Remove a custom domain
 * Only super_coach can remove custom domains
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ domainId: string }> }
) {
  try {
    const { domainId } = await params;
    const { userId, organizationId, orgRole } = await requireCoachWithOrg();
    
    // Check if user is authorized (super_coach)
    // First check metadata (fast), then fall back to Clerk API lookup (handles tenant subdomain routing)
    let isAuthorized = isSuperCoach(orgRole);
    
    if (!isAuthorized) {
      // Check Clerk organization membership directly (handles subdomain tenant routing)
      isAuthorized = await isUserOrgAdminInOrg(userId, organizationId);
    }
    
    if (!isAuthorized) {
      console.log(`[COACH_CUSTOM_DOMAIN] Unauthorized delete attempt. userId=${userId}, orgRole=${orgRole}, orgId=${organizationId}`);
      return NextResponse.json(
        { error: 'Only the Super Coach can remove custom domains' },
        { status: 403 }
      );
    }
    
    // Verify the domain belongs to this organization
    const domainDoc = await adminDb.collection('org_custom_domains').doc(domainId).get();
    
    if (!domainDoc.exists) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
    }
    
    const domainData = domainDoc.data() as OrgCustomDomain;
    if (domainData.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Domain does not belong to your organization' },
        { status: 403 }
      );
    }
    
    // Invalidate Edge Config entry for this custom domain FIRST
    try {
      await invalidateTenantByCustomDomain(domainData.domain);
      console.log(`[COACH_CUSTOM_DOMAIN] Invalidated Edge Config for custom domain: ${domainData.domain}`);
    } catch (edgeError) {
      // Log but don't fail the request - Edge Config is optimization, not critical
      console.error('[COACH_CUSTOM_DOMAIN] Edge Config invalidation error (non-fatal):', edgeError);
    }
    
    // Remove the domain from Vercel (if configured)
    if (isVercelDomainApiConfigured()) {
      const vercelResult = await removeDomainFromVercel(domainData.domain);
      if (!vercelResult.success) {
        console.error(`[COACH_CUSTOM_DOMAIN] Failed to remove domain from Vercel: ${vercelResult.error}`);
        // Continue with deletion anyway - the domain might not exist in Vercel
      }
    }
    
    // Remove the domain from Clerk (if it was added)
    if (domainData.clerkDomainId) {
      const clerkResult = await removeDomainFromClerk(domainData.clerkDomainId);
      if (!clerkResult.success) {
        console.error(`[COACH_CUSTOM_DOMAIN] Failed to remove domain from Clerk: ${clerkResult.error}`);
        // Continue with deletion anyway
      }
    }
    
    // Remove the domain from our database
    await removeCustomDomain(domainId);
    
    console.log(`[COACH_CUSTOM_DOMAIN] Removed custom domain ${domainData.domain} from org ${organizationId}`);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[COACH_CUSTOM_DOMAIN_DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to remove custom domain' }, { status: 500 });
  }
}
