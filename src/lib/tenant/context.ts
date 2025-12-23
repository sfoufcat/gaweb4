/**
 * Tenant Context Helpers
 * 
 * Utilities for accessing tenant context in server code.
 * The middleware sets x-tenant-* headers which these helpers read.
 */

import { headers } from 'next/headers';
import type { TenantContext } from '@/types';

/**
 * Get the current tenant's organization ID from request context
 * 
 * This reads from headers set by the middleware. In tenant mode (subdomain or custom domain),
 * this returns the resolved organizationId. In platform mode, returns null.
 * 
 * Use this to scope database queries to the current tenant.
 * 
 * @returns The tenant's organizationId or null if in platform mode
 */
export async function getTenantOrgId(): Promise<string | null> {
  const headersList = await headers();
  const orgId = headersList.get('x-tenant-org-id');
  return orgId || null;
}

/**
 * Require tenant context - throws if not in tenant mode
 * 
 * Use this in routes that must only work on tenant domains.
 * 
 * @returns The tenant's organizationId
 * @throws Error if not in tenant mode
 */
export async function requireTenantOrgId(): Promise<string> {
  const orgId = await getTenantOrgId();
  if (!orgId) {
    throw new Error('Tenant context required');
  }
  return orgId;
}

/**
 * Check if the current request is in tenant mode
 * 
 * @returns True if request is on a tenant domain (subdomain or custom domain)
 */
export async function isTenantMode(): Promise<boolean> {
  const orgId = await getTenantOrgId();
  return !!orgId;
}

/**
 * Get full tenant context from headers
 * 
 * @returns Full tenant context or null if in platform mode
 */
export async function getTenantContext(): Promise<TenantContext | null> {
  const headersList = await headers();
  
  const orgId = headersList.get('x-tenant-org-id');
  if (!orgId) {
    return null;
  }
  
  return {
    organizationId: orgId,
    subdomain: headersList.get('x-tenant-subdomain') || '',
    isCustomDomain: headersList.get('x-tenant-is-custom-domain') === 'true',
    hostname: headersList.get('x-tenant-hostname') || '',
  };
}

/**
 * Get the effective organization ID for database queries
 * 
 * In tenant mode: Returns the tenant's organizationId (domain-based)
 * In platform mode: Returns null (no tenant context)
 * 
 * This ensures that:
 * - On tenant domains, the domain's org is always used (cannot be spoofed)
 * - On platform domain (app.growthaddicts.com), NO tenant data is shown
 *   Platform domain is for admin/management, not user experience
 * 
 * @returns The effective organization ID for queries, or null on platform domain
 */
export async function getEffectiveOrgId(): Promise<string | null> {
  const tenantOrgId = await getTenantOrgId();
  
  // In tenant mode, use the domain's org
  if (tenantOrgId) {
    return tenantOrgId;
  }
  
  // Platform mode - NO tenant context
  // Platform domain is for admin management, not tenant-specific features
  // Users should visit tenant domains to see tenant data
  return null;
}

