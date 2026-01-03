/**
 * Enrollment Check Utility
 * 
 * Shared validation functions for checking if a user already owns
 * or is enrolled in programs, squads, or content.
 * 
 * Used across:
 * - /api/programs/verify-payment
 * - /api/funnel/create-payment-intent
 * - /api/funnel/upsell-charge
 * - /api/webhooks/stripe
 * - Funnel pages (server-side)
 */

import { adminDb } from '@/lib/firebase-admin';
import type { 
  ProgramEnrollment, 
  ContentPurchase, 
  ContentPurchaseType,
  NewProgramEnrollmentStatus,
} from '@/types';

// =============================================================================
// TYPES
// =============================================================================

export interface ExistingEnrollment {
  id: string;
  status: NewProgramEnrollmentStatus;
  cohortId: string | null;
  squadId: string | null;
  programId: string;
  startedAt: string;
  createdAt: string;
}

export interface EnrollmentCheckResult {
  exists: boolean;
  enrollment: ExistingEnrollment | null;
  /** Whether re-enrollment is allowed (e.g., for a different future cohort) */
  allowReEnrollment: boolean;
  /** Reason for blocking re-enrollment */
  reason?: string;
}

export interface SquadMembershipCheckResult {
  exists: boolean;
  membership: {
    id: string;
    squadId: string;
    roleInSquad: string;
    createdAt: string;
  } | null;
}

export interface ContentPurchaseCheckResult {
  exists: boolean;
  purchase: {
    id: string;
    contentType: ContentPurchaseType;
    contentId: string;
    purchasedAt: string;
  } | null;
}

// =============================================================================
// PROGRAM ENROLLMENT CHECK
// =============================================================================

/**
 * Check if user already has an active or upcoming enrollment in a program.
 * 
 * @param userId - The user ID to check
 * @param programId - The program ID to check enrollment for
 * @param targetCohortId - Optional cohort ID being enrolled into (for future cohort check)
 * @returns EnrollmentCheckResult with enrollment details and re-enrollment allowance
 */
export async function checkExistingEnrollment(
  userId: string,
  programId: string,
  targetCohortId?: string | null
): Promise<EnrollmentCheckResult> {
  // Query for active or upcoming enrollments in this program
  const enrollmentSnapshot = await adminDb
    .collection('program_enrollments')
    .where('userId', '==', userId)
    .where('programId', '==', programId)
    .where('status', 'in', ['active', 'upcoming'])
    .limit(1)
    .get();

  if (enrollmentSnapshot.empty) {
    return {
      exists: false,
      enrollment: null,
      allowReEnrollment: true,
    };
  }

  const doc = enrollmentSnapshot.docs[0];
  const data = doc.data() as ProgramEnrollment;
  
  const existingEnrollment: ExistingEnrollment = {
    id: doc.id,
    status: data.status,
    cohortId: data.cohortId || null,
    squadId: data.squadId || null,
    programId: data.programId,
    startedAt: data.startedAt,
    createdAt: data.createdAt,
  };

  // Check if re-enrollment is allowed for a different future cohort
  // This is allowed if:
  // 1. Target cohort is specified
  // 2. Target cohort is different from existing cohort
  // 3. Target cohort starts after existing enrollment ends
  let allowReEnrollment = false;
  let reason = 'You are already enrolled in this program';

  if (targetCohortId && data.cohortId && targetCohortId !== data.cohortId) {
    // User is trying to enroll in a different cohort
    // Check if the target cohort starts after the existing enrollment ends
    const [targetCohortDoc, programDoc] = await Promise.all([
      adminDb.collection('program_cohorts').doc(targetCohortId).get(),
      adminDb.collection('programs').doc(programId).get(),
    ]);

    if (targetCohortDoc.exists && programDoc.exists) {
      const targetCohort = targetCohortDoc.data();
      const program = programDoc.data();
      
      // Calculate existing enrollment end date
      const existingStartDate = new Date(data.startedAt);
      const existingEndDate = new Date(existingStartDate);
      existingEndDate.setDate(existingEndDate.getDate() + (program?.lengthDays || 30) - 1);
      
      const targetStartDate = new Date(targetCohort?.startDate);
      
      if (targetStartDate > existingEndDate) {
        allowReEnrollment = true;
        reason = 'You can enroll in this future cohort after your current program ends';
      } else {
        reason = `You are already enrolled in this program. The cohort you selected starts before your current enrollment ends (${existingEndDate.toLocaleDateString()})`;
      }
    }
  }

  return {
    exists: true,
    enrollment: existingEnrollment,
    allowReEnrollment,
    reason,
  };
}

/**
 * Check if user has any completed or stopped enrollments in a program
 * (for tracking re-enrollment eligibility)
 */
export async function checkPastEnrollments(
  userId: string,
  programId: string
): Promise<{ hasCompletedEnrollment: boolean; enrollments: ExistingEnrollment[] }> {
  const enrollmentSnapshot = await adminDb
    .collection('program_enrollments')
    .where('userId', '==', userId)
    .where('programId', '==', programId)
    .where('status', 'in', ['completed', 'stopped'])
    .get();

  const enrollments: ExistingEnrollment[] = enrollmentSnapshot.docs.map(doc => {
    const data = doc.data() as ProgramEnrollment;
    return {
      id: doc.id,
      status: data.status,
      cohortId: data.cohortId || null,
      squadId: data.squadId || null,
      programId: data.programId,
      startedAt: data.startedAt,
      createdAt: data.createdAt,
    };
  });

  return {
    hasCompletedEnrollment: enrollments.length > 0,
    enrollments,
  };
}

// =============================================================================
// SQUAD MEMBERSHIP CHECK
// =============================================================================

/**
 * Check if user is already a member of a squad
 * 
 * @param userId - The user ID to check
 * @param squadId - The squad ID to check membership for
 * @returns SquadMembershipCheckResult with membership details
 */
export async function checkExistingSquadMembership(
  userId: string,
  squadId: string
): Promise<SquadMembershipCheckResult> {
  // Check squadMembers collection
  const memberSnapshot = await adminDb
    .collection('squadMembers')
    .where('squadId', '==', squadId)
    .where('userId', '==', userId)
    .limit(1)
    .get();

  if (memberSnapshot.empty) {
    // Also check the squad's memberIds array as a fallback
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();
    if (squadDoc.exists) {
      const memberIds = squadDoc.data()?.memberIds || [];
      if (memberIds.includes(userId)) {
        return {
          exists: true,
          membership: {
            id: `${squadId}_${userId}`,
            squadId,
            roleInSquad: 'member',
            createdAt: '', // Unknown
          },
        };
      }
    }
    
    return {
      exists: false,
      membership: null,
    };
  }

  const doc = memberSnapshot.docs[0];
  const data = doc.data();

  return {
    exists: true,
    membership: {
      id: doc.id,
      squadId: data.squadId,
      roleInSquad: data.roleInSquad || 'member',
      createdAt: data.createdAt,
    },
  };
}

// =============================================================================
// CONTENT PURCHASE CHECK
// =============================================================================

/**
 * Check if user has already purchased specific content
 * 
 * @param userId - The user ID to check
 * @param contentType - The type of content
 * @param contentId - The content ID to check
 * @returns ContentPurchaseCheckResult with purchase details
 */
export async function checkExistingContentPurchase(
  userId: string,
  contentType: ContentPurchaseType,
  contentId: string
): Promise<ContentPurchaseCheckResult> {
  const purchaseSnapshot = await adminDb
    .collection('user_content_purchases')
    .where('userId', '==', userId)
    .where('contentType', '==', contentType)
    .where('contentId', '==', contentId)
    .limit(1)
    .get();

  if (purchaseSnapshot.empty) {
    return {
      exists: false,
      purchase: null,
    };
  }

  const doc = purchaseSnapshot.docs[0];
  const data = doc.data() as ContentPurchase;

  return {
    exists: true,
    purchase: {
      id: doc.id,
      contentType: data.contentType,
      contentId: data.contentId,
      purchasedAt: data.purchasedAt,
    },
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get human-readable message for enrollment status
 */
export function getEnrollmentStatusMessage(
  productType: 'program' | 'squad' | 'content',
  productName?: string
): string {
  const name = productName || 'this';
  
  switch (productType) {
    case 'program':
      return `You are already enrolled in ${name}`;
    case 'squad':
      return `You are already a member of ${name}`;
    case 'content':
      return `You already own ${name}`;
    default:
      return `You already have access to ${name}`;
  }
}

/**
 * Determine the appropriate redirect URL based on product type
 */
export function getProductRedirectUrl(
  productType: 'program' | 'squad' | 'content',
  productId: string,
  contentType?: ContentPurchaseType
): string {
  switch (productType) {
    case 'program':
      return `/program/${productId}`;
    case 'squad':
      return `/squad`;
    case 'content':
      if (contentType) {
        const pathMap: Record<ContentPurchaseType, string> = {
          article: 'articles',
          course: 'courses',
          event: 'events',
          download: 'downloads',
          link: 'links',
        };
        return `/discover/${pathMap[contentType]}/${productId}`;
      }
      return `/discover`;
    default:
      return '/';
  }
}

