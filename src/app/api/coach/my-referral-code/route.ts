/**
 * Coach Referral Code API
 * 
 * GET: Get or generate the coach's unique referral code
 * 
 * The referral code is used for coach-to-coach referrals.
 * When a new coach signs up using this code and subscribes,
 * both the referrer and referee get 1 month free.
 */

import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { CoachReferralCode, ClerkPublicMetadata } from '@/types';

// Generate a unique referral code
function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars (0, O, I, 1)
  let code = 'COACH-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * GET /api/coach/my-referral-code
 * Get the coach's referral code, creating one if it doesn't exist
 */
export async function GET() {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get organization from user metadata
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const organizationId = publicMetadata?.primaryOrganizationId || publicMetadata?.organizationId;
    
    if (!organizationId) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 400 }
      );
    }
    
    // Check if coach already has a referral code
    const codeDoc = await adminDb
      .collection('coach_referral_codes')
      .doc(organizationId)
      .get();
    
    if (codeDoc.exists) {
      const codeData = codeDoc.data() as CoachReferralCode;
      
      // Generate referral URL
      const referralUrl = `https://growthaddicts.com?ref=${codeData.code}`;
      
      return NextResponse.json({
        code: codeData.code,
        referralUrl,
        stats: {
          totalReferrals: codeData.totalReferrals,
          successfulReferrals: codeData.successfulReferrals,
          totalRewardsEarned: codeData.totalRewardsEarned,
        },
      });
    }
    
    // Generate a new unique code
    let newCode = generateReferralCode();
    let attempts = 0;
    const maxAttempts = 10;
    
    // Ensure code is unique
    while (attempts < maxAttempts) {
      const existingCode = await adminDb
        .collection('coach_referral_codes')
        .where('code', '==', newCode)
        .limit(1)
        .get();
      
      if (existingCode.empty) {
        break;
      }
      
      newCode = generateReferralCode();
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { error: 'Failed to generate unique code. Please try again.' },
        { status: 500 }
      );
    }
    
    // Create the referral code record
    const now = new Date().toISOString();
    const codeData: CoachReferralCode = {
      id: organizationId,
      orgId: organizationId,
      userId,
      code: newCode,
      totalReferrals: 0,
      successfulReferrals: 0,
      totalRewardsEarned: 0,
      createdAt: now,
      updatedAt: now,
    };
    
    await adminDb
      .collection('coach_referral_codes')
      .doc(organizationId)
      .set(codeData);
    
    console.log(`[COACH_REFERRAL] Created referral code ${newCode} for org ${organizationId}`);
    
    // Generate referral URL
    const referralUrl = `https://growthaddicts.com?ref=${newCode}`;
    
    return NextResponse.json({
      code: newCode,
      referralUrl,
      stats: {
        totalReferrals: 0,
        successfulReferrals: 0,
        totalRewardsEarned: 0,
      },
    });
    
  } catch (error) {
    console.error('[COACH_REFERRAL] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get referral code' },
      { status: 500 }
    );
  }
}

