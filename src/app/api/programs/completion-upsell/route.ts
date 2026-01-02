/**
 * Program Completion Upsell Purchase
 * 
 * POST /api/programs/completion-upsell
 * 
 * Handles one-click purchases from the program completion popup.
 * Uses saved payment method for seamless checkout.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import Stripe from 'stripe';
import type { OrgSettings, Program } from '@/types';
import { enrollUserInProduct } from '@/lib/enrollments/enrollUser';

// Lazy initialization of Stripe
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
    _stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia' });
  }
  return _stripe;
}

/**
 * POST /api/programs/completion-upsell
 * 
 * Body:
 * - programId: string - The upsell program to purchase
 * - paymentMethodId: string - The saved payment method to use
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { programId, paymentMethodId } = body;

    if (!programId) {
      return NextResponse.json(
        { error: 'Missing required field: programId' },
        { status: 400 }
      );
    }

    if (!paymentMethodId) {
      return NextResponse.json(
        { error: 'Missing required field: paymentMethodId' },
        { status: 400 }
      );
    }

    // Get program details
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    const program = { id: programDoc.id, ...programDoc.data() } as Program;
    const organizationId = program.organizationId;

    // Check if user is already enrolled
    const existingEnrollment = await adminDb
      .collection('program_enrollments')
      .where('userId', '==', userId)
      .where('programId', '==', programId)
      .where('status', 'in', ['active', 'upcoming'])
      .limit(1)
      .get();

    if (!existingEnrollment.empty) {
      return NextResponse.json(
        { error: 'You are already enrolled in this program' },
        { status: 400 }
      );
    }

    // Get organization settings for Stripe Connect
    const orgSettingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
    const orgSettings = orgSettingsDoc.data() as OrgSettings | undefined;

    const stripeConnectAccountId = orgSettings?.stripeConnectAccountId;
    if (!stripeConnectAccountId) {
      return NextResponse.json(
        { error: 'Payment is not configured for this organization' },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    // Get user's customer ID for this connected account
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const connectedCustomerIds = userData?.stripeConnectedCustomerIds || {};
    const customerId = connectedCustomerIds[stripeConnectAccountId];

    if (!customerId) {
      return NextResponse.json(
        { error: 'No saved payment method found. Please add a payment method first.' },
        { status: 400 }
      );
    }

    // Handle free programs (no payment needed)
    if (program.priceInCents === 0) {
      // Get user info for enrollment
      const clerk = await clerkClient();
      const clerkUser = await clerk.users.getUser(userId);
      
      const enrollResult = await enrollUserInProduct(
        userId,
        'program',
        programId,
        {
          firstName: clerkUser.firstName,
          lastName: clerkUser.lastName,
          imageUrl: clerkUser.imageUrl,
          email: clerkUser.emailAddresses[0]?.emailAddress,
        },
        {
          amountPaid: 0,
        }
      );

      if (!enrollResult.success) {
        return NextResponse.json(
          { error: enrollResult.error || 'Enrollment failed' },
          { status: 500 }
        );
      }

      console.log(`[COMPLETION_UPSELL] Free enrollment for user ${userId} in program ${programId}`);

      return NextResponse.json({
        success: true,
        enrollmentId: enrollResult.enrollmentId,
        free: true,
      });
    }

    // Calculate platform fee
    const platformFeePercent = orgSettings?.platformFeePercent ?? 1;
    const applicationFeeAmount = Math.round(program.priceInCents * (platformFeePercent / 100));

    // Build metadata
    const metadata: Record<string, string> = {
      userId,
      programId,
      organizationId,
      type: 'completion_upsell',
    };

    // Build description
    const description = `${program.name} - Completion Upsell (saved card)`;

    // Create and confirm payment intent immediately with the saved payment method
    let paymentIntent: Stripe.PaymentIntent;
    
    try {
      paymentIntent = await stripe.paymentIntents.create(
        {
          amount: program.priceInCents,
          currency: (program.currency || 'usd').toLowerCase(),
          customer: customerId,
          payment_method: paymentMethodId,
          confirm: true, // Confirm immediately for one-click
          off_session: true, // Customer not present
          description,
          metadata,
          application_fee_amount: applicationFeeAmount,
        },
        { stripeAccount: stripeConnectAccountId }
      );
    } catch (stripeError) {
      console.error('[COMPLETION_UPSELL] Stripe error:', stripeError);
      
      if (stripeError instanceof Stripe.errors.StripeCardError) {
        return NextResponse.json(
          { error: 'Payment failed: ' + stripeError.message },
          { status: 400 }
        );
      }
      
      throw stripeError;
    }

    // Check if payment succeeded
    if (paymentIntent.status !== 'succeeded') {
      console.error('[COMPLETION_UPSELL] Payment not succeeded:', paymentIntent.status);
      return NextResponse.json(
        { 
          error: 'Payment not completed', 
          status: paymentIntent.status,
          requiresAction: paymentIntent.status === 'requires_action',
        },
        { status: 400 }
      );
    }

    // Payment succeeded - enroll the user
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);

    const enrollResult = await enrollUserInProduct(
      userId,
      'program',
      programId,
      {
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        imageUrl: clerkUser.imageUrl,
        email: clerkUser.emailAddresses[0]?.emailAddress,
      },
      {
        stripePaymentIntentId: paymentIntent.id,
        amountPaid: program.priceInCents,
      }
    );

    if (!enrollResult.success) {
      // Payment succeeded but enrollment failed - this is a critical error
      // The webhook should handle this case, but log it
      console.error(
        `[COMPLETION_UPSELL] Payment succeeded but enrollment failed for user ${userId} in program ${programId}:`,
        enrollResult.error
      );
      
      // Still return success since payment went through
      // The user can be manually enrolled if needed
      return NextResponse.json({
        success: true,
        paymentIntentId: paymentIntent.id,
        enrollmentPending: true,
        warning: 'Payment successful. Enrollment will be processed shortly.',
      });
    }

    console.log(
      `[COMPLETION_UPSELL] Successfully purchased upsell for user ${userId} - program ${programId} - enrollment ${enrollResult.enrollmentId}`
    );

    return NextResponse.json({
      success: true,
      paymentIntentId: paymentIntent.id,
      enrollmentId: enrollResult.enrollmentId,
      connectedAccountId: stripeConnectAccountId,
    });
  } catch (error) {
    console.error('[COMPLETION_UPSELL] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}



