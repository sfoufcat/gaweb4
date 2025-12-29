import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { auth, clerkClient } from '@clerk/nextjs/server';
import type { CoachTier, CoachSubscription, OrgSettings, ClerkPublicMetadata } from '@/types';

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

// Coach tier Stripe price IDs
const COACH_TIER_PRICE_IDS: Record<CoachTier, string> = {
  starter: process.env.STRIPE_COACH_STARTER_PRICE_ID || 'price_1ShVoxGZhrOwy75wozPPoU4f',
  pro: process.env.STRIPE_COACH_PRO_PRICE_ID || 'price_1ShVpGGZhrOwy75wcFJQasPA',
  scale: process.env.STRIPE_COACH_SCALE_PRICE_ID || 'price_1ShVqFGZhrOwy75w0FPwa1Z9',
};

/**
 * POST /api/coach/subscription/checkout
 * 
 * Two flows supported:
 * 
 * 1. REACTIVATION (reactivate: true):
 *    - Creates Checkout Session for immediate billing
 *    - Used by EmbeddedCheckout on /coach/reactivate page
 *    - Returns Checkout Session clientSecret
 * 
 * 2. ONBOARDING WITH TRIAL (trial: true):
 *    - Creates SetupIntent to save payment method
 *    - Frontend uses PaymentElement to collect payment details
 *    - On success, /api/coach/subscription/confirm creates the subscription with trial
 *    - Returns SetupIntent clientSecret
 * 
 * Body: { tier: CoachTier, trial?: boolean, onboarding?: boolean, reactivate?: boolean }
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
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const organizationId = publicMetadata?.organizationId || publicMetadata?.primaryOrganizationId;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'No organization found. Please complete coach signup first.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { tier, trial, onboarding, reactivate } = body as { 
      tier: CoachTier; 
      trial?: boolean;      // Request 7-day trial
      onboarding?: boolean; // Is part of onboarding flow
      reactivate?: boolean; // Reactivating canceled/expired subscription
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

    // REACTIVATION FLOW: Use Checkout Session for immediate billing
    // This returns a clientSecret compatible with EmbeddedCheckout
    if (reactivate) {
      const priceId = COACH_TIER_PRICE_IDS[tier];
      
      // Determine base URL for redirects
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.growthaddicts.com';
      
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        ui_mode: 'embedded',
        line_items: [{ price: priceId, quantity: 1 }],
        return_url: `${baseUrl}/coach?reactivated=true`,
        metadata: {
          userId,
          organizationId,
          tier,
          type: 'coach_subscription',
          reactivate: 'true',
        },
        subscription_data: {
          metadata: {
            userId,
            organizationId,
            tier,
            type: 'coach_subscription',
          },
        },
      });

      console.log(`[COACH_CHECKOUT] Created Checkout Session ${session.id} for reactivation, org ${organizationId}, tier ${tier}`);

      return NextResponse.json({ 
        clientSecret: session.client_secret,
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
        type: 'coach_subscription',
        trial: trial ? 'true' : 'false',
        onboarding: onboarding ? 'true' : 'false',
      },
      usage: 'off_session', // For recurring subscription billing
    });

    console.log(`[COACH_CHECKOUT] Created SetupIntent ${setupIntent.id} for org ${organizationId}, tier ${tier}`);

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
