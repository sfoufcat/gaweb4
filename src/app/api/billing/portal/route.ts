import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';

// Lazy initialization of Stripe to avoid build-time errors
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    _stripe = new Stripe(key, {
      apiVersion: '2025-02-24.acacia',
    });
  }
  return _stripe;
}

/**
 * POST /api/billing/portal
 * Creates a Stripe Customer Portal session for the current user
 * 
 * Returns the portal URL where the user can:
 * - Update payment method
 * - View invoices
 * - Upgrade/downgrade plans
 * - Cancel subscription
 */
export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stripe = getStripe();

    // Get user data from Firestore
    const userDoc = await adminDb.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const stripeCustomerId = userData?.billing?.stripeCustomerId;

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: 'No subscription found. Please subscribe first.' },
        { status: 400 }
      );
    }

    // Verify the customer exists in Stripe
    try {
      await stripe.customers.retrieve(stripeCustomerId);
    } catch (stripeError) {
      const errorCode = (stripeError as { code?: string })?.code;
      if (errorCode === 'resource_missing') {
        return NextResponse.json(
          { error: 'Subscription record not found. Please contact support.' },
          { status: 400 }
        );
      }
      throw stripeError;
    }

    // Build return URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || 'http://localhost:3000';
    const returnUrl = `${appUrl}/profile`;

    // Create Stripe Billing Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    console.log(`[BILLING_PORTAL] Created portal session for user ${userId}, customer ${stripeCustomerId}`);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[BILLING_PORTAL] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create billing portal session';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}









