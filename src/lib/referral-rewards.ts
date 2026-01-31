/**
 * Referral Rewards System
 *
 * Handles granting rewards to referrers when their referred users complete enrollment.
 */

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { nanoid } from 'nanoid';
import type { Referral, ReferralConfig, Program, DiscountCode, ReferralResourceType } from '@/types';

export interface RewardResult {
  success: boolean;
  rewardType: string;
  details: Record<string, unknown>;
  error?: string;
}

/**
 * Grant a referral reward to a referrer
 *
 * @param referralId - The referral record ID
 * @param referralConfig - The referral configuration with reward settings
 * @param referrerId - The user ID of the referrer
 * @param organizationId - The organization ID
 * @returns Result of the reward operation
 */
export async function grantReferralReward(
  referralId: string,
  referralConfig: ReferralConfig,
  referrerId: string,
  organizationId: string
): Promise<RewardResult> {
  if (!referralConfig.reward) {
    return {
      success: true,
      rewardType: 'none',
      details: { message: 'No reward configured' },
    };
  }

  const reward = referralConfig.reward;

  try {
    switch (reward.type) {
      case 'free_program':
        // Handle both program and resource rewards
        if (reward.freeResourceId && reward.freeResourceType) {
          return await grantFreeResourceReward(
            referralId,
            referrerId,
            organizationId,
            reward.freeResourceId,
            reward.freeResourceType
          );
        }
        if (!reward.freeProgramId) {
          return {
            success: false,
            rewardType: 'free_program',
            details: {},
            error: 'No program or resource ID configured for free product reward',
          };
        }
        return await grantFreeProgramReward(referralId, referrerId, organizationId, reward.freeProgramId);

      case 'discount_code':
        return await grantDiscountCodeReward(
          referralId,
          referrerId,
          organizationId,
          reward.discountType || 'percentage',
          reward.discountValue || 20
        );

      case 'monetary':
        return await grantMonetaryReward(
          referralId,
          referrerId,
          organizationId,
          reward.monetaryAmount || 0
        );

      default:
        return {
          success: false,
          rewardType: reward.type,
          details: {},
          error: `Unknown reward type: ${reward.type}`,
        };
    }
  } catch (error) {
    console.error('[REFERRAL_REWARD] Error granting reward:', error);
    return {
      success: false,
      rewardType: reward.type,
      details: {},
      error: error instanceof Error ? error.message : 'Failed to grant reward',
    };
  }
}

/**
 * Grant free access to a program for the referrer
 */
async function grantFreeProgramReward(
  referralId: string,
  referrerId: string,
  organizationId: string,
  freeProgramId: string
): Promise<RewardResult> {
  const now = new Date().toISOString();

  // Check if program exists
  const programDoc = await adminDb.collection('programs').doc(freeProgramId).get();
  if (!programDoc.exists) {
    return {
      success: false,
      rewardType: 'free_program',
      details: {},
      error: 'Reward program not found',
    };
  }

  const program = programDoc.data() as Program;

  // Check if user is already enrolled
  const existingEnrollment = await adminDb
    .collection('program_enrollments')
    .where('userId', '==', referrerId)
    .where('programId', '==', freeProgramId)
    .where('status', 'in', ['active', 'upcoming'])
    .limit(1)
    .get();

  if (!existingEnrollment.empty) {
    // Already enrolled - record for tracking but don't create duplicate
    await updateReferralWithReward(referralId, 'free_program', {
      programId: freeProgramId,
      programName: program.name,
      status: 'already_enrolled',
    });

    return {
      success: true,
      rewardType: 'free_program',
      details: {
        programId: freeProgramId,
        programName: program.name,
        status: 'already_enrolled',
      },
    };
  }

  // Create free enrollment
  const enrollmentId = `enroll_${nanoid(16)}`;
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + program.lengthDays);

  await adminDb.collection('program_enrollments').doc(enrollmentId).set({
    id: enrollmentId,
    userId: referrerId,
    programId: freeProgramId,
    organizationId,
    status: 'active',
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    currentDay: 1,
    paymentStatus: 'free',
    accessSource: 'referral_reward',
    referralId,
    createdAt: now,
    updatedAt: now,
  });

  // Update referral record
  await updateReferralWithReward(referralId, 'free_program', {
    programId: freeProgramId,
    programName: program.name,
    enrollmentId,
  });

  console.log(`[REFERRAL_REWARD] Granted free access to program ${freeProgramId} for user ${referrerId}`);

  return {
    success: true,
    rewardType: 'free_program',
    details: {
      programId: freeProgramId,
      programName: program.name,
      enrollmentId,
    },
  };
}

/**
 * Grant free access to a resource (article, course, video, download, link) for the referrer
 */
async function grantFreeResourceReward(
  referralId: string,
  referrerId: string,
  organizationId: string,
  resourceId: string,
  resourceType: ReferralResourceType
): Promise<RewardResult> {
  const now = new Date().toISOString();

  // Map resource type to collection name
  const resourceCollections: Record<ReferralResourceType, string> = {
    article: 'articles',
    course: 'courses',
    video: 'videos',
    download: 'downloads',
    link: 'links',
  };

  const collectionName = resourceCollections[resourceType];
  if (!collectionName) {
    return {
      success: false,
      rewardType: 'free_program',
      details: {},
      error: `Unknown resource type: ${resourceType}`,
    };
  }

  // Check if resource exists
  const resourceDoc = await adminDb.collection(collectionName).doc(resourceId).get();
  if (!resourceDoc.exists) {
    return {
      success: false,
      rewardType: 'free_program',
      details: {},
      error: 'Reward resource not found',
    };
  }

  const resource = resourceDoc.data();
  const resourceName = resource?.title || resource?.name || 'Resource';

  // Check if user already has access
  const existingAccess = await adminDb
    .collection('resource_access')
    .where('userId', '==', referrerId)
    .where('resourceId', '==', resourceId)
    .where('resourceType', '==', resourceType)
    .limit(1)
    .get();

  if (!existingAccess.empty) {
    // Already has access - record for tracking but don't create duplicate
    await updateReferralWithReward(referralId, 'free_program', {
      resourceId,
      resourceType,
      resourceName,
      status: 'already_has_access',
    });

    return {
      success: true,
      rewardType: 'free_program',
      details: {
        resourceId,
        resourceType,
        resourceName,
        status: 'already_has_access',
      },
    };
  }

  // Create resource access record
  const accessId = `access_${nanoid(16)}`;

  await adminDb.collection('resource_access').doc(accessId).set({
    id: accessId,
    userId: referrerId,
    organizationId,
    resourceType,
    resourceId,
    grantedBy: 'referral',
    referralId,
    createdAt: now,
  });

  // Update referral record
  await updateReferralWithReward(referralId, 'free_program', {
    resourceId,
    resourceType,
    resourceName,
    accessId,
  });

  console.log(`[REFERRAL_REWARD] Granted free access to ${resourceType} ${resourceId} for user ${referrerId}`);

  return {
    success: true,
    rewardType: 'free_program',
    details: {
      resourceId,
      resourceType,
      resourceName,
      accessId,
    },
  };
}

/**
 * Generate and grant a discount code for the referrer
 */
async function grantDiscountCodeReward(
  referralId: string,
  referrerId: string,
  organizationId: string,
  discountType: 'percentage' | 'fixed',
  discountValue: number
): Promise<RewardResult> {
  const now = new Date().toISOString();

  // Generate a unique code
  const codePrefix = 'REF';
  const randomPart = nanoid(6).toUpperCase();
  const code = `${codePrefix}${randomPart}`;

  // Create expiration (90 days from now)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90);

  const discountCode: DiscountCode = {
    id: code,
    organizationId,
    code,
    name: 'Referral Reward',
    type: discountType,
    value: discountValue,
    applicableTo: 'all',
    maxUses: 1, // Single use
    useCount: 0,
    maxUsesPerUser: 1,
    expiresAt: expiresAt.toISOString(),
    isActive: true,
    createdBy: 'system', // System-generated
    createdAt: now,
    updatedAt: now,
  };

  // Save discount code
  await adminDb.collection('discount_codes').doc(code).set(discountCode);

  // Also store in user-specific collection for easy lookup
  await adminDb.collection('user_discount_codes').add({
    userId: referrerId,
    discountCodeId: code,
    code,
    organizationId,
    source: 'referral_reward',
    referralId,
    createdAt: now,
  });

  // Update referral record
  await updateReferralWithReward(referralId, 'discount_code', {
    code,
    discountType,
    discountValue,
    expiresAt: expiresAt.toISOString(),
  });

  const displayValue = discountType === 'percentage'
    ? `${discountValue}%`
    : `$${(discountValue / 100).toFixed(2)}`;

  console.log(`[REFERRAL_REWARD] Generated discount code ${code} (${displayValue} off) for user ${referrerId}`);

  return {
    success: true,
    rewardType: 'discount_code',
    details: {
      code,
      discountType,
      discountValue,
      displayValue,
      expiresAt: expiresAt.toISOString(),
    },
  };
}

/**
 * Record a monetary reward for the referrer
 *
 * Note: Monetary rewards are tracked but must be paid manually by the coach.
 * This function records the reward and sets paymentStatus to 'pending'.
 */
async function grantMonetaryReward(
  referralId: string,
  referrerId: string,
  organizationId: string,
  monetaryAmount: number
): Promise<RewardResult> {
  if (monetaryAmount <= 0) {
    return {
      success: false,
      rewardType: 'monetary',
      details: {},
      error: 'Monetary amount must be greater than 0',
    };
  }

  // Update referral record with monetary reward and pending payment status
  await updateReferralWithReward(referralId, 'monetary', {
    monetaryAmount,
    displayValue: `$${(monetaryAmount / 100).toFixed(2)}`,
  });

  // Also set payment status to pending
  await adminDb.collection('referrals').doc(referralId).update({
    paymentStatus: 'pending',
  });

  console.log(`[REFERRAL_REWARD] Recorded monetary reward of $${(monetaryAmount / 100).toFixed(2)} for user ${referrerId} (pending payment)`);

  return {
    success: true,
    rewardType: 'monetary',
    details: {
      monetaryAmount,
      displayValue: `$${(monetaryAmount / 100).toFixed(2)}`,
      paymentStatus: 'pending',
    },
  };
}

/**
 * Helper to update referral record with reward details
 */
async function updateReferralWithReward(
  referralId: string,
  rewardType: string,
  rewardDetails: Record<string, unknown>
): Promise<void> {
  const now = new Date().toISOString();

  await adminDb.collection('referrals').doc(referralId).update({
    status: 'rewarded',
    rewardType,
    rewardGrantedAt: now,
    rewardDetails,
    updatedAt: now,
  });
}

/**
 * Update referral when the referred user is linked (signs up)
 */
export async function linkReferredUser(
  referralId: string,
  referredUserId: string
): Promise<void> {
  const now = new Date().toISOString();

  await adminDb.collection('referrals').doc(referralId).update({
    referredUserId,
    updatedAt: now,
  });

  console.log(`[REFERRAL] Linked referred user ${referredUserId} to referral ${referralId}`);
}

/**
 * Mark referral as completed (referred user enrolled)
 */
export async function completeReferral(
  referralId: string
): Promise<void> {
  const now = new Date().toISOString();

  await adminDb.collection('referrals').doc(referralId).update({
    status: 'completed',
    completedAt: now,
    updatedAt: now,
  });

  console.log(`[REFERRAL] Marked referral ${referralId} as completed`);
}
