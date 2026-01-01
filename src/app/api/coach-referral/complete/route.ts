/**
 * Coach Referral Completion API
 * 
 * POST: Complete a referral and apply rewards when referred coach subscribes
 * 
 * This is called after a referred coach successfully subscribes to a paid plan.
 * It applies 1 month credit to both the referrer and referee's Stripe subscriptions.
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import Stripe from 'stripe';
import type { CoachReferral, CoachReferralCode, CoachSubscription, ClerkPublicMetadata } from '@/types';

// Lazy initialization of Stripe
function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(key, {
    apiVersion: '2025-02-24.acacia',
  });
}

/**
 * Apply 1 month credit to a Stripe subscription
 */
async function applyOneMonthCredit(
  stripe: Stripe, 
  subscriptionId: string,
  reason: string
): Promise<boolean> {
  try {
    // Get the subscription to find the price
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const priceId = subscription.items.data[0]?.price.id;
    
    if (!priceId) {
      console.error('[REFERRAL_REWARD] No price found on subscription');
      return false;
    }
    
    // Get the price to determine the credit amount
    const price = await stripe.prices.retrieve(priceId);
    const creditAmount = price.unit_amount || 0; // Amount in cents
    
    if (creditAmount <= 0) {
      console.error('[REFERRAL_REWARD] Invalid price amount');
      return false;
    }
    
    // Create a credit note / invoice item credit
    // Using customer balance credit (negative invoice item)
    await stripe.invoiceItems.create({
      customer: subscription.customer as string,
      amount: -creditAmount, // Negative amount = credit
      currency: price.currency,
      description: `Referral reward: ${reason}`,
    });
    
    console.log(`[REFERRAL_REWARD] Applied $${(creditAmount / 100).toFixed(2)} credit to customer ${subscription.customer}`);
    
    return true;
  } catch (error) {
    console.error('[REFERRAL_REWARD] Error applying credit:', error);
    return false;
  }
}

/**
 * POST /api/coach-referral/complete
 * Complete a referral and apply rewards
 * 
 * Body: {
 *   referredOrgId: string,  // The org that just subscribed
 *   referredUserId: string, // The user that just subscribed
 * }
 */
export async function POST(request: Request) {
  try {
    const { userId: authUserId, sessionClaims } = await auth();
    
    // This can be called internally or by the user who just subscribed
    const internalKey = request.headers.get('x-internal-key');
    const isInternalCall = internalKey === process.env.INTERNAL_API_KEY;
    
    if (!authUserId && !isInternalCall) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { referredOrgId, referredUserId } = body;
    
    if (!referredOrgId || !referredUserId) {
      return NextResponse.json(
        { error: 'referredOrgId and referredUserId are required' },
        { status: 400 }
      );
    }
    
    // Find pending referral for this user/org
    let referralSnapshot = await adminDb
      .collection('coach_referrals')
      .where('referredOrgId', '==', referredOrgId)
      .where('status', 'in', ['pending', 'signed_up'])
      .limit(1)
      .get();
    
    // If not found by orgId, try by userId
    if (referralSnapshot.empty) {
      referralSnapshot = await adminDb
        .collection('coach_referrals')
        .where('referredUserId', '==', referredUserId)
        .where('status', 'in', ['pending', 'signed_up'])
        .limit(1)
        .get();
    }
    
    if (referralSnapshot.empty) {
      console.log(`[REFERRAL_COMPLETE] No pending referral found for org ${referredOrgId}`);
      return NextResponse.json({
        success: false,
        message: 'No pending referral found',
      });
    }
    
    const referralDoc = referralSnapshot.docs[0];
    const referral = { id: referralDoc.id, ...referralDoc.data() } as CoachReferral;
    
    // Check if already completed
    if (referral.status === 'subscribed' || referral.status === 'rewarded') {
      return NextResponse.json({
        success: true,
        message: 'Referral already completed',
        status: referral.status,
      });
    }
    
    const now = new Date().toISOString();
    const stripe = getStripeClient();
    
    // Get referrer's subscription
    const referrerSubSnapshot = await adminDb
      .collection('coach_subscriptions')
      .where('organizationId', '==', referral.referrerOrgId)
      .where('status', 'in', ['active', 'trialing'])
      .limit(1)
      .get();
    
    // Get referee's subscription
    const refereeSubSnapshot = await adminDb
      .collection('coach_subscriptions')
      .where('organizationId', '==', referredOrgId)
      .where('status', 'in', ['active', 'trialing'])
      .limit(1)
      .get();
    
    let referrerRewarded = referral.referrerRewarded;
    let refereeRewarded = referral.refereeRewarded;
    
    // Apply credit to referrer
    if (!referral.referrerRewarded && !referrerSubSnapshot.empty) {
      const referrerSub = referrerSubSnapshot.docs[0].data() as CoachSubscription;
      if (referrerSub.stripeSubscriptionId) {
        referrerRewarded = await applyOneMonthCredit(
          stripe,
          referrerSub.stripeSubscriptionId,
          `1 month free for referring a new coach`
        );
      }
    }
    
    // Apply credit to referee (the new coach)
    if (!referral.refereeRewarded && !refereeSubSnapshot.empty) {
      const refereeSub = refereeSubSnapshot.docs[0].data() as CoachSubscription;
      if (refereeSub.stripeSubscriptionId) {
        refereeRewarded = await applyOneMonthCredit(
          stripe,
          refereeSub.stripeSubscriptionId,
          `1 month free for signing up with referral code`
        );
      }
    }
    
    // Update referral status
    const newStatus = (referrerRewarded && refereeRewarded) ? 'rewarded' : 'subscribed';
    
    await referralDoc.ref.update({
      status: newStatus,
      referredOrgId,
      referredUserId,
      referrerRewarded,
      refereeRewarded,
      referrerRewardAppliedAt: referrerRewarded && !referral.referrerRewarded ? now : referral.referrerRewardAppliedAt,
      refereeRewardAppliedAt: refereeRewarded && !referral.refereeRewarded ? now : referral.refereeRewardAppliedAt,
      subscribedAt: now,
      rewardedAt: (referrerRewarded && refereeRewarded) ? now : undefined,
    });
    
    // Update referrer's stats
    if (referrerRewarded && !referral.referrerRewarded) {
      const codeDoc = await adminDb
        .collection('coach_referral_codes')
        .doc(referral.referrerOrgId)
        .get();
      
      if (codeDoc.exists) {
        const codeData = codeDoc.data() as CoachReferralCode;
        await codeDoc.ref.update({
          successfulReferrals: (codeData.successfulReferrals || 0) + 1,
          totalRewardsEarned: (codeData.totalRewardsEarned || 0) + 1,
          updatedAt: now,
        });
      }
    }
    
    console.log(`[REFERRAL_COMPLETE] Completed referral ${referral.id}: referrer=${referrerRewarded}, referee=${refereeRewarded}`);
    
    return NextResponse.json({
      success: true,
      status: newStatus,
      referrerRewarded,
      refereeRewarded,
    });
    
  } catch (error) {
    console.error('[REFERRAL_COMPLETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to complete referral' },
      { status: 500 }
    );
  }
}

