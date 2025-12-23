/**
 * Tenant Resolution API
 * 
 * GET /api/tenant/resolve?subdomain=xxx or ?domain=xxx
 * 
 * Called by middleware to resolve tenant from subdomain or custom domain.
 * This API has access to Firebase Admin SDK, which edge middleware does not.
 * 
 * Returns organizationId, subdomain, and branding data for the middleware
 * to build the tenant cookie correctly (even when Edge Config is unavailable).
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { OrgDomain, OrgCustomDomain, OrgBranding } from '@/types';
import { DEFAULT_BRANDING_COLORS, DEFAULT_APP_TITLE, DEFAULT_LOGO_URL, DEFAULT_MENU_TITLES, DEFAULT_MENU_ICONS } from '@/types';
import type { TenantBrandingData, TenantCoachingPromoData } from '@/lib/tenant-edge-config';

/**
 * Fetch branding data for an organization from Firestore
 */
async function getOrgBranding(organizationId: string): Promise<TenantBrandingData> {
  try {
    const brandingDoc = await adminDb.collection('org_branding').doc(organizationId).get();
    
    if (brandingDoc.exists) {
      const data = brandingDoc.data() as OrgBranding;
      return {
        logoUrl: data.logoUrl ?? DEFAULT_LOGO_URL,
        horizontalLogoUrl: data.horizontalLogoUrl ?? null,
        appTitle: data.appTitle ?? DEFAULT_APP_TITLE,
        colors: data.colors ?? DEFAULT_BRANDING_COLORS,
        menuTitles: data.menuTitles ?? DEFAULT_MENU_TITLES,
        menuIcons: data.menuIcons ?? DEFAULT_MENU_ICONS,
      };
    }
    
    // Return default branding if no custom branding exists
    return {
      logoUrl: DEFAULT_LOGO_URL,
      horizontalLogoUrl: null,
      appTitle: DEFAULT_APP_TITLE,
      colors: DEFAULT_BRANDING_COLORS,
      menuTitles: DEFAULT_MENU_TITLES,
      menuIcons: DEFAULT_MENU_ICONS,
    };
  } catch (error) {
    console.error('[TENANT_RESOLVE] Error fetching branding:', error);
    // Return default branding on error
    return {
      logoUrl: DEFAULT_LOGO_URL,
      horizontalLogoUrl: null,
      appTitle: DEFAULT_APP_TITLE,
      colors: DEFAULT_BRANDING_COLORS,
      menuTitles: DEFAULT_MENU_TITLES,
      menuIcons: DEFAULT_MENU_ICONS,
    };
  }
}

/**
 * Fetch coaching promo data for an organization from Firestore
 */
async function getOrgCoachingPromo(organizationId: string): Promise<TenantCoachingPromoData | undefined> {
  try {
    const promoDoc = await adminDb.collection('org_coaching_promo').doc(organizationId).get();
    
    if (promoDoc.exists) {
      const data = promoDoc.data();
      return {
        title: data?.title || 'Get your personal coach',
        subtitle: data?.subtitle || 'Work with a performance psychologist 1:1',
        imageUrl: data?.imageUrl || '',
        isVisible: data?.isVisible ?? true,
      };
    }
    
    return undefined;
  } catch (error) {
    console.error('[TENANT_RESOLVE] Error fetching coaching promo:', error);
    return undefined;
  }
}

export async function GET(request: Request) {
  // Only allow internal requests (from middleware)
  const isInternal = request.headers.get('x-internal-request') === 'true';
  const isDev = process.env.NODE_ENV === 'development';
  
  if (!isInternal && !isDev) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  const { searchParams } = new URL(request.url);
  const subdomain = searchParams.get('subdomain');
  const domain = searchParams.get('domain');
  
  if (!subdomain && !domain) {
    return NextResponse.json({ error: 'Missing subdomain or domain parameter' }, { status: 400 });
  }
  
  try {
    if (subdomain) {
      // Resolve by subdomain
      const snapshot = await adminDb
        .collection('org_domains')
        .where('subdomain', '==', subdomain.toLowerCase())
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return NextResponse.json({ found: false }, { status: 404 });
      }
      
      const data = snapshot.docs[0].data() as OrgDomain;
      
      // Check if this organization has a verified custom domain
      // If so, subdomain requests should redirect to the custom domain
      const customDomainSnapshot = await adminDb
        .collection('org_custom_domains')
        .where('organizationId', '==', data.organizationId)
        .where('status', '==', 'verified')
        .limit(1)
        .get();
      
      const verifiedCustomDomain = customDomainSnapshot.empty 
        ? null 
        : (customDomainSnapshot.docs[0].data() as OrgCustomDomain).domain;
      
      // Fetch branding data for the middleware to build the cookie
      const branding = await getOrgBranding(data.organizationId);
      const coachingPromo = await getOrgCoachingPromo(data.organizationId);
      
      return NextResponse.json({
        found: true,
        organizationId: data.organizationId,
        subdomain: data.subdomain,
        isCustomDomain: false,
        verifiedCustomDomain,  // For subdomain -> custom domain redirect
        branding,
        coachingPromo,
      });
    } else if (domain) {
      // Resolve by custom domain
      const snapshot = await adminDb
        .collection('org_custom_domains')
        .where('domain', '==', domain.toLowerCase())
        .where('status', '==', 'verified')
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return NextResponse.json({ found: false }, { status: 404 });
      }
      
      const customDomainData = snapshot.docs[0].data() as OrgCustomDomain;
      
      // Get the org's subdomain
      const orgDomainSnapshot = await adminDb
        .collection('org_domains')
        .where('organizationId', '==', customDomainData.organizationId)
        .limit(1)
        .get();
      
      const subdomain = orgDomainSnapshot.empty 
        ? '' 
        : (orgDomainSnapshot.docs[0].data() as OrgDomain).subdomain;
      
      // Fetch branding data for the middleware to build the cookie
      const branding = await getOrgBranding(customDomainData.organizationId);
      const coachingPromo = await getOrgCoachingPromo(customDomainData.organizationId);
      
      return NextResponse.json({
        found: true,
        organizationId: customDomainData.organizationId,
        subdomain,
        isCustomDomain: true,
        verifiedCustomDomain: domain,
        branding,
        coachingPromo,
      });
    }
    
    return NextResponse.json({ found: false }, { status: 404 });
  } catch (error) {
    console.error('[TENANT_RESOLVE] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
