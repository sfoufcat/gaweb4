import { auth, clerkClient } from '@clerk/nextjs/server';
import type { UserRole, UserTier, UserTrack, CoachingStatus, CoachingPlan } from '@/types';
import { isAdmin, isSuperAdmin } from './admin-utils-shared';

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
// BILLING STATUS TYPES & HELPERS
// ============================================================================

export type BillingStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';

export interface ClerkPublicMetadata {
  role?: UserRole;
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
 * Get the current user's role from Clerk session
 * This reads from the JWT token (no database call needed)
 */
export async function getCurrentUserRole(): Promise<UserRole> {
  const { sessionClaims } = await auth();
  const publicMetadata = sessionClaims?.publicMetadata as { role?: UserRole } | undefined;
  const role = publicMetadata?.role;
  return role || 'user'; // Default to 'user' if no role set
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

// Re-export shared utilities for convenience in server-side code
export * from './admin-utils-shared';

