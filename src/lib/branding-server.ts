/**
 * Server-Side Branding Utilities
 * 
 * Provides branding data for Server Components by reading the tenant cookie
 * set by middleware. This eliminates the need for client-side API calls
 * and prevents the "flash of default branding" issue.
 * 
 * Usage in Server Components:
 * ```tsx
 * import { getServerBranding } from '@/lib/branding-server';
 * 
 * export default async function Layout({ children }) {
 *   const branding = await getServerBranding();
 *   return <BrandingProvider initialBranding={branding}>{children}</BrandingProvider>;
 * }
 * ```
 */

import { cookies } from 'next/headers';
import type { OrgBranding, OrgBrandingColors, OrgMenuTitles, OrgMenuIcons, MenuItemKey, EmptyStateBehavior } from '@/types';
import { 
  DEFAULT_BRANDING_COLORS, 
  DEFAULT_APP_TITLE, 
  DEFAULT_LOGO_URL, 
  DEFAULT_MENU_TITLES,
  DEFAULT_MENU_ICONS,
  DEFAULT_MENU_ORDER,
} from '@/types';
import { 
  DEFAULT_TENANT_COACHING_PROMO,
  type TenantCoachingPromoData,
} from '@/lib/tenant-edge-config';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Tenant context from cookie (set by middleware)
 */
export interface TenantCookieData {
  orgId: string;
  subdomain: string;
  branding: {
    logoUrl: string | null;
    horizontalLogoUrl: string | null;
    appTitle: string;
    colors: OrgBrandingColors;
    menuTitles: OrgMenuTitles;
    menuIcons: OrgMenuIcons;
    menuOrder: MenuItemKey[];
  };
  feedEnabled?: boolean;
  coachingPromo?: TenantCoachingPromoData;
  programEmptyStateBehavior?: EmptyStateBehavior;
  squadEmptyStateBehavior?: EmptyStateBehavior;
}

/**
 * Server-side branding result
 */
export interface ServerBranding {
  branding: OrgBranding;
  coachingPromo: TenantCoachingPromoData;
  feedEnabled: boolean;
  programEmptyStateBehavior: EmptyStateBehavior;
  squadEmptyStateBehavior: EmptyStateBehavior;
  isDefault: boolean;
  isTenantMode: boolean;
  organizationId: string | null;
  subdomain: string | null;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get default branding object
 */
function getDefaultBranding(): OrgBranding {
  const now = new Date().toISOString();
  return {
    id: 'default',
    organizationId: 'default',
    logoUrl: DEFAULT_LOGO_URL,
    logoUrlDark: null,
    horizontalLogoUrl: null,
    horizontalLogoUrlDark: null,
    appTitle: DEFAULT_APP_TITLE,
    colors: DEFAULT_BRANDING_COLORS,
    menuTitles: DEFAULT_MENU_TITLES,
    menuIcons: DEFAULT_MENU_ICONS,
    menuOrder: DEFAULT_MENU_ORDER,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Parse tenant cookie safely
 */
function parseTenantCookie(cookieValue: string | undefined): TenantCookieData | null {
  if (!cookieValue) {
    return null;
  }
  
  try {
    const parsed = JSON.parse(cookieValue);
    
    // Validate required fields
    if (!parsed.orgId || !parsed.branding) {
      console.warn('[BRANDING_SERVER] Invalid tenant cookie structure');
      return null;
    }
    
    return parsed as TenantCookieData;
  } catch (error) {
    console.error('[BRANDING_SERVER] Failed to parse tenant cookie:', error);
    return null;
  }
}

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Get branding for Server Components
 * 
 * Reads the tenant cookie set by middleware and returns branding data.
 * Falls back to default branding if no tenant context or cookie.
 * 
 * @returns ServerBranding with branding data and metadata
 */
export async function getServerBranding(): Promise<ServerBranding> {
  const cookieStore = await cookies();
  const tenantCookie = cookieStore.get('ga_tenant_context')?.value;
  
  const tenantData = parseTenantCookie(tenantCookie);
  
  if (!tenantData) {
    // Platform mode or no tenant cookie - return default branding
    return {
      branding: getDefaultBranding(),
      coachingPromo: DEFAULT_TENANT_COACHING_PROMO,
      feedEnabled: false,
      programEmptyStateBehavior: 'discover',
      squadEmptyStateBehavior: 'discover',
      isDefault: true,
      isTenantMode: false,
      organizationId: null,
      subdomain: null,
    };
  }
  
  // Build OrgBranding from tenant cookie data
  // Apply fallbacks for all fields to ensure valid branding
  const now = new Date().toISOString();
  const branding: OrgBranding = {
    id: tenantData.orgId,
    organizationId: tenantData.orgId,
    logoUrl: tenantData.branding.logoUrl || DEFAULT_LOGO_URL,
    logoUrlDark: (tenantData.branding as { logoUrlDark?: string | null }).logoUrlDark || null,
    horizontalLogoUrl: tenantData.branding.horizontalLogoUrl || null,
    horizontalLogoUrlDark: (tenantData.branding as { horizontalLogoUrlDark?: string | null }).horizontalLogoUrlDark || null,
    appTitle: tenantData.branding.appTitle || DEFAULT_APP_TITLE,
    colors: tenantData.branding.colors || DEFAULT_BRANDING_COLORS,
    menuTitles: tenantData.branding.menuTitles || DEFAULT_MENU_TITLES,
    menuIcons: tenantData.branding.menuIcons || DEFAULT_MENU_ICONS,
    menuOrder: tenantData.branding.menuOrder || DEFAULT_MENU_ORDER,
    createdAt: now,
    updatedAt: now,
  };
  
  // Check if branding in cookie is actually default (not custom)
  // This happens when Edge Config is empty and API fallback is used
  // In that case, we want BrandingProvider to fetch actual branding from API
  const isActuallyDefault = 
    branding.logoUrl === DEFAULT_LOGO_URL &&
    branding.appTitle === DEFAULT_APP_TITLE;
  
  // Get coaching promo from cookie, fallback to defaults if not present
  const coachingPromo: TenantCoachingPromoData = tenantData.coachingPromo || DEFAULT_TENANT_COACHING_PROMO;
  
  // Get feedEnabled from cookie (set by middleware from Edge Config)
  const feedEnabled = tenantData.feedEnabled === true;
  
  // Get empty state behaviors from cookie (set by middleware from Edge Config)
  const programEmptyStateBehavior: EmptyStateBehavior = tenantData.programEmptyStateBehavior || 'discover';
  const squadEmptyStateBehavior: EmptyStateBehavior = tenantData.squadEmptyStateBehavior || 'discover';
  
  return {
    branding,
    coachingPromo,
    feedEnabled,
    programEmptyStateBehavior,
    squadEmptyStateBehavior,
    isDefault: isActuallyDefault,
    isTenantMode: true,
    organizationId: tenantData.orgId,
    subdomain: tenantData.subdomain,
  };
}

/**
 * Get just the organization ID from tenant context (for API routes)
 */
export async function getServerTenantOrgId(): Promise<string | null> {
  const cookieStore = await cookies();
  const tenantCookie = cookieStore.get('ga_tenant_context')?.value;
  
  const tenantData = parseTenantCookie(tenantCookie);
  return tenantData?.orgId || null;
}

/**
 * Check if currently in tenant mode (for conditional rendering)
 */
export async function isInTenantMode(): Promise<boolean> {
  const cookieStore = await cookies();
  const tenantCookie = cookieStore.get('ga_tenant_context')?.value;
  return !!parseTenantCookie(tenantCookie);
}

/**
 * Get the full tenant context (for debugging/logging)
 */
export async function getServerTenantContext(): Promise<TenantCookieData | null> {
  const cookieStore = await cookies();
  const tenantCookie = cookieStore.get('ga_tenant_context')?.value;
  return parseTenantCookie(tenantCookie);
}

