/**
 * Tenant Resolution
 * 
 * Resolves tenant (organization) from hostname by looking up
 * subdomain or custom domain in Firestore.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { TenantContext, TenantResolutionResult, OrgDomain, OrgCustomDomain } from '@/types';
import { parseHost, getDevTenantOverride, isDevelopment } from './parseHost';

/**
 * Resolve tenant from hostname
 * 
 * Priority:
 * 1. Dev override (if in development mode)
 * 2. Subdomain lookup
 * 3. Custom domain lookup
 * 
 * @param hostname - The hostname from the request
 * @param searchParams - URL search params (for dev override)
 * @param headers - Request headers (for dev override)
 * @returns Tenant resolution result
 */
export async function resolveTenant(
  hostname: string,
  searchParams?: URLSearchParams | null,
  headers?: Headers | null
): Promise<TenantResolutionResult> {
  // Check for dev override first
  const devOverride = getDevTenantOverride(searchParams ?? null, headers ?? null);
  if (devOverride) {
    const tenant = await resolveTenantBySubdomain(devOverride);
    if (tenant) {
      return {
        type: 'tenant',
        tenant: {
          ...tenant,
          hostname: `${devOverride}.growthaddicts.app`, // Synthetic hostname
        },
      };
    }
    // Dev override specified but not found
    console.warn(`[TENANT] Dev override tenant "${devOverride}" not found`);
    return { type: 'not_found', hostname };
  }
  
  // Parse the hostname
  const parsed = parseHost(hostname);
  
  switch (parsed.type) {
    case 'platform':
      return { type: 'platform', hostname: parsed.hostname };
      
    case 'subdomain': {
      const tenant = await resolveTenantBySubdomain(parsed.subdomain!);
      if (tenant) {
        return {
          type: 'tenant',
          tenant: {
            ...tenant,
            hostname: parsed.hostname,
          },
        };
      }
      return { type: 'not_found', hostname: parsed.hostname };
    }
    
    case 'custom_domain': {
      const tenant = await resolveTenantByCustomDomain(parsed.hostname);
      if (tenant) {
        return {
          type: 'tenant',
          tenant: {
            ...tenant,
            hostname: parsed.hostname,
          },
        };
      }
      return { type: 'not_found', hostname: parsed.hostname };
    }
  }
}

/**
 * Resolve tenant by subdomain
 */
async function resolveTenantBySubdomain(
  subdomain: string
): Promise<Omit<TenantContext, 'hostname'> | null> {
  try {
    const snapshot = await adminDb
      .collection('org_domains')
      .where('subdomain', '==', subdomain.toLowerCase())
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    const doc = snapshot.docs[0];
    const data = doc.data() as OrgDomain;
    
    return {
      organizationId: data.organizationId,
      subdomain: data.subdomain,
      isCustomDomain: false,
    };
  } catch (error) {
    console.error('[TENANT] Error resolving subdomain:', error);
    return null;
  }
}

/**
 * Resolve tenant by custom domain
 */
async function resolveTenantByCustomDomain(
  domain: string
): Promise<Omit<TenantContext, 'hostname'> | null> {
  try {
    // Only match verified domains
    const snapshot = await adminDb
      .collection('org_custom_domains')
      .where('domain', '==', domain.toLowerCase())
      .where('status', '==', 'verified')
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    const doc = snapshot.docs[0];
    const customDomainData = doc.data() as OrgCustomDomain;
    
    // Get the org's subdomain for reference
    const orgDomainSnapshot = await adminDb
      .collection('org_domains')
      .where('organizationId', '==', customDomainData.organizationId)
      .limit(1)
      .get();
    
    const subdomain = orgDomainSnapshot.empty 
      ? '' 
      : (orgDomainSnapshot.docs[0].data() as OrgDomain).subdomain;
    
    return {
      organizationId: customDomainData.organizationId,
      subdomain,
      isCustomDomain: true,
    };
  } catch (error) {
    console.error('[TENANT] Error resolving custom domain:', error);
    return null;
  }
}

/**
 * Get tenant context from request headers
 * Used by API routes and server actions after middleware has resolved tenant
 * 
 * @param headers - Request headers
 * @returns Tenant context or null if in platform mode
 */
export function getTenantFromHeaders(headers: Headers): TenantContext | null {
  const orgId = headers.get('x-tenant-org-id');
  const subdomain = headers.get('x-tenant-subdomain');
  const isCustomDomain = headers.get('x-tenant-is-custom-domain') === 'true';
  const hostname = headers.get('x-tenant-hostname');
  
  if (!orgId) {
    return null;
  }
  
  return {
    organizationId: orgId,
    subdomain: subdomain || '',
    isCustomDomain,
    hostname: hostname || '',
  };
}

/**
 * Check if a subdomain is available (not taken and not reserved)
 */
export async function isSubdomainAvailable(subdomain: string): Promise<boolean> {
  const normalized = subdomain.toLowerCase().trim();
  
  // Check if already taken
  const snapshot = await adminDb
    .collection('org_domains')
    .where('subdomain', '==', normalized)
    .limit(1)
    .get();
  
  return snapshot.empty;
}

/**
 * Check if a custom domain is available (not taken)
 */
export async function isCustomDomainAvailable(domain: string): Promise<boolean> {
  const normalized = domain.toLowerCase().trim();
  
  const snapshot = await adminDb
    .collection('org_custom_domains')
    .where('domain', '==', normalized)
    .limit(1)
    .get();
  
  return snapshot.empty;
}

/**
 * Create org domain mapping for a new coach organization
 * Called when coach role is assigned and subdomain is set
 */
export async function createOrgDomain(
  organizationId: string,
  subdomain: string
): Promise<OrgDomain> {
  const normalized = subdomain.toLowerCase().trim();
  const now = new Date().toISOString();
  
  const domainData: Omit<OrgDomain, 'id'> = {
    organizationId,
    subdomain: normalized,
    primaryDomain: `${normalized}.growthaddicts.app`,
    createdAt: now,
    updatedAt: now,
  };
  
  const docRef = await adminDb.collection('org_domains').add(domainData);
  
  console.log(`[TENANT] Created org domain: ${normalized}.growthaddicts.app -> org:${organizationId}`);
  
  return {
    id: docRef.id,
    ...domainData,
  };
}

/**
 * Update org subdomain
 */
export async function updateOrgSubdomain(
  organizationId: string,
  newSubdomain: string
): Promise<void> {
  const normalized = newSubdomain.toLowerCase().trim();
  const now = new Date().toISOString();
  
  // Find existing domain doc
  const snapshot = await adminDb
    .collection('org_domains')
    .where('organizationId', '==', organizationId)
    .limit(1)
    .get();
  
  if (snapshot.empty) {
    // Create new if doesn't exist
    await createOrgDomain(organizationId, normalized);
    return;
  }
  
  // Update existing
  const docRef = snapshot.docs[0].ref;
  await docRef.update({
    subdomain: normalized,
    primaryDomain: `${normalized}.growthaddicts.app`,
    updatedAt: now,
  });
  
  console.log(`[TENANT] Updated org subdomain: ${normalized}.growthaddicts.app -> org:${organizationId}`);
}

/**
 * Get org domain by organization ID
 */
export async function getOrgDomain(organizationId: string): Promise<OrgDomain | null> {
  const snapshot = await adminDb
    .collection('org_domains')
    .where('organizationId', '==', organizationId)
    .limit(1)
    .get();
  
  if (snapshot.empty) {
    return null;
  }
  
  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
  } as OrgDomain;
}

/**
 * Generate a verification token for custom domains
 */
export function generateVerificationToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = 'ga-verify-';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Add a custom domain for an organization
 */
export async function addCustomDomain(
  organizationId: string,
  domain: string
): Promise<OrgCustomDomain> {
  const normalized = domain.toLowerCase().trim();
  const now = new Date().toISOString();
  const verificationToken = generateVerificationToken();
  
  const domainData: Omit<OrgCustomDomain, 'id'> = {
    organizationId,
    domain: normalized,
    status: 'pending',
    verificationToken,
    createdAt: now,
    updatedAt: now,
  };
  
  const docRef = await adminDb.collection('org_custom_domains').add(domainData);
  
  console.log(`[TENANT] Added custom domain: ${normalized} -> org:${organizationId} (pending verification)`);
  
  return {
    id: docRef.id,
    ...domainData,
  };
}

/**
 * Get custom domains for an organization
 */
export async function getOrgCustomDomains(organizationId: string): Promise<OrgCustomDomain[]> {
  const snapshot = await adminDb
    .collection('org_custom_domains')
    .where('organizationId', '==', organizationId)
    .orderBy('createdAt', 'desc')
    .get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as OrgCustomDomain[];
}

/**
 * Remove a custom domain
 */
export async function removeCustomDomain(domainId: string): Promise<void> {
  await adminDb.collection('org_custom_domains').doc(domainId).delete();
  console.log(`[TENANT] Removed custom domain: ${domainId}`);
}

/**
 * Verify a custom domain (manual verification by admin or automated DNS check)
 */
export async function verifyCustomDomain(domainId: string): Promise<void> {
  const now = new Date().toISOString();
  
  await adminDb.collection('org_custom_domains').doc(domainId).update({
    status: 'verified',
    verifiedAt: now,
    lastCheckedAt: now,
    updatedAt: now,
  });
  
  console.log(`[TENANT] Verified custom domain: ${domainId}`);
}
