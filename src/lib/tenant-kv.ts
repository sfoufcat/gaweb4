/**
 * Tenant KV Cache
 * 
 * Provides fast Edge-compatible tenant resolution using Vercel KV.
 * Replaces HTTP-based tenant resolution in middleware for better performance.
 * 
 * Key format:
 * - Subdomain: "tenant:subdomain:acme" → TenantKVData
 * - Custom domain: "tenant:domain:coaching.example.com" → TenantKVData
 */

import { kv } from '@vercel/kv';
import type { OrgBrandingColors, OrgMenuTitles } from '@/types';
import { DEFAULT_BRANDING_COLORS, DEFAULT_APP_TITLE, DEFAULT_LOGO_URL, DEFAULT_MENU_TITLES } from '@/types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Branding data stored in KV for fast access
 */
export interface TenantBrandingData {
  logoUrl: string | null;
  horizontalLogoUrl: string | null;
  appTitle: string;
  colors: OrgBrandingColors;
  menuTitles: OrgMenuTitles;
}

/**
 * Complete tenant data stored in KV
 */
export interface TenantKVData {
  organizationId: string;
  subdomain: string;
  branding: TenantBrandingData;
  verifiedCustomDomain?: string; // If subdomain should redirect to custom domain
  updatedAt: string;
}

/**
 * Default branding for new organizations or when KV is empty
 */
export const DEFAULT_TENANT_BRANDING: TenantBrandingData = {
  logoUrl: DEFAULT_LOGO_URL,
  horizontalLogoUrl: null,
  appTitle: DEFAULT_APP_TITLE,
  colors: DEFAULT_BRANDING_COLORS,
  menuTitles: DEFAULT_MENU_TITLES,
};

// =============================================================================
// KEY HELPERS
// =============================================================================

/**
 * Generate KV key for subdomain lookup
 */
function getSubdomainKey(subdomain: string): string {
  return `tenant:subdomain:${subdomain.toLowerCase()}`;
}

/**
 * Generate KV key for custom domain lookup
 */
function getCustomDomainKey(domain: string): string {
  return `tenant:domain:${domain.toLowerCase()}`;
}

// =============================================================================
// KV OPERATIONS
// =============================================================================

/**
 * Get tenant data from KV by subdomain
 * 
 * @param subdomain - The subdomain to look up (e.g., "coach-abc123")
 * @returns TenantKVData or null if not found
 */
export async function getTenantBySubdomain(subdomain: string): Promise<TenantKVData | null> {
  try {
    const key = getSubdomainKey(subdomain);
    const data = await kv.get<TenantKVData>(key);
    return data;
  } catch (error) {
    console.error('[TENANT_KV] Error getting tenant by subdomain:', error);
    return null;
  }
}

/**
 * Get tenant data from KV by custom domain
 * 
 * @param domain - The custom domain to look up (e.g., "coaching.example.com")
 * @returns TenantKVData or null if not found
 */
export async function getTenantByCustomDomain(domain: string): Promise<TenantKVData | null> {
  try {
    const key = getCustomDomainKey(domain);
    const data = await kv.get<TenantKVData>(key);
    return data;
  } catch (error) {
    console.error('[TENANT_KV] Error getting tenant by custom domain:', error);
    return null;
  }
}

/**
 * Set tenant data in KV for a subdomain
 * Called when:
 * - Organization is created
 * - Subdomain is changed
 * - Branding is updated
 * 
 * @param subdomain - The subdomain (e.g., "coach-abc123")
 * @param data - The tenant data to store
 */
export async function setTenantBySubdomain(subdomain: string, data: TenantKVData): Promise<void> {
  try {
    const key = getSubdomainKey(subdomain);
    // Set with no expiration - data is updated on changes
    await kv.set(key, data);
    console.log(`[TENANT_KV] Set tenant data for subdomain: ${subdomain}`);
  } catch (error) {
    console.error('[TENANT_KV] Error setting tenant by subdomain:', error);
    throw error;
  }
}

/**
 * Set tenant data in KV for a custom domain
 * Called when custom domain is verified
 * 
 * @param domain - The custom domain (e.g., "coaching.example.com")
 * @param data - The tenant data to store
 */
export async function setTenantByCustomDomain(domain: string, data: TenantKVData): Promise<void> {
  try {
    const key = getCustomDomainKey(domain);
    await kv.set(key, data);
    console.log(`[TENANT_KV] Set tenant data for custom domain: ${domain}`);
  } catch (error) {
    console.error('[TENANT_KV] Error setting tenant by custom domain:', error);
    throw error;
  }
}

/**
 * Invalidate (delete) tenant data from KV for a subdomain
 * Called when subdomain is changed or organization is deleted
 * 
 * @param subdomain - The subdomain to invalidate
 */
export async function invalidateTenantBySubdomain(subdomain: string): Promise<void> {
  try {
    const key = getSubdomainKey(subdomain);
    await kv.del(key);
    console.log(`[TENANT_KV] Invalidated tenant data for subdomain: ${subdomain}`);
  } catch (error) {
    console.error('[TENANT_KV] Error invalidating tenant by subdomain:', error);
    // Don't throw - invalidation failures shouldn't break the flow
  }
}

/**
 * Invalidate (delete) tenant data from KV for a custom domain
 * Called when custom domain is removed or unverified
 * 
 * @param domain - The custom domain to invalidate
 */
export async function invalidateTenantByCustomDomain(domain: string): Promise<void> {
  try {
    const key = getCustomDomainKey(domain);
    await kv.del(key);
    console.log(`[TENANT_KV] Invalidated tenant data for custom domain: ${domain}`);
  } catch (error) {
    console.error('[TENANT_KV] Error invalidating tenant by custom domain:', error);
    // Don't throw - invalidation failures shouldn't break the flow
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Build TenantKVData from organization data
 * Used when setting/updating tenant data in KV
 * 
 * @param organizationId - The Clerk organization ID
 * @param subdomain - The organization's subdomain
 * @param branding - Optional branding data (uses defaults if not provided)
 * @param verifiedCustomDomain - Optional verified custom domain for redirect
 */
export function buildTenantKVData(
  organizationId: string,
  subdomain: string,
  branding?: Partial<TenantBrandingData>,
  verifiedCustomDomain?: string
): TenantKVData {
  return {
    organizationId,
    subdomain,
    branding: {
      logoUrl: branding?.logoUrl ?? DEFAULT_TENANT_BRANDING.logoUrl,
      horizontalLogoUrl: branding?.horizontalLogoUrl ?? DEFAULT_TENANT_BRANDING.horizontalLogoUrl,
      appTitle: branding?.appTitle ?? DEFAULT_TENANT_BRANDING.appTitle,
      colors: branding?.colors ?? DEFAULT_TENANT_BRANDING.colors,
      menuTitles: branding?.menuTitles ?? DEFAULT_TENANT_BRANDING.menuTitles,
    },
    verifiedCustomDomain,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Update only the branding portion of tenant data in KV
 * Preserves other fields like organizationId and subdomain
 * 
 * @param subdomain - The subdomain to update
 * @param brandingUpdates - Partial branding updates
 */
export async function updateTenantBranding(
  subdomain: string,
  brandingUpdates: Partial<TenantBrandingData>
): Promise<void> {
  // Get existing data
  const existing = await getTenantBySubdomain(subdomain);
  
  if (!existing) {
    console.warn(`[TENANT_KV] Cannot update branding - no existing data for subdomain: ${subdomain}`);
    return;
  }
  
  // Merge branding updates
  const updatedData: TenantKVData = {
    ...existing,
    branding: {
      ...existing.branding,
      ...brandingUpdates,
      // Deep merge colors if provided
      colors: brandingUpdates.colors 
        ? { ...existing.branding.colors, ...brandingUpdates.colors }
        : existing.branding.colors,
      // Deep merge menuTitles if provided
      menuTitles: brandingUpdates.menuTitles
        ? { ...existing.branding.menuTitles, ...brandingUpdates.menuTitles }
        : existing.branding.menuTitles,
    },
    updatedAt: new Date().toISOString(),
  };
  
  // Update subdomain key
  await setTenantBySubdomain(subdomain, updatedData);
  
  // Also update custom domain key if one exists
  if (existing.verifiedCustomDomain) {
    await setTenantByCustomDomain(existing.verifiedCustomDomain, updatedData);
  }
}

/**
 * Sync tenant data from Firestore to KV
 * Used for initial population or recovery
 * 
 * @param organizationId - The organization ID to sync
 * @param subdomain - The subdomain
 * @param branding - Branding data from Firestore
 * @param verifiedCustomDomain - Optional verified custom domain
 */
export async function syncTenantToKV(
  organizationId: string,
  subdomain: string,
  branding?: Partial<TenantBrandingData>,
  verifiedCustomDomain?: string
): Promise<void> {
  const data = buildTenantKVData(organizationId, subdomain, branding, verifiedCustomDomain);
  
  // Set subdomain key
  await setTenantBySubdomain(subdomain, data);
  
  // Set custom domain key if verified
  if (verifiedCustomDomain) {
    await setTenantByCustomDomain(verifiedCustomDomain, data);
  }
}

