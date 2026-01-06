/**
 * Credit Purchase Confirmation API
 *
 * Called after a payment succeeds to ensure credits are added to the organization.
 * This serves as a fallback in case the webhook doesn't fire or fails.
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { UserRole, OrgRole, ClerkPublicMetadata } from '@/types';

// Lazy Stripe initialization
let stripeInstance: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-02-24.acacia',
    });
  }
  return stripeInstance;
}

/**
 * POST /api/coach/credits/confirm
 *
 * Confirm a credit purchase and ensure credits are added
 *
 * Body:
 * - paymentIntentId: string - The PaymentIntent ID to confirm
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata & { role?: UserRole; orgRole?: OrgRole };
    const role = publicMetadata?.role;
    const orgRole = publicMetadata?.orgRole;

    if (!canAccessCoachDashboard(role, orgRole)) {
      return NextResponse.json({ error: 'Coach access required' }, { status: 403 });
    }

    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const body = await request.json();
    const { paymentIntentId } = body;

    if (!paymentIntentId) {
      return NextResponse.json({ error: 'Payment intent ID required' }, { status: 400 });
    }

    // Retrieve the PaymentIntent from Stripe to verify it succeeded
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Verify the payment succeeded
    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        { error: 'Payment not completed', status: paymentIntent.status },
        { status: 400 }
      );
    }

    // Verify this is a credit purchase for this organization
    if (paymentIntent.metadata?.type !== 'credit_purchase') {
      return NextResponse.json({ error: 'Invalid payment type' }, { status: 400 });
    }

    if (paymentIntent.metadata?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Organization mismatch' }, { status: 403 });
    }

    const credits = paymentIntent.metadata?.credits;
    if (!credits) {
      return NextResponse.json({ error: 'Credits not specified in payment' }, { status: 400 });
    }

    const creditsToAdd = parseInt(credits, 10);
    const minutesToAdd = creditsToAdd * 60; // 60 minutes per credit/call

    // Check if credits were already added (idempotency)
    // We'll use a simple check: store processedPaymentIntentIds in the org doc
    const orgRef = adminDb.collection('organizations').doc(organizationId);

    const result = await adminDb.runTransaction(async (transaction) => {
      const orgDoc = await transaction.get(orgRef);

      if (!orgDoc.exists) {
        throw new Error(`Organization ${organizationId} not found`);
      }

      const orgData = orgDoc.data();
      const processedPaymentIntents = orgData?.processedCreditPurchases || [];

      // Check if already processed
      if (processedPaymentIntents.includes(paymentIntentId)) {
        return { alreadyProcessed: true, creditsAdded: 0 };
      }

      // Add credits
      const currentPurchasedMinutes = orgData?.summaryCredits?.purchasedMinutes || 0;

      transaction.update(orgRef, {
        'summaryCredits.purchasedMinutes': currentPurchasedMinutes + minutesToAdd,
        processedCreditPurchases: [...processedPaymentIntents.slice(-99), paymentIntentId], // Keep last 100
      });

      return { alreadyProcessed: false, creditsAdded: creditsToAdd };
    });

    if (result.alreadyProcessed) {
      console.log(`[CREDITS_CONFIRM_API] PaymentIntent ${paymentIntentId} already processed for org ${organizationId}`);
      return NextResponse.json({
        success: true,
        creditsAdded: 0,
        message: 'Credits were already added',
      });
    }

    console.log(`[CREDITS_CONFIRM_API] Added ${creditsToAdd} credits (${minutesToAdd} minutes) to org ${organizationId}`);

    return NextResponse.json({
      success: true,
      creditsAdded: creditsToAdd,
    });
  } catch (error) {
    console.error('[CREDITS_CONFIRM_API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
