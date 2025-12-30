/**
 * Coach Permissions System
 * 
 * Flexible permission registry for coach tiers.
 * Add new permissions by extending PermissionKey type and TIER_PERMISSIONS.
 */

import type { CoachTier } from '@/types';

// =============================================================================
// PERMISSION KEYS
// =============================================================================

/**
 * All gatable permissions in the system.
 * Add new keys here when adding new features to gate.
 */
export type PermissionKey =
  // Limits (numeric)
  | 'max_clients'
  | 'max_programs'
  | 'max_squads'
  | 'max_funnels_per_target'
  | 'max_order_bumps'
  // Platform features (boolean)
  | 'custom_domain'
  | 'email_whitelabel'
  | 'stripe_connect'
  // Funnel step permissions (boolean)
  | 'funnel_step_identity'
  | 'funnel_step_analyzing'
  | 'funnel_step_plan_reveal'
  | 'funnel_step_transformation'
  | 'funnel_custom_branding'
  // AI features (boolean)
  | 'ai_landing_page_generation'
  // Future features (boolean)
  | 'analytics_advanced'
  | 'ab_testing'
  | 'api_access';

/**
 * Permission value can be boolean (feature flag) or number (limit)
 * -1 means unlimited
 */
export type PermissionValue = boolean | number;

// =============================================================================
// TIER PRICING
// =============================================================================

/**
 * Tier pricing in cents
 */
export const TIER_PRICING: Record<CoachTier, { monthly: number; name: string; description: string }> = {
  starter: {
    monthly: 4900, // $49
    name: 'Starter',
    description: 'Perfect for coaches just starting out',
  },
  pro: {
    monthly: 12900, // $129
    name: 'Pro',
    description: 'For growing coaching businesses',
  },
  scale: {
    monthly: 29900, // $299
    name: 'Scale',
    description: 'For established coaching operations',
  },
};

// =============================================================================
// TIER PERMISSIONS REGISTRY
// =============================================================================

/**
 * Master permission registry for all tiers.
 * This is the single source of truth for what each tier can do.
 * 
 * Numbers:
 * - Positive number = limit
 * - -1 = unlimited
 * 
 * Booleans:
 * - true = feature enabled
 * - false = feature disabled
 */
export const TIER_PERMISSIONS: Record<CoachTier, Record<PermissionKey, PermissionValue>> = {
  starter: {
    // Limits
    max_clients: 15,
    max_programs: 2,
    max_squads: 3,
    max_funnels_per_target: 1,
    max_order_bumps: 1, // Starter gets 1 order bump per product
    // Platform features
    custom_domain: false,
    email_whitelabel: false,
    stripe_connect: true,  // All tiers can accept payments via Stripe Connect
    // Funnel steps - Starter gets basic steps + question/input/goal but NOT identity
    funnel_step_identity: false,
    funnel_step_analyzing: false,
    funnel_step_plan_reveal: false,
    funnel_step_transformation: false,
    funnel_custom_branding: true, // Starter CAN customize funnel branding
    // AI features
    ai_landing_page_generation: false, // Pro/Scale only
    // Future features
    analytics_advanced: false,
    ab_testing: false,
    api_access: false,
  },
  pro: {
    // Limits
    max_clients: 150,
    max_programs: 10,
    max_squads: 25,
    max_funnels_per_target: 5,
    max_order_bumps: 2, // Pro gets 2 order bumps per product
    // Platform features
    custom_domain: true,
    email_whitelabel: true,
    stripe_connect: true,
    // Funnel steps - Pro gets all steps
    funnel_step_identity: true,
    funnel_step_analyzing: true,
    funnel_step_plan_reveal: true,
    funnel_step_transformation: true,
    funnel_custom_branding: true,
    // AI features
    ai_landing_page_generation: true,
    // Future features
    analytics_advanced: false,
    ab_testing: false,
    api_access: false,
  },
  scale: {
    // Limits (-1 = unlimited, but with reasonable soft caps)
    max_clients: 500,
    max_programs: 50,
    max_squads: 100,
    max_funnels_per_target: -1, // Unlimited
    max_order_bumps: 2, // Scale gets 2 order bumps per product (same as Pro)
    // Platform features
    custom_domain: true,
    email_whitelabel: true,
    stripe_connect: true,
    // Funnel steps - Scale gets all steps
    funnel_step_identity: true,
    funnel_step_analyzing: true,
    funnel_step_plan_reveal: true,
    funnel_step_transformation: true,
    funnel_custom_branding: true,
    // AI features
    ai_landing_page_generation: true,
    // Future features
    analytics_advanced: true,
    ab_testing: true,
    api_access: true,
  },
};

// =============================================================================
// PERMISSION UTILITIES
// =============================================================================

/**
 * Check if a tier has a boolean permission
 */
export function hasPermission(tier: CoachTier, key: PermissionKey): boolean {
  const value = TIER_PERMISSIONS[tier][key];
  return typeof value === 'boolean' ? value : value > 0 || value === -1;
}

/**
 * Get the numeric limit for a permission
 * Returns -1 for unlimited, 0 if not applicable
 */
export function getLimit(tier: CoachTier, key: PermissionKey): number {
  const value = TIER_PERMISSIONS[tier][key];
  return typeof value === 'number' ? value : 0;
}

/**
 * Check if a limit has been reached
 * Returns false if unlimited (-1) or under limit
 */
export function isLimitReached(tier: CoachTier, key: PermissionKey, currentCount: number): boolean {
  const limit = getLimit(tier, key);
  if (limit === -1) return false; // Unlimited
  return currentCount >= limit;
}

/**
 * Get remaining capacity for a limit
 * Returns -1 if unlimited
 */
export function getRemainingCapacity(tier: CoachTier, key: PermissionKey, currentCount: number): number {
  const limit = getLimit(tier, key);
  if (limit === -1) return -1; // Unlimited
  return Math.max(0, limit - currentCount);
}

/**
 * Get usage percentage (0-100)
 * Returns 0 if unlimited
 */
export function getUsagePercent(tier: CoachTier, key: PermissionKey, currentCount: number): number {
  const limit = getLimit(tier, key);
  if (limit === -1 || limit === 0) return 0;
  return Math.min(100, Math.round((currentCount / limit) * 100));
}

/**
 * Check if approaching limit (> 80% used)
 */
export function isApproachingLimit(tier: CoachTier, key: PermissionKey, currentCount: number): boolean {
  const percent = getUsagePercent(tier, key, currentCount);
  return percent >= 80 && percent < 100;
}

// =============================================================================
// FUNNEL STEP PERMISSION HELPERS
// =============================================================================

/**
 * Funnel step types that require tier permissions
 */
export const GATED_FUNNEL_STEPS = [
  'identity',
  'analyzing',
  'plan_reveal',
  'transformation',
] as const;

export type GatedFunnelStep = typeof GATED_FUNNEL_STEPS[number];

/**
 * Check if a funnel step type is allowed for a tier
 */
export function canUseFunnelStep(tier: CoachTier, stepType: string): boolean {
  // Steps that are always allowed
  const alwaysAllowed = [
    'signup',
    'payment',
    'success',
    'question',
    'info',
    'goal_setting',
  ];
  
  if (alwaysAllowed.includes(stepType)) {
    return true;
  }
  
  // Check gated steps
  const permissionKey = `funnel_step_${stepType}` as PermissionKey;
  if (permissionKey in TIER_PERMISSIONS[tier]) {
    return hasPermission(tier, permissionKey);
  }
  
  // Unknown step type - allow by default
  return true;
}

/**
 * Get list of funnel steps that are locked for a tier
 */
export function getLockedFunnelSteps(tier: CoachTier): GatedFunnelStep[] {
  return GATED_FUNNEL_STEPS.filter(step => !canUseFunnelStep(tier, step));
}

// =============================================================================
// TIER COMPARISON UTILITIES
// =============================================================================

/**
 * Tier hierarchy for comparison
 */
const TIER_ORDER: CoachTier[] = ['starter', 'pro', 'scale'];

/**
 * Get the next tier up (for upgrade prompts)
 * Returns null if already on highest tier
 */
export function getNextTier(currentTier: CoachTier): CoachTier | null {
  const currentIndex = TIER_ORDER.indexOf(currentTier);
  if (currentIndex === -1 || currentIndex === TIER_ORDER.length - 1) {
    return null;
  }
  return TIER_ORDER[currentIndex + 1];
}

/**
 * Get the minimum tier required for a permission
 */
export function getRequiredTier(key: PermissionKey): CoachTier {
  for (const tier of TIER_ORDER) {
    if (hasPermission(tier, key)) {
      return tier;
    }
  }
  return 'scale'; // Fallback to highest tier
}

/**
 * Check if upgrading would unlock a specific permission
 */
export function wouldUpgradeUnlock(currentTier: CoachTier, key: PermissionKey): boolean {
  if (hasPermission(currentTier, key)) return false;
  const nextTier = getNextTier(currentTier);
  return nextTier ? hasPermission(nextTier, key) : false;
}

/**
 * Get all permissions that would be unlocked by upgrading
 */
export function getUpgradeUnlocks(currentTier: CoachTier): PermissionKey[] {
  const nextTier = getNextTier(currentTier);
  if (!nextTier) return [];
  
  const unlocks: PermissionKey[] = [];
  const keys = Object.keys(TIER_PERMISSIONS[currentTier]) as PermissionKey[];
  
  for (const key of keys) {
    if (!hasPermission(currentTier, key) && hasPermission(nextTier, key)) {
      unlocks.push(key);
    }
  }
  
  return unlocks;
}

// =============================================================================
// DISPLAY HELPERS
// =============================================================================

/**
 * Human-readable names for permission keys
 */
export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  max_clients: 'Active Clients',
  max_programs: 'Programs',
  max_squads: 'Squads',
  max_funnels_per_target: 'Funnels per Program/Squad',
  max_order_bumps: 'Order Bumps per Product',
  custom_domain: 'Custom Domain',
  email_whitelabel: 'Email Whitelabeling',
  stripe_connect: 'Stripe Connect',
  funnel_step_identity: 'Identity Step',
  funnel_step_analyzing: 'Analyzing Step',
  funnel_step_plan_reveal: 'Plan Reveal Step',
  funnel_step_transformation: 'Transformation Step',
  funnel_custom_branding: 'Custom Funnel Branding',
  ai_landing_page_generation: 'AI Landing Page Generation',
  analytics_advanced: 'Advanced Analytics',
  ab_testing: 'A/B Testing',
  api_access: 'API Access',
};

/**
 * Format a limit value for display
 */
export function formatLimitValue(value: PermissionValue): string {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (value === -1) {
    return 'Unlimited';
  }
  return value.toLocaleString();
}

/**
 * Get tier display info
 */
export function getTierDisplayInfo(tier: CoachTier) {
  return {
    ...TIER_PRICING[tier],
    limits: {
      clients: getLimit(tier, 'max_clients'),
      programs: getLimit(tier, 'max_programs'),
      squads: getLimit(tier, 'max_squads'),
      funnels: getLimit(tier, 'max_funnels_per_target'),
    },
    features: {
      customDomain: hasPermission(tier, 'custom_domain'),
      emailWhitelabel: hasPermission(tier, 'email_whitelabel'),
      stripeConnect: hasPermission(tier, 'stripe_connect'),
      advancedAnalytics: hasPermission(tier, 'analytics_advanced'),
      abTesting: hasPermission(tier, 'ab_testing'),
      apiAccess: hasPermission(tier, 'api_access'),
    },
  };
}

