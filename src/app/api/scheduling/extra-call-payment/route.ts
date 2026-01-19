/**
 * API Route: Extra Call Payment
 *
 * POST /api/scheduling/extra-call-payment
 * Create a payment intent for an extra call BEFORE the event is created.
 * This is different from /api/scheduling/payment which requires an existing event.
 *
 * Body:
 * - enrollmentId: string - The program enrollment ID
 * - durationMinutes?: number - Call duration (for description)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import Stripe from 'stripe';

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
    _stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia' });
  }
  return _stripe;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { enrollmentId, durationMinutes = 60 } = body;

    if (!enrollmentId) {
      return NextResponse.json(
        { error: 'Enrollment ID is required' },
        { status: 400 }
      );
    }

    // Get enrollment
    const enrollmentDoc = await adminDb
      .collection('program_enrollments')
      .doc(enrollmentId)
      .get();

    if (!enrollmentDoc.exists) {
      return NextResponse.json(
        { error: 'Enrollment not found' },
        { status: 404 }
      );
    }

    const enrollment = enrollmentDoc.data();

    // Verify user owns this enrollment
    if (enrollment?.userId !== userId) {
      return NextResponse.json(
        { error: 'You are not the owner of this enrollment' },
        { status: 403 }
      );
    }

    // Get program to check extra call price
    const programDoc = await adminDb
      .collection('programs')
      .doc(enrollment.programId)
      .get();

    if (!programDoc.exists) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    const program = programDoc.data();
    const pricePerExtraCallCents = program?.pricePerExtraCallCents || 0;

    if (pricePerExtraCallCents <= 0) {
      return NextResponse.json(
        { error: 'Extra calls are free for this program' },
        { status: 400 }
      );
    }

    // Get user email for Stripe receipt
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userEmail = userData?.email || userData?.primaryEmail;

    // Get organization for Stripe Connect (if coach has connected account)
    const orgDoc = await adminDb.collection('organizations').doc(enrollment.organizationId).get();
    const orgData = orgDoc.data();
    const stripeAccountId = orgData?.stripeAccountId;

    // Create payment intent
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: pricePerExtraCallCents,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        type: 'extra_call',
        enrollmentId,
        programId: enrollment.programId,
        userId,
        organizationId: enrollment.organizationId,
      },
      receipt_email: userEmail,
      description: `Extra ${durationMinutes}-minute coaching call - ${program?.name || 'Program'}`,
    };

    // If coach has Stripe Connect, send payment to their account
    if (stripeAccountId) {
      // Application fee: 10% (adjust as needed)
      const applicationFee = Math.round(pricePerExtraCallCents * 0.1);
      paymentIntentParams.application_fee_amount = applicationFee;
      paymentIntentParams.transfer_data = {
        destination: stripeAccountId,
      };
    }

    const paymentIntent = await getStripe().paymentIntents.create(paymentIntentParams);

    console.log(`[EXTRA_CALL_PAYMENT] Created PaymentIntent ${paymentIntent.id} for enrollment ${enrollmentId}`);

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: pricePerExtraCallCents,
      currency: 'usd',
    });
  } catch (error) {
    console.error('[EXTRA_CALL_PAYMENT] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}
