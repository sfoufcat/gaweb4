/**
 * Tenant Module - Multi-Tenant Domain Routing
 * 
 * This module provides utilities for tenant-by-domain routing,
 * allowing each organization to have their own subdomain or custom domain.
 */

export * from './parseHost';
export * from './resolveTenant';
export { getTenantOrgId, requireTenantOrgId, isTenantMode } from './context';


