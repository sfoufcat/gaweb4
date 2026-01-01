/**
 * Coach Referral Tracking API
 * 
 * POST: Track when a new coach signs up using a referral code
 * 
 * This is called during the signup process when a referral code is detected.
 * Creates a pending referral record that will be completed when the
 * referred coach subscribes to a paid plan.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { CoachReferral, CoachReferralCode } from '@/types';

/**
 * POST /api/coach-referral/track
 * Track a referral signup
 * 
 * Body: {
 *   referralCode: string,
 *   referredEmail: string,
 *   referredUserId?: string,
 *   referredOrgId?: string,
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { referralCode, referredEmail, referredUserId, referredOrgId } = body;
    
    if (!referralCode || !referredEmail) {
      return NextResponse.json(
        { error: 'Referral code and email are required' },
        { status: 400 }
      );
    }
    
    // Find the referral code
    const codeSnapshot = await adminDb
      .collection('coach_referral_codes')
      .where('code', '==', referralCode.toUpperCase())
      .limit(1)
      .get();
    
    if (codeSnapshot.empty) {
      console.log(`[COACH_REFERRAL_TRACK] Invalid referral code: ${referralCode}`);
      return NextResponse.json(
        { error: 'Invalid referral code' },
        { status: 404 }
      );
    }
    
    const codeDoc = codeSnapshot.docs[0];
    const codeData = codeDoc.data() as CoachReferralCode;
    
    // Check if this email has already been referred
    const existingReferral = await adminDb
      .collection('coach_referrals')
      .where('referredEmail', '==', referredEmail.toLowerCase())
      .limit(1)
      .get();
    
    if (!existingReferral.empty) {
      console.log(`[COACH_REFERRAL_TRACK] Email ${referredEmail} already has a referral`);
      return NextResponse.json({
        success: true,
        message: 'Referral already tracked',
        referralId: existingReferral.docs[0].id,
      });
    }
    
    // Prevent self-referral
    if (referredOrgId && referredOrgId === codeData.orgId) {
      return NextResponse.json(
        { error: 'Cannot use your own referral code' },
        { status: 400 }
      );
    }
    
    // Create referral record
    const now = new Date().toISOString();
    const referralRef = adminDb.collection('coach_referrals').doc();
    const referralData: CoachReferral = {
      id: referralRef.id,
      referrerOrgId: codeData.orgId,
      referrerUserId: codeData.userId,
      referralCode: codeData.code,
      referredEmail: referredEmail.toLowerCase(),
      referredUserId: referredUserId || undefined,
      referredOrgId: referredOrgId || undefined,
      status: referredUserId ? 'signed_up' : 'pending',
      rewardType: 'free_month',
      referrerRewarded: false,
      refereeRewarded: false,
      createdAt: now,
      signedUpAt: referredUserId ? now : undefined,
    };
    
    await referralRef.set(referralData);
    
    // Update referrer's total referrals count
    await codeDoc.ref.update({
      totalReferrals: (codeData.totalReferrals || 0) + 1,
      updatedAt: now,
    });
    
    console.log(`[COACH_REFERRAL_TRACK] Created referral ${referralRef.id}: ${codeData.code} -> ${referredEmail}`);
    
    return NextResponse.json({
      success: true,
      referralId: referralRef.id,
      status: referralData.status,
    });
    
  } catch (error) {
    console.error('[COACH_REFERRAL_TRACK] Error:', error);
    return NextResponse.json(
      { error: 'Failed to track referral' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/coach-referral/track
 * Validate a referral code
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    
    if (!code) {
      return NextResponse.json(
        { error: 'Referral code required' },
        { status: 400 }
      );
    }
    
    // Find the referral code
    const codeSnapshot = await adminDb
      .collection('coach_referral_codes')
      .where('code', '==', code.toUpperCase())
      .limit(1)
      .get();
    
    if (codeSnapshot.empty) {
      return NextResponse.json({ valid: false });
    }
    
    return NextResponse.json({ 
      valid: true,
      reward: '1 month free for both you and the referrer',
    });
    
  } catch (error) {
    console.error('[COACH_REFERRAL_TRACK] Error:', error);
    return NextResponse.json(
      { error: 'Failed to validate code' },
      { status: 500 }
    );
  }
}

