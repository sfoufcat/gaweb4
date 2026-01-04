/**
 * Domain Configuration
 * 
 * Centralized domain configuration for the multi-tenant architecture.
 * This file makes it easy to manage domain configuration.
 * 
 * Domain Structure:
 * - Marketing: coachful.co - public marketing site
 * - Platform Admin: app.coachful.co - super admin management
 * - Tenant: {org}.coachful.co or custom domains - coach instances
 */

// =============================================================================
// CORE DOMAIN CONFIGURATION
// =============================================================================

/**
 * Base domain for the Coachful platform
 */
export const BASE_DOMAIN = 'coachful.co';

/**
 * Alternative/legacy domains that should also be recognized
 * These will be treated as platform domains
 */
export const LEGACY_DOMAINS = [
  'growthaddicts.com',      // Legacy domain - redirect to coachful.co
  'pro.growthaddicts.com',
  'growthaddicts.app',
];

// =============================================================================
// DERIVED DOMAIN CONFIGURATION
// =============================================================================

/**
 * Marketing domain - the root domain for public marketing pages
 */
export const MARKETING_DOMAIN = BASE_DOMAIN;

/**
 * Platform admin domain - for super admins to manage the platform
 */
export const PLATFORM_ADMIN_DOMAIN = `app.${BASE_DOMAIN}`;

/**
 * All platform domains that are NOT tenant-scoped
 * Includes www variants and legacy domains
 */
export const PLATFORM_DOMAINS = [
  BASE_DOMAIN,
  `www.${BASE_DOMAIN}`,
  PLATFORM_ADMIN_DOMAIN,
  ...LEGACY_DOMAINS,
  ...LEGACY_DOMAINS.map(d => `www.${d}`),
];

/**
 * Development hosts treated as platform mode
 */
export const DEV_HOSTS = [
  'localhost',
  '127.0.0.1',
];

// =============================================================================
// REGEX PATTERNS
// =============================================================================

/**
 * Pattern to match tenant subdomains
 * Captures the subdomain from URLs like "acme.coachful.co"
 */
export const TENANT_SUBDOMAIN_PATTERN = new RegExp(
  `^([a-z0-9-]+)\\.${BASE_DOMAIN.replace('.', '\\.')}$`
);

/**
 * Pattern to match tenant subdomains on legacy domains
 */
export const LEGACY_SUBDOMAIN_PATTERNS = LEGACY_DOMAINS.map(domain => 
  new RegExp(`^([a-z0-9-]+)\\.${domain.replace('.', '\\.')}$`)
);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a hostname is a platform domain (not tenant-scoped)
 */
export function isPlatformDomain(hostname: string): boolean {
  const normalized = hostname.toLowerCase().split(':')[0];
  return PLATFORM_DOMAINS.includes(normalized);
}

/**
 * Check if a hostname is a development host
 */
export function isDevHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().split(':')[0];
  return DEV_HOSTS.some(dev => normalized.startsWith(dev));
}

/**
 * Check if a hostname is the platform admin domain
 */
export function isPlatformAdminDomain(hostname: string): boolean {
  const normalized = hostname.toLowerCase().split(':')[0];
  return normalized === PLATFORM_ADMIN_DOMAIN;
}

/**
 * Check if a hostname is the marketing domain
 */
export function isMarketingDomain(hostname: string): boolean {
  const normalized = hostname.toLowerCase().split(':')[0];
  return normalized === MARKETING_DOMAIN || normalized === `www.${MARKETING_DOMAIN}`;
}

/**
 * Extract subdomain from a hostname
 * Returns null if not a valid tenant subdomain
 */
export function extractSubdomain(hostname: string): string | null {
  const normalized = hostname.toLowerCase().split(':')[0];
  
  // Check main domain pattern
  const mainMatch = normalized.match(TENANT_SUBDOMAIN_PATTERN);
  if (mainMatch) {
    const subdomain = mainMatch[1];
    // Skip reserved subdomains
    if (subdomain === 'www' || subdomain === 'app') {
      return null;
    }
    return subdomain;
  }
  
  // Check legacy domain patterns
  for (const pattern of LEGACY_SUBDOMAIN_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) {
      const subdomain = match[1];
      if (subdomain === 'www') {
        return null;
      }
      return subdomain;
    }
  }
  
  return null;
}

/**
 * Build a tenant URL from a subdomain
 */
export function buildTenantUrl(subdomain: string, path: string = '/'): string {
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  return `${protocol}://${subdomain}.${BASE_DOMAIN}${path}`;
}

/**
 * Build the platform admin URL
 */
export function buildPlatformAdminUrl(path: string = '/'): string {
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  return `${protocol}://${PLATFORM_ADMIN_DOMAIN}${path}`;
}

/**
 * Build the marketing URL
 */
export function buildMarketingUrl(path: string = '/'): string {
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  return `${protocol}://${MARKETING_DOMAIN}${path}`;
}

// =============================================================================
// DOMAIN TYPE DETECTION
// =============================================================================

export type DomainType = 'marketing' | 'platform_admin' | 'tenant' | 'custom_domain' | 'dev';

/**
 * Determine the type of domain from a hostname
 */
export function getDomainType(hostname: string): DomainType {
  const normalized = hostname.toLowerCase().split(':')[0];
  
  // Dev hosts
  if (isDevHost(normalized)) {
    return 'dev';
  }
  
  // Marketing domain
  if (isMarketingDomain(normalized)) {
    return 'marketing';
  }
  
  // Platform admin domain
  if (isPlatformAdminDomain(normalized)) {
    return 'platform_admin';
  }
  
  // Tenant subdomain
  const subdomain = extractSubdomain(normalized);
  if (subdomain) {
    return 'tenant';
  }
  
  // Must be a custom domain
  return 'custom_domain';
}

