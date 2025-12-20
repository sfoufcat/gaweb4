/**
 * Coach API: Custom Domain Management (Single Domain)
 * 
 * PATCH /api/coach/org-domain/custom/[domainId] - Re-verify a custom domain
 * DELETE /api/coach/org-domain/custom/[domainId] - Remove a custom domain
 */

import { NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
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
import { auth } from '@clerk/nextjs/server';
import type { OrgRole, OrgCustomDomain, CustomDomainStatus } from '@/types';
import dns from 'dns';
import { promisify } from 'util';

const resolveCname = promisify(dns.resolveCname);
const resolveTxt = promisify(dns.resolveTxt);

interface ClerkPublicMetadata {
  orgRole?: OrgRole;
  [key: string]: unknown;
}

/**
 * Check if domain has valid CNAME pointing to our service
 */
async function checkCnameRecord(domain: string): Promise<boolean> {
  try {
    const records = await resolveCname(domain);
    // Check if any CNAME record points to our Vercel DNS
    return records.some(record => 
      record.toLowerCase().includes('vercel') || 
      record.toLowerCase().includes('cname.vercel-dns.com')
    );
  } catch {
    return false;
  }
}

/**
 * Check if domain has valid TXT verification record
 */
async function checkTxtRecord(domain: string, expectedToken: string): Promise<boolean> {
  try {
    // Check for TXT record on the verification subdomain
    const verifyDomain = `_growthaddicts-verify.${domain}`;
    const records = await resolveTxt(verifyDomain);
    // TXT records come as arrays of strings, flatten and check
    return records.some(recordArray => 
      recordArray.some(record => record === expectedToken)
    );
  } catch {
    return false;
  }
}

/**
 * Verify domain DNS configuration
 */
async function verifyDomainDns(domain: string, verificationToken: string): Promise<{
  verified: boolean;
  method?: 'cname' | 'txt';
}> {
  // Check CNAME first
  const hasCname = await checkCnameRecord(domain);
  if (hasCname) {
    return { verified: true, method: 'cname' };
  }
  
  // Check TXT record
  const hasTxt = await checkTxtRecord(domain, verificationToken);
  if (hasTxt) {
    return { verified: true, method: 'txt' };
  }
  
  return { verified: false };
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
    
    let verified = false;
    let method: string | null = null;
    let verificationRecords: Array<{ type: string; domain: string; value: string; reason: string }> = [];
    
    // Use Vercel API for verification if configured
    if (isVercelDomainApiConfigured()) {
      // First trigger verification in Vercel
      const verifyResult = await verifyDomainInVercel(domainData.domain);
      
      if (verifyResult.success) {
        verified = verifyResult.verified || false;
        method = 'vercel';
        verificationRecords = verifyResult.verification || [];
      } else {
        // Domain might not be in Vercel, try to get its status
        const statusResult = await getDomainVerificationStatus(domainData.domain);
        if (statusResult.success) {
          verified = statusResult.verified && statusResult.configured || false;
          method = 'vercel';
          verificationRecords = statusResult.verification || [];
        }
      }
    }
    
    // Fallback to manual DNS check if Vercel API not configured or failed
    if (!isVercelDomainApiConfigured() || (!verified && method === null)) {
      const dnsResult = await verifyDomainDns(domainData.domain, domainData.verificationToken);
      verified = dnsResult.verified;
      method = dnsResult.method || null;
    }
    
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
    
    console.log(`[COACH_CUSTOM_DOMAIN] Re-verified domain ${domainData.domain}: ${verified ? `verified via ${method}` : 'still pending'}`);
    
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
      method,
      verificationRecords: verificationRecords.length > 0 ? verificationRecords : undefined,
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
    const { organizationId } = await requireCoachWithOrg();
    
    // Check if user is super_coach
    const { sessionClaims } = await auth();
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const orgRole = publicMetadata?.orgRole;
    
    if (!isSuperCoach(orgRole)) {
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
    
    // Remove the domain from Vercel first (if configured)
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
