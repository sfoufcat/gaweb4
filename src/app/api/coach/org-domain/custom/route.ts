/**
 * Coach API: Custom Domain Management
 * 
 * GET /api/coach/org-domain/custom - List custom domains
 * POST /api/coach/org-domain/custom - Add a new custom domain
 */

import { NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { 
  getOrgCustomDomains,
  addCustomDomain,
  isCustomDomainAvailable,
} from '@/lib/tenant/resolveTenant';
import { addDomainToVercel, isVercelDomainApiConfigured } from '@/lib/vercel-domains';
import { addDomainToClerk } from '@/lib/clerk-domains';
import { isSuperCoach } from '@/lib/admin-utils-shared';
import { auth } from '@clerk/nextjs/server';
import type { OrgRole } from '@/types';

interface ClerkPublicMetadata {
  orgRole?: OrgRole;
  [key: string]: unknown;
}

/**
 * GET /api/coach/org-domain/custom
 * List all custom domains for the organization
 */
export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();
    
    const customDomains = await getOrgCustomDomains(organizationId);
    
    return NextResponse.json({
      customDomains: customDomains.map(d => ({
        id: d.id,
        domain: d.domain,
        status: d.status,
        verificationToken: d.verificationToken,
        verifiedAt: d.verifiedAt,
        createdAt: d.createdAt,
      })),
      organizationId,
    });
  } catch (error) {
    console.error('[COACH_CUSTOM_DOMAIN_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch custom domains' }, { status: 500 });
  }
}

/**
 * POST /api/coach/org-domain/custom
 * Add a new custom domain
 * Only super_coach can add custom domains
 */
export async function POST(request: Request) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    
    // Check if user is super_coach
    const { sessionClaims } = await auth();
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const orgRole = publicMetadata?.orgRole;
    
    if (!isSuperCoach(orgRole)) {
      return NextResponse.json(
        { error: 'Only the Super Coach can add custom domains' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { domain } = body as { domain: string };
    
    if (!domain) {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 });
    }
    
    // Normalize domain
    const normalizedDomain = domain.toLowerCase().trim();
    
    // Basic domain validation
    const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
    if (!domainRegex.test(normalizedDomain)) {
      return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 });
    }
    
    // Don't allow growthaddicts.app subdomains as custom domains
    if (normalizedDomain.endsWith('.growthaddicts.app') || normalizedDomain.endsWith('.growthaddicts.com')) {
      return NextResponse.json({ 
        error: 'Cannot add growthaddicts.app/com domains as custom domains. Use the subdomain setting instead.' 
      }, { status: 400 });
    }
    
    // Check availability in our database
    const isAvailable = await isCustomDomainAvailable(normalizedDomain);
    if (!isAvailable) {
      return NextResponse.json({ error: 'This domain is already registered' }, { status: 400 });
    }
    
    // Add the domain to Vercel project first (if configured)
    let vercelResult = null;
    if (isVercelDomainApiConfigured()) {
      vercelResult = await addDomainToVercel(normalizedDomain);
      
      if (!vercelResult.success) {
        console.error(`[COACH_CUSTOM_DOMAIN] Failed to add domain to Vercel: ${vercelResult.error}`);
        return NextResponse.json({ 
          error: vercelResult.error || 'Failed to add domain to hosting provider' 
        }, { status: 400 });
      }
    } else {
      console.warn('[COACH_CUSTOM_DOMAIN] Vercel API not configured - domain added to database only');
    }
    
    // Add the domain to Clerk for authentication
    let clerkDomainId: string | undefined;
    const clerkResult = await addDomainToClerk(normalizedDomain);
    if (clerkResult.success && clerkResult.domainId) {
      clerkDomainId = clerkResult.domainId;
      console.log(`[COACH_CUSTOM_DOMAIN] Added domain to Clerk: ${clerkDomainId}`);
    } else {
      // Log but don't fail - Clerk API might not be available on all plans
      console.warn(`[COACH_CUSTOM_DOMAIN] Could not add domain to Clerk: ${clerkResult.error}. Authentication may require manual setup.`);
    }
    
    // Add the custom domain to our database
    const customDomain = await addCustomDomain(organizationId, normalizedDomain, clerkDomainId);
    
    console.log(`[COACH_CUSTOM_DOMAIN] Added custom domain ${normalizedDomain} for org ${organizationId}`);
    
    // Build verification instructions
    // Use Vercel's verification info if available, otherwise use default CNAME instructions
    const verificationInstructions = vercelResult?.verification && vercelResult.verification.length > 0
      ? {
          records: vercelResult.verification.map(v => ({
            type: v.type,
            domain: v.domain,
            value: v.value,
            reason: v.reason,
          })),
          note: 'Add these DNS records to verify domain ownership. DNS changes may take up to 24 hours to propagate.',
        }
      : {
          records: [
            {
              type: 'CNAME',
              domain: normalizedDomain,
              value: 'cname.vercel-dns.com',
              reason: 'Point your domain to Vercel',
            },
          ],
          note: 'Add this CNAME record to your DNS settings. Verification may take up to 24 hours.',
        };
    
    return NextResponse.json({
      success: true,
      customDomain: {
        id: customDomain.id,
        domain: customDomain.domain,
        status: vercelResult?.verified ? 'verified' : customDomain.status,
        verificationToken: customDomain.verificationToken,
      },
      verificationInstructions,
      vercelConfigured: isVercelDomainApiConfigured(),
      clerkConfigured: !!clerkDomainId,
    }, { status: 201 });
  } catch (error) {
    console.error('[COACH_CUSTOM_DOMAIN_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to add custom domain' }, { status: 500 });
  }
}
