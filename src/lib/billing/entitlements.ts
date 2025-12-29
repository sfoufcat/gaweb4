/**
 * Entitlements System
 * 
 * The SINGLE SOURCE OF TRUTH for plan gating across the entire platform.
 * All UI and API checks must use this module.
 * 
 * Plans:
 * - Starter: $49/mo - Basic features
 * - Pro: $129/mo - Custom domain, email whitelabeling, advanced funnels
 * - Scale: $299/mo - Team roles, multi-coach, AI helper, priority support
 */

import type { CoachTier, CoachSubscriptionStatus } from '@/types';

// =============================================================================
// PLAN FEATURE DEFINITIONS (Exact features per plan)
// =============================================================================

/**
 * Features included in Starter plan
 */
export const STARTER_FEATURES = [
  'Accountability + check-ins (morning/evening/weekly)',
  'Programs + Masterminds + Squads',
  'Tasks + habits (incl. program-assigned)',
  'Social feed + chat + voice/video calls',
  'Courses + events + articles',
  'Custom funnels (basic steps)',
  'Basic analytics',
  'Stripe Connect payments',
] as const;

/**
 * Features added in Pro plan (on top of Starter)
 */
export const PRO_ADDED_FEATURES = [
  'Custom domain',
  'Email white labeling',
  'Advanced funnel steps (Identity, Analyzing, Plan Reveal)',
  'Upsells + downsells',
] as const;

/**
 * Features added in Scale plan (on top of Pro)
 */
export const SCALE_ADDED_FEATURES = [
  'Team roles + permissions',
  'Multi-coach support',
  'Higher limits (members/programs/funnels/content/storage)',
  'AI Builder / AI Helper',
  'Priority support',
] as const;

// =============================================================================
// PLAN LIMITS
// =============================================================================

export interface PlanLimits {
  maxClients: number;      // -1 = unlimited
  maxPrograms: number;
  maxMasterminds: number;
  maxSquads: number;
  maxFunnelsPerTarget: number;
  maxContentItems: number; // courses, articles, events
  maxStorageMB: number;    // -1 = unlimited
  maxCoaches: number;      // additional coaches beyond owner
}

export const PLAN_LIMITS: Record<CoachTier, PlanLimits> = {
  starter: {
    maxClients: 15,
    maxPrograms: 2,
    maxMasterminds: 1,
    maxSquads: 3,
    maxFunnelsPerTarget: 1,
    maxContentItems: 20,
    maxStorageMB: 500,
    maxCoaches: 0, // No additional coaches
  },
  pro: {
    maxClients: 150,
    maxPrograms: 10,
    maxMasterminds: 5,
    maxSquads: 25,
    maxFunnelsPerTarget: 5,
    maxContentItems: 100,
    maxStorageMB: 5000,
    maxCoaches: 0, // Still no additional coaches
  },
  scale: {
    maxClients: 500,
    maxPrograms: 50,
    maxMasterminds: 20,
    maxSquads: 100,
    maxFunnelsPerTarget: -1, // Unlimited
    maxContentItems: -1, // Unlimited
    maxStorageMB: -1, // Unlimited
    maxCoaches: 10, // Can add up to 10 coaches
  },
};

// =============================================================================
// FEATURE FLAGS (Boolean permissions)
// =============================================================================

export interface PlanFeatures {
  // Pro+ features
  customDomain: boolean;
  emailWhitelabel: boolean;
  advancedFunnelSteps: boolean;  // identity, analyzing, plan_reveal
  upsellsDownsells: boolean;
  
  // Scale only features
  teamRolesPermissions: boolean;
  multiCoachSupport: boolean;
  aiHelper: boolean;
  prioritySupport: boolean;
  
  // Always available (listed for clarity)
  stripeConnect: boolean;
  basicAnalytics: boolean;
}

export const PLAN_FEATURES: Record<CoachTier, PlanFeatures> = {
  starter: {
    customDomain: false,
    emailWhitelabel: false,
    advancedFunnelSteps: false,
    upsellsDownsells: false,
    teamRolesPermissions: false,
    multiCoachSupport: false,
    aiHelper: false,
    prioritySupport: false,
    stripeConnect: true,
    basicAnalytics: true,
  },
  pro: {
    customDomain: true,
    emailWhitelabel: true,
    advancedFunnelSteps: true,
    upsellsDownsells: true,
    teamRolesPermissions: false,
    multiCoachSupport: false,
    aiHelper: false,
    prioritySupport: false,
    stripeConnect: true,
    basicAnalytics: true,
  },
  scale: {
    customDomain: true,
    emailWhitelabel: true,
    advancedFunnelSteps: true,
    upsellsDownsells: true,
    teamRolesPermissions: true,
    multiCoachSupport: true,
    aiHelper: true,
    prioritySupport: true,
    stripeConnect: true,
    basicAnalytics: true,
  },
};

// =============================================================================
// PRICING
// =============================================================================

export interface PlanPricing {
  name: string;
  monthly: number; // in cents
  description: string;
}

export const PLAN_PRICING: Record<CoachTier, PlanPricing> = {
  starter: {
    name: 'Starter',
    monthly: 4900, // $49
    description: 'Perfect for coaches just starting out',
  },
  pro: {
    name: 'Pro',
    monthly: 12900, // $129
    description: 'For growing coaching businesses',
  },
  scale: {
    name: 'Scale',
    monthly: 29900, // $299
    description: 'For established coaching operations',
  },
};

// =============================================================================
// ENTITLEMENTS INTERFACE
// =============================================================================

export interface OrgEntitlements {
  // Plan info
  plan: CoachTier;
  planName: string;
  
  // Subscription status
  subscriptionStatus: CoachSubscriptionStatus;
  isActive: boolean;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  
  // Features (boolean flags)
  features: PlanFeatures;
  
  // Limits (numeric)
  limits: PlanLimits;
  
  // Computed convenience flags
  canUseCustomDomain: boolean;
  canUseEmailWhitelabel: boolean;
  canUseAdvancedFunnels: boolean;
  canAddCoach: boolean;
  canUseAIHelper: boolean;
  canChangeRoles: boolean;
  hasPrioritySupport: boolean;
}

// =============================================================================
// SUBSCRIPTION STATUS HELPERS
// =============================================================================

/**
 * Check if subscription grants active access
 * Access is granted if:
 * - status is 'active' or 'trialing'
 * - OR status is 'canceled' but still within paid period
 */
export function isSubscriptionActive(
  status: CoachSubscriptionStatus | undefined,
  currentPeriodEnd: string | null | undefined,
  cancelAtPeriodEnd: boolean | undefined
): boolean {
  // Active or trialing = full access
  if (status === 'active' || status === 'trialing') {
    return true;
  }
  
  // Canceled but still in paid period
  if ((status === 'canceled' || cancelAtPeriodEnd) && currentPeriodEnd) {
    const endDate = new Date(currentPeriodEnd);
    const now = new Date();
    return endDate > now;
  }
  
  return false;
}

// =============================================================================
// GET ENTITLEMENTS
// =============================================================================

export interface OrgBillingState {
  plan: CoachTier;
  subscriptionStatus: CoachSubscriptionStatus;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

/**
 * Get full entitlements for an organization
 * This is the ONLY function that should determine what an org can do
 */
export function getOrgEntitlements(billingState: OrgBillingState): OrgEntitlements {
  const { plan, subscriptionStatus, currentPeriodEnd, trialEnd, cancelAtPeriodEnd } = billingState;
  
  const isActive = isSubscriptionActive(subscriptionStatus, currentPeriodEnd, cancelAtPeriodEnd);
  const features = PLAN_FEATURES[plan];
  const limits = PLAN_LIMITS[plan];
  const pricing = PLAN_PRICING[plan];
  
  return {
    plan,
    planName: pricing.name,
    subscriptionStatus,
    isActive,
    currentPeriodEnd,
    trialEnd,
    cancelAtPeriodEnd,
    features,
    limits,
    
    // Computed convenience flags (only if subscription is active)
    canUseCustomDomain: isActive && features.customDomain,
    canUseEmailWhitelabel: isActive && features.emailWhitelabel,
    canUseAdvancedFunnels: isActive && features.advancedFunnelSteps,
    canAddCoach: isActive && features.multiCoachSupport,
    canUseAIHelper: isActive && features.aiHelper,
    canChangeRoles: isActive && features.teamRolesPermissions,
    hasPrioritySupport: isActive && features.prioritySupport,
  };
}

// =============================================================================
// LIMIT CHECKING
// =============================================================================

export type LimitKey = keyof PlanLimits;

/**
 * Check if a limit has been reached
 * Returns false if unlimited (-1)
 */
export function isLimitReached(
  entitlements: OrgEntitlements,
  limitKey: LimitKey,
  currentCount: number
): boolean {
  const limit = entitlements.limits[limitKey];
  if (limit === -1) return false; // Unlimited
  return currentCount >= limit;
}

/**
 * Get remaining capacity for a limit
 * Returns -1 if unlimited
 */
export function getRemainingCapacity(
  entitlements: OrgEntitlements,
  limitKey: LimitKey,
  currentCount: number
): number {
  const limit = entitlements.limits[limitKey];
  if (limit === -1) return -1; // Unlimited
  return Math.max(0, limit - currentCount);
}

/**
 * Get usage percentage (0-100)
 * Returns 0 if unlimited
 */
export function getUsagePercent(
  entitlements: OrgEntitlements,
  limitKey: LimitKey,
  currentCount: number
): number {
  const limit = entitlements.limits[limitKey];
  if (limit === -1 || limit === 0) return 0;
  return Math.min(100, Math.round((currentCount / limit) * 100));
}

// =============================================================================
// FEATURE CHECKING
// =============================================================================

export type FeatureKey = keyof PlanFeatures;

/**
 * Check if a feature is available
 * Note: This checks if the feature is in the plan, but also requires active subscription
 */
export function hasFeature(
  entitlements: OrgEntitlements,
  featureKey: FeatureKey
): boolean {
  if (!entitlements.isActive) return false;
  return entitlements.features[featureKey];
}

/**
 * Get the minimum tier required for a feature
 */
export function getRequiredTierForFeature(featureKey: FeatureKey): CoachTier {
  if (PLAN_FEATURES.starter[featureKey]) return 'starter';
  if (PLAN_FEATURES.pro[featureKey]) return 'pro';
  return 'scale';
}

// =============================================================================
// UPGRADE HELPERS
// =============================================================================

const TIER_ORDER: CoachTier[] = ['starter', 'pro', 'scale'];

/**
 * Get the next tier up for upgrade prompts
 */
export function getNextTier(currentTier: CoachTier): CoachTier | null {
  const currentIndex = TIER_ORDER.indexOf(currentTier);
  if (currentIndex === -1 || currentIndex === TIER_ORDER.length - 1) {
    return null;
  }
  return TIER_ORDER[currentIndex + 1];
}

/**
 * Check if target tier is higher than current tier
 */
export function isUpgrade(currentTier: CoachTier, targetTier: CoachTier): boolean {
  const currentIndex = TIER_ORDER.indexOf(currentTier);
  const targetIndex = TIER_ORDER.indexOf(targetTier);
  return targetIndex > currentIndex;
}

// =============================================================================
// ERROR CODES
// =============================================================================

export const ENTITLEMENT_ERROR_CODES = {
  PLAN_FEATURE_LOCKED: 'PLAN_FEATURE_LOCKED',
  PLAN_LIMIT: 'PLAN_LIMIT',
  SUBSCRIPTION_INACTIVE: 'SUBSCRIPTION_INACTIVE',
} as const;

export type EntitlementErrorCode = keyof typeof ENTITLEMENT_ERROR_CODES;

export interface EntitlementError {
  code: EntitlementErrorCode;
  message: string;
  requiredPlan?: CoachTier;
  currentPlan?: CoachTier;
  limit?: number;
  currentUsage?: number;
  // Additional limit-specific fields (used by requirePlanLimit)
  limitKey?: LimitKey;
  maxLimit?: number;
  currentCount?: number;
}

/**
 * Create a standardized entitlement error
 */
export function createEntitlementError(
  code: EntitlementErrorCode,
  message: string,
  details?: Partial<Omit<EntitlementError, 'code' | 'message'>>
): EntitlementError {
  return {
    code,
    message,
    ...details,
  };
}

// =============================================================================
// FUNNEL STEP GATING
// =============================================================================

/**
 * Funnel step types that require Pro+ tier
 */
export const ADVANCED_FUNNEL_STEPS = [
  'identity',
  'analyzing',
  'plan_reveal',
  'transformation',
  'upsell',
  'downsell',
] as const;

export type AdvancedFunnelStep = typeof ADVANCED_FUNNEL_STEPS[number];

/**
 * Check if a funnel step type is allowed for an org
 */
export function canUseFunnelStep(
  entitlements: OrgEntitlements,
  stepType: string
): boolean {
  // Basic steps always allowed
  const basicSteps = ['signup', 'payment', 'success', 'question', 'info', 'goal_setting'];
  if (basicSteps.includes(stepType)) {
    return true;
  }
  
  // Advanced steps require Pro+ with active subscription
  if (ADVANCED_FUNNEL_STEPS.includes(stepType as AdvancedFunnelStep)) {
    return entitlements.canUseAdvancedFunnels;
  }
  
  // Unknown step type - allow by default
  return true;
}

/**
 * Get list of funnel steps that are locked for an org
 */
export function getLockedFunnelSteps(entitlements: OrgEntitlements): AdvancedFunnelStep[] {
  if (entitlements.canUseAdvancedFunnels) {
    return [];
  }
  return [...ADVANCED_FUNNEL_STEPS];
}

