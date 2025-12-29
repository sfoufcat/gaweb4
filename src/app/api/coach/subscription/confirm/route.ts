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
 * POST /api/coach/subscription/confirm
 * Create the subscription after payment method is set up via SetupIntent
 * 
 * Body: { 
 *   setupIntentId: string,
 *   tier: CoachTier,
 *   trial?: boolean,
 *   onboarding?: boolean
 * }
 */
export async function POST(req: Request) {
  try {
    // Use direct auth - this is platform billing (GA charging coaches)
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get organization from user metadata
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const organizationId = publicMetadata?.organizationId || publicMetadata?.primaryOrganizationId;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'No organization found.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { setupIntentId, tier, trial, onboarding } = body as { 
      setupIntentId: string;
      tier: CoachTier; 
      trial?: boolean;
      onboarding?: boolean;
    };

    if (!setupIntentId) {
      return NextResponse.json({ error: 'Setup intent ID required' }, { status: 400 });
    }

    // Validate tier
    if (!tier || !['starter', 'pro', 'scale'].includes(tier)) {
      return NextResponse.json({ error: 'Invalid tier selected' }, { status: 400 });
    }

    const priceId = COACH_TIER_PRICE_IDS[tier];
    if (!priceId) {
      return NextResponse.json(
        { error: `Subscription not configured for ${tier} tier.` },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();

    // Retrieve the SetupIntent to get the payment method
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);

    if (setupIntent.status !== 'succeeded') {
      return NextResponse.json(
        { error: 'Payment method setup not completed' },
        { status: 400 }
      );
    }

    const paymentMethodId = setupIntent.payment_method as string;
    const customerId = setupIntent.customer as string;

    if (!paymentMethodId || !customerId) {
      return NextResponse.json(
        { error: 'Payment method or customer not found' },
        { status: 400 }
      );
    }

    // Set as default payment method for the customer
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Create the subscription
    const subscriptionParams: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      items: [{ price: priceId }],
      default_payment_method: paymentMethodId,
      metadata: {
        userId,
        organizationId,
        tier,
        type: 'coach_subscription',
      },
      // Add 7-day trial if requested
      ...(trial ? { trial_period_days: 7 } : {}),
      // Expand latest invoice for immediate access
      expand: ['latest_invoice.payment_intent'],
    };

    const subscription = await stripe.subscriptions.create(subscriptionParams);

    console.log(`[COACH_SUBSCRIPTION_CONFIRM] Created subscription ${subscription.id} for org ${organizationId}, tier ${tier}`);

    // Save subscription to Firestore
    const now = new Date().toISOString();
    const coachSubscriptionData: Omit<CoachSubscription, 'id'> = {
      organizationId,
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      tier,
      status: subscription.status as CoachSubscription['status'],
      currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      trialEnd: subscription.trial_end 
        ? new Date(subscription.trial_end * 1000).toISOString() 
        : undefined,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      createdAt: now,
      updatedAt: now,
    };

    const subDocRef = await adminDb.collection('coach_subscriptions').add(coachSubscriptionData);

    // Update org_settings with subscription reference
    await adminDb.collection('org_settings').doc(organizationId).set({
      coachSubscriptionId: subDocRef.id,
      coachTier: tier,
      updatedAt: now,
    }, { merge: true });

    // If this is onboarding, update onboarding state to active
    if (onboarding) {
      await adminDb.collection('coach_onboarding').doc(organizationId).set({
        status: 'active',
        planSelectedAt: now,
        updatedAt: now,
      }, { merge: true });

      // Update user's billing status in Clerk
      try {
        const clerk = await clerkClient();
        await clerk.users.updateUserMetadata(userId, {
          publicMetadata: {
            ...publicMetadata,
            billingStatus: subscription.status === 'trialing' ? 'trialing' : 'active',
            billingPeriodEnd: coachSubscriptionData.currentPeriodEnd,
          },
        });
      } catch (error) {
        console.error('[COACH_SUBSCRIPTION_CONFIRM] Failed to update Clerk metadata:', error);
        // Continue - subscription is created, this is not critical
      }
    }

    return NextResponse.json({ 
      success: true,
      subscriptionId: subscription.id,
      status: subscription.status,
      trialEnd: coachSubscriptionData.trialEnd,
    });
  } catch (error) {
    console.error('[COACH_SUBSCRIPTION_CONFIRM]', error);
    const message = error instanceof Error ? error.message : 'Failed to create subscription';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

