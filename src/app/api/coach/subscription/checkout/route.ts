import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { auth, clerkClient } from '@clerk/nextjs/server';
import type { CoachTier, CoachSubscription, OrgSettings, ClerkPublicMetadata } from '@/types';
import type { BillingPeriod } from '@/lib/coach-permissions';

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

// Coach tier Stripe price IDs - Monthly
const COACH_TIER_MONTHLY_PRICE_IDS: Record<CoachTier, string> = {
  starter: process.env.STRIPE_COACH_STARTER_PRICE_ID || 'price_1ShVoxGZhrOwy75wozPPoU4f',
  pro: process.env.STRIPE_COACH_PRO_PRICE_ID || 'price_1ShVpGGZhrOwy75wcFJQasPA',
  scale: process.env.STRIPE_COACH_SCALE_PRICE_ID || 'price_1ShVqFGZhrOwy75w0FPwa1Z9',
};

// Coach tier Stripe price IDs - Yearly (from Doppler)
const COACH_TIER_YEARLY_PRICE_IDS: Record<CoachTier, string> = {
  starter: process.env.STRIPE_COACH_STARTER_YEARLY_PRICE_ID!,
  pro: process.env.STRIPE_COACH_PRO_YEARLY_PRICE_ID!,
  scale: process.env.STRIPE_COACH_SCALE_YEARLY_PRICE_ID!,
};

// Helper to get price ID based on tier and billing period
function getPriceId(tier: CoachTier, billingPeriod: BillingPeriod = 'monthly'): string {
  return billingPeriod === 'yearly' 
    ? COACH_TIER_YEARLY_PRICE_IDS[tier] 
    : COACH_TIER_MONTHLY_PRICE_IDS[tier];
}

/**
 * POST /api/coach/subscription/checkout
 * 
 * Four flows supported:
 * 
 * 1. SAVED PAYMENT METHOD (paymentMethodId provided):
 *    - Uses existing saved card to create subscription immediately
 *    - No PaymentIntent needed - subscription is created and activated
 *    - Returns success: true with subscriptionId
 * 
 * 2. REACTIVATION (reactivate: true, no paymentMethodId):
 *    - Creates Subscription with payment_behavior: 'default_incomplete'
 *    - Frontend uses PaymentElement to collect payment details
 *    - Returns PaymentIntent clientSecret and subscriptionId
 * 
 * 3. UPGRADE (upgrade: true, no paymentMethodId):
 *    - Creates Subscription with payment_behavior: 'default_incomplete'
 *    - Frontend uses PaymentElement to collect payment details
 *    - Returns PaymentIntent clientSecret and subscriptionId
 * 
 * 4. ONBOARDING WITH TRIAL (trial: true):
 *    - Creates SetupIntent to save payment method
 *    - Frontend uses PaymentElement to collect payment details
 *    - On success, /api/coach/subscription/confirm creates the subscription with trial
 *    - Returns SetupIntent clientSecret
 * 
 * Body: { tier: CoachTier, billingPeriod?: BillingPeriod, trial?: boolean, onboarding?: boolean, reactivate?: boolean, upgrade?: boolean, paymentMethodId?: string }
 */
export async function POST(req: Request) {
  try {
    // Use direct auth - this is platform billing (GA charging coaches)
    // Works on both main domain (onboarding) and tenant subdomains
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get organization from user metadata (works on main domain during onboarding)
    // Use primaryOrganizationId (new multi-org field) with fallback to organizationId (legacy)
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const organizationId = publicMetadata?.primaryOrganizationId || publicMetadata?.organizationId;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'No organization found. Please complete coach signup first.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { tier, billingPeriod = 'monthly', trial, onboarding, reactivate, upgrade, paymentMethodId } = body as { 
      tier: CoachTier; 
      billingPeriod?: BillingPeriod; // 'monthly' or 'yearly'
      trial?: boolean;      // Request 7-day trial
      onboarding?: boolean; // Is part of onboarding flow
      reactivate?: boolean; // Reactivating canceled/expired subscription
      upgrade?: boolean;    // Upgrading to a higher tier
      paymentMethodId?: string; // Use existing saved payment method
    };

    // Validate tier
    if (!tier || !['starter', 'pro', 'scale'].includes(tier)) {
      return NextResponse.json({ error: 'Invalid tier selected' }, { status: 400 });
    }

    const stripe = getStripeClient();

    // Get or create Stripe customer for the coach
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);
    const email = clerkUser.emailAddresses[0]?.emailAddress;

    // Get org settings to check for existing customer ID
    const settingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
    const settings = settingsDoc.data() as OrgSettings | undefined;

    // Check for existing subscription
    let existingSubscription: CoachSubscription | null = null;
    if (settings?.coachSubscriptionId) {
      const subDoc = await adminDb
        .collection('coach_subscriptions')
        .doc(settings.coachSubscriptionId)
        .get();
      if (subDoc.exists) {
        existingSubscription = { id: subDoc.id, ...subDoc.data() } as CoachSubscription;
      }
    }

    let customerId = existingSubscription?.stripeCustomerId;

    // Create or get Stripe customer
    if (!customerId && email) {
      // Check if customer exists by email
      const existingCustomers = await stripe.customers.list({
        email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id;
      } else {
        // Create new customer
        const customer = await stripe.customers.create({
          email,
          name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || undefined,
          metadata: {
            userId,
            organizationId,
            type: 'coach',
          },
        });
        customerId = customer.id;
      }
    }

    if (!customerId) {
      return NextResponse.json(
        { error: 'Could not create customer. Please try again.' },
        { status: 500 }
      );
    }

    // SAVED PAYMENT METHOD FLOW: Use existing card to create subscription immediately
    // This skips the PaymentElement and charges the saved card directly
    if (paymentMethodId && (reactivate || upgrade)) {
      const priceId = getPriceId(tier, billingPeriod);
      const flowType = reactivate ? 'reactivate' : 'upgrade';
      
      try {
        // Verify the payment method belongs to this customer
        const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
        if (paymentMethod.customer !== customerId) {
          return NextResponse.json(
            { error: 'Invalid payment method' },
            { status: 400 }
          );
        }

        // Create subscription with the saved payment method
        const subscription = await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: priceId }],
          default_payment_method: paymentMethodId,
          payment_settings: { 
            save_default_payment_method: 'on_subscription',
            payment_method_types: ['card'],
          },
          expand: ['latest_invoice.payment_intent'],
          metadata: {
            userId,
            organizationId,
            tier,
            billingPeriod,
            type: 'coach_subscription',
            reactivate: reactivate ? 'true' : 'false',
            upgrade: upgrade ? 'true' : 'false',
          },
        });

        // Check if payment succeeded
        const invoice = subscription.latest_invoice as Stripe.Invoice;
        
        if (subscription.status === 'active') {
          console.log(`[COACH_CHECKOUT] Created active subscription ${subscription.id} with saved PM for ${flowType}, org ${organizationId}, tier ${tier}, billing ${billingPeriod}`);
          
          return NextResponse.json({ 
            success: true,
            subscriptionId: subscription.id,
            status: subscription.status,
            customerId,
          });
        }
        
        // If subscription requires payment (e.g., card declined), handle it
        if (subscription.status === 'incomplete') {
          const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;
          
          if (paymentIntent?.status === 'requires_action') {
            // 3D Secure required - return clientSecret for frontend to handle
            console.log(`[COACH_CHECKOUT] 3DS required for subscription ${subscription.id}, org ${organizationId}`);
            return NextResponse.json({ 
              clientSecret: paymentIntent.client_secret,
              subscriptionId: subscription.id,
              requires3DS: true,
              customerId,
            });
          }
          
          // Payment failed - cancel subscription and return error
          await stripe.subscriptions.cancel(subscription.id);
          return NextResponse.json(
            { error: 'Payment failed. Please try a different card.' },
            { status: 402 }
          );
        }

        // Unexpected status
        console.error(`[COACH_CHECKOUT] Unexpected subscription status: ${subscription.status}`);
        return NextResponse.json(
          { error: 'Subscription creation failed. Please try again.' },
          { status: 500 }
        );
      } catch (error) {
        console.error(`[COACH_CHECKOUT] Saved payment method error:`, error);
        const message = error instanceof Error ? error.message : 'Payment failed';
        return NextResponse.json({ error: message }, { status: 402 });
      }
    }

    // REACTIVATION/UPGRADE FLOW (without saved payment method): Create subscription with incomplete payment
    // This returns a PaymentIntent clientSecret compatible with PaymentElement
    if (reactivate || upgrade) {
      const priceId = getPriceId(tier, billingPeriod);
      const flowType = reactivate ? 'reactivate' : 'upgrade';
      
      // Create subscription with payment_behavior: 'default_incomplete'
      // This creates the subscription in 'incomplete' status with a PaymentIntent
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { 
          save_default_payment_method: 'on_subscription',
          payment_method_types: ['card'],
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          userId,
          organizationId,
          tier,
          billingPeriod,
          type: 'coach_subscription',
          reactivate: reactivate ? 'true' : 'false',
          upgrade: upgrade ? 'true' : 'false',
        },
      });

      // Get the PaymentIntent from the latest invoice
      const invoice = subscription.latest_invoice as Stripe.Invoice;
      const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

      if (!paymentIntent?.client_secret) {
        // Cleanup the incomplete subscription if we can't get the PaymentIntent
        await stripe.subscriptions.cancel(subscription.id);
        return NextResponse.json(
          { error: 'Failed to create payment. Please try again.' },
          { status: 500 }
        );
      }

      console.log(`[COACH_CHECKOUT] Created Subscription ${subscription.id} with PaymentIntent for ${flowType}, org ${organizationId}, tier ${tier}, billing ${billingPeriod}`);

      return NextResponse.json({ 
        clientSecret: paymentIntent.client_secret,
        subscriptionId: subscription.id,
        customerId,
      });
    }

    // ONBOARDING/TRIAL FLOW: Use SetupIntent to save payment method
    // Frontend uses PaymentElement, then calls /confirm to create subscription with trial
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      metadata: {
        userId,
        organizationId,
        tier,
        billingPeriod,
        type: 'coach_subscription',
        trial: trial ? 'true' : 'false',
        onboarding: onboarding ? 'true' : 'false',
      },
      usage: 'off_session', // For recurring subscription billing
    });

    console.log(`[COACH_CHECKOUT] Created SetupIntent ${setupIntent.id} for org ${organizationId}, tier ${tier}, billing ${billingPeriod}`);

    return NextResponse.json({ 
      clientSecret: setupIntent.client_secret,
      customerId,
    });
  } catch (error) {
    console.error('[COACH_CHECKOUT]', error);
    const message = error instanceof Error ? error.message : 'Failed to create checkout session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
