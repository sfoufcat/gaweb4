/**
 * Server-side Branding Utility
 * 
 * Fetches organization branding based on hostname (subdomain or custom domain).
 * Used by layout.tsx for dynamic metadata and ClerkThemeProvider configuration.
 */

import { adminDb } from '@/lib/firebase-admin';
import { resolveTenant } from '@/lib/tenant/resolveTenant';
import type { OrgBranding } from '@/types';
import { DEFAULT_APP_TITLE, DEFAULT_LOGO_URL } from '@/types';

export interface ServerBranding {
  logoUrl: string;
  horizontalLogoUrl: string | null;
  appTitle: string;
  organizationId: string | null;
}

const DEFAULT_BRANDING: ServerBranding = {
  logoUrl: DEFAULT_LOGO_URL,
  horizontalLogoUrl: null,
  appTitle: DEFAULT_APP_TITLE,
  organizationId: null,
};

/**
 * Get branding for a hostname
 * 
 * Resolves the hostname to an organization and fetches their branding.
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
