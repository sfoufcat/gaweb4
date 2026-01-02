/**
 * Referral API: Generate Referral Link
 * 
 * POST /api/referral/generate-link - Generate a referral link for a user
 * 
 * This creates a personalized referral link that routes through the configured funnel
 * and tracks the referring user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { headers } from 'next/headers';
import { adminDb } from '@/lib/firebase-admin';
import type { Program, Squad, Funnel, ReferralConfig } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { targetType, targetId } = body as {
      targetType: 'program' | 'squad';
      targetId: string;
    };

    if (!targetType || !targetId) {
      return NextResponse.json(
        { error: 'targetType and targetId are required' },
        { status: 400 }
      );
    }

    // Fetch the program or squad
    const collection = targetType === 'program' ? 'programs' : 'squads';
    const docRef = await adminDb.collection(collection).doc(targetId).get();

    if (!docRef.exists) {
      return NextResponse.json({ error: `${targetType} not found` }, { status: 404 });
    }

    const data = docRef.data() as Program | Squad;
    const referralConfig = data.referralConfig as ReferralConfig | undefined;

    if (!referralConfig?.enabled || !referralConfig.funnelId) {
      return NextResponse.json(
        { error: 'Referrals are not enabled for this ' + targetType },
        { status: 400 }
      );
    }

    // Get the funnel to build the URL
    const funnelDoc = await adminDb.collection('funnels').doc(referralConfig.funnelId).get();
    if (!funnelDoc.exists) {
      return NextResponse.json({ error: 'Referral funnel not found' }, { status: 404 });
    }

    const funnel = funnelDoc.data() as Funnel;

    // Get the origin domain from headers for proper URL construction
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const protocol = headersList.get('x-forwarded-proto') || 'https';
    
    // Build the referral URL
    // Format: /join/{funnel-slug}?ref={userId}
    // The ref parameter will be captured when the funnel session is created
    const baseUrl = `${protocol}://${host}`;
    const referralUrl = `${baseUrl}/join/${funnel.slug}?ref=${userId}`;

    // Get reward info to show the user what they'll get
    let rewardDescription: string | null = null;
    if (referralConfig.reward) {
      switch (referralConfig.reward.type) {
        case 'free_time':
          rewardDescription = `${referralConfig.reward.freeDays} free days added to your subscription`;
          break;
        case 'free_program':
          if (referralConfig.reward.freeProgramId) {
            const rewardProgram = await adminDb.collection('programs').doc(referralConfig.reward.freeProgramId).get();
            if (rewardProgram.exists) {
              rewardDescription = `Free access to "${(rewardProgram.data() as Program).name}"`;
            }
          }
          break;
        case 'discount_code':
          if (referralConfig.reward.discountType === 'percentage') {
            rewardDescription = `${referralConfig.reward.discountValue}% off your next purchase`;
          } else {
            rewardDescription = `$${(referralConfig.reward.discountValue || 0) / 100} off your next purchase`;
          }
          break;
      }
    }

    return NextResponse.json({
      referralUrl,
      funnelSlug: funnel.slug,
      funnelName: funnel.name,
      targetType,
      targetId,
      targetName: data.name,
      hasReward: !!referralConfig.reward,
      rewardType: referralConfig.reward?.type,
      rewardDescription,
    });
  } catch (error) {
    console.error('[REFERRAL_GENERATE_LINK] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}









