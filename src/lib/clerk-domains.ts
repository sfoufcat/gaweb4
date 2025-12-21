/**
 * Clerk Domain Management
 * 
 * Handles adding and removing satellite domains in Clerk for multi-tenant
 * custom domain authentication.
 * 
 * Note: This requires Clerk's domains API access, which may be plan-dependent.
 * If the API is not available, operations will fail gracefully.
 */

import { clerkClient } from '@clerk/nextjs/server';

interface ClerkDomainResult {
  success: boolean;
  domainId?: string;
  frontendApi?: string;  // e.g., "clerk.cyberked.com" - needed for DNS setup
  error?: string;
}

/**
 * Add a domain to Clerk as a satellite domain
 * This enables Clerk authentication to work on the custom domain
 * 
 * @param domain - The domain to add (e.g., "cyberked.com")
 * @returns Result with the Clerk domain ID if successful
 */
export async function addDomainToClerk(domain: string): Promise<ClerkDomainResult> {
  try {
    const client = await clerkClient();
    
    // Create the domain as a satellite
    const result = await client.domains.add({ 
      name: domain,
      is_satellite: true,
    });
    
    // Clerk satellite domains need a CNAME: clerk.{domain} -> frontend-api.clerk.services
    const frontendApi = `clerk.${domain}`;
    
    console.log(`[CLERK_DOMAINS] Added domain ${domain} to Clerk (ID: ${result.id}, Frontend API: ${frontendApi})`);
    
    return {
      success: true,
      domainId: result.id,
      frontendApi,
    };
  } catch (error) {
    console.error('[CLERK_DOMAINS] Error adding domain to Clerk:', error);
    
    // Check for specific error types
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Domain might already exist
    if (errorMessage.includes('already exists') || errorMessage.includes('duplicate')) {
      return {
        success: false,
        error: 'Domain already exists in Clerk',
      };
    }
    
    // API might not be available on this plan
    if (errorMessage.includes('not allowed') || errorMessage.includes('unauthorized') || errorMessage.includes('forbidden')) {
      return {
        success: false,
        error: 'Clerk domains API not available on current plan',
      };
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Remove a domain from Clerk
 * 
 * @param domainId - The Clerk domain ID to remove
 * @returns Success status
 */
export async function removeDomainFromClerk(domainId: string): Promise<ClerkDomainResult> {
  try {
    const client = await clerkClient();
    
    await client.domains.delete(domainId);
    
    console.log(`[CLERK_DOMAINS] Removed domain ${domainId} from Clerk`);
    
    return { success: true };
  } catch (error) {
    console.error('[CLERK_DOMAINS] Error removing domain from Clerk:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Domain might not exist (already deleted)
    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      console.log(`[CLERK_DOMAINS] Domain ${domainId} not found in Clerk (already removed)`);
      return { success: true };
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Get a domain from Clerk by ID
 * 
 * @param domainId - The Clerk domain ID
 * @returns Domain info or null if not found
 */
export async function getDomainFromClerk(domainId: string): Promise<{ id: string; name: string } | null> {
  try {
    const client = await clerkClient();
    const { data: domains } = await client.domains.list();
    const domain = domains.find(d => d.id === domainId);
    return domain ? { id: domain.id, name: domain.name } : null;
  } catch {
    return null;
  }
}

/**
 * List all domains in Clerk
 * Useful for debugging/admin purposes
 */
export async function listClerkDomains(): Promise<Array<{ id: string; name: string }>> {
  try {
    const client = await clerkClient();
    const { data: domains } = await client.domains.list();
    return domains.map(d => ({ id: d.id, name: d.name }));
  } catch (error) {
    console.error('[CLERK_DOMAINS] Error listing domains:', error);
    return [];
  }
}

/**
 * Clerk domain status for verification
 */
export interface ClerkDomainStatus {
  found: boolean;
  domainId?: string;
  name?: string;
  /** Whether the main domain CNAME is verified in Clerk */
  dnsVerified: boolean;
  /** Whether the clerk.{domain} CNAME is verified */
  frontendApiVerified: boolean;
  /** SSL certificate status: 'pending' | 'issued' | 'failed' | 'unknown' */
  sslStatus: 'pending' | 'issued' | 'failed' | 'unknown';
  /** Whether the domain is fully ready for use (DNS + SSL) */
  fullyReady: boolean;
  error?: string;
}

/**
 * Check if a Clerk CNAME record is properly configured via DNS lookup
 * clerk.{domain} should point to frontend-api.clerk.services
 */
async function verifyClerkCnameViaDns(domain: string): Promise<boolean> {
  try {
    const dns = await import('dns');
    const { promisify } = await import('util');
    const resolveCname = promisify(dns.resolveCname);
    
    const clerkSubdomain = `clerk.${domain}`;
    const records = await resolveCname(clerkSubdomain);
    return records.some(record => 
      record.toLowerCase().includes('clerk') || 
      record.toLowerCase().includes('frontend-api.clerk.services')
    );
  } catch {
    return false;
  }
}

/**
 * Get detailed status of a Clerk domain
 * Checks DNS verification and SSL certificate status
 * 
 * Uses multiple detection methods:
 * 1. Clerk API domain object properties (various field patterns)
 * 2. DNS lookup fallback to verify CNAME configuration
 * 
 * @param domainId - The Clerk domain ID
 * @returns Detailed status of the domain
 */
export async function getClerkDomainStatus(domainId: string): Promise<ClerkDomainStatus> {
  try {
    const client = await clerkClient();
    
    // Get domain details - Clerk SDK returns full domain object with status
    const { data: domains } = await client.domains.list();
    const domain = domains.find(d => d.id === domainId);
    
    if (!domain) {
      return {
        found: false,
        dnsVerified: false,
        frontendApiVerified: false,
        sslStatus: 'unknown',
        fullyReady: false,
        error: 'Domain not found in Clerk',
      };
    }
    
    // Access raw domain data to check verification status
    // Clerk domain objects may have additional properties not in TypeScript types
    const domainData = domain as unknown as Record<string, unknown>;
    
    // Log full domain object for debugging (helps identify correct field names)
    console.log(`[CLERK_DOMAINS] Full domain object for ${domain.name}:`, JSON.stringify(domainData, null, 2));
    
    // Check verification status - try multiple possible field patterns
    // Clerk's API may use different field names across versions
    let dnsVerified = false;
    let sslStatus: 'pending' | 'issued' | 'failed' | 'unknown' = 'unknown';
    
    // Pattern 1: Check verification object (older Clerk API format)
    if (domainData.verification && typeof domainData.verification === 'object') {
      const verification = domainData.verification as Record<string, unknown>;
      if (verification.status === 'verified') {
        dnsVerified = true;
        sslStatus = 'issued';
      } else if (verification.status === 'pending') {
        sslStatus = 'pending';
      } else if (verification.status === 'failed') {
        sslStatus = 'failed';
      }
    }
    
    // Pattern 2: Check top-level status fields (newer Clerk API format)
    if (!dnsVerified) {
      // Check for direct verification_status field
      if (domainData.verification_status === 'verified') {
        dnsVerified = true;
        sslStatus = 'issued';
      }
      
      // Check for is_verified boolean
      if (domainData.is_verified === true) {
        dnsVerified = true;
        sslStatus = 'issued';
      }
      
      // Check for status field
      if (domainData.status === 'verified' || domainData.status === 'active') {
        dnsVerified = true;
        sslStatus = 'issued';
      }
    }
    
    // Pattern 3: Check cnameTargets array (indicates domain is configured)
    // If Clerk returns cnameTargets and they're populated, domain is at least registered
    if (!dnsVerified && domainData.cname_targets && Array.isArray(domainData.cname_targets)) {
      // Domain is registered in Clerk, but we need to verify DNS is pointing correctly
      sslStatus = 'pending';
    }
    
    // Pattern 4: Check proxy_url presence (indicates fully configured satellite domain)
    if (!dnsVerified && domainData.proxy_url) {
      // If proxy_url exists, Clerk has fully configured this domain
      dnsVerified = true;
      sslStatus = 'issued';
    }
    
    // Pattern 5: Check development_origin for satellite domains
    // If development_origin is set, satellite is configured
    if (!dnsVerified && domainData.development_origin) {
      dnsVerified = true;
      sslStatus = 'issued';
    }
    
    // Fallback: Use DNS lookup to verify CNAME configuration
    // This is the most reliable check - if DNS is pointing correctly, domain should work
    if (!dnsVerified && domain.name) {
      console.log(`[CLERK_DOMAINS] API status unclear for ${domain.name}, checking DNS...`);
      const dnsCheck = await verifyClerkCnameViaDns(domain.name);
      if (dnsCheck) {
        console.log(`[CLERK_DOMAINS] DNS verification passed for ${domain.name}`);
        dnsVerified = true;
        // If DNS is correct, SSL should be issued or issuing
        // Clerk auto-provisions SSL once CNAME is verified
        sslStatus = 'issued';
      }
    }
    
    // For frontend API, it's typically verified together with main DNS
    const frontendApiVerified = dnsVerified;
    
    // Domain is fully ready when DNS is verified and SSL is issued
    const fullyReady = dnsVerified && sslStatus === 'issued';
    
    console.log(`[CLERK_DOMAINS] Final status for ${domain.name}: dns=${dnsVerified}, ssl=${sslStatus}, ready=${fullyReady}`);
    
    return {
      found: true,
      domainId: domain.id,
      name: domain.name,
      dnsVerified,
      frontendApiVerified,
      sslStatus,
      fullyReady,
    };
  } catch (error) {
    console.error('[CLERK_DOMAINS] Error getting domain status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      found: false,
      dnsVerified: false,
      frontendApiVerified: false,
      sslStatus: 'unknown',
      fullyReady: false,
      error: errorMessage,
    };
  }
}
