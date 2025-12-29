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
import type { OrgBrandingColors, OrgMenuTitles, OrgMenuIcons, MenuItemKey, EmptyStateBehavior, CoachTier, CoachSubscriptionStatus } from '@/types';
import { DEFAULT_BRANDING_COLORS, DEFAULT_APP_TITLE, DEFAULT_LOGO_URL, DEFAULT_MENU_TITLES, DEFAULT_MENU_ICONS, DEFAULT_MENU_ORDER } from '@/types';

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
  menuOrder: MenuItemKey[];
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
 * Subscription data stored in Edge Config for middleware access checks
 * This mirrors the billing state in Clerk Organization publicMetadata
 */
export interface TenantSubscriptionData {
  plan: CoachTier;
  subscriptionStatus: CoachSubscriptionStatus;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  graceEndsAt?: string;  // ISO date when payment failure grace period ends
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
  // Menu empty state behavior (what to show when user has no program/squad)
  programEmptyStateBehavior?: EmptyStateBehavior; // 'hide' | 'discover'
  squadEmptyStateBehavior?: EmptyStateBehavior;   // 'hide' | 'discover'
  // Subscription status for middleware access checks (synced from Clerk org metadata)
  subscription?: TenantSubscriptionData;
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
  menuOrder: DEFAULT_MENU_ORDER,
};

/**
 * Default coaching promo for new organizations or when Edge Config is empty
 */
export const DEFAULT_TENANT_COACHING_PROMO: TenantCoachingPromoData = {
  title: 'Work with me 1:1',
  subtitle: 'Let me help you unleash your potential',
  imageUrl: '', // Empty string signals "use coach's profile picture"
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
  feedEnabled?: boolean,
  programEmptyStateBehavior?: EmptyStateBehavior,
  squadEmptyStateBehavior?: EmptyStateBehavior,
  subscription?: TenantSubscriptionData
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
      menuOrder: branding?.menuOrder ?? DEFAULT_TENANT_BRANDING.menuOrder,
    },
    feedEnabled: feedEnabled ?? false,
    coachingPromo: coachingPromo ? {
      title: coachingPromo.title ?? DEFAULT_TENANT_COACHING_PROMO.title,
      subtitle: coachingPromo.subtitle ?? DEFAULT_TENANT_COACHING_PROMO.subtitle,
      imageUrl: coachingPromo.imageUrl ?? DEFAULT_TENANT_COACHING_PROMO.imageUrl,
      isVisible: coachingPromo.isVisible ?? DEFAULT_TENANT_COACHING_PROMO.isVisible,
    } : undefined,
    verifiedCustomDomain,
    programEmptyStateBehavior: programEmptyStateBehavior ?? 'discover',
    squadEmptyStateBehavior: squadEmptyStateBehavior ?? 'discover',
    subscription,
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
  feedEnabled?: boolean,
  programEmptyStateBehavior?: EmptyStateBehavior,
  squadEmptyStateBehavior?: EmptyStateBehavior,
  subscription?: TenantSubscriptionData
): Promise<void> {
  const data = buildTenantConfigData(organizationId, subdomain, branding, verifiedCustomDomain, coachingPromo, feedEnabled, programEmptyStateBehavior, squadEmptyStateBehavior, subscription);
  
  const items: EdgeConfigItem[] = [
    { operation: 'upsert', key: getSubdomainKey(subdomain), value: data },
  ];
  
  // Also set custom domain key if verified
  if (verifiedCustomDomain) {
    items.push({ operation: 'upsert', key: getCustomDomainKey(verifiedCustomDomain), value: data });
  }
  
  await updateEdgeConfig(items);
}

/**
 * Update ONLY the subscription data in Edge Config for a tenant
 * This is more efficient than syncing the entire config when only subscription changes
 * 
 * @param organizationId - The organization ID
 * @param subdomain - The subdomain for key lookup
 * @param subscription - The subscription data to update
 * @param verifiedCustomDomain - Optional custom domain to also update
 * @param fallbackBranding - Optional branding to use if no existing config (prevents reset to defaults)
 */
export async function syncSubscriptionToEdgeConfig(
  organizationId: string,
  subdomain: string,
  subscription: TenantSubscriptionData,
  verifiedCustomDomain?: string,
  fallbackBranding?: TenantBrandingData
): Promise<void> {
  // First get existing tenant config
  const existingConfig = await getTenantBySubdomain(subdomain);
  
  if (!existingConfig) {
    // No existing config - create minimal config with subscription
    // Use fallbackBranding if provided (fetched from Firestore) to preserve actual branding
    console.log(`[TENANT_EDGE_CONFIG] No existing config for ${subdomain}, creating with subscription data`);
    const data: TenantConfigData = {
      organizationId,
      subdomain,
      branding: fallbackBranding || DEFAULT_TENANT_BRANDING,
      subscription,
      updatedAt: new Date().toISOString(),
    };
    
    const items: EdgeConfigItem[] = [
      { operation: 'upsert', key: getSubdomainKey(subdomain), value: data },
    ];
    
    if (verifiedCustomDomain) {
      items.push({ operation: 'upsert', key: getCustomDomainKey(verifiedCustomDomain), value: data });
    }
    
    await updateEdgeConfig(items);
    return;
  }
  
  // Merge subscription into existing config
  const updatedConfig: TenantConfigData = {
    ...existingConfig,
    subscription,
    updatedAt: new Date().toISOString(),
  };
  
  const items: EdgeConfigItem[] = [
    { operation: 'upsert', key: getSubdomainKey(subdomain), value: updatedConfig },
  ];
  
  // Update custom domain key too if present
  const customDomain = verifiedCustomDomain || existingConfig.verifiedCustomDomain;
  if (customDomain) {
    items.push({ operation: 'upsert', key: getCustomDomainKey(customDomain), value: updatedConfig });
  }
  
  await updateEdgeConfig(items);
  console.log(`[TENANT_EDGE_CONFIG] Updated subscription in Edge Config for ${subdomain}: status=${subscription.subscriptionStatus}`);
}

