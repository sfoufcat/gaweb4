import { auth, clerkClient } from '@clerk/nextjs/server';
import type { UserRole, UserTier, UserTrack, CoachingStatus, CoachingPlan, OrgRole } from '@/types';
import { isAdmin, isSuperAdmin, isOrgCoach } from './admin-utils-shared';

/**
 * Clerk-Based Admin & Billing Authorization Utilities (Server-Side)
 * 
 * These functions use Clerk's server-side auth() and should only be used in:
 * - API routes
 * - Server Components
 * - Server Actions
 * 
 * For Client Components, import from '@/lib/admin-utils-shared' instead.
 */

// ============================================================================
// TENANT REQUIRED ERROR
// ============================================================================

/**
 * Error thrown when tenant mode is required but the request is on the platform domain.
 * Includes the user's tenant URL so UI can redirect them.
 */
export class TenantRequiredError extends Error {
  tenantUrl: string | null;
  subdomain: string | null;
  
  constructor(tenantUrl: string | null, subdomain: string | null) {
    super('TenantRequired: Please access this feature from your organization domain');
    this.name = 'TenantRequiredError';
    this.tenantUrl = tenantUrl;
    this.subdomain = subdomain;
  }
}

// ============================================================================
// BILLING STATUS TYPES & HELPERS
// ============================================================================

export type BillingStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';

export interface ClerkPublicMetadata {
  role?: UserRole;
  orgRole?: OrgRole; // Organization-level role (super_coach, coach, member)
  organizationId?: string; // Clerk Organization ID
  billingStatus?: BillingStatus;
  billingPeriodEnd?: string; // ISO date string for grace period checks
  tier?: UserTier; // User subscription tier (free, standard, premium) - NOT coaching
  track?: UserTrack; // Business track (content_creator, saas, coach_consultant, ecom, agency, general)
  // Coaching (separate from membership tier)
  coaching?: boolean; // Legacy flag - true if has active coaching
  coachingStatus?: CoachingStatus; // Detailed coaching status
  coachingPlan?: CoachingPlan; // Coaching plan type
  coachingPeriodEnd?: string; // ISO date when coaching access ends
  [key: string]: unknown; // Index signature for compatibility with UserPublicMetadata
}

/**
 * Update a user's billing status and tier in Clerk publicMetadata
 * This is the SINGLE SOURCE OF TRUTH for access control
 */
export async function updateUserBillingInClerk(
  userId: string, 
  billingStatus: BillingStatus,
  billingPeriodEnd?: string,
  tier?: UserTier
): Promise<void> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  
  const metadataUpdate: ClerkPublicMetadata = {
    ...user.publicMetadata as ClerkPublicMetadata,
    billingStatus,
    billingPeriodEnd,
  };
  
  // Only update tier if provided
  if (tier !== undefined) {
    metadataUpdate.tier = tier;
  }
  
  await client.users.updateUserMetadata(userId, {
    publicMetadata: metadataUpdate,
  });
  
  console.log(`[CLERK_BILLING] Updated user ${userId}: status=${billingStatus}, tier=${tier ?? 'unchanged'}, periodEnd=${billingPeriodEnd}`);
}

/**
 * Get the current user's billing status and tier from Clerk session
 * This reads from the JWT token (no database call needed)
 */
export async function getCurrentBillingStatus(): Promise<{ status: BillingStatus; periodEnd?: string; tier?: UserTier }> {
  const { sessionClaims } = await auth();
  const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
  
  return {
    status: publicMetadata?.billingStatus || 'none',
    periodEnd: publicMetadata?.billingPeriodEnd,
    tier: publicMetadata?.tier,
  };
}

/**
 * Get the current user's tier from Clerk session
 * This reads from the JWT token (no database call needed)
 */
export async function getCurrentUserTier(): Promise<UserTier> {
  const { sessionClaims } = await auth();
  const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
  return publicMetadata?.tier || 'standard';
}

/**
 * Check if user has active billing (either active subscription or in grace period)
 */
export function hasActiveBilling(status: BillingStatus, periodEnd?: string): boolean {
  // Active or trialing = full access
  if (status === 'active' || status === 'trialing') {
    return true;
  }
  
  // Canceled but still in paid period = grace access
  if (status === 'canceled' && periodEnd) {
    const endDate = new Date(periodEnd);
    const now = new Date();
    return endDate > now;
  }
  
  return false;
}

// ============================================================================
// COACHING STATUS HELPERS
// ============================================================================

/**
 * Update a user's coaching status in Clerk publicMetadata
 * This is SEPARATE from membership tier - coaching is an add-on product
 */
export async function updateUserCoachingInClerk(
  userId: string,
  coachingStatus: CoachingStatus,
  coachingPlan?: CoachingPlan,
  coachingPeriodEnd?: string
): Promise<void> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  
  const metadataUpdate: ClerkPublicMetadata = {
    ...user.publicMetadata as ClerkPublicMetadata,
    coachingStatus,
    // Set legacy coaching flag based on status
    coaching: coachingStatus === 'active',
  };
  
  // Only update plan if provided
  if (coachingPlan !== undefined) {
    metadataUpdate.coachingPlan = coachingPlan;
  }
  
  // Only update period end if provided
  if (coachingPeriodEnd !== undefined) {
    metadataUpdate.coachingPeriodEnd = coachingPeriodEnd;
  }
  
  await client.users.updateUserMetadata(userId, {
    publicMetadata: metadataUpdate,
  });
  
  console.log(`[CLERK_COACHING] Updated user ${userId}: status=${coachingStatus}, plan=${coachingPlan ?? 'unchanged'}, periodEnd=${coachingPeriodEnd ?? 'unchanged'}`);
}

/**
 * Check if user has active coaching (either active or in grace period)
 */
export function hasActiveCoaching(status?: CoachingStatus, periodEnd?: string): boolean {
  // Active coaching = full access
  if (status === 'active') {
    return true;
  }
  
  // Canceled but still in paid period = grace access
  if (status === 'canceled' && periodEnd) {
    const endDate = new Date(periodEnd);
    const now = new Date();
    return endDate > now;
  }
  
  return false;
}

/**
 * Get the current user's coaching status from Clerk session
 */
export async function getCurrentCoachingStatus(): Promise<{ 
  status: CoachingStatus; 
  plan?: CoachingPlan; 
  periodEnd?: string;
  hasAccess: boolean;
}> {
  const { sessionClaims } = await auth();
  const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
  
  const status = publicMetadata?.coachingStatus || 'none';
  const plan = publicMetadata?.coachingPlan;
  const periodEnd = publicMetadata?.coachingPeriodEnd;
  
  // Check for active access (active status OR legacy coaching flag OR in grace period)
  const hasAccess = status === 'active' || 
    publicMetadata?.coaching === true || 
    hasActiveCoaching(status, periodEnd);
  
  return { status, plan, periodEnd, hasAccess };
}

// ============================================================================
// ROLE & ADMIN UTILITIES
// ============================================================================

/**
 * Check if a user is an org:admin in a specific Clerk organization
 * 
 * This is used for tenant subdomain routing where the organization context
 * comes from headers (x-tenant-org-id) rather than Clerk's active org session.
 * In this case, auth().orgRole is undefined, so we need to look up the
 * actual membership role from Clerk's API.
 * 
 * @param userId - The Clerk user ID
 * @param organizationId - The Clerk organization ID
 * @returns true if user is org:admin in the organization
 */
export async function isUserOrgAdminInOrg(userId: string, organizationId: string): Promise<boolean> {
  try {
    const client = await clerkClient();
    const memberships = await client.organizations.getOrganizationMembershipList({
      organizationId,
    });
    
    const userMembership = memberships.data.find(m => m.publicUserData?.userId === userId);
    const isAdmin = userMembership?.role === 'org:admin';
    
    console.log(`[isUserOrgAdminInOrg] User ${userId} in org ${organizationId}: role=${userMembership?.role}, isAdmin=${isAdmin}`);
    
    return isAdmin;
  } catch (error) {
    console.error(`[isUserOrgAdminInOrg] Error checking org admin status for user ${userId} in org ${organizationId}:`, error);
    return false;
  }
}

/**
 * Get the current user's role from Clerk database
 * Fetches fresh data to avoid stale JWT issues
 */
export async function getCurrentUserRole(): Promise<UserRole> {
  const { userId } = await auth();
  if (!userId) {
    return 'user';
  }
  
  // Fetch fresh data from Clerk database (not stale JWT)
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const publicMetadata = user.publicMetadata as ClerkPublicMetadata | undefined;
  
  return publicMetadata?.role || 'user';
}

/**
 * Server-side: Check if current user is admin (for API routes)
 * Throws error if not admin
 */
export async function requireAdmin(): Promise<UserRole> {
  const { userId } = await auth();
  
  if (!userId) {
    throw new Error('Unauthorized');
  }

  const role = await getCurrentUserRole();
  
  if (!isAdmin(role)) {
    throw new Error('Forbidden: Admin access required');
  }

  return role;
}

/**
 * Server-side: Check if current user is super admin (for API routes)
 * Throws error if not super admin
 */
export async function requireSuperAdmin(): Promise<void> {
  const { userId } = await auth();
  
  if (!userId) {
    throw new Error('Unauthorized');
  }

  const role = await getCurrentUserRole();
  
  if (!isSuperAdmin(role)) {
    throw new Error('Forbidden: Super admin access required');
  }
}

/**
 * Server-side: Check if current user is a coach and get their organizationId
 * Throws error if not coach/admin or if no organization exists
 * 
 * IMPORTANT: By default, this function REQUIRES tenant mode (subdomain or custom domain).
 * On the platform domain, it will throw TenantRequiredError unless:
 * - The user is a super_admin (full access on platform domain)
 * - allowPlatformMode option is explicitly set to true
 * 
 * Priority for organizationId:
 * 1. Tenant context from headers (x-tenant-org-id) - for domain-based routing
 * 2. Clerk's native org session (auth().orgId) - preferred for full Clerk Orgs
 * 3. publicMetadata.primaryOrganizationId - active organization (preferred)
 * 4. publicMetadata.organizationId - backward compatibility (legacy/deprecated)
 * 
 * @param options.allowPlatformMode - If true, allows access from platform domain (default: false)
 * @returns { userId, role, organizationId, isTenantMode }
 * @throws TenantRequiredError if not on tenant domain and not super_admin
 */
export async function requireCoachWithOrg(options?: {
  allowPlatformMode?: boolean;
}): Promise<{ 
  userId: string; 
  role: UserRole; 
  orgRole?: OrgRole;
  organizationId: string;
  isTenantMode?: boolean;
}> {
  const { userId, orgId, sessionClaims } = await auth();
  
  if (!userId) {
    throw new Error('Unauthorized');
  }

  const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
  const role = publicMetadata?.role || 'user';
  const orgRole = publicMetadata?.orgRole;
  
  // Helper to safely get string org IDs from metadata (Clerk metadata can sometimes be empty objects)
  const primaryOrgId = typeof publicMetadata?.primaryOrganizationId === 'string' ? publicMetadata.primaryOrganizationId : undefined;
  const legacyOrgId = typeof publicMetadata?.organizationId === 'string' ? publicMetadata.organizationId : undefined;
  
  // Check access: global coach/admin roles OR org-level coach roles
  const hasGlobalAccess = role === 'coach' || role === 'admin' || role === 'super_admin';
  const hasOrgAccess = isOrgCoach(orgRole); // super_coach or coach
  
  if (!hasGlobalAccess && !hasOrgAccess) {
    throw new Error('Forbidden: Coach access required');
  }
  
  // Check for tenant context from headers (set by middleware)
  let tenantOrgId: string | null = null;
  let isTenantMode = false;
  try {
    // Dynamic import to avoid issues in non-server contexts
    const { headers } = await import('next/headers');
    const headersList = await headers();
    tenantOrgId = headersList.get('x-tenant-org-id');
    isTenantMode = !!tenantOrgId;
  } catch {
    // Headers not available (e.g., in some edge cases)
  }
  
  // TENANT MODE ENFORCEMENT
  // If not in tenant mode and platform mode not explicitly allowed
  if (!isTenantMode && !options?.allowPlatformMode) {
    // Super admins always have full access on platform domain (for support/debugging)
    if (role === 'super_admin') {
      const organizationId = orgId || primaryOrgId || legacyOrgId;
      if (organizationId) {
        console.log(`[requireCoachWithOrg] Super admin ${userId} accessing org ${organizationId} from platform domain`);
        return { userId, role, orgRole, organizationId, isTenantMode: false };
      }
    }
    
    // Regular coaches must use their tenant domain
    // Look up their subdomain to provide a helpful redirect URL
    const userOrgId = orgId || primaryOrgId || legacyOrgId;
    let tenantUrl: string | null = null;
    let subdomain: string | null = null;
    
    if (userOrgId) {
      try {
        // Dynamic import to avoid circular dependencies
        const { getOrgDomain } = await import('@/lib/tenant/resolveTenant');
        const orgDomain = await getOrgDomain(userOrgId);
        if (orgDomain?.subdomain) {
          subdomain = orgDomain.subdomain;
          tenantUrl = `https://${orgDomain.subdomain}.growthaddicts.com`;
        }
      } catch (error) {
        console.error('[requireCoachWithOrg] Error looking up org domain:', error);
      }
    }
    
    throw new TenantRequiredError(tenantUrl, subdomain);
  }
  
  // Get organizationId - priority: tenant context > Clerk org session > primaryOrganizationId > organizationId (legacy)
  const organizationId = tenantOrgId || orgId || primaryOrgId || legacyOrgId;
  
  if (!organizationId) {
    throw new Error('Organization not found: Coach must have an organization');
  }
  
  // In tenant mode, verify user has access to this organization
  // This is a secondary check - middleware already verifies membership
  // But we do a quick sanity check here for org-level coach operations
  if (isTenantMode && tenantOrgId) {
    const userOrgId = publicMetadata?.organizationId;
    const primaryOrgId = publicMetadata?.primaryOrganizationId;
    const clerkOrgMatch = orgId === tenantOrgId;
    const metadataMatch = userOrgId === tenantOrgId || primaryOrgId === tenantOrgId;
    
    // Allow if any org reference matches (middleware already validated full membership)
    if (!clerkOrgMatch && !metadataMatch) {
      // This case shouldn't happen if middleware is working correctly
      // But log it for debugging
      console.warn(`[requireCoachWithOrg] User ${userId} accessing tenant ${tenantOrgId} without quick match`);
    }
  }
  
  return { userId, role, orgRole, organizationId, isTenantMode };
}

// Re-export shared utilities for convenience in server-side code
export * from './admin-utils-shared';

