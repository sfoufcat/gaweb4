/**
 * User Access Validation System
 * 
 * Utilities for checking and syncing user access to organizations.
 * Access is granted via:
 * 1. Active program enrollment
 * 2. Active squad membership
 * 3. Coach assignment (staff roles)
 */

import { adminDb } from '@/lib/firebase-admin';
import type { OrgMembership, UserAccessReason, OrgRole } from '@/types';

// =============================================================================
// ACCESS CHECK RESULT TYPE
// =============================================================================

export interface AccessCheckResult {
  hasAccess: boolean;
  reason: UserAccessReason;
  details?: {
    programId?: string;
    programName?: string;
    squadId?: string;
    squadName?: string;
    enrollmentStatus?: string;
  };
}

// =============================================================================
// ACCESS VALIDATION
// =============================================================================

/**
 * Check if a user has active access to an organization
 * Access is granted if user has:
 * 1. An active program enrollment in the org
 * 2. An active squad membership in the org
 * 3. A staff role (coach, super_coach)
 */
export async function checkUserAccess(
  userId: string,
  organizationId: string
): Promise<AccessCheckResult> {
  // First check if user has a membership record
  const membershipSnapshot = await adminDb
    .collection('org_memberships')
    .where('userId', '==', userId)
    .where('organizationId', '==', organizationId)
    .limit(1)
    .get();

  if (membershipSnapshot.empty) {
    return { hasAccess: false, reason: 'none' };
  }

  const membership = membershipSnapshot.docs[0].data() as OrgMembership;

  // Staff roles always have access
  if (isStaffRole(membership.orgRole)) {
    return { hasAccess: true, reason: 'staff' };
  }

  // Check for active program enrollment
  const programAccess = await checkProgramAccess(userId, organizationId);
  if (programAccess.hasAccess) {
    return programAccess;
  }

  // Check for squad membership (direct squad assignment, not via program)
  const squadAccess = await checkSquadAccess(userId, organizationId, membership);
  if (squadAccess.hasAccess) {
    return squadAccess;
  }

  // Check for coach assignment
  if (membership.accessSource === 'manual' || membership.accessSource === 'invite_code') {
    // Coach manually granted access or user used invite code
    // Check if access hasn't expired
    if (membership.accessExpiresAt) {
      const expiresAt = new Date(membership.accessExpiresAt);
      if (expiresAt > new Date()) {
        return { hasAccess: true, reason: 'coach_assigned' };
      }
    } else {
      // No expiration - access is valid
      return { hasAccess: true, reason: 'coach_assigned' };
    }
  }

  return { hasAccess: false, reason: 'none' };
}

/**
 * Check if user has an active program enrollment in the org
 */
async function checkProgramAccess(
  userId: string,
  organizationId: string
): Promise<AccessCheckResult> {
  const enrollmentsSnapshot = await adminDb
    .collection('program_enrollments')
    .where('userId', '==', userId)
    .where('organizationId', '==', organizationId)
    .where('status', 'in', ['active', 'upcoming'])
    .limit(1)
    .get();

  if (!enrollmentsSnapshot.empty) {
    const enrollment = enrollmentsSnapshot.docs[0].data();
    
    // Get program name for details
    let programName: string | undefined;
    if (enrollment.programId) {
      const programDoc = await adminDb.collection('programs').doc(enrollment.programId).get();
      if (programDoc.exists) {
        programName = programDoc.data()?.name;
      }
    }

    return {
      hasAccess: true,
      reason: 'program',
      details: {
        programId: enrollment.programId,
        programName,
        enrollmentStatus: enrollment.status,
      },
    };
  }

  return { hasAccess: false, reason: 'none' };
}

/**
 * Check if user has direct squad membership (not via program)
 */
async function checkSquadAccess(
  userId: string,
  organizationId: string,
  membership: OrgMembership
): Promise<AccessCheckResult> {
  // Check squadId on membership
  const squadId = membership.squadId || membership.premiumSquadId;
  
  if (!squadId) {
    return { hasAccess: false, reason: 'none' };
  }

  // Verify squad exists and belongs to this org
  const squadDoc = await adminDb.collection('squads').doc(squadId).get();
  
  if (!squadDoc.exists) {
    return { hasAccess: false, reason: 'none' };
  }

  const squad = squadDoc.data();
  
  // Check squad belongs to same org
  if (squad?.organizationId !== organizationId) {
    return { hasAccess: false, reason: 'none' };
  }

  // Check squad is active
  if (squad?.isActive === false) {
    return { hasAccess: false, reason: 'none' };
  }

  return {
    hasAccess: true,
    reason: 'squad',
    details: {
      squadId,
      squadName: squad?.name,
    },
  };
}

/**
 * Check if role is a staff role (coach or higher)
 */
function isStaffRole(role: OrgRole): boolean {
  return role === 'coach' || role === 'super_coach';
}

// =============================================================================
// ACCESS STATUS SYNC
// =============================================================================

/**
 * Sync the hasActiveAccess field on org_membership
 * Call this when:
 * - Program enrollment changes
 * - Squad membership changes
 * - Coach grants/revokes access
 */
export async function syncAccessStatus(
  userId: string,
  organizationId: string
): Promise<{ updated: boolean; newStatus: AccessCheckResult }> {
  // Get current access status
  const accessCheck = await checkUserAccess(userId, organizationId);

  // Find the membership document
  const membershipSnapshot = await adminDb
    .collection('org_memberships')
    .where('userId', '==', userId)
    .where('organizationId', '==', organizationId)
    .limit(1)
    .get();

  if (membershipSnapshot.empty) {
    return { updated: false, newStatus: accessCheck };
  }

  const membershipDoc = membershipSnapshot.docs[0];
  const currentData = membershipDoc.data() as OrgMembership;

  // Check if update is needed
  if (
    currentData.hasActiveAccess === accessCheck.hasAccess &&
    currentData.accessReason === accessCheck.reason
  ) {
    return { updated: false, newStatus: accessCheck };
  }

  // Update the membership
  await membershipDoc.ref.update({
    hasActiveAccess: accessCheck.hasAccess,
    accessReason: accessCheck.reason,
    updatedAt: new Date().toISOString(),
  });

  console.log(
    `[USER_ACCESS] Updated access for user ${userId} in org ${organizationId}: ` +
    `hasAccess=${accessCheck.hasAccess}, reason=${accessCheck.reason}`
  );

  return { updated: true, newStatus: accessCheck };
}

/**
 * Batch sync access status for all members of an org
 * Useful when org settings change or for periodic maintenance
 */
export async function syncOrgAccessStatuses(
  organizationId: string
): Promise<{ total: number; updated: number }> {
  const membershipsSnapshot = await adminDb
    .collection('org_memberships')
    .where('organizationId', '==', organizationId)
    .get();

  let updated = 0;

  for (const doc of membershipsSnapshot.docs) {
    const membership = doc.data() as OrgMembership;
    const result = await syncAccessStatus(membership.userId, organizationId);
    if (result.updated) {
      updated++;
    }
  }

  return { total: membershipsSnapshot.size, updated };
}

// =============================================================================
// ACCESS GRANT/REVOKE
// =============================================================================

/**
 * Grant access to a user (coach assigns directly)
 */
export async function grantCoachAccess(
  userId: string,
  organizationId: string,
  options?: {
    expiresAt?: string;
    squadId?: string;
  }
): Promise<void> {
  const membershipSnapshot = await adminDb
    .collection('org_memberships')
    .where('userId', '==', userId)
    .where('organizationId', '==', organizationId)
    .limit(1)
    .get();

  if (membershipSnapshot.empty) {
    throw new Error('User is not a member of this organization');
  }

  const membershipDoc = membershipSnapshot.docs[0];
  const now = new Date().toISOString();

  await membershipDoc.ref.update({
    hasActiveAccess: true,
    accessReason: 'coach_assigned',
    accessSource: 'manual',
    accessExpiresAt: options?.expiresAt || null,
    squadId: options?.squadId || membershipDoc.data().squadId,
    updatedAt: now,
  });

  console.log(`[USER_ACCESS] Coach granted access to user ${userId} in org ${organizationId}`);
}

/**
 * Revoke access from a user
 */
export async function revokeAccess(
  userId: string,
  organizationId: string
): Promise<void> {
  const membershipSnapshot = await adminDb
    .collection('org_memberships')
    .where('userId', '==', userId)
    .where('organizationId', '==', organizationId)
    .limit(1)
    .get();

  if (membershipSnapshot.empty) {
    throw new Error('User is not a member of this organization');
  }

  const membershipDoc = membershipSnapshot.docs[0];

  await membershipDoc.ref.update({
    hasActiveAccess: false,
    accessReason: 'none',
    squadId: null,
    premiumSquadId: null,
    updatedAt: new Date().toISOString(),
  });

  console.log(`[USER_ACCESS] Revoked access for user ${userId} in org ${organizationId}`);
}

// =============================================================================
// DEFAULT FUNNEL REDIRECT
// =============================================================================

/**
 * Get the redirect URL for a user without access
 * Returns the org's default funnel URL or a fallback
 */
export async function getNoAccessRedirectUrl(
  organizationId: string,
  subdomain: string
): Promise<string> {
  // Get org settings for default funnel
  const settingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
  const settings = settingsDoc.data();

  if (settings?.defaultFunnelId) {
    // Get the funnel details
    const funnelDoc = await adminDb.collection('funnels').doc(settings.defaultFunnelId).get();
    
    if (funnelDoc.exists) {
      const funnel = funnelDoc.data();
      
      if (funnel?.targetType === 'squad' && funnel?.squadId) {
        // Squad funnel - get squad slug
        const squadDoc = await adminDb.collection('squads').doc(funnel.squadId).get();
        const squad = squadDoc.data();
        if (squad?.slug) {
          return `/join/squad/${squad.slug}/${funnel.slug}`;
        }
      } else if (funnel?.programId) {
        // Program funnel - get program slug
        const programDoc = await adminDb.collection('programs').doc(funnel.programId).get();
        const program = programDoc.data();
        if (program?.slug) {
          return `/join/${program.slug}/${funnel.slug}`;
        }
      }
    }
  }

  // Fallback: redirect to sign-in with a message
  return '/sign-in?access=required';
}

