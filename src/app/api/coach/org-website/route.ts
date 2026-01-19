import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg, TenantRequiredError } from '@/lib/admin-utils-clerk';
import { withDemoMode, demoNotAvailable } from '@/lib/demo-api';
import { syncTenantToEdgeConfig, buildTenantConfigData, setTenantByCustomDomain, type TenantBrandingData } from '@/lib/tenant-edge-config';
import type { OrgWebsite, OrgBranding, OrgCustomDomain, Funnel, OrgSettings } from '@/types';
import { DEFAULT_ORG_WEBSITE, DEFAULT_MENU_TITLES, DEFAULT_MENU_ICONS, DEFAULT_BRANDING_COLORS, DEFAULT_APP_TITLE, DEFAULT_LOGO_URL, DEFAULT_MENU_ORDER } from '@/types';

/**
 * GET /api/coach/org-website
 * Get the website configuration for the coach's organization
 * Each organization has at most one website
 */
export async function GET() {
  try {
    // Demo mode: return demo data
    const demoData = await withDemoMode('org-website');
    if (demoData) return demoData;

    const { organizationId } = await requireCoachWithOrg();

    // Get the website for this org (document ID = organizationId)
    const doc = await adminDb
      .collection('org_websites')
      .doc(organizationId)
      .get();

    let website: OrgWebsite | null = null;

    if (doc.exists) {
      website = {
        id: doc.id,
        ...doc.data(),
      } as OrgWebsite;
    }

    // Also fetch funnels for the dropdown selectors
    const funnelsSnapshot = await adminDb
      .collection('funnels')
      .where('organizationId', '==', organizationId)
      .where('isActive', '==', true)
      .get();

    const funnels = funnelsSnapshot.docs.map(d => ({
      id: d.id,
      name: d.data().name,
      slug: d.data().slug,
      targetType: d.data().targetType,
    }));

    return NextResponse.json({ website, funnels });
  } catch (error) {
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    console.error('[COACH_ORG_WEBSITE_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * PUT /api/coach/org-website
 * Create or update the website configuration for the organization
 *
 * Body: Partial<OrgWebsite>
 */
export async function PUT(req: Request) {
  try {
    // Demo mode: block write operations
    const demoData = await withDemoMode('org-website');
    if (demoData) return demoNotAvailable('Updating website');

    const { organizationId } = await requireCoachWithOrg();

    const body = await req.json();
    const updates = body as Partial<OrgWebsite>;

    // Validate funnelIds if provided
    const funnelIdsToValidate: string[] = [];
    if (updates.heroCtaFunnelId) funnelIdsToValidate.push(updates.heroCtaFunnelId);
    if (updates.ctaFunnelId) funnelIdsToValidate.push(updates.ctaFunnelId);
    if (updates.services) {
      updates.services.forEach(s => {
        if (s.funnelId) funnelIdsToValidate.push(s.funnelId);
      });
    }

    // Validate that all funnelIds exist in this org
    if (funnelIdsToValidate.length > 0) {
      const uniqueFunnelIds = [...new Set(funnelIdsToValidate)];
      const funnelDocs = await Promise.all(
        uniqueFunnelIds.map(id => adminDb.collection('funnels').doc(id).get())
      );

      for (let i = 0; i < funnelDocs.length; i++) {
        const doc = funnelDocs[i];
        if (!doc.exists) {
          return NextResponse.json({
            error: `Funnel not found: ${uniqueFunnelIds[i]}`
          }, { status: 400 });
        }
        const funnel = doc.data() as Funnel;
        if (funnel.organizationId !== organizationId) {
          return NextResponse.json({
            error: `Funnel does not belong to this organization: ${uniqueFunnelIds[i]}`
          }, { status: 403 });
        }
      }
    }

    const now = new Date().toISOString();
    const websiteRef = adminDb.collection('org_websites').doc(organizationId);
    const existingDoc = await websiteRef.get();

    let website: OrgWebsite;

    if (existingDoc.exists) {
      // Update existing website
      const updateData: Record<string, unknown> = {
        ...updates,
        updatedAt: now,
      };
      // Don't allow changing id or organizationId
      delete updateData.id;
      delete updateData.organizationId;
      delete updateData.createdAt;

      await websiteRef.update(updateData);

      const updatedDoc = await websiteRef.get();
      website = {
        id: updatedDoc.id,
        ...updatedDoc.data(),
      } as OrgWebsite;
    } else {
      // Create new website with defaults
      const websiteData: Omit<OrgWebsite, 'id'> = {
        ...DEFAULT_ORG_WEBSITE,
        ...updates,
        organizationId,
        createdAt: now,
        updatedAt: now,
      };

      await websiteRef.set(websiteData);

      website = {
        id: websiteRef.id,
        ...websiteData,
      };
    }

    console.log(`[COACH_ORG_WEBSITE] Updated website for org ${organizationId}: enabled=${website.enabled}`);

    // Sync websiteEnabled to Edge Config for fast middleware routing
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

      // Get feedEnabled from org_settings
      const settingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
      const settingsData = settingsDoc.exists ? (settingsDoc.data() as OrgSettings) : null;
      const feedEnabled = settingsData?.feedEnabled ?? false;

      const edgeBranding: TenantBrandingData = {
        logoUrl: brandingData?.logoUrl ?? DEFAULT_LOGO_URL,
        horizontalLogoUrl: brandingData?.horizontalLogoUrl ?? null,
        appTitle: brandingData?.appTitle ?? DEFAULT_APP_TITLE,
        colors: brandingData?.colors ?? DEFAULT_BRANDING_COLORS,
        menuTitles: brandingData?.menuTitles ?? DEFAULT_MENU_TITLES,
        menuIcons: brandingData?.menuIcons ?? DEFAULT_MENU_ICONS,
        menuOrder: brandingData?.menuOrder ?? DEFAULT_MENU_ORDER,
      };

      // Use syncTenantToEdgeConfig which preserves existing subscription data
      if (subdomain) {
        await syncTenantToEdgeConfig(
          organizationId,
          subdomain,
          edgeBranding,
          verifiedCustomDomain || undefined,
          undefined, // coachingPromo
          feedEnabled,
          undefined, // programEmptyStateBehavior
          undefined, // squadEmptyStateBehavior
          undefined, // subscription - will be preserved by syncTenantToEdgeConfig
          website.enabled // websiteEnabled
        );
        console.log(`[COACH_ORG_WEBSITE] Synced websiteEnabled=${website.enabled} to Edge Config for subdomain: ${subdomain}`);
      } else if (verifiedCustomDomain) {
        // For custom domain without subdomain, also use syncTenantToEdgeConfig to preserve subscription
        const fallbackSubdomain = `org-${organizationId.substring(0, 8)}`;
        await syncTenantToEdgeConfig(
          organizationId,
          fallbackSubdomain,
          edgeBranding,
          verifiedCustomDomain,
          undefined, // coachingPromo
          feedEnabled,
          undefined, // programEmptyStateBehavior
          undefined, // squadEmptyStateBehavior
          undefined, // subscription - will be preserved by syncTenantToEdgeConfig
          website.enabled // websiteEnabled
        );
        console.log(`[COACH_ORG_WEBSITE] Synced websiteEnabled=${website.enabled} to Edge Config for custom domain: ${verifiedCustomDomain}`);
      }
    } catch (edgeError) {
      console.error('[COACH_ORG_WEBSITE] Edge Config sync error (non-fatal):', edgeError);
    }

    return NextResponse.json({ website });
  } catch (error) {
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    console.error('[COACH_ORG_WEBSITE_PUT]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
