/**
 * Client-Side Entitlement Hooks
 * 
 * React hooks for checking plan entitlements on the client.
 * These are for UI/UX purposes only - server-side enforcement is mandatory.
 * 
 * Usage:
 * ```tsx
 * const entitlements = useOrgEntitlements();
 * 
 * if (!entitlements?.canUseAIHelper) {
 *   return <UpgradePrompt feature="AI Helper" requiredPlan="scale" />;
 * }
 * ```
 */

'use client';

import { useOrganization } from '@clerk/nextjs';
import { useMemo } from 'react';
import type { CoachTier, CoachSubscriptionStatus } from '@/types';
import {
  getOrgEntitlements,
  type OrgEntitlements,
  type OrgBillingState,
  type FeatureKey,
  type LimitKey,
  hasFeature,
  isLimitReached,
  getRequiredTierForFeature,
  getNextTier,
  PLAN_PRICING,
} from './entitlements';

// Re-export types for convenience
export type { OrgEntitlements, FeatureKey, LimitKey };

/**
 * Clerk org publicMetadata shape (synced from Stripe webhooks)
 */
interface ClerkOrgPublicMetadata {
  plan?: CoachTier;
  subscriptionStatus?: CoachSubscriptionStatus;
  currentPeriodEnd?: string;
  trialEnd?: string;
  cancelAtPeriodEnd?: boolean;
  onboardingState?: 'needs_profile' | 'needs_plan' | 'active';
}

/**
 * Hook to get organization entitlements
 * 
 * Returns null if:
 * - Clerk is not loaded yet
 * - User is not in an organization
 * - Organization metadata is not available
 */
export function useOrgEntitlements(): OrgEntitlements | null {
  const { organization, isLoaded } = useOrganization();
  
  return useMemo(() => {
    if (!isLoaded || !organization) {
      return null;
    }
    
    const metadata = organization.publicMetadata as ClerkOrgPublicMetadata | undefined;
    
    // Build billing state from Clerk org metadata
    const billingState: OrgBillingState = {
      plan: metadata?.plan || 'starter',
      subscriptionStatus: metadata?.subscriptionStatus || 'none',
      currentPeriodEnd: metadata?.currentPeriodEnd || null,
      trialEnd: metadata?.trialEnd || null,
      cancelAtPeriodEnd: metadata?.cancelAtPeriodEnd || false,
    };
    
    return getOrgEntitlements(billingState);
  }, [isLoaded, organization]);
}

/**
 * Hook to check if a specific feature is available
 */
export function useHasFeature(featureKey: FeatureKey): boolean {
  const entitlements = useOrgEntitlements();
  
  if (!entitlements) {
    return false;
  }
  
  return hasFeature(entitlements, featureKey);
}

/**
 * Hook to check if a limit has been reached
 */
export function useIsLimitReached(limitKey: LimitKey, currentCount: number): boolean {
  const entitlements = useOrgEntitlements();
  
  if (!entitlements) {
    return true; // Assume limit reached if we can't check
  }
  
  return isLimitReached(entitlements, limitKey, currentCount);
}

/**
 * Hook to get upgrade info for a locked feature
 */
export function useUpgradeInfo(featureKey: FeatureKey): {
  isLocked: boolean;
  requiredPlan: CoachTier;
  requiredPlanName: string;
  requiredPlanPrice: number;
  currentPlan: CoachTier | null;
} {
  const entitlements = useOrgEntitlements();
  
  const requiredPlan = getRequiredTierForFeature(featureKey);
  const pricing = PLAN_PRICING[requiredPlan];
  
  if (!entitlements) {
    return {
      isLocked: true,
      requiredPlan,
      requiredPlanName: pricing.name,
      requiredPlanPrice: pricing.monthly,
      currentPlan: null,
    };
  }
  
  return {
    isLocked: !hasFeature(entitlements, featureKey),
    requiredPlan,
    requiredPlanName: pricing.name,
    requiredPlanPrice: pricing.monthly,
    currentPlan: entitlements.plan,
  };
}

/**
 * Hook to check subscription status
 */
export function useSubscriptionStatus(): {
  isLoaded: boolean;
  isActive: boolean;
  status: CoachSubscriptionStatus | null;
  plan: CoachTier | null;
  planName: string | null;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
} {
  const entitlements = useOrgEntitlements();
  const { isLoaded } = useOrganization();
  
  if (!entitlements) {
    return {
      isLoaded,
      isActive: false,
      status: null,
      plan: null,
      planName: null,
      trialEnd: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };
  }
  
  return {
    isLoaded: true,
    isActive: entitlements.isActive,
    status: entitlements.subscriptionStatus,
    plan: entitlements.plan,
    planName: entitlements.planName,
    trialEnd: entitlements.trialEnd,
    currentPeriodEnd: entitlements.currentPeriodEnd,
    cancelAtPeriodEnd: entitlements.cancelAtPeriodEnd,
  };
}

/**
 * Hook to check if user can perform an action based on limits
 */
export function useCanCreate(limitKey: LimitKey, currentCount: number): {
  canCreate: boolean;
  remaining: number;
  limit: number;
  isUnlimited: boolean;
  nextPlan: CoachTier | null;
} {
  const entitlements = useOrgEntitlements();
  
  if (!entitlements) {
    return {
      canCreate: false,
      remaining: 0,
      limit: 0,
      isUnlimited: false,
      nextPlan: null,
    };
  }
  
  const limit = entitlements.limits[limitKey];
  const isUnlimited = limit === -1;
  const canCreate = isUnlimited || currentCount < limit;
  const remaining = isUnlimited ? -1 : Math.max(0, limit - currentCount);
  const nextPlan = !canCreate ? getNextTier(entitlements.plan) : null;
  
  return {
    canCreate,
    remaining,
    limit,
    isUnlimited,
    nextPlan,
  };
}

