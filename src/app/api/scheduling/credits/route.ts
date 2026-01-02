import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { UserCallCredits, CoachCallSettings } from '@/types';

/**
 * GET /api/scheduling/credits
 * Get user's call credits balance
 */
export async function GET() {
  try {
    const { userId, orgId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 400 }
      );
    }

    // Get user's credits
    const creditsDoc = await adminDb
      .collection('user_call_credits')
      .doc(`${orgId}_${userId}`)
      .get();

    if (!creditsDoc.exists) {
      // Check organization settings for monthly allowance
      const orgDoc = await adminDb.collection('organizations').doc(orgId).get();
      const orgData = orgDoc.data();
      const callSettings = orgData?.callSettings as CoachCallSettings | undefined;
      const monthlyAllowance = callSettings?.creditsIncludedMonthly || 0;

      // If there's a monthly allowance, create initial credits
      if (monthlyAllowance > 0) {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const newCredits: UserCallCredits = {
          id: `${orgId}_${userId}`,
          odId: orgId,
          userId,
          creditsRemaining: monthlyAllowance,
          creditsUsedThisMonth: 0,
          monthlyAllowance,
          billingPeriodStart: monthStart.toISOString(),
          billingPeriodEnd: monthEnd.toISOString(),
          lastUpdated: now.toISOString(),
        };

        await adminDb
          .collection('user_call_credits')
          .doc(newCredits.id)
          .set(newCredits);

        return NextResponse.json({ credits: newCredits });
      }

      return NextResponse.json({ 
        credits: null,
        message: 'No credits available',
      });
    }

    const credits = creditsDoc.data() as UserCallCredits;

    // Check if billing period has reset
    const now = new Date();
    const periodEnd = new Date(credits.billingPeriodEnd);
    
    if (now > periodEnd) {
      // Reset credits for new billing period
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const updatedCredits: Partial<UserCallCredits> = {
        creditsRemaining: credits.monthlyAllowance,
        creditsUsedThisMonth: 0,
        billingPeriodStart: monthStart.toISOString(),
        billingPeriodEnd: monthEnd.toISOString(),
        lastUpdated: now.toISOString(),
      };

      await adminDb
        .collection('user_call_credits')
        .doc(`${orgId}_${userId}`)
        .update(updatedCredits);

      return NextResponse.json({ 
        credits: { ...credits, ...updatedCredits },
        periodReset: true,
      });
    }

    return NextResponse.json({ credits });
  } catch (error) {
    console.error('[SCHEDULING_CREDITS_GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/scheduling/credits
 * Add credits to a user (coach only)
 * 
 * Body:
 * - userId: string - The user to add credits to
 * - amount: number - Number of credits to add
 */
export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const body = await request.json();
    const { userId, amount } = body;

    if (!userId || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Valid user ID and positive amount are required' },
        { status: 400 }
      );
    }

    const now = new Date();
    const creditsRef = adminDb
      .collection('user_call_credits')
      .doc(`${organizationId}_${userId}`);
    const creditsDoc = await creditsRef.get();

    if (creditsDoc.exists) {
      // Update existing credits
      const credits = creditsDoc.data() as UserCallCredits;
      await creditsRef.update({
        creditsRemaining: credits.creditsRemaining + amount,
        lastUpdated: now.toISOString(),
      });
    } else {
      // Create new credits document
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const newCredits: UserCallCredits = {
        id: `${organizationId}_${userId}`,
        odId: organizationId,
        userId,
        creditsRemaining: amount,
        creditsUsedThisMonth: 0,
        monthlyAllowance: 0, // Manual credits, not monthly
        billingPeriodStart: monthStart.toISOString(),
        billingPeriodEnd: monthEnd.toISOString(),
        lastUpdated: now.toISOString(),
      };

      await creditsRef.set(newCredits);
    }

    return NextResponse.json({ success: true, creditsAdded: amount });
  } catch (error) {
    console.error('[SCHEDULING_CREDITS_POST] Error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

