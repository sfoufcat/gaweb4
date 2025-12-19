import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';

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
 * POST /api/guest/verify-checkout
 * Verifies a Stripe checkout session and returns the customer email and payment status
 * 
 * This is called after a guest user returns from Stripe checkout to verify
 * the payment was successful and get their email for account creation.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'subscription'],
    });

    // Check payment status
    if (session.payment_status !== 'paid') {
      return NextResponse.json({
        success: false,
        status: session.payment_status,
        error: 'Payment not completed',
      });
    }

    // Get customer email
    const customerEmail = 
      (session.customer as Stripe.Customer)?.email ||
      session.customer_email ||
      session.customer_details?.email;

    if (!customerEmail) {
      return NextResponse.json({
        success: false,
        error: 'Could not retrieve customer email',
      });
    }

    // Get guest session ID from metadata
    const guestSessionId = session.metadata?.guestSessionId;
    
    // Get subscription details
    const subscription = session.subscription as Stripe.Subscription | null;
    const subscriptionId = typeof session.subscription === 'string' 
      ? session.subscription 
      : subscription?.id;
    
    const customerId = typeof session.customer === 'string'
      ? session.customer
      : (session.customer as Stripe.Customer)?.id;

    // If we have a guest session ID, update it with payment info
    if (guestSessionId) {
      await adminDb.collection('guestSessions').doc(guestSessionId).set({
        paymentStatus: 'completed',
        stripeSessionId: sessionId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        email: customerEmail,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }

    // Get plan from metadata
    const plan = session.metadata?.plan || 'standard';

    return NextResponse.json({
      success: true,
      status: 'active',
      email: customerEmail,
      plan,
      guestSessionId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
    });

  } catch (error: any) {
    console.error('[GUEST_VERIFY_CHECKOUT_ERROR]', error);
    
    // Handle specific Stripe errors
    if (error.type === 'StripeInvalidRequestError') {
      return NextResponse.json({
        success: false,
        error: 'Invalid checkout session',
      }, { status: 400 });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to verify checkout session' },
      { status: 500 }
    );
  }
}








