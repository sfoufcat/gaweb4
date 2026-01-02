/**
 * Vercel Domain Management API
 * 
 * Handles adding, removing, and verifying custom domains on the Vercel project.
 * This is required for domains to actually route to this application.
 * 
 * Required environment variables:
 * - VERCEL_API_TOKEN: Personal Access Token from Vercel
 * - VERCEL_PROJECT_ID: Project ID from Vercel dashboard
 * - VERCEL_TEAM_ID: Team ID (optional, if project is under a team)
 */

const VERCEL_API_BASE = 'https://api.vercel.com';

interface VercelDomainResponse {
  name: string;
  verified: boolean;
  verification?: Array<{
    type: string;
    domain: string;
    value: string;
    reason: string;
  }>;
  configured?: boolean;
  error?: {
    code: string;
    message: string;
  };
}

interface VercelDomainConfig {
  configuredBy?: string;
  misconfigured: boolean;
}

interface VercelAddDomainResult {
  success: boolean;
  domain?: string;
  verified?: boolean;
  verification?: Array<{
    type: string;
    domain: string;
    value: string;
    reason: string;
  }>;
  error?: string;
}

interface VercelDomainStatusResult {
  success: boolean;
  domain?: string;
  verified?: boolean;
  configured?: boolean;
  misconfigured?: boolean;
  verification?: Array<{
    type: string;
    domain: string;
    value: string;
    reason: string;
  }>;
  error?: string;
}

/**
 * Get Vercel API headers with authentication
 */
function getVercelHeaders(): HeadersInit {
  const token = process.env.VERCEL_API_TOKEN;
  if (!token) {
    throw new Error('VERCEL_API_TOKEN environment variable is not set');
  }
  
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Get the team query parameter if VERCEL_TEAM_ID is set
 */
function getTeamQuery(): string {
  const teamId = process.env.VERCEL_TEAM_ID;
  return teamId ? `?teamId=${teamId}` : '';
}

/**
 * Get the project ID from environment
 */
function getProjectId(): string {
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!projectId) {
    throw new Error('VERCEL_PROJECT_ID environment variable is not set');
  }
  return projectId;
}

/**
 * Add a domain to the Vercel project
 * 
 * @param domain - The domain to add (e.g., "app.example.com")
 * @returns Result with verification instructions if not yet verified
 */
export async function addDomainToVercel(domain: string): Promise<VercelAddDomainResult> {
  try {
    const projectId = getProjectId();
    const teamQuery = getTeamQuery();
    
    const response = await fetch(
      `${VERCEL_API_BASE}/v10/projects/${projectId}/domains${teamQuery}`,
      {
        method: 'POST',
        headers: getVercelHeaders(),
        body: JSON.stringify({ name: domain }),
      }
    );
    
    const data = await response.json() as VercelDomainResponse;
    
    if (!response.ok) {
      // Handle specific error cases
      if (data.error?.code === 'domain_already_in_use') {
        return {
          success: false,
          error: 'This domain is already in use by another Vercel project',
        };
      }
      if (data.error?.code === 'invalid_domain') {
        return {
          success: false,
          error: 'Invalid domain format',
        };
      }
      
      console.error('[VERCEL_DOMAINS] Add domain error:', data);
      return {
        success: false,
        error: data.error?.message || 'Failed to add domain to Vercel',
      };
    }
    
    console.log(`[VERCEL_DOMAINS] Added domain ${domain} to Vercel project`);
    
    return {
      success: true,
      domain: data.name,
      verified: data.verified,
      verification: data.verification,
    };
  } catch (error) {
    console.error('[VERCEL_DOMAINS] Error adding domain:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add domain to Vercel',
    };
  }
}

/**
 * Remove a domain from the Vercel project
 * 
 * @param domain - The domain to remove
 * @returns Success status
 */
export async function removeDomainFromVercel(domain: string): Promise<{ success: boolean; error?: string }> {
  try {
    const projectId = getProjectId();
    const teamQuery = getTeamQuery();
    
    const response = await fetch(
      `${VERCEL_API_BASE}/v9/projects/${projectId}/domains/${domain}${teamQuery}`,
      {
        method: 'DELETE',
        headers: getVercelHeaders(),
      }
    );
    
    if (!response.ok) {
      const data = await response.json();
      
      // Domain might not exist in Vercel - that's okay for deletion
      if (response.status === 404) {
        console.log(`[VERCEL_DOMAINS] Domain ${domain} not found in Vercel (already removed)`);
        return { success: true };
      }
      
      console.error('[VERCEL_DOMAINS] Remove domain error:', data);
      return {
        success: false,
        error: data.error?.message || 'Failed to remove domain from Vercel',
      };
    }
    
    console.log(`[VERCEL_DOMAINS] Removed domain ${domain} from Vercel project`);
    return { success: true };
  } catch (error) {
    console.error('[VERCEL_DOMAINS] Error removing domain:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove domain from Vercel',
    };
  }
}

/**
 * Get the verification/configuration status of a domain
 * 
 * @param domain - The domain to check
 * @returns Domain status including verification and configuration
 */
export async function getDomainVerificationStatus(domain: string): Promise<VercelDomainStatusResult> {
  try {
    const projectId = getProjectId();
    const teamQuery = getTeamQuery();
    
    // Get domain info
    const domainResponse = await fetch(
      `${VERCEL_API_BASE}/v9/projects/${projectId}/domains/${domain}${teamQuery}`,
      {
        method: 'GET',
        headers: getVercelHeaders(),
      }
    );
    
    if (!domainResponse.ok) {
      if (domainResponse.status === 404) {
        return {
          success: false,
          error: 'Domain not found in Vercel project',
        };
      }
      
      const data = await domainResponse.json();
      console.error('[VERCEL_DOMAINS] Get domain status error:', data);
      return {
        success: false,
        error: data.error?.message || 'Failed to get domain status',
      };
    }
    
    const domainData = await domainResponse.json() as VercelDomainResponse;
    
    // Also check domain configuration
    const configResponse = await fetch(
      `${VERCEL_API_BASE}/v6/domains/${domain}/config${teamQuery}`,
      {
        method: 'GET',
        headers: getVercelHeaders(),
      }
    );
    
    let configured = false;
    let misconfigured = false;
    
    if (configResponse.ok) {
      const configData = await configResponse.json() as VercelDomainConfig;
      misconfigured = configData.misconfigured;
      configured = !misconfigured && !!configData.configuredBy;
    }
    
    console.log(`[VERCEL_DOMAINS] Domain ${domain} status: verified=${domainData.verified}, configured=${configured}`);
    
    return {
      success: true,
      domain: domainData.name,
      verified: domainData.verified,
      configured,
      misconfigured,
      verification: domainData.verification,
    };
  } catch (error) {
    console.error('[VERCEL_DOMAINS] Error getting domain status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get domain status',
    };
  }
}

/**
 * Trigger domain verification in Vercel
 * 
 * @param domain - The domain to verify
 * @returns Verification status
 */
export async function verifyDomainInVercel(domain: string): Promise<VercelDomainStatusResult> {
  try {
    const projectId = getProjectId();
    const teamQuery = getTeamQuery();
    
    const response = await fetch(
      `${VERCEL_API_BASE}/v9/projects/${projectId}/domains/${domain}/verify${teamQuery}`,
      {
        method: 'POST',
        headers: getVercelHeaders(),
      }
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          error: 'Domain not found in Vercel project',
        };
      }
      
      const data = await response.json();
      console.error('[VERCEL_DOMAINS] Verify domain error:', data);
      return {
        success: false,
        error: data.error?.message || 'Failed to verify domain',
      };
    }
    
    const data = await response.json() as VercelDomainResponse;
    
    console.log(`[VERCEL_DOMAINS] Verified domain ${domain}: verified=${data.verified}`);
    
    return {
      success: true,
      domain: data.name,
      verified: data.verified,
      verification: data.verification,
    };
  } catch (error) {
    console.error('[VERCEL_DOMAINS] Error verifying domain:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify domain',
    };
  }
}

/**
 * Check if Vercel domain API is configured
 */
export function isVercelDomainApiConfigured(): boolean {
  return !!(process.env.VERCEL_API_TOKEN && process.env.VERCEL_PROJECT_ID);
}









