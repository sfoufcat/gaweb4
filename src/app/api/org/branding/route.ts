import { auth } from '@clerk/nextjs/server';
import { headers } from 'next/headers';
import { NextResponse, NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg, TenantRequiredError } from '@/lib/admin-utils-clerk';
import { syncTenantToEdgeConfig, setTenantByCustomDomain, buildTenantConfigData, type TenantBrandingData, type TenantSubscriptionData } from '@/lib/tenant-edge-config';
import { regenerateDefaultLogo } from '@/lib/logo-generator';
import type { OrgCustomDomain, LogoSource, MenuItemKey } from '@/types';
import type { OrgBranding, OrgBrandingColors, OrgMenuTitles, OrgMenuIcons, OrgDefaultTheme, UserRole } from '@/types';
import { DEFAULT_BRANDING_COLORS, DEFAULT_APP_TITLE, DEFAULT_LOGO_URL, DEFAULT_MENU_TITLES, DEFAULT_MENU_ICONS, DEFAULT_MENU_ORDER, DEFAULT_THEME } from '@/types';

/**
 * Cookie data structure for tenant context (must match branding-server.ts)
 */
interface TenantCookieData {
  orgId: string;
  subdomain: string;
  branding: {
    logoUrl: string | null;
    logoUrlDark?: string | null;
    horizontalLogoUrl: string | null;
    horizontalLogoUrlDark?: string | null;
    appTitle: string;
    colors: OrgBrandingColors;
    menuTitles: OrgMenuTitles;
    menuIcons: OrgMenuIcons;
    menuOrder: MenuItemKey[];
  };
  feedEnabled?: boolean;
  updatedAt?: string; // Timestamp for freshness comparison with Edge Config
}

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
export async function POST(request: NextRequest) {
  try {
    // Use requireCoachWithOrg which enforces tenant mode
    // Super admins are exempted and can access from platform domain
    let organizationId: string;
    
    try {
      // Allow platform mode for branding updates (e.g., during onboarding on marketing domain)
      // This is safe because the function still requires coach auth and resolves org from user metadata
      const result = await requireCoachWithOrg({ allowPlatformMode: true });
      organizationId = result.organizationId;
      console.log(`[ORG_BRANDING_POST] Using org: ${organizationId} (tenantMode: ${result.isTenantMode}, role: ${result.role})`);
    } catch (error) {
      console.error('[ORG_BRANDING_POST] Auth error:', error instanceof Error ? error.message : error);
      if (error instanceof TenantRequiredError) {
        return NextResponse.json({
          error: 'tenant_required',
          message: 'Please access this feature from your organization domain',
          tenantUrl: error.tenantUrl,
          subdomain: error.subdomain,
        }, { status: 403 });
      }
      // Return proper error for other auth failures
      if (error instanceof Error) {
        if (error.message === 'Unauthorized') {
          return NextResponse.json({ error: 'Unauthorized', message: 'You must be logged in' }, { status: 401 });
        }
        if (error.message.includes('Coach access required') || error.message.includes('Forbidden')) {
          return NextResponse.json({ error: 'Forbidden', message: error.message }, { status: 403 });
        }
        if (error.message.includes('Organization not found')) {
          return NextResponse.json({ error: 'OrganizationNotFound', message: error.message }, { status: 400 });
        }
      }
      throw error;
    }

    // Parse request body
    const body = await request.json();
    const { logoUrl, logoUrlDark, horizontalLogoUrl, horizontalLogoUrlDark, appTitle, colors, menuTitles, menuIcons, menuOrder } = body as Partial<OrgBranding>;

    // Get existing branding or create new
    const brandingRef = adminDb.collection('org_branding').doc(organizationId);
    const existingDoc = await brandingRef.get();
    const now = new Date().toISOString();

    let brandingData: OrgBranding;
    let finalLogoUrl: string | null = null;
    let logoSource: LogoSource | undefined = undefined;

    if (existingDoc.exists) {
      // Update existing branding
      const existing = existingDoc.data() as OrgBranding;
      
      // Handle logo source logic
      if (logoUrl !== undefined && logoUrl !== null && logoUrl !== existing.logoUrl) {
        // New custom logo URL provided - mark as custom
        finalLogoUrl = logoUrl;
        logoSource = 'custom';
        console.log(`[ORG_BRANDING_POST] Custom logo uploaded for ${organizationId}`);
      } else if (appTitle !== undefined && appTitle !== existing.appTitle && existing.logoSource === 'generated') {
        // App title changed and logo is generated - regenerate logo
        try {
          finalLogoUrl = await regenerateDefaultLogo(organizationId, appTitle);
          logoSource = 'generated';
          console.log(`[ORG_BRANDING_POST] Regenerated logo for name change: ${appTitle}`);
        } catch (logoError) {
          console.error(`[ORG_BRANDING_POST] Failed to regenerate logo:`, logoError);
          // Keep existing logo
          finalLogoUrl = existing.logoUrl;
          logoSource = existing.logoSource;
        }
      } else {
        // No change to logo
        finalLogoUrl = logoUrl !== undefined ? logoUrl : existing.logoUrl;
        logoSource = existing.logoSource;
      }
      
      brandingData = {
        ...existing,
        ...(finalLogoUrl !== undefined && { logoUrl: finalLogoUrl }),
        ...(logoSource !== undefined && { logoSource }),
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
        ...(menuOrder !== undefined && { menuOrder }),
        updatedAt: now,
      };
    } else {
      // Create new branding with defaults
      // If logoUrl provided, it's custom; otherwise generate one
      if (logoUrl) {
        finalLogoUrl = logoUrl;
        logoSource = 'custom';
      } else if (appTitle) {
        try {
          finalLogoUrl = await regenerateDefaultLogo(organizationId, appTitle);
          logoSource = 'generated';
          console.log(`[ORG_BRANDING_POST] Generated initial logo for new branding: ${appTitle}`);
        } catch (logoError) {
          console.error(`[ORG_BRANDING_POST] Failed to generate initial logo:`, logoError);
        }
      }
      
      brandingData = {
        id: organizationId,
        organizationId,
        logoUrl: finalLogoUrl ?? null,
        logoUrlDark: logoUrlDark ?? null,
        horizontalLogoUrl: horizontalLogoUrl ?? null,
        horizontalLogoUrlDark: horizontalLogoUrlDark ?? null,
        logoSource: logoSource,
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
        ...(menuOrder !== undefined && { menuOrder }),
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

    // Check if this completes the onboarding flow (state was 'needs_branding')
    // If so, update state to 'active' in both Firestore and Clerk org metadata
    try {
      const onboardingDoc = await adminDb.collection('coach_onboarding').doc(organizationId).get();
      if (onboardingDoc.exists && onboardingDoc.data()?.status === 'needs_branding') {
        const now = new Date().toISOString();
        
        // Update Firestore onboarding state to active
        await adminDb.collection('coach_onboarding').doc(organizationId).set({
          status: 'active',
          brandingCompletedAt: now,
          updatedAt: now,
        }, { merge: true });
        console.log(`[ORG_BRANDING_POST] Updated onboarding state to 'active' for org ${organizationId}`);
        
        // Update Clerk organization metadata
        const { clerkClient } = await import('@clerk/nextjs/server');
        const clerk = await clerkClient();
        const org = await clerk.organizations.getOrganization({ organizationId });
        const existingOrgMetadata = org.publicMetadata || {};
        
        await clerk.organizations.updateOrganization(organizationId, {
          publicMetadata: {
            ...existingOrgMetadata,
            onboardingState: 'active',
          },
        });
        console.log(`[ORG_BRANDING_POST] Updated Clerk org onboardingState to 'active' for ${organizationId}`);
      }
    } catch (onboardingError) {
      // Log but don't fail - branding was saved, onboarding state is not critical for this request
      console.error('[ORG_BRANDING_POST] Failed to update onboarding state (non-fatal):', onboardingError);
    }

    // Fetch subdomain and feedEnabled for both Edge Config sync and cookie update
    let subdomain: string | undefined;
    let feedEnabled = false;
    
    try {
      // Get subdomain from org_domains
      const domainDoc = await adminDb.collection('org_domains').doc(organizationId).get();
      const domainData = domainDoc.data();
      subdomain = domainData?.subdomain;
      
      // Get feedEnabled from org_settings
      const orgSettingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
      feedEnabled = orgSettingsDoc.exists ? (orgSettingsDoc.data()?.feedEnabled === true) : false;
    } catch (fetchError) {
      console.warn('[ORG_BRANDING_POST] Failed to fetch subdomain/feedEnabled:', fetchError);
    }

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
        menuOrder: brandingData.menuOrder || DEFAULT_MENU_ORDER,
      };
      
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
      
      // Fetch subscription from Firestore to preserve it in Edge Config
      // This prevents subscription status from being reset when only branding changes
      let subscription: TenantSubscriptionData | undefined;
      try {
        const subscriptionDoc = await adminDb.collection('coach_subscriptions').doc(organizationId).get();
        if (subscriptionDoc.exists) {
          const subData = subscriptionDoc.data();
          subscription = {
            plan: subData?.tier || 'starter',
            subscriptionStatus: subData?.status || 'none',
            currentPeriodEnd: subData?.currentPeriodEnd || subData?.manualExpiresAt,
            cancelAtPeriodEnd: subData?.cancelAtPeriodEnd || false,
          };
          console.log(`[ORG_BRANDING_POST] Fetched subscription from Firestore: plan=${subscription.plan}, status=${subscription.subscriptionStatus}`);
        }
      } catch (subError) {
        console.warn(`[ORG_BRANDING_POST] Could not fetch subscription from Firestore:`, subError);
        // Continue without subscription - Edge Config may have existing data
      }
      
      if (subdomain) {
        // Has subdomain - sync with both subdomain and custom domain keys
        await syncTenantToEdgeConfig(
          organizationId,
          subdomain,
          edgeBranding,
          verifiedCustomDomain || undefined,
          undefined, // coachingPromo
          feedEnabled,
          undefined, // programEmptyStateBehavior
          undefined, // squadEmptyStateBehavior
          subscription  // Preserve subscription data
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
          feedEnabled,
          undefined, // programEmptyStateBehavior
          undefined, // squadEmptyStateBehavior
          subscription  // Preserve subscription data
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

    // Build the response
    const response = NextResponse.json({
      success: true,
      branding: brandingData,
    });
    
    // Update the ga_tenant_context cookie with new branding data
    // This ensures the browser has updated data immediately, bypassing Edge Config propagation delay
    try {
      const existingCookie = request.cookies.get('ga_tenant_context')?.value;
      let cookieData: TenantCookieData | null = null;
      
      if (existingCookie) {
        try {
          cookieData = JSON.parse(existingCookie) as TenantCookieData;
        } catch {
          console.warn('[ORG_BRANDING_POST] Failed to parse existing tenant cookie');
        }
      }
      
      // Current timestamp for freshness tracking
      const cookieUpdatedAt = new Date().toISOString();
      
      // If no existing cookie, try to build one from available data
      if (!cookieData && subdomain) {
        cookieData = {
          orgId: organizationId,
          subdomain: subdomain,
          branding: {
            logoUrl: brandingData.logoUrl,
            logoUrlDark: brandingData.logoUrlDark,
            horizontalLogoUrl: brandingData.horizontalLogoUrl,
            horizontalLogoUrlDark: brandingData.horizontalLogoUrlDark,
            appTitle: brandingData.appTitle,
            colors: brandingData.colors,
            menuTitles: brandingData.menuTitles || DEFAULT_MENU_TITLES,
            menuIcons: brandingData.menuIcons || DEFAULT_MENU_ICONS,
            menuOrder: brandingData.menuOrder || DEFAULT_MENU_ORDER,
          },
          feedEnabled: feedEnabled,
          updatedAt: cookieUpdatedAt,
        };
      }
      
      // Update branding in existing cookie
      if (cookieData) {
        cookieData.branding = {
          logoUrl: brandingData.logoUrl,
          logoUrlDark: brandingData.logoUrlDark,
          horizontalLogoUrl: brandingData.horizontalLogoUrl,
          horizontalLogoUrlDark: brandingData.horizontalLogoUrlDark,
          appTitle: brandingData.appTitle,
          colors: brandingData.colors,
          menuTitles: brandingData.menuTitles || DEFAULT_MENU_TITLES,
          menuIcons: brandingData.menuIcons || DEFAULT_MENU_ICONS,
          menuOrder: brandingData.menuOrder || DEFAULT_MENU_ORDER,
        };
        // Also update feedEnabled if we fetched it
        if (typeof feedEnabled === 'boolean') {
          cookieData.feedEnabled = feedEnabled;
        }
        // Set updatedAt to current time - this makes the cookie "fresher" than Edge Config
        // so middleware won't overwrite it until Edge Config propagates
        cookieData.updatedAt = cookieUpdatedAt;
        
        // Set the updated cookie
        response.cookies.set('ga_tenant_context', JSON.stringify(cookieData), {
          path: '/',
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7, // 1 week
        });
        console.log('[ORG_BRANDING_POST] Updated ga_tenant_context cookie with new branding, updatedAt:', cookieUpdatedAt);
      }
    } catch (cookieError) {
      // Log but don't fail the request - cookie update is optimization
      console.error('[ORG_BRANDING_POST] Cookie update error (non-fatal):', cookieError);
    }
    
    return response;
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
