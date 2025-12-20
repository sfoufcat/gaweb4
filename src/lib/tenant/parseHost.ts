/**
 * Host Parsing Utilities for Multi-Tenant Routing
 * 
 * Parses hostnames to extract tenant information (subdomain or custom domain).
 */

// Platform domains that are NOT tenant-scoped
const PLATFORM_DOMAINS = [
  'growthaddicts.app',
  'www.growthaddicts.app',
  'pro.growthaddicts.com',
  'www.pro.growthaddicts.com',
];

// Development hosts treated as platform mode
const DEV_HOSTS = [
  'localhost',
  '127.0.0.1',
];

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
  const isDevHost = DEV_HOSTS.some(dev => normalizedHost.startsWith(dev));
  if (isDevHost) {
    return { type: 'platform', hostname: normalizedHost };
  }
  
  // Check if it's a subdomain of growthaddicts.app
  const subdomainMatch = normalizedHost.match(/^([a-z0-9-]+)\.growthaddicts\.app$/);
  if (subdomainMatch) {
    const subdomain = subdomainMatch[1];
    // Skip www - treat as platform
    if (subdomain === 'www') {
      return { type: 'platform', hostname: normalizedHost };
    }
    return { type: 'subdomain', hostname: normalizedHost, subdomain };
  }
  
  // Check if it's a subdomain of pro.growthaddicts.com
  const proSubdomainMatch = normalizedHost.match(/^([a-z0-9-]+)\.pro\.growthaddicts\.com$/);
  if (proSubdomainMatch) {
    const subdomain = proSubdomainMatch[1];
    if (subdomain === 'www') {
      return { type: 'platform', hostname: normalizedHost };
    }
    return { type: 'subdomain', hostname: normalizedHost, subdomain };
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
