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
 * Get detailed status of a Clerk domain
 * Checks DNS verification and SSL certificate status
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
    
    // Check verification status - may be in different fields depending on Clerk version
    // Common patterns: verification.status, cname_targets, is_verified
    let dnsVerified = false;
    let sslStatus: 'pending' | 'issued' | 'failed' | 'unknown' = 'unknown';
    
    // Check various possible verification indicators
    if (domainData.verification && typeof domainData.verification === 'object') {
      const verification = domainData.verification as Record<string, unknown>;
      dnsVerified = verification.status === 'verified';
      
      if (verification.status === 'verified') {
        sslStatus = 'issued';
      } else if (verification.status === 'pending') {
        sslStatus = 'pending';
      } else if (verification.status === 'failed') {
        sslStatus = 'failed';
      }
    }
    
    // Alternative: check if domain has cname_targets populated (indicates it's active)
    if (!dnsVerified && domainData.cname_targets) {
      // If cname_targets exist, domain is at least registered
      // We'll need to do a DNS check to verify
      sslStatus = 'pending';
    }
    
    // For frontend API, it's typically verified together with main DNS
    const frontendApiVerified = dnsVerified;
    
    // Domain is fully ready when DNS is verified and SSL is issued
    const fullyReady = dnsVerified && sslStatus === 'issued';
    
    console.log(`[CLERK_DOMAINS] Status for ${domain.name}: dns=${dnsVerified}, ssl=${sslStatus}, ready=${fullyReady}, raw=${JSON.stringify(domainData).substring(0, 200)}`);
    
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
