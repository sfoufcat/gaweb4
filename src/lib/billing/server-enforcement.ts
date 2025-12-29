/**
 * Server-Side Entitlement Enforcement
 * 
 * Use these functions in API routes to enforce plan limits and features.
 * This is the security layer - UI checks are for UX only.
 */

import { auth } from '@clerk/nextjs/server';
import { headers } from 'next/headers';
import { adminDb } from '@/lib/firebase-admin';
import type { CoachTier, CoachSubscriptionStatus, OrgSettings, CoachSubscription } from '@/types';
import {
  getOrgEntitlements,
  type OrgEntitlements,
  type OrgBillingState,
  type LimitKey,
  type FeatureKey,
  isLimitReached,
  hasFeature,
  ENTITLEMENT_ERROR_CODES,
  createEntitlementError,
  type EntitlementError,
  getRequiredTierForFeature,
  PLAN_LIMITS,
} from './entitlements';

// =============================================================================
// TYPES
// =============================================================================

export interface OrgAuthContext {
  userId: string;
  orgId: string;
  orgRole?: string;
  isTenantMode: boolean;
  entitlements: OrgEntitlements;
}

export interface RequireEntitlementsOptions {
  /** Require a specific feature to be available */
  requireFeature?: FeatureKey;
  /** Require limit to not be exceeded (pass current count) */
  requireLimitNotExceeded?: {
    limitKey: LimitKey;
    currentCount: number;
  };
  /** Skip subscription active check (for viewing data, not mutations) */
  allowInactive?: boolean;
}

// =============================================================================
// CLERK ORG METADATA TYPES
// =============================================================================

export interface ClerkOrgPublicMetadata {
  plan?: CoachTier;
  subscriptionStatus?: CoachSubscriptionStatus;
  currentPeriodEnd?: string;
  trialEnd?: string;
  cancelAtPeriodEnd?: boolean;
  onboardingState?: 'needs_profile' | 'needs_plan' | 'active';
}

// =============================================================================
// GET ORG BILLING STATE
// =============================================================================

/**
 * Get billing state from Firestore (canonical source)
 */
async function getOrgBillingStateFromDB(orgId: string): Promise<OrgBillingState> {
  // Get org settings
  const settingsDoc = await adminDb.collection('org_settings').doc(orgId).get();
  const settings = settingsDoc.data() as OrgSettings | undefined;
  
  // Default state if no settings
  if (!settings) {
    return {
      plan: 'starter',
      subscriptionStatus: 'none',
      currentPeriodEnd: null,
      trialEnd: null,
      cancelAtPeriodEnd: false,
    };
  }
  
  // Get subscription details if exists
  let subscription: CoachSubscription | null = null;
  if (settings.coachSubscriptionId) {
    const subDoc = await adminDb
      .collection('coach_subscriptions')
      .doc(settings.coachSubscriptionId)
      .get();
    if (subDoc.exists) {
      subscription = { id: subDoc.id, ...subDoc.data() } as CoachSubscription;
    }
  }
  
  return {
    plan: subscription?.tier || settings.coachTier || 'starter',
    subscriptionStatus: subscription?.status || 'none',
    currentPeriodEnd: subscription?.currentPeriodEnd || null,
    trialEnd: subscription?.trialEnd || null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd || false,
  };
}

/**
 * Get billing state from Clerk org metadata (cache, for fast checks)
 * Falls back to DB if metadata is missing
 */
async function getOrgBillingStateFromClerk(orgId: string): Promise<OrgBillingState | null> {
  try {
    const { clerkClient } = await import('@clerk/nextjs/server');
    const clerk = await clerkClient();
    const org = await clerk.organizations.getOrganization({ organizationId: orgId });
    const metadata = org.publicMetadata as ClerkOrgPublicMetadata | undefined;
    
    if (!metadata?.plan) {
      return null; // No cached billing state
    }
    
    return {
      plan: metadata.plan,
      subscriptionStatus: metadata.subscriptionStatus || 'none',
      currentPeriodEnd: metadata.currentPeriodEnd || null,
      trialEnd: metadata.trialEnd || null,
      cancelAtPeriodEnd: metadata.cancelAtPeriodEnd || false,
    };
  } catch (error) {
    console.error('[ENTITLEMENTS] Error fetching Clerk org metadata:', error);
    return null;
  }
}

/**
 * Get org entitlements with fallback chain:
 * 1. Try Clerk org metadata (fast cache)
 * 2. Fall back to Firestore (canonical)
 */
export async function getOrgEntitlementsById(orgId: string): Promise<OrgEntitlements> {
  // Try Clerk cache first
  const clerkState = await getOrgBillingStateFromClerk(orgId);
  if (clerkState) {
    return getOrgEntitlements(clerkState);
  }
  
  // Fall back to DB
  const dbState = await getOrgBillingStateFromDB(orgId);
  return getOrgEntitlements(dbState);
}

// =============================================================================
// REQUIRE ORG AUTH AND ENTITLEMENTS
// =============================================================================

/**
 * Authenticate user and get their org context with entitlements
 * 
 * This is the main function API routes should use for authorization.
 * It validates auth, gets the org context, and returns entitlements.
 * 
 * @throws Error if not authenticated
 * @throws Error if no org context (not in an org)
 * @throws EntitlementError if subscription inactive and allowInactive is false
 * @throws EntitlementError if required feature is locked
 * @throws EntitlementError if limit is exceeded
 */
export async function requireOrgAuthAndEntitlements(
  options: RequireEntitlementsOptions = {}
): Promise<OrgAuthContext> {
  // Get auth context
  const { userId, orgId: clerkOrgId, orgRole } = await auth();
  
  if (!userId) {
    throw new Error('Unauthorized');
  }
  
  // Get org ID from tenant headers or Clerk session
  const headersList = await headers();
  const tenantOrgId = headersList.get('x-tenant-org-id');
  const isTenantMode = !!tenantOrgId;
  const orgId = tenantOrgId || clerkOrgId;
  
  if (!orgId) {
    throw new Error('No organization context');
  }
  
  // Get entitlements
  const entitlements = await getOrgEntitlementsById(orgId);
  
  // Check subscription is active (unless explicitly allowing inactive)
  if (!options.allowInactive && !entitlements.isActive) {
    throw createEntitlementError(
      'SUBSCRIPTION_INACTIVE',
      'Subscription is not active. Please upgrade to continue.',
      { currentPlan: entitlements.plan }
    );
  }
  
  // Check required feature
  if (options.requireFeature && !hasFeature(entitlements, options.requireFeature)) {
    const requiredPlan = getRequiredTierForFeature(options.requireFeature);
    throw createEntitlementError(
      'PLAN_FEATURE_LOCKED',
      `This feature requires the ${requiredPlan} plan or higher.`,
      { requiredPlan, currentPlan: entitlements.plan }
    );
  }
  
  // Check limit not exceeded
  if (options.requireLimitNotExceeded) {
    const { limitKey, currentCount } = options.requireLimitNotExceeded;
    if (isLimitReached(entitlements, limitKey, currentCount)) {
      const limit = entitlements.limits[limitKey];
      throw createEntitlementError(
        'PLAN_LIMIT',
        `You've reached the ${limitKey.replace('max', '').replace(/([A-Z])/g, ' $1').trim()} limit for your plan.`,
        {
          currentPlan: entitlements.plan,
          limit,
          currentUsage: currentCount,
        }
      );
    }
  }
  
  return {
    userId,
    orgId,
    orgRole,
    isTenantMode,
    entitlements,
  };
}

// =============================================================================
// SPECIFIC ENFORCEMENT HELPERS
// =============================================================================

/**
 * Require AI helper access (Scale only)
 */
export async function requireAIHelperAccess(): Promise<OrgAuthContext> {
  return requireOrgAuthAndEntitlements({
    requireFeature: 'aiHelper',
  });
}

/**
 * Require multi-coach/team access (Scale only)
 */
export async function requireTeamAccess(): Promise<OrgAuthContext> {
  return requireOrgAuthAndEntitlements({
    requireFeature: 'teamRolesPermissions',
  });
}

/**
 * Require custom domain access (Pro+)
 */
export async function requireCustomDomainAccess(): Promise<OrgAuthContext> {
  return requireOrgAuthAndEntitlements({
    requireFeature: 'customDomain',
  });
}

/**
 * Require email whitelabel access (Pro+)
 */
export async function requireEmailWhitelabelAccess(): Promise<OrgAuthContext> {
  return requireOrgAuthAndEntitlements({
    requireFeature: 'emailWhitelabel',
  });
}

/**
 * Require advanced funnel steps access (Pro+)
 */
export async function requireAdvancedFunnelsAccess(): Promise<OrgAuthContext> {
  return requireOrgAuthAndEntitlements({
    requireFeature: 'advancedFunnelSteps',
  });
}

// Alias for backwards compatibility
export const requireAdvancedFunnels = async (orgId: string): Promise<void> => {
  const entitlements = await getOrgEntitlementsById(orgId);
  if (!hasFeature(entitlements, 'advancedFunnelSteps')) {
    throw createEntitlementError(
      'PLAN_FEATURE_LOCKED',
      'Advanced funnel steps require the Pro plan or higher.',
      { requiredPlan: 'pro', currentPlan: entitlements.plan }
    );
  }
};

// Alias for backwards compatibility
export const requireCustomDomain = async (orgId: string): Promise<void> => {
  const entitlements = await getOrgEntitlementsById(orgId);
  if (!hasFeature(entitlements, 'customDomain')) {
    throw createEntitlementError(
      'PLAN_FEATURE_LOCKED',
      'Custom domains require the Pro plan or higher.',
      { requiredPlan: 'pro', currentPlan: entitlements.plan }
    );
  }
};

/**
 * Check if a plan limit is reached and throw if so
 */
export async function requirePlanLimit(orgId: string, limitKey: LimitKey): Promise<void> {
  const entitlements = await getOrgEntitlementsById(orgId);
  
  // Get current count based on limit type
  let currentCount: number;
  switch (limitKey) {
    case 'maxPrograms':
      currentCount = await getOrgProgramCount(orgId);
      break;
    case 'maxMasterminds':
      currentCount = await getOrgMastermindCount(orgId);
      break;
    case 'maxSquads':
      currentCount = await getOrgSquadCount(orgId);
      break;
    case 'maxClients':
      currentCount = await getOrgClientCount(orgId);
      break;
    case 'maxCoaches':
      currentCount = await getOrgCoachCount(orgId);
      break;
    case 'maxFunnelsPerTarget':
      // For funnels per target, we need the org-wide count
      const funnelsSnapshot = await adminDb
        .collection('funnels')
        .where('organizationId', '==', orgId)
        .count()
        .get();
      currentCount = funnelsSnapshot.data().count;
      break;
    case 'maxContentItems':
      currentCount = await getOrgContentCount(orgId);
      break;
    case 'maxStorageMB':
      // Storage limit enforcement requires external tracking (e.g., cloud storage usage API)
      // For now, log a warning - this should be implemented when storage tracking is available
      console.warn('[ENTITLEMENTS] Storage limit enforcement not yet implemented - needs storage usage tracking');
      return;
    default:
      // Unknown limit key - log and skip (don't silently fail)
      console.warn(`[ENTITLEMENTS] Unknown limit key: ${limitKey}`);
      return;
  }
  
  const limit = entitlements.limits[limitKey];
  
  // Unlimited (-1) means no enforcement
  if (limit === -1) {
    return;
  }
  
  if (currentCount >= limit) {
    throw createEntitlementError(
      'PLAN_LIMIT',
      `You've reached the ${limitKey.replace('max', '').replace(/([A-Z])/g, ' $1').trim().toLowerCase()} limit for your plan (${currentCount}/${limit}).`,
      {
        currentPlan: entitlements.plan,
        limit,
        currentCount,
        limitKey,
        maxLimit: limit,
      }
    );
  }
}

// =============================================================================
// USAGE COUNTING HELPERS
// =============================================================================

/**
 * Get current program count for an org
 */
export async function getOrgProgramCount(orgId: string): Promise<number> {
  const snapshot = await adminDb
    .collection('programs')
    .where('organizationId', '==', orgId)
    .where('isActive', '==', true)
    .count()
    .get();
  return snapshot.data().count;
}

/**
 * Get current mastermind count for an org
 */
export async function getOrgMastermindCount(orgId: string): Promise<number> {
  const snapshot = await adminDb
    .collection('masterminds')
    .where('organizationId', '==', orgId)
    .where('isActive', '==', true)
    .count()
    .get();
  return snapshot.data().count;
}

/**
 * Get current squad count for an org
 */
export async function getOrgSquadCount(orgId: string): Promise<number> {
  const snapshot = await adminDb
    .collection('squads')
    .where('organizationId', '==', orgId)
    .count()
    .get();
  return snapshot.data().count;
}

/**
 * Get current active client (member) count for an org
 */
export async function getOrgClientCount(orgId: string): Promise<number> {
  const snapshot = await adminDb
    .collection('org_memberships')
    .where('organizationId', '==', orgId)
    .where('orgRole', '==', 'member')
    .where('isActive', '==', true)
    .count()
    .get();
  return snapshot.data().count;
}

/**
 * Get current coach count for an org (excluding owner)
 */
export async function getOrgCoachCount(orgId: string): Promise<number> {
  const snapshot = await adminDb
    .collection('org_memberships')
    .where('organizationId', '==', orgId)
    .where('orgRole', 'in', ['coach', 'super_coach'])
    .where('isActive', '==', true)
    .count()
    .get();
  // Subtract 1 for the owner (who is always super_coach)
  return Math.max(0, snapshot.data().count - 1);
}

/**
 * Get funnel count for a specific target (program or squad)
 */
export async function getFunnelCountForTarget(
  orgId: string,
  targetType: 'program' | 'squad',
  targetId: string
): Promise<number> {
  const snapshot = await adminDb
    .collection('funnels')
    .where('organizationId', '==', orgId)
    .where('targetType', '==', targetType)
    .where('targetId', '==', targetId)
    .where('isActive', '==', true)
    .count()
    .get();
  return snapshot.data().count;
}

/**
 * Get content item count for an org (courses, articles, events)
 */
export async function getOrgContentCount(orgId: string): Promise<number> {
  const [coursesSnapshot, articlesSnapshot, eventsSnapshot] = await Promise.all([
    adminDb.collection('courses').where('organizationId', '==', orgId).count().get(),
    adminDb.collection('articles').where('organizationId', '==', orgId).count().get(),
    adminDb.collection('events').where('organizationId', '==', orgId).count().get(),
  ]);
  
  return (
    coursesSnapshot.data().count +
    articlesSnapshot.data().count +
    eventsSnapshot.data().count
  );
}

// =============================================================================
// ERROR RESPONSE HELPER
// =============================================================================

/**
 * Check if an error is an entitlement error
 */
export function isEntitlementError(error: unknown): error is EntitlementError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    Object.values(ENTITLEMENT_ERROR_CODES).includes((error as EntitlementError).code)
  );
}

/**
 * Get HTTP status code for an entitlement error
 */
export function getEntitlementErrorStatus(error: EntitlementError): number {
  switch (error.code) {
    case 'SUBSCRIPTION_INACTIVE':
      return 402; // Payment Required
    case 'PLAN_FEATURE_LOCKED':
    case 'PLAN_LIMIT':
      return 403; // Forbidden
    default:
      return 403;
  }
}

