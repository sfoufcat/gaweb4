'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'expired' | 'none';
export type ResourceType = 'squad' | 'program';

interface SubscriptionAccessState {
  /** Whether the access check is loading */
  isLoading: boolean;
  /** Whether the user has valid access */
  hasAccess: boolean;
  /** Current subscription status */
  subscriptionStatus: SubscriptionStatus;
  /** When access ends (for grace periods or cancellations) */
  accessEndsAt?: string;
  /** When current billing period ends */
  currentPeriodEnd?: string;
  /** Number of days until access ends */
  daysRemaining?: number;
  /** Whether subscription is set to cancel at period end */
  cancelAtPeriodEnd?: boolean;
  /** Error message if any */
  error?: string;
}

interface UseSubscriptionAccessOptions {
  /** Resource type (squad or program) */
  resourceType: ResourceType;
  /** Resource ID */
  resourceId: string;
  /** Whether to auto-redirect on expired access */
  redirectOnExpired?: boolean;
  /** Whether to skip the check entirely (for free resources) */
  skip?: boolean;
}

/**
 * useSubscriptionAccess - Hook to check and manage subscription access for squads/programs
 * 
 * This hook:
 * - Fetches the user's subscription status for a specific resource
 * - Calculates remaining access time
 * - Optionally redirects on expired access
 * - Provides state for UI components (banners, blocking)
 * 
 * @example
 * ```tsx
 * const { hasAccess, subscriptionStatus, accessEndsAt } = useSubscriptionAccess({
 *   resourceType: 'squad',
 *   resourceId: squadId,
 *   redirectOnExpired: true,
 * });
 * 
 * if (!hasAccess && subscriptionStatus === 'expired') {
 *   return <AccessBlockedUI />;
 * }
 * ```
 */
export function useSubscriptionAccess({
  resourceType,
  resourceId,
  redirectOnExpired = false,
  skip = false,
}: UseSubscriptionAccessOptions): SubscriptionAccessState {
  const { userId, isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  
  const [state, setState] = useState<SubscriptionAccessState>({
    isLoading: true,
    hasAccess: true, // Default to true to avoid flash of blocked content
    subscriptionStatus: 'none',
  });

  const checkAccess = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId || !resourceId || skip) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasAccess: !isLoaded || skip, // Allow access if skipped or not loaded
        subscriptionStatus: 'none',
      }));
      return;
    }

    try {
      // Fetch membership/enrollment details
      const endpoint = resourceType === 'squad'
        ? `/api/squad/${resourceId}/membership`
        : `/api/programs/enrollments/check?programId=${resourceId}`;

      const response = await fetch(endpoint);
      
      if (!response.ok) {
        if (response.status === 404) {
          // User is not a member/enrolled
          setState({
            isLoading: false,
            hasAccess: false,
            subscriptionStatus: 'none',
          });
          return;
        }
        throw new Error('Failed to check access');
      }

      const data = await response.json();

      // Check if user is a member/enrolled
      const isMemberOrEnrolled = resourceType === 'squad' 
        ? data.isMember 
        : data.isEnrolled;

      if (!isMemberOrEnrolled) {
        setState({
          isLoading: false,
          hasAccess: false,
          subscriptionStatus: 'none',
        });
        return;
      }
      
      // Extract subscription info
      const subscriptionStatus = (data.subscriptionStatus || 'none') as SubscriptionStatus;
      const accessEndsAt = data.accessEndsAt;
      const currentPeriodEnd = data.currentPeriodEnd;
      const cancelAtPeriodEnd = data.cancelAtPeriodEnd;

      // Calculate days remaining
      let daysRemaining: number | undefined;
      const endDate = accessEndsAt || currentPeriodEnd;
      if (endDate && (subscriptionStatus === 'past_due' || subscriptionStatus === 'canceled')) {
        const end = new Date(endDate);
        const now = new Date();
        daysRemaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      }

      // Determine if user has access
      let hasAccess = true;
      
      // No subscription info means it's a free resource or one-time payment
      if (subscriptionStatus === 'none' || subscriptionStatus === 'active') {
        hasAccess = true;
      } else if (subscriptionStatus === 'past_due') {
        // Grace period - allow access but show warning
        if (accessEndsAt) {
          hasAccess = new Date(accessEndsAt) > new Date();
        } else {
          hasAccess = true; // Default 3-day grace period
        }
      } else if (subscriptionStatus === 'canceled') {
        // Canceled - allow access until period end
        if (currentPeriodEnd) {
          hasAccess = new Date(currentPeriodEnd) > new Date();
        } else {
          hasAccess = false;
        }
      } else if (subscriptionStatus === 'expired') {
        hasAccess = false;
      }

      setState({
        isLoading: false,
        hasAccess,
        subscriptionStatus,
        accessEndsAt,
        currentPeriodEnd,
        daysRemaining,
        cancelAtPeriodEnd,
      });

      // Redirect if expired and option is enabled
      if (!hasAccess && subscriptionStatus === 'expired' && redirectOnExpired) {
        router.push(`/subscription-blocked?type=${resourceType}&id=${resourceId}&reason=expired`);
      }
    } catch (error) {
      console.error('[useSubscriptionAccess] Error:', error);
      setState({
        isLoading: false,
        hasAccess: true, // Default to allowing access on error
        subscriptionStatus: 'none',
        error: 'Failed to check subscription status',
      });
    }
  }, [isLoaded, isSignedIn, userId, resourceId, resourceType, skip, redirectOnExpired, router]);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  return state;
}

/**
 * useSquadSubscriptionAccess - Convenience wrapper for squad access
 */
export function useSquadSubscriptionAccess(
  squadId: string,
  options?: Omit<UseSubscriptionAccessOptions, 'resourceType' | 'resourceId'>
) {
  return useSubscriptionAccess({
    resourceType: 'squad',
    resourceId: squadId,
    ...options,
  });
}

/**
 * useProgramSubscriptionAccess - Convenience wrapper for program access
 */
export function useProgramSubscriptionAccess(
  programId: string,
  options?: Omit<UseSubscriptionAccessOptions, 'resourceType' | 'resourceId'>
) {
  return useSubscriptionAccess({
    resourceType: 'program',
    resourceId: programId,
    ...options,
  });
}

/**
 * Utility function to check if access should be blocked
 */
export function shouldBlockAccess(status: SubscriptionStatus, accessEndsAt?: string, currentPeriodEnd?: string): boolean {
  if (status === 'active' || status === 'none') {
    return false;
  }
  
  if (status === 'expired') {
    return true;
  }
  
  // Check if grace period or billing period has ended
  const endDate = accessEndsAt || currentPeriodEnd;
  if (endDate) {
    return new Date(endDate) <= new Date();
  }
  
  return false;
}

/**
 * Utility function to calculate days remaining
 */
export function calculateDaysRemaining(accessEndsAt?: string, currentPeriodEnd?: string): number | null {
  const endDate = accessEndsAt || currentPeriodEnd;
  if (!endDate) return null;
  
  const end = new Date(endDate);
  const now = new Date();
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

