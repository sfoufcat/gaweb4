/**
 * Tenant Edge Config
 * 
 * Provides ultra-fast edge-compatible tenant resolution using Vercel Edge Config.
 * Edge Config is optimized for read-heavy workloads with rare writes - perfect for
 * tenant branding which is read on every request but updated rarely.
 * 
 * Key format:
 * - Subdomain: "tenant_subdomain_acme" → TenantConfigData
 * - Custom domain: "tenant_domain_coaching_example_com" → TenantConfigData
 * 
 * Note: Edge Config keys cannot contain colons, so we use underscores.
 */

import { get } from '@vercel/edge-config';
import type { OrgBrandingColors, OrgMenuTitles, OrgMenuIcons } from '@/types';
import { DEFAULT_BRANDING_COLORS, DEFAULT_APP_TITLE, DEFAULT_LOGO_URL, DEFAULT_MENU_TITLES, DEFAULT_MENU_ICONS } from '@/types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Branding data stored in Edge Config for fast access
 */
export interface TenantBrandingData {
  logoUrl: string | null;
  horizontalLogoUrl: string | null;
  appTitle: string;
  colors: OrgBrandingColors;
  menuTitles: OrgMenuTitles;
  menuIcons: OrgMenuIcons;
}

/**
 * Coaching promo data stored in Edge Config
 * Separate from branding (visual identity) - this is feature/content config
 */
export interface TenantCoachingPromoData {
  title: string;
  subtitle: string;
  imageUrl: string;
  isVisible: boolean;
}

/**
 * Complete tenant data stored in Edge Config
 */
export interface TenantConfigData {
  organizationId: string;
  subdomain: string;
  branding: TenantBrandingData;
  feedEnabled?: boolean;  // Whether social feed is enabled for this org
  coachingPromo?: TenantCoachingPromoData;
  verifiedCustomDomain?: string;
  updatedAt: string;
}

/**
 * Default branding for new organizations or when Edge Config is empty
 */
export const DEFAULT_TENANT_BRANDING: TenantBrandingData = {
  logoUrl: DEFAULT_LOGO_URL,
  horizontalLogoUrl: null,
  appTitle: DEFAULT_APP_TITLE,
  colors: DEFAULT_BRANDING_COLORS,
  menuTitles: DEFAULT_MENU_TITLES,
  menuIcons: DEFAULT_MENU_ICONS,
};

/**
 * Default coaching promo for new organizations or when Edge Config is empty
 */
export const DEFAULT_TENANT_COACHING_PROMO: TenantCoachingPromoData = {
  title: 'Get your personal coach',
  subtitle: 'Work with a performance psychologist 1:1',
  imageUrl: 'https://images.unsplash.com/photo-1580518324671-c2f0833a3af3?q=80&w=987&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  isVisible: true,
};

// =============================================================================
// KEY HELPERS
// =============================================================================

/**
 * Generate Edge Config key for subdomain lookup
 * Edge Config keys use underscores instead of colons
 */
function getSubdomainKey(subdomain: string): string {
  return `tenant_subdomain_${subdomain.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}

/**
 * Generate Edge Config key for custom domain lookup
 */
function getCustomDomainKey(domain: string): string {
  return `tenant_domain_${domain.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}

// =============================================================================
// EDGE CONFIG READ OPERATIONS (Used in Middleware)
// =============================================================================

/**
 * Get tenant data from Edge Config by subdomain
 * 
 * @param subdomain - The subdomain to look up (e.g., "coach-abc123")
 * @returns TenantConfigData or null if not found
 */
export async function getTenantBySubdomain(subdomain: string): Promise<TenantConfigData | null> {
  try {
    const key = getSubdomainKey(subdomain);
    const data = await get<TenantConfigData>(key);
    return data || null;
  } catch (error) {
    console.error('[TENANT_EDGE_CONFIG] Error getting tenant by subdomain:', error);
    return null;
  }
}

/**
 * Get tenant data from Edge Config by custom domain
 * 
 * @param domain - The custom domain to look up (e.g., "coaching.example.com")
 * @returns TenantConfigData or null if not found
 */
export async function getTenantByCustomDomain(domain: string): Promise<TenantConfigData | null> {
  try {
    const key = getCustomDomainKey(domain);
    const data = await get<TenantConfigData>(key);
    return data || null;
  } catch (error) {
    console.error('[TENANT_EDGE_CONFIG] Error getting tenant by custom domain:', error);
    return null;
  }
}

// =============================================================================
// EDGE CONFIG WRITE OPERATIONS (Used in API Routes)
// These use the Vercel API to update Edge Config
// =============================================================================

const EDGE_CONFIG_ID = process.env.EDGE_CONFIG_ID;
const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;

interface EdgeConfigItem {
  operation: 'create' | 'update' | 'upsert' | 'delete';
  key: string;
  value?: TenantConfigData;
}

/**
 * Update Edge Config items via Vercel API
 * Used when branding or domain mappings change
 */
async function updateEdgeConfig(items: EdgeConfigItem[]): Promise<boolean> {
  if (!EDGE_CONFIG_ID || !VERCEL_API_TOKEN) {
    console.warn('[TENANT_EDGE_CONFIG] Missing EDGE_CONFIG_ID or VERCEL_API_TOKEN - skipping Edge Config update');
    return false;
  }
  
  try {
    const response = await fetch(
      `https://api.vercel.com/v1/edge-config/${EDGE_CONFIG_ID}/items`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${VERCEL_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items }),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      console.error('[TENANT_EDGE_CONFIG] Failed to update Edge Config:', error);
      return false;
    }
    
    console.log(`[TENANT_EDGE_CONFIG] Updated ${items.length} items in Edge Config`);
    return true;
  } catch (error) {
    console.error('[TENANT_EDGE_CONFIG] Error updating Edge Config:', error);
    return false;
  }
}

/**
 * Set tenant data in Edge Config for a subdomain
 */
export async function setTenantBySubdomain(subdomain: string, data: TenantConfigData): Promise<void> {
  const key = getSubdomainKey(subdomain);
  await updateEdgeConfig([{ operation: 'upsert', key, value: data }]);
}

/**
 * Set tenant data in Edge Config for a custom domain
 */
export async function setTenantByCustomDomain(domain: string, data: TenantConfigData): Promise<void> {
  const key = getCustomDomainKey(domain);
  await updateEdgeConfig([{ operation: 'upsert', key, value: data }]);
}

/**
 * Remove tenant data from Edge Config for a subdomain
 */
export async function invalidateTenantBySubdomain(subdomain: string): Promise<void> {
  const key = getSubdomainKey(subdomain);
  await updateEdgeConfig([{ operation: 'delete', key }]);
}

/**
 * Remove tenant data from Edge Config for a custom domain
 */
export async function invalidateTenantByCustomDomain(domain: string): Promise<void> {
  const key = getCustomDomainKey(domain);
  await updateEdgeConfig([{ operation: 'delete', key }]);
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Build TenantConfigData from organization data
 */
export function buildTenantConfigData(
  organizationId: string,
  subdomain: string,
  branding?: Partial<TenantBrandingData>,
  verifiedCustomDomain?: string,
  coachingPromo?: Partial<TenantCoachingPromoData>,
  feedEnabled?: boolean
): TenantConfigData {
  return {
    organizationId,
    subdomain,
    branding: {
      logoUrl: branding?.logoUrl ?? DEFAULT_TENANT_BRANDING.logoUrl,
      horizontalLogoUrl: branding?.horizontalLogoUrl ?? DEFAULT_TENANT_BRANDING.horizontalLogoUrl,
      appTitle: branding?.appTitle ?? DEFAULT_TENANT_BRANDING.appTitle,
      colors: branding?.colors ?? DEFAULT_TENANT_BRANDING.colors,
      menuTitles: branding?.menuTitles ?? DEFAULT_TENANT_BRANDING.menuTitles,
      menuIcons: branding?.menuIcons ?? DEFAULT_TENANT_BRANDING.menuIcons,
    },
    feedEnabled: feedEnabled ?? false,
    coachingPromo: coachingPromo ? {
      title: coachingPromo.title ?? DEFAULT_TENANT_COACHING_PROMO.title,
      subtitle: coachingPromo.subtitle ?? DEFAULT_TENANT_COACHING_PROMO.subtitle,
      imageUrl: coachingPromo.imageUrl ?? DEFAULT_TENANT_COACHING_PROMO.imageUrl,
      isVisible: coachingPromo.isVisible ?? DEFAULT_TENANT_COACHING_PROMO.isVisible,
    } : undefined,
    verifiedCustomDomain,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Sync tenant data to Edge Config (both subdomain and custom domain keys)
 */
export async function syncTenantToEdgeConfig(
  organizationId: string,
  subdomain: string,
  branding?: Partial<TenantBrandingData>,
  verifiedCustomDomain?: string,
  coachingPromo?: Partial<TenantCoachingPromoData>,
  feedEnabled?: boolean
): Promise<void> {
  const data = buildTenantConfigData(organizationId, subdomain, branding, verifiedCustomDomain, coachingPromo, feedEnabled);
  
  const items: EdgeConfigItem[] = [
    { operation: 'upsert', key: getSubdomainKey(subdomain), value: data },
  ];
  
  // Also set custom domain key if verified
  if (verifiedCustomDomain) {
    items.push({ operation: 'upsert', key: getCustomDomainKey(verifiedCustomDomain), value: data });
  }
  
  await updateEdgeConfig(items);
}

