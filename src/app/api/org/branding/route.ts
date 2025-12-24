import { auth } from '@clerk/nextjs/server';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg, TenantRequiredError } from '@/lib/admin-utils-clerk';
import { syncTenantToEdgeConfig, setTenantByCustomDomain, buildTenantConfigData, type TenantBrandingData } from '@/lib/tenant-edge-config';
import type { OrgCustomDomain } from '@/types';
import type { OrgBranding, OrgBrandingColors, OrgMenuTitles, OrgMenuIcons, OrgDefaultTheme, UserRole } from '@/types';
import { DEFAULT_BRANDING_COLORS, DEFAULT_APP_TITLE, DEFAULT_LOGO_URL, DEFAULT_MENU_TITLES, DEFAULT_MENU_ICONS, DEFAULT_THEME } from '@/types';

/**
 * GET /api/org/branding
 * Fetches branding settings for an organization
 * 
 * Resolution priority:
 * 1. x-tenant-org-id header (set by middleware for tenant domains) - NO AUTH REQUIRED
 * 2. Query param orgId (for super_admin only - for debugging/support)
 * 3. Default branding (on platform domain)
 * 
 * NOTE: The forCoach fallback has been REMOVED to enforce tenant isolation.
 * Coaches must access their branding settings from their tenant domain
 * (subdomain or custom domain), not the platform domain.
 * Super admins are exempted and can access from platform domain.
 * 
 * This endpoint is public for GET requests when on a tenant domain,
 * allowing branding to load before user authentication.
 */
export async function GET(request: Request) {
  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    const requestedOrgId = searchParams.get('orgId');

    // Priority 1: Check for tenant org ID from middleware (set for tenant domains)
    // This allows branding to be loaded without authentication on tenant domains
    const headersList = await headers();
    const tenantOrgId = headersList.get('x-tenant-org-id');
    
    let organizationId: string | null = null;
    
    if (tenantOrgId) {
      // Tenant mode - use tenant org ID (no auth required)
      organizationId = tenantOrgId;
      console.log(`[ORG_BRANDING_GET] Using tenant org from header: ${organizationId}`);
    } else if (requestedOrgId) {
      // Priority 2: Explicit org ID requested - only allow for super_admin
      const { sessionClaims } = await auth();
      const role = (sessionClaims?.publicMetadata as { role?: UserRole } | undefined)?.role;
      if (role === 'super_admin') {
        organizationId = requestedOrgId;
        console.log(`[ORG_BRANDING_GET] Super admin accessing org: ${organizationId}`);
      } else {
        console.log(`[ORG_BRANDING_GET] Rejected orgId param for non-super_admin`);
      }
    }
    
    // NOTE: forCoach fallback REMOVED - enforces tenant isolation
    // On platform domain without tenant context, return default branding
    // Coaches must use their subdomain or custom domain to see their branding

    // If still no org ID, return default branding
    if (!organizationId) {
      return NextResponse.json({
        branding: getDefaultBranding(),
        isDefault: true,
      });
    }

    // Fetch branding from Firestore
    const brandingDoc = await adminDb.collection('org_branding').doc(organizationId).get();

    if (!brandingDoc.exists) {
      return NextResponse.json({
        branding: getDefaultBranding(organizationId),
        isDefault: true,
      });
    }

    const branding = { id: brandingDoc.id, ...brandingDoc.data() } as OrgBranding;

    return NextResponse.json({
      branding,
      isDefault: false,
    });
  } catch (error) {
    console.error('[ORG_BRANDING_GET_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * POST /api/org/branding
 * Updates branding settings for the current user's organization
 * 
 * REQUIRES tenant mode (subdomain or custom domain) unless super_admin.
 * Regular coaches must access from their tenant domain.
 * 
 * Body: Partial<OrgBranding> - fields to update
 */
export async function POST(request: Request) {
  try {
    // Use requireCoachWithOrg which enforces tenant mode
    // Super admins are exempted and can access from platform domain
    let organizationId: string;
    
    try {
      const result = await requireCoachWithOrg();
      organizationId = result.organizationId;
      console.log(`[ORG_BRANDING_POST] Using org: ${organizationId} (tenantMode: ${result.isTenantMode})`);
    } catch (error) {
      if (error instanceof TenantRequiredError) {
        return NextResponse.json({
          error: 'tenant_required',
          message: 'Please access this feature from your organization domain',
          tenantUrl: error.tenantUrl,
          subdomain: error.subdomain,
        }, { status: 403 });
      }
      throw error;
    }

    // Parse request body
    const body = await request.json();
    const { logoUrl, logoUrlDark, horizontalLogoUrl, horizontalLogoUrlDark, appTitle, colors, menuTitles, menuIcons, defaultTheme } = body as Partial<OrgBranding>;

    // Get existing branding or create new
    const brandingRef = adminDb.collection('org_branding').doc(organizationId);
    const existingDoc = await brandingRef.get();
    const now = new Date().toISOString();

    let brandingData: OrgBranding;

    if (existingDoc.exists) {
      // Update existing branding
      const existing = existingDoc.data() as OrgBranding;
      
      brandingData = {
        ...existing,
        ...(logoUrl !== undefined && { logoUrl }),
        ...(logoUrlDark !== undefined && { logoUrlDark }),
        ...(horizontalLogoUrl !== undefined && { horizontalLogoUrl }),
        ...(horizontalLogoUrlDark !== undefined && { horizontalLogoUrlDark }),
        ...(appTitle !== undefined && { appTitle }),
        ...(colors !== undefined && { 
          colors: {
            ...existing.colors,
            ...colors,
          } as OrgBrandingColors
        }),
        ...(menuTitles !== undefined && { 
          menuTitles: {
            ...DEFAULT_MENU_TITLES,
            ...existing.menuTitles,
            ...menuTitles,
          } as OrgMenuTitles
        }),
        ...(menuIcons !== undefined && { 
          menuIcons: {
            ...DEFAULT_MENU_ICONS,
            ...existing.menuIcons,
            ...menuIcons,
          } as OrgMenuIcons
        }),
        ...(defaultTheme !== undefined && { defaultTheme }),
        updatedAt: now,
      };
    } else {
      // Create new branding with defaults
      brandingData = {
        id: organizationId,
        organizationId,
        logoUrl: logoUrl ?? null,
        logoUrlDark: logoUrlDark ?? null,
        horizontalLogoUrl: horizontalLogoUrl ?? null,
        horizontalLogoUrlDark: horizontalLogoUrlDark ?? null,
        appTitle: appTitle ?? DEFAULT_APP_TITLE,
        colors: {
          ...DEFAULT_BRANDING_COLORS,
          ...colors,
        },
        menuTitles: {
          ...DEFAULT_MENU_TITLES,
          ...menuTitles,
        },
        menuIcons: {
          ...DEFAULT_MENU_ICONS,
          ...menuIcons,
        },
        defaultTheme: defaultTheme ?? DEFAULT_THEME,
        createdAt: now,
        updatedAt: now,
      };
    }

    // Save to Firestore
    await brandingRef.set(brandingData, { merge: true });

    console.log(`[ORG_BRANDING_POST] Updated branding for org ${organizationId}`, {
      menuTitles: brandingData.menuTitles,
      menuIcons: brandingData.menuIcons,
    });

    // Sync to Edge Config for fast tenant resolution
    try {
      // Build branding data for Edge Config
      const edgeBranding: TenantBrandingData = {
        logoUrl: brandingData.logoUrl,
        horizontalLogoUrl: brandingData.horizontalLogoUrl,
        appTitle: brandingData.appTitle,
        colors: brandingData.colors,
        menuTitles: brandingData.menuTitles || DEFAULT_MENU_TITLES,
        menuIcons: brandingData.menuIcons || DEFAULT_MENU_ICONS,
      };
      
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
      
      // Get feedEnabled from org_settings for Edge Config
      const orgSettingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
      const feedEnabled = orgSettingsDoc.exists ? (orgSettingsDoc.data()?.feedEnabled === true) : false;
      
      if (subdomain) {
        // Has subdomain - sync with both subdomain and custom domain keys
        await syncTenantToEdgeConfig(
          organizationId,
          subdomain,
          edgeBranding,
          verifiedCustomDomain || undefined,
          undefined, // coachingPromo
          feedEnabled
        );
        console.log(`[ORG_BRANDING_POST] Synced branding to Edge Config for subdomain: ${subdomain}${verifiedCustomDomain ? ` and custom domain: ${verifiedCustomDomain}` : ''} (feedEnabled: ${feedEnabled})`);
      } else if (verifiedCustomDomain) {
        // Custom-domain-only org - sync with custom domain key only
        // Generate a fallback subdomain from org ID for the data structure
        const fallbackSubdomain = `org-${organizationId.substring(0, 8)}`;
        const configData = buildTenantConfigData(
          organizationId,
          fallbackSubdomain,
          edgeBranding,
          verifiedCustomDomain,
          undefined, // coachingPromo
          feedEnabled
        );
        await setTenantByCustomDomain(verifiedCustomDomain, configData);
        console.log(`[ORG_BRANDING_POST] Synced branding to Edge Config for custom domain: ${verifiedCustomDomain} (feedEnabled: ${feedEnabled})`);
      } else {
        console.log(`[ORG_BRANDING_POST] No subdomain or verified custom domain found for org ${organizationId} - skipping Edge Config sync`);
      }
    } catch (edgeError) {
      // Log but don't fail the request - Edge Config is optimization, not critical
      console.error('[ORG_BRANDING_POST] Edge Config sync error (non-fatal):', edgeError);
    }

    return NextResponse.json({
      success: true,
      branding: brandingData,
    });
  } catch (error) {
    console.error('[ORG_BRANDING_POST_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * Helper to get default branding object
 */
function getDefaultBranding(organizationId?: string): OrgBranding {
  const now = new Date().toISOString();
  return {
    id: organizationId || 'default',
    organizationId: organizationId || 'default',
    logoUrl: DEFAULT_LOGO_URL,
    logoUrlDark: null,
    horizontalLogoUrl: null,
    horizontalLogoUrlDark: null,
    appTitle: DEFAULT_APP_TITLE,
    colors: DEFAULT_BRANDING_COLORS,
    menuTitles: DEFAULT_MENU_TITLES,
    menuIcons: DEFAULT_MENU_ICONS,
    defaultTheme: DEFAULT_THEME,
    createdAt: now,
    updatedAt: now,
  };
}
