import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { auth, clerkClient } from '@clerk/nextjs/server';
import type { CoachTier, CoachSubscription, OrgSettings, ClerkPublicMetadata } from '@/types';
import { TIER_PRICING } from '@/lib/coach-permissions';

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
// Environment variables set in Doppler, with fallback values
const COACH_TIER_PRICE_IDS: Record<CoachTier, string> = {
  starter: process.env.STRIPE_COACH_STARTER_PRICE_ID || 'price_1ShVoxGZhrOwy75wozPPoU4f',
  pro: process.env.STRIPE_COACH_PRO_PRICE_ID || 'price_1ShVpGGZhrOwy75wcFJQasPA',
  scale: process.env.STRIPE_COACH_SCALE_PRICE_ID || 'price_1ShVqFGZhrOwy75w0FPwa1Z9',
};

/**
 * POST /api/coach/subscription/checkout
 * Create a Stripe Checkout session for coach subscription
 * 
 * Body: { tier: CoachTier }
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
    const { tier, trial, onboarding } = body as { 
      tier: CoachTier; 
      trial?: boolean;      // Request 7-day trial
      onboarding?: boolean; // Is part of onboarding flow
    };

    // Validate tier
    if (!tier || !['starter', 'pro', 'scale'].includes(tier)) {
      return NextResponse.json({ error: 'Invalid tier selected' }, { status: 400 });
    }

    const priceId = COACH_TIER_PRICE_IDS[tier];
    
    // If price ID is not configured, fall back to a placeholder checkout flow
    // In production, you'd want to ensure these are always configured
    if (!priceId) {
      console.warn(`[COACH_CHECKOUT] No price ID configured for tier: ${tier}. Using placeholder.`);
      // For now, return an error - in production, set up the prices
      return NextResponse.json(
        { error: `Checkout not yet configured for ${tier} tier. Please contact support.` },
        { status: 400 }
      );
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

    // Build checkout session params for embedded checkout
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://growthaddicts.app';
    
    // Determine return URL based on context
    const returnUrl = onboarding
      ? `${baseUrl}/coach/welcome?session_id={CHECKOUT_SESSION_ID}`
      : `${baseUrl}/coach?tab=plan&success=true&session_id={CHECKOUT_SESSION_ID}`;
    
    // Use embedded checkout mode for in-page payment experience
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      ui_mode: 'embedded',
      customer: customerId || undefined,
      customer_email: customerId ? undefined : email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      return_url: returnUrl,
      metadata: {
        userId,
        organizationId,
        tier,
        type: 'coach_subscription',
        onboarding: onboarding ? 'true' : 'false',
      },
      subscription_data: {
        metadata: {
          userId,
          organizationId,
          tier,
          type: 'coach_subscription',
        },
        // Add 7-day trial if requested (typically during onboarding)
        ...(trial ? { trial_period_days: 7 } : {}),
      },
      allow_promotion_codes: true,
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log(`[COACH_CHECKOUT] Created embedded checkout session ${session.id} for org ${organizationId}, tier ${tier}`);

    return NextResponse.json({ clientSecret: session.client_secret });
  } catch (error) {
    console.error('[COACH_CHECKOUT]', error);
    const message = error instanceof Error ? error.message : 'Failed to create checkout session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

