/**
 * Server-side Branding Utility
 * 
 * Fetches organization branding for Server Components.
 * 
 * Priority:
 * 1. Cookie (set by middleware from KV) - fastest, no DB call
 * 2. Firestore lookup - fallback for when cookie not available
 * 
 * Used by layout.tsx for dynamic metadata and ClerkThemeProvider configuration.
 */

import { cookies } from 'next/headers';
import { adminDb } from '@/lib/firebase-admin';
import { resolveTenant } from '@/lib/tenant/resolveTenant';
import type { OrgBranding } from '@/types';
import { DEFAULT_APP_TITLE, DEFAULT_LOGO_URL } from '@/types';

export interface ServerBranding {
  logoUrl: string;
  horizontalLogoUrl: string | null;
  appTitle: string;
  primaryColor: string;
  organizationId: string | null;
}

const DEFAULT_PRIMARY_COLOR = '#a07855';

const DEFAULT_BRANDING: ServerBranding = {
  logoUrl: DEFAULT_LOGO_URL,
  horizontalLogoUrl: null,
  appTitle: DEFAULT_APP_TITLE,
  primaryColor: DEFAULT_PRIMARY_COLOR,
  organizationId: null,
};

/**
 * Parse tenant cookie to get branding (set by middleware from KV)
 */
async function getBrandingFromCookie(): Promise<ServerBranding | null> {
  try {
    const cookieStore = await cookies();
    const tenantCookie = cookieStore.get('ga_tenant_context')?.value;
    
    if (!tenantCookie) {
      return null;
    }
    
    const parsed = JSON.parse(tenantCookie);
    
    if (!parsed.orgId || !parsed.branding) {
      return null;
    }
    
    return {
      logoUrl: parsed.branding.logoUrl || DEFAULT_LOGO_URL,
      horizontalLogoUrl: parsed.branding.horizontalLogoUrl || null,
      appTitle: parsed.branding.appTitle || DEFAULT_APP_TITLE,
      primaryColor: parsed.branding.colors?.accentLight || DEFAULT_PRIMARY_COLOR,
      organizationId: parsed.orgId,
    };
  } catch (error) {
    console.error('[SERVER_BRANDING] Error parsing tenant cookie:', error);
    return null;
  }
}

/**
 * Get branding for a hostname
 * 
 * First tries cookie (fast, set by middleware from KV).
 * Falls back to Firestore lookup if cookie not available.
 * Returns default branding if:
 * - Hostname is the platform domain (growthaddicts.app)
 * - Organization not found
 * - No custom branding set
 * 
 * @param hostname - The hostname from the request (e.g., "cyberked.com" or "coach.growthaddicts.app")
 * @returns ServerBranding object with logo URLs and app title
 */
export async function getBrandingForDomain(hostname: string): Promise<ServerBranding> {
  try {
    // Priority 1: Try cookie (fast - set by middleware from KV)
    const cookieBranding = await getBrandingFromCookie();
    if (cookieBranding) {
      return cookieBranding;
    }
    
    // Priority 2: Fallback to Firestore lookup (for when cookie not set)
    // Resolve tenant from hostname
    const result = await resolveTenant(hostname, null, null);
    
    // If platform mode or not found, return defaults
    if (result.type !== 'tenant') {
      return DEFAULT_BRANDING;
    }
    
    const { organizationId } = result.tenant;
    
    // Fetch branding from Firestore
    const brandingDoc = await adminDb
      .collection('org_branding')
      .doc(organizationId)
      .get();
    
    if (!brandingDoc.exists) {
      return {
        ...DEFAULT_BRANDING,
        organizationId,
      };
    }
    
    const branding = brandingDoc.data() as OrgBranding;
    
    return {
      logoUrl: branding.logoUrl || DEFAULT_LOGO_URL,
      horizontalLogoUrl: branding.horizontalLogoUrl || null,
      appTitle: branding.appTitle || DEFAULT_APP_TITLE,
      primaryColor: branding.colors?.accentLight || DEFAULT_PRIMARY_COLOR,
      organizationId,
    };
  } catch (error) {
    console.error('[SERVER_BRANDING] Error fetching branding:', error);
    return DEFAULT_BRANDING;
  }
}

/**
 * Get the best logo URL for icons/favicon
 * Prefers square logo, falls back to horizontal, then default
 */
export function getBestLogoUrl(branding: ServerBranding): string {
  return branding.logoUrl || branding.horizontalLogoUrl || DEFAULT_LOGO_URL;
}

