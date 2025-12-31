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
import { clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { OrgDomain, OrgCustomDomain, OrgBranding } from '@/types';
import { DEFAULT_BRANDING_COLORS, DEFAULT_APP_TITLE, DEFAULT_LOGO_URL, DEFAULT_MENU_TITLES, DEFAULT_MENU_ICONS, DEFAULT_MENU_ORDER } from '@/types';
import type { TenantBrandingData, TenantCoachingPromoData } from '@/lib/tenant-edge-config';

/**
 * Helper to get the coach's profile picture for an organization
 * Finds the super_coach member and returns their Clerk imageUrl
 */
async function getCoachImageUrl(organizationId: string): Promise<string | null> {
  try {
    const clerk = await clerkClient();
    
    // Get organization members to find the super_coach
    const memberships = await clerk.organizations.getOrganizationMembershipList({
      organizationId,
    });
    
    // Find the member with super_coach orgRole (stored in membership publicMetadata)
    const coachMember = memberships.data.find(m => {
      const metadata = m.publicMetadata as { orgRole?: string } | undefined;
      return metadata?.orgRole === 'super_coach';
    });
    
    if (coachMember?.publicUserData?.userId) {
      const coachUser = await clerk.users.getUser(coachMember.publicUserData.userId);
      return coachUser.imageUrl || null;
    }
    
    // Fallback to first org:admin if no super_coach found
    const adminMember = memberships.data.find(m => 
      m.role === 'org:admin' && m.publicUserData?.userId
    );
    if (adminMember?.publicUserData?.userId) {
      const adminUser = await clerk.users.getUser(adminMember.publicUserData.userId);
      return adminUser.imageUrl || null;
    }
    
    return null;
  } catch (err) {
    console.error('[TENANT_RESOLVE] Error fetching coach image:', err);
    return null;
  }
}

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
        menuOrder: data.menuOrder ?? DEFAULT_MENU_ORDER,
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
      menuOrder: DEFAULT_MENU_ORDER,
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
      menuOrder: DEFAULT_MENU_ORDER,
    };
  }
}

/**
 * Fetch coaching promo data for an organization from Firestore
 * If no custom image is set, resolves to coach's profile picture
 */
async function getOrgCoachingPromo(organizationId: string): Promise<TenantCoachingPromoData | undefined> {
  try {
    const promoDoc = await adminDb.collection('org_coaching_promo').doc(organizationId).get();
    
    let imageUrl = '';
    let title = 'Work with me 1:1';
    let subtitle = 'Let me help you unleash your potential';
    let isVisible = true;
    
    if (promoDoc.exists) {
      const data = promoDoc.data();
      title = data?.title || title;
      subtitle = data?.subtitle || subtitle;
      imageUrl = data?.imageUrl || '';
      isVisible = data?.isVisible ?? true;
    }
    
    // If no custom image, resolve to coach's profile picture
    if (!imageUrl) {
      const coachImage = await getCoachImageUrl(organizationId);
      imageUrl = coachImage || '';
    }
    
    return {
      title,
      subtitle,
      imageUrl,
      isVisible,
    };
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
  const orgId = searchParams.get('orgId');
  
  if (!subdomain && !domain && !orgId) {
    return NextResponse.json({ error: 'Missing subdomain, domain, or orgId parameter' }, { status: 400 });
  }
  
  try {
    // Resolve by organization ID (reverse lookup)
    if (orgId) {
      const snapshot = await adminDb
        .collection('org_domains')
        .where('organizationId', '==', orgId)
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return NextResponse.json({ found: false, subdomain: null }, { status: 404 });
      }
      
      const data = snapshot.docs[0].data() as OrgDomain;
      return NextResponse.json({
        found: true,
        organizationId: data.organizationId,
        subdomain: data.subdomain,
      });
    }
    
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
