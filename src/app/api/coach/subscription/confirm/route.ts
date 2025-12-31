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

// Coach tier Stripe price IDs - Yearly
const COACH_TIER_YEARLY_PRICE_IDS: Record<CoachTier, string> = {
  starter: process.env.STRIPE_COACH_STARTER_YEARLY_PRICE_ID || 'price_1SkVUEGZhrOwy75wa5gVzRgV',
  pro: process.env.STRIPE_COACH_PRO_YEARLY_PRICE_ID || 'price_1SkVV8GZhrOwy75w3TMsA8U9',
  scale: process.env.STRIPE_COACH_SCALE_YEARLY_PRICE_ID || 'price_1SkVVVGZhrOwy75wqY09RQZY',
};

// Helper to get price ID based on tier and billing period
function getPriceId(tier: CoachTier, billingPeriod: BillingPeriod = 'monthly'): string {
  return billingPeriod === 'yearly' 
    ? COACH_TIER_YEARLY_PRICE_IDS[tier] 
    : COACH_TIER_MONTHLY_PRICE_IDS[tier];
}

/**
 * POST /api/coach/subscription/confirm
 * Create the subscription after payment method is set up via SetupIntent
 * 
 * Body: { 
 *   setupIntentId: string,
 *   tier: CoachTier,
 *   billingPeriod?: BillingPeriod,
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
    // Use primaryOrganizationId (new multi-org field) with fallback to organizationId (legacy)
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const organizationId = publicMetadata?.primaryOrganizationId || publicMetadata?.organizationId;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'No organization found.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { setupIntentId, tier, billingPeriod = 'monthly', trial, onboarding } = body as { 
      setupIntentId: string;
      tier: CoachTier;
      billingPeriod?: BillingPeriod;
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

    const priceId = getPriceId(tier, billingPeriod);
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
        billingPeriod,
        type: 'coach_subscription',
      },
      // Add 7-day trial if requested
      ...(trial ? { trial_period_days: 7 } : {}),
      // Expand latest invoice for immediate access
      expand: ['latest_invoice.payment_intent'],
    };

    const subscription = await stripe.subscriptions.create(subscriptionParams);

    console.log(`[COACH_SUBSCRIPTION_CONFIRM] Created subscription ${subscription.id} for org ${organizationId}, tier ${tier}, billing ${billingPeriod}`);

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

    // If this is onboarding, update onboarding state to needs_branding
    // The state will be set to 'active' after the user completes branding setup
    if (onboarding) {
      await adminDb.collection('coach_onboarding').doc(organizationId).set({
        status: 'needs_branding',
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
        console.error('[COACH_SUBSCRIPTION_CONFIRM] Failed to update Clerk user metadata:', error);
        // Continue - subscription is created, this is not critical
      }
    }

    // CRITICAL: Sync billing state to Clerk ORGANIZATION publicMetadata
    // This is what the middleware checks for subscription access on tenant domains
    // Without this, the coach would be redirected to /coach/reactivate after payment
    try {
      const clerk = await clerkClient();
      const org = await clerk.organizations.getOrganization({ organizationId });
      const existingOrgMetadata = org.publicMetadata || {};
      
      const subscriptionStatus = subscription.status === 'trialing' ? 'trialing' : 'active';
      
      await clerk.organizations.updateOrganization(organizationId, {
        publicMetadata: {
          ...existingOrgMetadata,
          plan: tier,
          subscriptionStatus,
          currentPeriodEnd: coachSubscriptionData.currentPeriodEnd,
          trialEnd: coachSubscriptionData.trialEnd,
          cancelAtPeriodEnd: false,
          onboardingState: 'needs_branding', // Will be set to 'active' after branding setup
        },
      });
      console.log(`[COACH_SUBSCRIPTION_CONFIRM] Synced billing to Clerk org ${organizationId}: plan=${tier}, status=${subscriptionStatus}`);
      
      // Also update org_settings with subscription status for Edge Config sync
      await adminDb.collection('org_settings').doc(organizationId).set({
        subscriptionStatus,
        updatedAt: now,
      }, { merge: true });
      
      // Sync subscription to Edge Config for immediate middleware access
      // This prevents redirect to /coach/reactivate before Clerk session refreshes
      try {
        const { getOrgDomain } = await import('@/lib/tenant/resolveTenant');
        const { syncSubscriptionToEdgeConfig } = await import('@/lib/tenant-edge-config');
        
        const orgDomain = await getOrgDomain(organizationId);
        if (orgDomain?.subdomain) {
          await syncSubscriptionToEdgeConfig(
            organizationId,
            orgDomain.subdomain,
            {
              plan: tier,
              subscriptionStatus,
              currentPeriodEnd: coachSubscriptionData.currentPeriodEnd || undefined,
              cancelAtPeriodEnd: false,
            }
          );
          console.log(`[COACH_SUBSCRIPTION_CONFIRM] Synced subscription to Edge Config for ${orgDomain.subdomain}`);
        }
      } catch (edgeError) {
        console.error('[COACH_SUBSCRIPTION_CONFIRM] Failed to sync Edge Config:', edgeError);
        // Non-critical - middleware will fall back to Clerk org metadata
      }
    } catch (orgError) {
      console.error('[COACH_SUBSCRIPTION_CONFIRM] Failed to sync org metadata:', orgError);
      // Don't fail the request - the Stripe webhook will eventually sync this
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


