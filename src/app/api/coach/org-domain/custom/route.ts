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
    
    // Check availability
    const isAvailable = await isCustomDomainAvailable(normalizedDomain);
    if (!isAvailable) {
      return NextResponse.json({ error: 'This domain is already registered' }, { status: 400 });
    }
    
    // Add the custom domain
    const customDomain = await addCustomDomain(organizationId, normalizedDomain);
    
    console.log(`[COACH_CUSTOM_DOMAIN] Added custom domain ${normalizedDomain} for org ${organizationId}`);
    
    return NextResponse.json({
      success: true,
      customDomain: {
        id: customDomain.id,
        domain: customDomain.domain,
        status: customDomain.status,
        verificationToken: customDomain.verificationToken,
      },
      verificationInstructions: {
        type: 'CNAME',
        host: normalizedDomain,
        value: 'cname.vercel-dns.com', // Or your canonical app domain
        note: 'Add this CNAME record to your DNS settings. Verification may take up to 24 hours.',
        txtRecord: {
          host: `_growthaddicts-verify.${normalizedDomain}`,
          value: customDomain.verificationToken,
          note: 'Alternatively, add this TXT record for verification.',
        },
      },
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
