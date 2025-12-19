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
 * POST /api/checkout/create-subscription
 * Creates a Stripe subscription with incomplete payment for embedded checkout
 * Returns the client secret for the PaymentIntent
 * 
 * This is used for embedded Stripe Elements checkout (no redirect)
 * 
 * Supports 3 plans:
 * - trial: $9.99/week for first week, then auto-converts to $39.99/month
 * - standard: $39.99/month direct
 * - premium: $99/month
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { plan, email, firstName, lastName, guestSessionId } = body;

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
    if (!plan || !['trial', 'standard', 'premium'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 });
    }

    // Validate guest session exists
    const guestDoc = await adminDb.collection('guestSessions').doc(guestSessionId).get();
    if (!guestDoc.exists) {
      return NextResponse.json({ error: 'Invalid guest session' }, { status: 400 });
    }

    const stripe = getStripeClient();

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

    // Determine the effective tier for access control
    // Trial and Standard both get 'standard' tier access
    // Premium gets 'premium' tier access
    const effectiveTier = plan === 'premium' ? 'premium' : 'standard';

    // Create or get existing customer
    let customer: Stripe.Customer;
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
      // Update customer name if provided and different
      const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
      if (fullName && customer.name !== fullName) {
        customer = await stripe.customers.update(customer.id, { name: fullName });
      }
    } else {
      // Create new customer
      const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
      customer = await stripe.customers.create({
        email: email,
        name: fullName || undefined,
        metadata: {
          guestSessionId: guestSessionId,
        },
      });
    }

    // Create subscription with incomplete payment
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { 
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        guestSessionId: guestSessionId,
        plan: plan,
        effectiveTier: effectiveTier,
        isTrial: isTrial ? 'true' : 'false',
        isGuestCheckout: 'true',
        // For trial plans, store the monthly price ID for later conversion
        ...(isTrial ? { convertToPriceId: PRICE_IDS.standard_monthly } : {}),
      },
    });

    // Get the client secret from the payment intent
    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

    if (!paymentIntent?.client_secret) {
      throw new Error('Failed to create payment intent');
    }

    // Update PaymentIntent metadata with guestSessionId for verification
    await stripe.paymentIntents.update(paymentIntent.id, {
      metadata: {
        guestSessionId: guestSessionId,
        plan: plan,
        effectiveTier: effectiveTier,
        isTrial: isTrial ? 'true' : 'false',
        isGuestCheckout: 'true',
      },
    });

    // Update guest session with subscription info
    await adminDb.collection('guestSessions').doc(guestSessionId).set({
      email,
      firstName,
      lastName,
      selectedPlan: plan,
      effectiveTier: effectiveTier,
      isTrial: isTrial,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: subscription.id,
      paymentStatus: 'pending',
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return NextResponse.json({
      subscriptionId: subscription.id,
      clientSecret: paymentIntent.client_secret,
      customerId: customer.id,
    });

  } catch (error) {
    console.error('[CREATE_SUBSCRIPTION_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Failed to create subscription';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

