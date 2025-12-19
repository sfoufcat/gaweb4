import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';

// Lazy initialization of Stripe to avoid build-time errors
function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(key, {
    apiVersion: '2025-02-24.acacia',
  });
}

// Price IDs from environment variables
const PRICE_IDS: Record<string, string | undefined> = {
  standard_monthly: process.env.STRIPE_STANDARD_MONTHLY_PRICE_ID,
  premium_monthly: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID,
  standard_halfyear: process.env.STRIPE_STANDARD_HALF_YEAR_PRICE_ID,
  premium_halfyear: process.env.STRIPE_PREMIUM_HALF_YEAR_PRICE_ID,
};

/**
 * POST /api/checkout/guest
 * Creates a Stripe Checkout Session for guest users (no auth required)
 * 
 * The key difference from /api/checkout is:
 * - No authentication required
 * - Uses guestSessionId instead of userId
 * - Email is passed in the request body
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { plan, email, guestSessionId, billingPeriod = 'monthly' } = body;

    // Validate required fields
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!guestSessionId) {
      return NextResponse.json({ error: 'Guest session ID is required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Validate plan
    if (!plan || !['standard', 'premium'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 });
    }

    // Validate guest session exists
    const guestDoc = await adminDb.collection('guestSessions').doc(guestSessionId).get();
    if (!guestDoc.exists) {
      return NextResponse.json({ error: 'Invalid guest session' }, { status: 400 });
    }

    const stripe = getStripeClient();

    // Get price ID
    const priceKey = `${plan}_${billingPeriod}`;
    const priceId = PRICE_IDS[priceKey];

    if (!priceId) {
      console.error(`Missing price ID for: ${priceKey}`);
      return NextResponse.json(
        { error: 'Price configuration error. Please contact support.' },
        { status: 500 }
      );
    }

    // Check if a customer with this email already exists
    let customerId: string | undefined;
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id;
    }

    // Build checkout session parameters
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      // Guest checkout redirects to a different success page
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/start/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/start/plan?checkout=canceled`,
      metadata: {
        // Note: No userId here - this is a guest checkout
        guestSessionId: guestSessionId,
        plan: plan,
        isGuestCheckout: 'true',
      },
      subscription_data: {
        metadata: {
          guestSessionId: guestSessionId,
          plan: plan,
          isGuestCheckout: 'true',
        },
      },
    };

    // Add customer if we found one, otherwise use customer_email
    if (customerId) {
      sessionParams.customer = customerId;
    } else {
      sessionParams.customer_email = email;
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create(sessionParams);

    // Update guest session with selected plan and email
    await adminDb.collection('guestSessions').doc(guestSessionId).set({
      email,
      selectedPlan: plan,
      stripeCheckoutSessionId: session.id,
      paymentStatus: 'pending',
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return NextResponse.json({ url: session.url });

  } catch (error) {
    console.error('[GUEST_CHECKOUT_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Failed to create checkout session';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}








