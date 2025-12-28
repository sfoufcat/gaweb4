/**
 * Analytics Constants
 * 
 * Centralized configuration for analytics thresholds and settings.
 */

// ============================================================================
// HEALTH STATUS THRESHOLDS
// ============================================================================

export const SQUAD_HEALTH_THRESHOLDS = {
  // Activity rate >= 70% = thriving
  thriving: 70,
  // Activity rate >= 40% = active  
  active: 40,
  // Activity rate < 40% = inactive
} as const;

export const CLIENT_HEALTH_THRESHOLDS = {
  // Days active in last 7 days >= 4 = thriving
  thrivingDays: 4,
  // At least 3 distinct activity types = thriving (alternative)
  thrivingActivityTypes: 3,
} as const;

// ============================================================================
// TIME PERIODS
// ============================================================================

export const ANALYTICS_PERIODS = {
  // Default lookback for activity checks
  defaultLookbackDays: 7,
  // Days to keep detailed analytics snapshots
  snapshotRetentionDays: 90,
} as const;

// ============================================================================
// COLLECTION NAMES
// ============================================================================

export const ANALYTICS_COLLECTIONS = {
  // Daily org-level snapshots
  orgSnapshots: 'org_analytics_snapshots',
  // Daily squad-level snapshots
  squadSnapshots: 'squad_analytics',
  // Daily program-level snapshots
  programSnapshots: 'program_analytics_snapshots',
  // Funnel events for tracking
  funnelEvents: 'funnel_events',
  // GA configuration per org
  gaConfig: 'org_ga_config',
} as const;

// ============================================================================
// STATUS TYPES
// ============================================================================

export type HealthStatus = 'thriving' | 'active' | 'inactive';
export type ActivitySignalType = 'task' | 'habit' | 'checkin' | 'weekly';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determine squad health status based on activity rate
 */
export function getSquadHealthStatus(activityRate: number): HealthStatus {
  if (activityRate >= SQUAD_HEALTH_THRESHOLDS.thriving) return 'thriving';
  if (activityRate >= SQUAD_HEALTH_THRESHOLDS.active) return 'active';
  return 'inactive';
}

/**
 * Determine client health status based on days active
 */
export function getClientHealthStatus(
  daysActive: number, 
  activityTypesCount: number
): HealthStatus {
  if (daysActive >= CLIENT_HEALTH_THRESHOLDS.thrivingDays) return 'thriving';
  if (activityTypesCount >= CLIENT_HEALTH_THRESHOLDS.thrivingActivityTypes) return 'thriving';
  if (daysActive > 0 || activityTypesCount > 0) return 'active';
  return 'inactive';
}

/**
 * Get color for health status (for UI)
 */
export function getHealthStatusColor(status: HealthStatus): string {
  switch (status) {
    case 'thriving': return 'emerald';
    case 'active': return 'amber';
    case 'inactive': return 'red';
  }
}

/**
 * Get label for health status
 */
export function getHealthStatusLabel(status: HealthStatus): string {
  switch (status) {
    case 'thriving': return 'Thriving';
    case 'active': return 'Active';
    case 'inactive': return 'Inactive';
  }
}


