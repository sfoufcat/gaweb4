import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { adminDb } from '@/lib/firebase-admin';
import { syncTenantToEdgeConfig, buildTenantConfigData, setTenantByCustomDomain, type TenantBrandingData } from '@/lib/tenant-edge-config';
import { withDemoMode } from '@/lib/demo-api';
import type { OrgBranding, OrgCustomDomain } from '@/types';
import { DEFAULT_MENU_TITLES, DEFAULT_MENU_ICONS, DEFAULT_BRANDING_COLORS, DEFAULT_APP_TITLE, DEFAULT_LOGO_URL, DEFAULT_MENU_ORDER } from '@/types';

/**
 * GET /api/coach/feed-settings
 * Get feed settings for the coach's organization
 */
export async function GET() {
  try {
    // Demo mode: return demo data
    const demoData = await withDemoMode('feed-settings');
    if (demoData) return demoData;
    
    const { organizationId } = await requireCoachWithOrg({ allowPlatformMode: true });

    const settingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
    
    if (!settingsDoc.exists) {
      return NextResponse.json({ feedEnabled: false });
    }

    const settings = settingsDoc.data();
    
    return NextResponse.json({
      feedEnabled: settings?.feedEnabled === true,
    });
  } catch (error) {
    console.error('[FEED_SETTINGS_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch settings';
    
    if (message === 'Unauthorized' || message.includes('Forbidden')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/coach/feed-settings
 * Update feed settings for the coach's organization
 */
export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg({ allowPlatformMode: true });

    const body = await request.json();
    const { feedEnabled } = body;

    if (typeof feedEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'feedEnabled must be a boolean' },
        { status: 400 }
      );
    }

    // Update org settings
    const settingsRef = adminDb.collection('org_settings').doc(organizationId);
    
    await settingsRef.set(
      { 
        feedEnabled,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // Sync feedEnabled to Edge Config for instant SSR loading
    try {
      // Get subdomain from org_domains
      const domainDoc = await adminDb.collection('org_domains').doc(organizationId).get();
      const domainData = domainDoc.data();
      const subdomain = domainData?.subdomain;
      
      // Get verified custom domain from org_custom_domains
      const customDomainSnapshot = await adminDb
        .collection('org_custom_domains')
        .where('organizationId', '==', organizationId)
        .where('status', '==', 'verified')
        .limit(1)
        .get();
      
      const verifiedCustomDomain = customDomainSnapshot.empty 
        ? null 
        : (customDomainSnapshot.docs[0].data() as OrgCustomDomain).domain;
      
      // Get branding from org_branding
      const brandingDoc = await adminDb.collection('org_branding').doc(organizationId).get();
      const brandingData = brandingDoc.exists ? (brandingDoc.data() as OrgBranding) : null;
      
      const edgeBranding: TenantBrandingData = {
        logoUrl: brandingData?.logoUrl ?? DEFAULT_LOGO_URL,
        horizontalLogoUrl: brandingData?.horizontalLogoUrl ?? null,
        appTitle: brandingData?.appTitle ?? DEFAULT_APP_TITLE,
        colors: brandingData?.colors ?? DEFAULT_BRANDING_COLORS,
        menuTitles: brandingData?.menuTitles ?? DEFAULT_MENU_TITLES,
        menuIcons: brandingData?.menuIcons ?? DEFAULT_MENU_ICONS,
        menuOrder: brandingData?.menuOrder ?? DEFAULT_MENU_ORDER,
      };
      
      if (subdomain) {
        await syncTenantToEdgeConfig(
          organizationId,
          subdomain,
          edgeBranding,
          verifiedCustomDomain || undefined,
          undefined, // coachingPromo
          feedEnabled
        );
        console.log(`[FEED_SETTINGS_POST] Synced feedEnabled=${feedEnabled} to Edge Config for subdomain: ${subdomain}`);
      } else if (verifiedCustomDomain) {
        const fallbackSubdomain = `org-${organizationId.substring(0, 8)}`;
        const configData = buildTenantConfigData(
          organizationId,
          fallbackSubdomain,
          edgeBranding,
          verifiedCustomDomain,
          undefined,
          feedEnabled
        );
        await setTenantByCustomDomain(verifiedCustomDomain, configData);
        console.log(`[FEED_SETTINGS_POST] Synced feedEnabled=${feedEnabled} to Edge Config for custom domain: ${verifiedCustomDomain}`);
      }
    } catch (edgeError) {
      console.error('[FEED_SETTINGS_POST] Edge Config sync error (non-fatal):', edgeError);
    }

    return NextResponse.json({
      success: true,
      feedEnabled,
    });
  } catch (error) {
    console.error('[FEED_SETTINGS_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update settings';
    
    if (message === 'Unauthorized' || message.includes('Forbidden')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

