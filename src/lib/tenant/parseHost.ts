/**
 * Host Parsing Utilities for Multi-Tenant Routing
 * 
 * Parses hostnames to extract tenant information (subdomain or custom domain).
 * Uses centralized domain config for easy domain migration.
 */

import {
  PLATFORM_DOMAINS,
  DEV_HOSTS,
  TENANT_SUBDOMAIN_PATTERN,
  LEGACY_SUBDOMAIN_PATTERNS,
  isDevHost as checkDevHost,
} from '@/lib/config/domains';

export interface ParsedHost {
  type: 'platform' | 'subdomain' | 'custom_domain';
  hostname: string;
  subdomain?: string;
}

/**
 * Parse a hostname to determine tenant routing
 * 
 * @param hostname - The hostname from the request (e.g., "acme.growthaddicts.app")
 * @returns Parsed host information
 */
export function parseHost(hostname: string): ParsedHost {
  // Normalize hostname (lowercase, remove port)
  const normalizedHost = hostname.toLowerCase().split(':')[0];
  
  // Check if it's a platform domain (no tenant)
  if (PLATFORM_DOMAINS.includes(normalizedHost)) {
    return { type: 'platform', hostname: normalizedHost };
  }
  
  // Check if it's a development host
  if (checkDevHost(normalizedHost)) {
    return { type: 'platform', hostname: normalizedHost };
  }
  
  // Check if it's a subdomain of the main domain
  const mainMatch = normalizedHost.match(TENANT_SUBDOMAIN_PATTERN);
  if (mainMatch) {
    const subdomain = mainMatch[1];
    // Skip www and app - treat as platform
    if (subdomain === 'www' || subdomain === 'app') {
      return { type: 'platform', hostname: normalizedHost };
    }
    return { type: 'subdomain', hostname: normalizedHost, subdomain };
  }
  
  // Check legacy domain patterns
  for (const pattern of LEGACY_SUBDOMAIN_PATTERNS) {
    const match = normalizedHost.match(pattern);
    if (match) {
      const subdomain = match[1];
      if (subdomain === 'www') {
        return { type: 'platform', hostname: normalizedHost };
      }
      return { type: 'subdomain', hostname: normalizedHost, subdomain };
    }
  }
  
  // Otherwise, treat as custom domain
  return { type: 'custom_domain', hostname: normalizedHost };
}

/**
 * Check if we're in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Get tenant override from request (dev only)
 * Allows testing tenant mode locally via query param or header
 * 
 * @param searchParams - URL search params
 * @param headers - Request headers
 * @returns Tenant slug override or null
 */
export function getDevTenantOverride(
  searchParams: URLSearchParams | null,
  headers: Headers | null
): string | null {
  if (!isDevelopment()) {
    return null;
  }
  
  // Check query param first: ?tenant=acme
  const tenantParam = searchParams?.get('tenant');
  if (tenantParam) {
    return tenantParam.toLowerCase();
  }
  
  // Check header: x-dev-tenant: acme
  const tenantHeader = headers?.get('x-dev-tenant');
  if (tenantHeader) {
    return tenantHeader.toLowerCase();
  }
  
  return null;
}

