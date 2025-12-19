import { auth } from '@clerk/nextjs/server';
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

// Price IDs for new 3-tier pricing
// Trial: $9.99/week (converts to $39.99/month after 1 week)
// Standard: $39.99/month (direct)
// Premium: $99/month
const PRICE_IDS = {
  // Trial weekly price (first week at $9.99)
  trial_weekly: process.env.STRIPE_TRIAL_WEEKLY_PRICE_ID || 'price_1SaLTQGZhrOwy75wyu7kdVRN',
  // Standard monthly price (what trial converts to, and direct standard plan)
  standard_monthly: process.env.STRIPE_STANDARD_MONTHLY_PRICE_ID || 'price_1SaLPhGZhrOwy75wesngK2M3',
  // Premium monthly price
  premium_monthly: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID || 'price_1SXkqZGZhrOwy75wAG3mSczA',
};

/**
 * POST /api/checkout
 * Creates a Stripe Checkout Session for subscription
 * 
 * Supports 3 plans:
 * - trial: $9.99/week for first week, then auto-converts to $39.99/month
 * - standard: $39.99/month direct
 * - premium: $99/month
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stripe = getStripeClient();
    const body = await req.json();
    const { plan, inviteToken } = body;

    // Validate plan
    if (!plan || !['trial', 'standard', 'premium'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 });
    }

    // Get price ID based on plan
    let priceId: string;
    let isTrial = false;
    
    switch (plan) {
      case 'trial':
        priceId = PRICE_IDS.trial_weekly;
        isTrial = true;
        break;
      case 'standard':
        priceId = PRICE_IDS.standard_monthly;
        break;
      case 'premium':
        priceId = PRICE_IDS.premium_monthly;
        break;
      default:
        return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 });
    }

    if (!priceId) {
      console.error(`Missing price ID for plan: ${plan}`);
      return NextResponse.json(
        { error: 'Price configuration error. Please contact support.' }, 
        { status: 500 }
      );
    }

    // Get user data from Firestore
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userEmail = userData?.email;

    // Check if user already has a Stripe customer ID
    let customerId = userData?.billing?.stripeCustomerId;

    if (!customerId && userEmail) {
      // Check if customer exists by email
      const existingCustomers = await stripe.customers.list({
        email: userEmail,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id;
      } else {
        // Create new customer
        const customer = await stripe.customers.create({
          email: userEmail,
          metadata: {
            userId: userId,
          },
        });
        customerId = customer.id;
      }

      // Save customer ID to Firestore
      await adminDb.collection('users').doc(userId).set({
        billing: {
          stripeCustomerId: customerId,
        },
      }, { merge: true });
    }

    // Determine the effective tier for access control
    // Trial and Standard both get 'standard' tier access
    // Premium gets 'premium' tier access
    const effectiveTier = plan === 'premium' ? 'premium' : 'standard';

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
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/onboarding/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/onboarding/plan?checkout=canceled`,
      metadata: {
        userId: userId,
        plan: plan,
        effectiveTier: effectiveTier,
        isTrial: isTrial ? 'true' : 'false',
        inviteToken: inviteToken || '',
      },
      subscription_data: {
        metadata: {
          userId: userId,
          plan: plan,
          effectiveTier: effectiveTier,
          isTrial: isTrial ? 'true' : 'false',
          inviteToken: inviteToken || '',
          // For trial plans, store the monthly price ID for later conversion
          ...(isTrial ? { convertToPriceId: PRICE_IDS.standard_monthly } : {}),
        },
      },
    };

    // Add customer if we have one
    if (customerId) {
      sessionParams.customer = customerId;
    } else if (userEmail) {
      sessionParams.customer_email = userEmail;
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ url: session.url });

  } catch (error: any) {
    console.error('[CHECKOUT_ERROR]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' }, 
      { status: 500 }
    );
  }
}

