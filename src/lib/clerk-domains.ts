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
