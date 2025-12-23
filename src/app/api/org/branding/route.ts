import { auth } from '@clerk/nextjs/server';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { ensureCoachHasOrganization } from '@/lib/clerk-organizations';
import { syncTenantToEdgeConfig, type TenantBrandingData } from '@/lib/tenant-edge-config';
import type { OrgBranding, OrgBrandingColors, OrgMenuTitles, OrgMenuIcons, UserRole, OrgRole } from '@/types';
import { DEFAULT_BRANDING_COLORS, DEFAULT_APP_TITLE, DEFAULT_LOGO_URL, DEFAULT_MENU_TITLES, DEFAULT_MENU_ICONS } from '@/types';

/**
 * GET /api/org/branding
 * Fetches branding settings for an organization
 * 
 * Resolution priority:
 * 1. x-tenant-org-id header (set by middleware for tenant domains) - NO AUTH REQUIRED
 * 2. Query param orgId (for specific org lookup)
 * 3. Query param forCoach=true (for coach dashboard on platform domain) - AUTH REQUIRED
 * 4. Default branding
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
      // Priority 2: Explicit org ID requested (only if explicitly passed)
      organizationId = requestedOrgId;
    }
    
    // Priority 3: Coach dashboard mode - fetch authenticated coach's org branding
    // This allows coaches to see/edit their branding from the platform domain
    const forCoach = searchParams.get('forCoach') === 'true';
    if (!organizationId && forCoach) {
      const { userId, sessionClaims } = await auth();
      if (userId) {
        const publicMetadata = sessionClaims?.publicMetadata as { role?: UserRole; orgRole?: OrgRole } | undefined;
        if (canAccessCoachDashboard(publicMetadata?.role, publicMetadata?.orgRole)) {
          organizationId = await ensureCoachHasOrganization(userId);
          console.log(`[ORG_BRANDING_GET] Using coach's org from auth: ${organizationId}`);
        }
      }
    }
    
    // NOTE: Without forCoach=true, we do NOT fall back to the user's organization.
    // On the platform domain (app.growthaddicts.com), we want default branding for regular users.
    // User-specific branding should only appear on tenant domains where
    // x-tenant-org-id header is set by the middleware, OR when forCoach=true for the coach dashboard.

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
 * Only accessible by users who can access the coach dashboard (coach, admin, super_admin)
 * 
 * Body: Partial<OrgBranding> - fields to update
 */
export async function POST(request: Request) {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has coach/admin access (check both global role and org role)
    const publicMetadata = sessionClaims?.publicMetadata as { role?: UserRole; orgRole?: OrgRole } | undefined;
    const role = publicMetadata?.role;
    const orgRole = publicMetadata?.orgRole;

    if (!canAccessCoachDashboard(role, orgRole)) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    // Determine which organization to save branding for
    // Priority 1: Use tenant org ID from middleware (on tenant domains like app.porepower.com)
    // Priority 2: Use user's personal org (on platform domain like app.growthaddicts.com)
    const headersList = await headers();
    const tenantOrgId = headersList.get('x-tenant-org-id');
    
    let organizationId: string;
    
    if (tenantOrgId) {
      // On tenant domain - use tenant's org ID
      // The user must be the owner/admin of this org (verified by middleware + coach access check)
      organizationId = tenantOrgId;
      console.log(`[ORG_BRANDING_POST] Using tenant org from header: ${organizationId}`);
    } else {
      // On platform domain - use user's personal org
      organizationId = await ensureCoachHasOrganization(userId);
      console.log(`[ORG_BRANDING_POST] Using user's org: ${organizationId}`);
    }

    // Parse request body
    const body = await request.json();
    const { logoUrl, horizontalLogoUrl, appTitle, colors, menuTitles, menuIcons } = body as Partial<OrgBranding>;

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
        ...(horizontalLogoUrl !== undefined && { horizontalLogoUrl }),
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
        updatedAt: now,
      };
    } else {
      // Create new branding with defaults
      brandingData = {
        id: organizationId,
        organizationId,
        logoUrl: logoUrl ?? null,
        horizontalLogoUrl: horizontalLogoUrl ?? null,
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
      // Get subdomain and custom domain from org_domains
      const domainDoc = await adminDb.collection('org_domains').doc(organizationId).get();
      const domainData = domainDoc.data();
      
      if (domainData?.subdomain) {
        const edgeBranding: TenantBrandingData = {
          logoUrl: brandingData.logoUrl,
          horizontalLogoUrl: brandingData.horizontalLogoUrl,
          appTitle: brandingData.appTitle,
          colors: brandingData.colors,
          menuTitles: brandingData.menuTitles || DEFAULT_MENU_TITLES,
          menuIcons: brandingData.menuIcons || DEFAULT_MENU_ICONS,
        };
        
        await syncTenantToEdgeConfig(
          organizationId,
          domainData.subdomain,
          edgeBranding,
          domainData.verifiedCustomDomain || undefined
        );
        
        console.log(`[ORG_BRANDING_POST] Synced branding to Edge Config for subdomain: ${domainData.subdomain}`);
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
    horizontalLogoUrl: null,
    appTitle: DEFAULT_APP_TITLE,
    colors: DEFAULT_BRANDING_COLORS,
    menuTitles: DEFAULT_MENU_TITLES,
    menuIcons: DEFAULT_MENU_ICONS,
    createdAt: now,
    updatedAt: now,
  };
}
