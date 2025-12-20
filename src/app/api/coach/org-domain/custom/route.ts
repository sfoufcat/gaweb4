/**
 * Coach API: Custom Domain Management
 * 
 * GET /api/coach/org-domain/custom - List custom domains
 * POST /api/coach/org-domain/custom - Add a new custom domain
 */

import { NextResponse } from 'next/server';
import { requireCoachWithOrg, isUserOrgAdminInOrg } from '@/lib/admin-utils-clerk';
import { 
  getOrgCustomDomains,
  addCustomDomain,
  isCustomDomainAvailable,
} from '@/lib/tenant/resolveTenant';
import { addDomainToVercel, isVercelDomainApiConfigured } from '@/lib/vercel-domains';
import { addDomainToClerk } from '@/lib/clerk-domains';
import { registerDomainForApplePay, isStripeDomainConfigured } from '@/lib/stripe-domains';
import { adminDb } from '@/lib/firebase-admin';
import { isSuperCoach } from '@/lib/admin-utils-shared';

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
    const { userId, organizationId, orgRole } = await requireCoachWithOrg();
    
    // Check if user is authorized (super_coach)
    // First check metadata (fast), then fall back to Clerk API lookup (handles tenant subdomain routing)
    let isAuthorized = isSuperCoach(orgRole);
    
    if (!isAuthorized) {
      // Check Clerk organization membership directly (handles subdomain tenant routing)
      isAuthorized = await isUserOrgAdminInOrg(userId, organizationId);
    }
    
    if (!isAuthorized) {
      console.log(`[COACH_CUSTOM_DOMAIN_ADD] Unauthorized add attempt. userId=${userId}, orgRole=${orgRole}, orgId=${organizationId}`);
      return NextResponse.json(
        { error: 'Only the Super Coach can add custom domains' },
        { status: 403 }
      );
    }
    
    // Enforce domain limit (1 custom domain per organization)
    const existingDomains = await getOrgCustomDomains(organizationId);
    if (existingDomains.length >= 1) {
      return NextResponse.json({ 
        error: 'Domain limit reached. Remove your existing custom domain first.' 
      }, { status: 400 });
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
    
    // Add the domain to Vercel project (if configured)
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
    
    // Add the domain to Clerk for authentication (satellite domain)
    let clerkDomainId: string | undefined;
    let clerkFrontendApi: string | undefined;
    const clerkResult = await addDomainToClerk(normalizedDomain);
    if (clerkResult.success && clerkResult.domainId) {
      clerkDomainId = clerkResult.domainId;
      clerkFrontendApi = clerkResult.frontendApi;
      console.log(`[COACH_CUSTOM_DOMAIN] Added domain to Clerk: ${clerkDomainId}`);
    } else {
      console.warn(`[COACH_CUSTOM_DOMAIN] Could not add domain to Clerk: ${clerkResult.error}. Authentication may require manual setup.`);
    }
    
    // Register domain with Stripe for Apple Pay (if coach has connected Stripe account)
    let stripeApplePayConfigured = false;
    if (isStripeDomainConfigured()) {
      // Get the org_settings to check for Stripe Connect account
      const settingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
      const settings = settingsDoc.data();
      
      if (settings?.stripeConnectAccountId) {
        const stripeResult = await registerDomainForApplePay(
          normalizedDomain,
          settings.stripeConnectAccountId
        );
        
        if (stripeResult.success) {
          stripeApplePayConfigured = true;
          console.log(`[COACH_CUSTOM_DOMAIN] Registered domain for Apple Pay with Stripe Connect account`);
        } else {
          // Don't fail the domain addition - Apple Pay is optional
          console.warn(`[COACH_CUSTOM_DOMAIN] Could not register domain for Apple Pay: ${stripeResult.error}. Apple Pay may not work on this domain.`);
        }
      } else {
        console.log(`[COACH_CUSTOM_DOMAIN] No Stripe Connect account found - skipping Apple Pay domain registration`);
      }
    }
    
    // Add the custom domain to our database
    const customDomain = await addCustomDomain(organizationId, normalizedDomain, clerkDomainId);
    
    console.log(`[COACH_CUSTOM_DOMAIN] Added custom domain ${normalizedDomain} for org ${organizationId}`);
    
    // Build combined DNS instructions (Vercel + Clerk)
    const dnsRecords: Array<{ type: string; domain: string; value: string; reason: string }> = [];
    
    // Add Vercel DNS records
    if (vercelResult?.verification && vercelResult.verification.length > 0) {
      dnsRecords.push(...vercelResult.verification.map(v => ({
        type: v.type,
        domain: v.domain,
        value: v.value,
        reason: v.reason,
      })));
    } else {
      // Default CNAME for Vercel
      dnsRecords.push({
        type: 'CNAME',
        domain: normalizedDomain,
        value: 'cname.vercel-dns.com',
        reason: 'Route traffic to your app',
      });
    }
    
    // Add Clerk DNS record for authentication
    if (clerkFrontendApi) {
      dnsRecords.push({
        type: 'CNAME',
        domain: clerkFrontendApi,
        value: 'frontend-api.clerk.services',
        reason: 'Enable authentication on custom domain',
      });
    }
    
    const verificationInstructions = {
      records: dnsRecords,
      note: 'Add ALL these DNS records to your domain provider. DNS changes may take up to 24 hours to propagate.',
    };
    
    return NextResponse.json({
      success: true,
      customDomain: {
        id: customDomain.id,
        domain: customDomain.domain,
        status: customDomain.status, // Always pending on add - use reverify to check both CNAMEs
        verificationToken: customDomain.verificationToken,
      },
      verificationInstructions,
      vercelConfigured: isVercelDomainApiConfigured(),
      clerkConfigured: !!clerkDomainId,
      stripeApplePayConfigured,
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
