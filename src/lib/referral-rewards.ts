/**
 * Referral Rewards System
 * 
 * Handles granting rewards to referrers when their referred users complete enrollment.
 */

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { nanoid } from 'nanoid';
import type { Referral, ReferralConfig, Program, DiscountCode } from '@/types';

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
  const now = new Date().toISOString();

  try {
    switch (reward.type) {
      case 'free_time':
        return await grantFreeTimeReward(referralId, referrerId, organizationId, reward.freeDays || 14);
      
      case 'free_program':
        if (!reward.freeProgramId) {
          return {
            success: false,
            rewardType: 'free_program',
            details: {},
            error: 'No program ID configured for free program reward',
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
 * Grant free time extension to a referrer's subscription/access
 */
async function grantFreeTimeReward(
  referralId: string,
  referrerId: string,
  organizationId: string,
  freeDays: number
): Promise<RewardResult> {
  const now = new Date().toISOString();
  
  // Find the user's org membership and extend their access
  const membershipQuery = await adminDb
    .collection('org_memberships')
    .where('userId', '==', referrerId)
    .where('organizationId', '==', organizationId)
    .limit(1)
    .get();

  if (membershipQuery.empty) {
    // No membership found - might need to create one or this is an error case
    // For now, just record the reward for later processing
    await updateReferralWithReward(referralId, 'free_time', {
      freeDays,
      status: 'pending_application',
      reason: 'No membership found - will apply when membership created',
    });

    return {
      success: true,
      rewardType: 'free_time',
      details: {
        freeDays,
        status: 'pending_application',
      },
    };
  }

  const membership = membershipQuery.docs[0];
  const membershipData = membership.data();
  
  // Calculate new expiration date
  let currentExpiration = membershipData.accessExpiresAt 
    ? new Date(membershipData.accessExpiresAt)
    : new Date();
  
  // If current expiration is in the past, start from now
  if (currentExpiration < new Date()) {
    currentExpiration = new Date();
  }
  
  const newExpiration = new Date(currentExpiration);
  newExpiration.setDate(newExpiration.getDate() + freeDays);

  // Update membership with extended access
  await membership.ref.update({
    accessExpiresAt: newExpiration.toISOString(),
    hasActiveAccess: true,
    updatedAt: now,
    // Track that this was extended via referral
    referralExtensions: FieldValue.arrayUnion({
      referralId,
      daysAdded: freeDays,
      appliedAt: now,
    }),
  });

  // Update referral record
  await updateReferralWithReward(referralId, 'free_time', {
    freeDays,
    newExpirationDate: newExpiration.toISOString(),
    previousExpirationDate: membershipData.accessExpiresAt,
  });

  console.log(`[REFERRAL_REWARD] Granted ${freeDays} free days to user ${referrerId}`);

  return {
    success: true,
    rewardType: 'free_time',
    details: {
      freeDays,
      newExpirationDate: newExpiration.toISOString(),
    },
  };
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



