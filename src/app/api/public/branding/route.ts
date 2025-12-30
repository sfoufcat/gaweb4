/**
 * Public Branding API
 * 
 * GET /api/public/branding?domain=xxx
 * 
 * Returns public branding info (logo, app title) for a custom domain.
 * No authentication required - used by sign-in pages.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { OrgCustomDomain, OrgBranding } from '@/types';
import { DEFAULT_LOGO_URL, DEFAULT_APP_TITLE } from '@/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain');
  
  if (!domain) {
    return NextResponse.json({ error: 'Missing domain parameter' }, { status: 400 });
  }
  
  try {
    // Step 1: Resolve domain to organization
    const customDomainSnapshot = await adminDb
      .collection('org_custom_domains')
      .where('domain', '==', domain.toLowerCase())
      .where('status', '==', 'verified')
      .limit(1)
      .get();
    
    if (customDomainSnapshot.empty) {
      // Domain not found or not verified - return defaults
      return NextResponse.json({
        logoUrl: DEFAULT_LOGO_URL,
        appTitle: DEFAULT_APP_TITLE,
        isDefault: true,
      });
    }
    
    const customDomainData = customDomainSnapshot.docs[0].data() as OrgCustomDomain;
    const organizationId = customDomainData.organizationId;
    
    // Step 2: Fetch organization's branding
    const brandingDoc = await adminDb
      .collection('org_branding')
      .doc(organizationId)
      .get();
    
    if (!brandingDoc.exists) {
      // No custom branding - return defaults
      return NextResponse.json({
        logoUrl: DEFAULT_LOGO_URL,
        appTitle: DEFAULT_APP_TITLE,
        isDefault: true,
      });
    }
    
    const branding = brandingDoc.data() as OrgBranding;
    
    // Logo priority: square logo first, then horizontal, then default
    const logoUrl = branding.logoUrl || branding.horizontalLogoUrl || DEFAULT_LOGO_URL;
    
    return NextResponse.json({
      logoUrl,
      appTitle: branding.appTitle || DEFAULT_APP_TITLE,
      isDefault: false,
    });
  } catch (error) {
    console.error('[PUBLIC_BRANDING] Error:', error);
    // On error, return defaults gracefully
    return NextResponse.json({
      logoUrl: DEFAULT_LOGO_URL,
      appTitle: DEFAULT_APP_TITLE,
      isDefault: true,
    });
  }
}








