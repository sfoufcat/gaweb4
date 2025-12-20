import { auth } from '@clerk/nextjs/server';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { ensureCoachHasOrganization, getCurrentUserOrganizationId } from '@/lib/clerk-organizations';
import type { OrgBranding, OrgBrandingColors, OrgMenuTitles, UserRole } from '@/types';
import { DEFAULT_BRANDING_COLORS, DEFAULT_APP_TITLE, DEFAULT_LOGO_URL, DEFAULT_MENU_TITLES } from '@/types';

/**
 * GET /api/org/branding
 * Fetches branding settings for an organization
 * 
 * Resolution priority:
 * 1. x-tenant-org-id header (set by middleware for tenant domains) - NO AUTH REQUIRED
 * 2. Query param orgId (for specific org lookup)
 * 3. Current authenticated user's organization
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
      // Priority 2: Explicit org ID requested
      organizationId = requestedOrgId;
    } else {
      // Priority 3: Try to get current user's organization (requires auth)
      const { userId } = await auth();
      
      if (userId) {
        organizationId = await getCurrentUserOrganizationId();
      }
    }

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

    // Check if user has coach/admin access
    const publicMetadata = sessionClaims?.publicMetadata as { role?: UserRole } | undefined;
    const role = publicMetadata?.role;

    if (!canAccessCoachDashboard(role)) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    // Ensure user has an organization
    const organizationId = await ensureCoachHasOrganization(userId);

    // Parse request body
    const body = await request.json();
    const { logoUrl, horizontalLogoUrl, appTitle, colors, menuTitles } = body as Partial<OrgBranding>;

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
        createdAt: now,
        updatedAt: now,
      };
    }

    // Save to Firestore
    await brandingRef.set(brandingData, { merge: true });

    console.log(`[ORG_BRANDING_POST] Updated branding for org ${organizationId}`);

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
    createdAt: now,
    updatedAt: now,
  };
}
