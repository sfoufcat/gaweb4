import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { sendWelcomeEmail } from '@/lib/email';
import { updateUserBillingInClerk, updateUserCoachingInClerk, type BillingStatus } from '@/lib/admin-utils-clerk';
import { archiveOldSquadMemberships } from '@/lib/program-engine';
import { syncSubscriptionToEdgeConfig, type TenantSubscriptionData, type TenantBrandingData } from '@/lib/tenant-edge-config';
import { DEFAULT_MENU_TITLES, DEFAULT_MENU_ICONS, DEFAULT_MENU_ORDER, DEFAULT_APP_TITLE, DEFAULT_BRANDING_COLORS } from '@/types';
import { getStreamServerClient } from '@/lib/stream-server';
import { addUserToOrganization } from '@/lib/clerk-organizations';
import type { CoachingStatus, CoachingPlan, FlowSession, Program, ProgramEnrollment, ProgramInvite, NewProgramEnrollmentStatus, CoachTier, CoachSubscriptionStatus, Squad, SquadMember } from '@/types';
import { TIER_CALL_CREDITS } from '@/types';
import { checkExistingEnrollment } from '@/lib/enrollment-check';
import { createInvoiceFromPayment, markInvoiceRefunded } from '@/lib/invoice-generator';

// =============================================================================
// CLERK ORG METADATA SYNC
// =============================================================================

/**
 * Update Clerk Organization publicMetadata with billing state
 * Also syncs to Edge Config for middleware-level access checks
 * This enables instant middleware-level tier gating without DB lookups
 */
async function syncBillingToClerkOrg(
  organizationId: string,
  billingState: {
    plan: CoachTier;
    subscriptionStatus: CoachSubscriptionStatus;
    currentPeriodEnd?: string;
    trialEnd?: string;
    cancelAtPeriodEnd?: boolean;
    graceEndsAt?: string;
    onboardingState?: 'needs_profile' | 'needs_plan' | 'active';
  }
): Promise<void> {
  try {
    const { clerkClient } = await import('@clerk/nextjs/server');
    const clerk = await clerkClient();
    
    // Get existing org metadata to preserve other fields
    const org = await clerk.organizations.getOrganization({ organizationId });
    const existingMetadata = org.publicMetadata || {};
    
    // Update with billing state
    await clerk.organizations.updateOrganization(organizationId, {
      publicMetadata: {
        ...existingMetadata,
        plan: billingState.plan,
        subscriptionStatus: billingState.subscriptionStatus,
        currentPeriodEnd: billingState.currentPeriodEnd,
        trialEnd: billingState.trialEnd,
        cancelAtPeriodEnd: billingState.cancelAtPeriodEnd,
        graceEndsAt: billingState.graceEndsAt,
        onboardingState: billingState.onboardingState,
      },
    });
    
    console.log(`[STRIPE_WEBHOOK] Synced billing to Clerk org ${organizationId}: plan=${billingState.plan}, status=${billingState.subscriptionStatus}`);
  } catch (error) {
    // Log but don't fail - DB is canonical, Clerk is cache
    console.error(`[STRIPE_WEBHOOK] Failed to sync billing to Clerk org ${organizationId}:`, error);
  }
  
  // Also sync to Edge Config for middleware access checks
  try {
    // Get the organization's subdomain from org_domains
    const domainSnapshot = await adminDb
      .collection('org_domains')
      .where('organizationId', '==', organizationId)
      .limit(1)
      .get();
    
    if (!domainSnapshot.empty) {
      const domainData = domainSnapshot.docs[0].data();
      const subdomain = domainData.subdomain;
      const customDomain = domainData.verifiedCustomDomain || undefined;
      
      const subscriptionData: TenantSubscriptionData = {
        plan: billingState.plan,
        subscriptionStatus: billingState.subscriptionStatus,
        currentPeriodEnd: billingState.currentPeriodEnd,
        cancelAtPeriodEnd: billingState.cancelAtPeriodEnd,
        graceEndsAt: billingState.graceEndsAt,
      };
      
      // Fetch branding from Firestore to prevent reset to defaults when Edge Config is empty
      let fallbackBranding: TenantBrandingData | undefined;
      try {
        const brandingDoc = await adminDb.collection('org_branding').doc(organizationId).get();
        if (brandingDoc.exists) {
          const brandingData = brandingDoc.data();
          fallbackBranding = {
            logoUrl: brandingData?.logoUrl ?? null,
            horizontalLogoUrl: brandingData?.horizontalLogoUrl ?? null,
            appTitle: brandingData?.appTitle ?? DEFAULT_APP_TITLE,
            colors: brandingData?.colors ?? DEFAULT_BRANDING_COLORS,
            menuTitles: brandingData?.menuTitles ?? DEFAULT_MENU_TITLES,
            menuIcons: brandingData?.menuIcons ?? DEFAULT_MENU_ICONS,
            menuOrder: brandingData?.menuOrder ?? DEFAULT_MENU_ORDER,
          };
        }
      } catch (brandingError) {
        console.warn(`[STRIPE_WEBHOOK] Could not fetch branding from Firestore:`, brandingError);
      }
      
      await syncSubscriptionToEdgeConfig(organizationId, subdomain, subscriptionData, customDomain, fallbackBranding);
      console.log(`[STRIPE_WEBHOOK] Synced billing to Edge Config for subdomain ${subdomain}`);
    } else {
      console.warn(`[STRIPE_WEBHOOK] No subdomain found for org ${organizationId} - Edge Config not updated`);
    }
  } catch (edgeError) {
    // Log but don't fail - Edge Config is an optimization, not critical path
    console.error(`[STRIPE_WEBHOOK] Failed to sync billing to Edge Config for org ${organizationId}:`, edgeError);
  }
}

// Coaching product ID - used to identify coaching subscriptions vs membership subscriptions
const COACHING_PRODUCT_ID = 'prod_TV2dhbvP1vJ69e';

// Coaching price IDs - map to plan types
const COACHING_PRICE_IDS: Record<string, CoachingPlan> = {
  'price_1SY2YIGZhrOwy75wdbPeTjtl': 'monthly',
  'price_1SY2ZBGZhrOwy75w5sniKZrq': 'quarterly',
};

// Membership price IDs for the 3-tier pricing system
const MEMBERSHIP_PRICE_IDS = {
  // Trial weekly price ($9.99/week - converts to standard monthly after 1 week)
  trial_weekly: process.env.STRIPE_TRIAL_WEEKLY_PRICE_ID || 'price_1SaLTQGZhrOwy75wyu7kdVRN',
  // Standard monthly price ($39.99/month)
  standard_monthly: process.env.STRIPE_STANDARD_MONTHLY_PRICE_ID || 'price_1SaLPhGZhrOwy75wesngK2M3',
  // Premium monthly price ($99/month)
  premium_monthly: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID || 'price_1SXkqZGZhrOwy75wAG3mSczA',
};

// Lazy initialization of Stripe to avoid build-time errors (cached singleton)
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

function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }
  return secret;
}

/**
 * Check if a subscription is for the coaching product
 * Returns the coaching plan type if it's a coaching subscription, null otherwise
 */
function getCoachingPlanFromSubscription(subscription: Stripe.Subscription): CoachingPlan {
  for (const item of subscription.items.data) {
    const productId = typeof item.price.product === 'string' 
      ? item.price.product 
      : item.price.product?.id;
    
    if (productId === COACHING_PRODUCT_ID) {
      // It's a coaching subscription, determine the plan from price ID
      const priceId = item.price.id;
      return COACHING_PRICE_IDS[priceId] || 'monthly'; // Default to monthly if unknown price
    }
  }
  return null; // Not a coaching subscription
}

/**
 * POST /api/webhooks/stripe
 * Handles Stripe webhook events for billing updates
 */
export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    console.error('[STRIPE_WEBHOOK] No signature provided');
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  const stripe = getStripe();
  const webhookSecret = getWebhookSecret();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[STRIPE_WEBHOOK] Signature verification failed:', message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log(`[STRIPE_WEBHOOK] Processing event: ${event.type}, id: ${event.id}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`[STRIPE_WEBHOOK] checkout.session.completed - userId: ${session.metadata?.userId}, plan: ${session.metadata?.plan}`);
        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
        const priceId = subscription.items.data[0]?.price?.id;
        console.log(`[STRIPE_WEBHOOK] ${event.type} - subscriptionId: ${subscription.id}, customerId: ${customerId}, status: ${subscription.status}, priceId: ${priceId}, userId: ${subscription.metadata?.userId}`);
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`[STRIPE_WEBHOOK] customer.subscription.deleted - subscriptionId: ${subscription.id}, userId: ${subscription.metadata?.userId}`);
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        console.log(`[STRIPE_WEBHOOK] invoice.payment_failed - invoiceId: ${invoice.id}, customerId: ${customerId}`);
        await handlePaymentFailed(invoice);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        // Only handle subscription renewal invoices (not initial subscription)
        if (invoice.billing_reason === 'subscription_cycle') {
          console.log(`[STRIPE_WEBHOOK] invoice.paid (renewal) - invoiceId: ${invoice.id}, subscriptionId: ${invoice.subscription}`);
          await handleSubscriptionRenewal(invoice);
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        // For Connect events, event.account contains the connected account ID
        const connectedAccountId = (event as { account?: string }).account;

        // Handle content purchases (one-time content payments via Stripe Connect)
        if (paymentIntent.metadata?.type === 'content_purchase') {
          console.log(`[STRIPE_WEBHOOK] payment_intent.succeeded (content) - paymentIntentId: ${paymentIntent.id}, contentType: ${paymentIntent.metadata?.contentType}, contentId: ${paymentIntent.metadata?.contentId}, connectedAccount: ${connectedAccountId || 'platform'}`);
          await handleContentPurchaseSucceeded(paymentIntent);
        }
        // Handle funnel payments (one-time program enrollment payments via Stripe Connect)
        else if (paymentIntent.metadata?.type === 'funnel_payment') {
          console.log(`[STRIPE_WEBHOOK] payment_intent.succeeded (funnel) - paymentIntentId: ${paymentIntent.id}, flowSessionId: ${paymentIntent.metadata?.flowSessionId}, connectedAccount: ${connectedAccountId || 'platform'}`);
          await handleFunnelPaymentSucceeded(paymentIntent);
        }
        // Handle credit pack purchases (platform payments)
        else if (paymentIntent.metadata?.type === 'credit_purchase') {
          console.log(`[STRIPE_WEBHOOK] payment_intent.succeeded (credit_purchase) - paymentIntentId: ${paymentIntent.id}, org: ${paymentIntent.metadata?.organizationId}, pack: ${paymentIntent.metadata?.packSize}`);
          await handleCreditPurchasePaymentSucceeded(paymentIntent);
        } else {
          console.log(`[STRIPE_WEBHOOK] payment_intent.succeeded - paymentIntentId: ${paymentIntent.id} (not a funnel, content, or credit payment, skipping)`);
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        console.log(`[STRIPE_WEBHOOK] charge.refunded - chargeId: ${charge.id}, paymentIntentId: ${charge.payment_intent}`);

        // Mark invoice as refunded if this charge is linked to a payment intent
        if (charge.payment_intent) {
          const paymentIntentId = typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : charge.payment_intent.id;

          const isFullRefund = charge.refunded && charge.amount_refunded === charge.amount;
          markInvoiceRefunded(paymentIntentId, charge.amount_refunded, isFullRefund).catch((err) => {
            console.error('[STRIPE_WEBHOOK] Failed to mark invoice as refunded:', err);
          });
        }
        break;
      }

      default:
        console.log(`[STRIPE_WEBHOOK] Unhandled event type: ${event.type}`);
    }

    console.log(`[STRIPE_WEBHOOK] Successfully processed event: ${event.type}, id: ${event.id}`);
    return NextResponse.json({ received: true });

  } catch (error) {
    // Detailed error logging to identify the failure cause
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    
    console.error(`[STRIPE_WEBHOOK] Error processing event ${event.type} (${event.id}):`, {
      errorName,
      errorMessage,
      errorStack,
      eventType: event.type,
      eventId: event.id,
    });
    
    // Log additional context for debugging
    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.created') {
      const subscription = event.data.object as Stripe.Subscription;
      console.error(`[STRIPE_WEBHOOK] Subscription context:`, {
        subscriptionId: subscription.id,
        status: subscription.status,
        priceId: subscription.items.data[0]?.price?.id,
        userId: subscription.metadata?.userId,
        customerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
        envPremiumMonthlyPriceId: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID ? 'SET' : 'MISSING',
        envPremiumHalfYearPriceId: process.env.STRIPE_PREMIUM_HALF_YEAR_PRICE_ID ? 'SET' : 'MISSING',
      });
    }
    
    return NextResponse.json({ error: 'Webhook processing failed', message: errorMessage }, { status: 500 });
  }
}

/**
 * Handle checkout.session.completed event
 * This is triggered when a user completes the checkout flow
 * Supports both authenticated and guest checkouts
 * 
 * For trial plans: Creates a subscription schedule to auto-convert to monthly after 1 week
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const guestSessionId = session.metadata?.guestSessionId;
  const isGuestCheckout = session.metadata?.isGuestCheckout === 'true';
  const plan = session.metadata?.plan as 'trial' | 'standard' | 'premium' | undefined;
  const isTrial = session.metadata?.isTrial === 'true';
  const effectiveTier = session.metadata?.effectiveTier as 'standard' | 'premium' | undefined;
  const checkoutType = session.metadata?.type;

  // Handle coach subscription checkout
  if (checkoutType === 'coach_subscription') {
    await handleCoachCheckoutCompleted(session);
    return;
  }

  // Handle squad subscription checkout (recurring squad membership)
  if (checkoutType === 'squad_subscription') {
    await handleSquadSubscriptionCheckoutCompleted(session);
    return;
  }

  // Handle program subscription checkout (recurring program enrollment)
  if (checkoutType === 'program_subscription') {
    await handleProgramSubscriptionCheckoutCompleted(session);
    return;
  }

  // Handle credit pack purchase
  if (checkoutType === 'credit_purchase') {
    await handleCreditPurchaseCompleted(session);
    return;
  }

  // Handle guest checkout (no userId)
  if (!userId && (guestSessionId || isGuestCheckout)) {
    await handleGuestCheckoutCompleted(session, guestSessionId, plan);
    return;
  }

  if (!userId) {
    console.error('[STRIPE_WEBHOOK] No userId or guestSessionId in session metadata');
    return;
  }

  console.log(`[STRIPE_WEBHOOK] Checkout completed for user ${userId}, plan: ${plan}, isTrial: ${isTrial}`);

  const stripe = getStripe();

  // Get subscription details
  let subscriptionId: string | undefined;
  let customerId: string | undefined;
  let currentPeriodEnd: string | undefined;
  let subscription: Stripe.Subscription | undefined;

  if (session.subscription) {
    subscriptionId = typeof session.subscription === 'string' 
      ? session.subscription 
      : session.subscription.id;
    
    // Fetch full subscription to get period end
    try {
      subscription = await stripe.subscriptions.retrieve(subscriptionId);
      currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
    } catch (error) {
      console.error('[STRIPE_WEBHOOK] Error fetching subscription:', error);
    }
  }

  if (session.customer) {
    customerId = typeof session.customer === 'string'
      ? session.customer
      : session.customer.id;
  }

  // For trial plans, create a subscription schedule to convert to monthly after 1 week
  if (isTrial && subscription && customerId) {
    try {
      console.log(`[STRIPE_WEBHOOK] Creating subscription schedule for trial user ${userId}`);
      
      // Create a subscription schedule from the existing subscription
      // This will automatically convert to monthly pricing after the trial week
      const schedule = await stripe.subscriptionSchedules.create({
        from_subscription: subscriptionId!,
      });

      // Update the schedule to add a second phase for monthly billing
      await stripe.subscriptionSchedules.update(schedule.id, {
        end_behavior: 'release', // Continue as regular subscription after schedule ends
        phases: [
          {
            items: [{ price: MEMBERSHIP_PRICE_IDS.trial_weekly, quantity: 1 }],
            iterations: 1, // 1 week (one billing cycle of weekly)
          },
          {
            items: [{ price: MEMBERSHIP_PRICE_IDS.standard_monthly, quantity: 1 }],
            // No iterations = continues indefinitely
          },
        ],
      });

      console.log(`[STRIPE_WEBHOOK] Subscription schedule created for trial user ${userId}: ${schedule.id}`);
    } catch (scheduleError) {
      // Log error but continue - user still has access, just won't auto-convert
      console.error(`[STRIPE_WEBHOOK] Failed to create subscription schedule for trial user ${userId}:`, scheduleError);
    }
  }

  // Fetch current user data to get email and name
  const userDoc = await adminDb.collection('users').doc(userId).get();
  const userData = userDoc.data();
  const userEmail = userData?.email || session.customer_email;
  const firstName = userData?.firstName || userData?.name?.split(' ')[0];
  const alreadyWelcomed = userData?.welcomeEmailSent === true;

  // Determine the billing plan and tier
  // Trial and Standard both get 'standard' tier, Premium gets 'premium' tier
  const billingPlan = plan === 'premium' ? 'premium' : 'standard';
  const tier = effectiveTier || (plan === 'premium' ? 'premium' : 'standard');

  // Update user document
  await adminDb.collection('users').doc(userId).set({
    billing: {
      plan: billingPlan,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      status: 'active',
      currentPeriodEnd: currentPeriodEnd,
      cancelAtPeriodEnd: false,
      // Track if user started with trial
      startedWithTrial: isTrial,
    },
    // Sync tier with effective tier (trial users get standard tier access)
    tier: tier,
    // Mark onboarding as completed
    onboardingStatus: 'completed',
    hasCompletedOnboarding: true,
    // Mark as converted member (prevents abandoned email)
    convertedToMember: true,
    convertedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  console.log(`[STRIPE_WEBHOOK] Updated billing for user ${userId}, plan: ${billingPlan}, tier: ${tier}, period ends: ${currentPeriodEnd}`);

  // CRITICAL: Sync billing status AND tier to Clerk for middleware access control
  try {
    await updateUserBillingInClerk(userId, 'active', currentPeriodEnd, tier);
  } catch (clerkError) {
    // Log but don't fail the webhook - Firebase is already updated
    console.error(`[STRIPE_WEBHOOK] Failed to update Clerk billing for user ${userId}:`, clerkError);
  }

  // Send welcome email (only once)
  if (userEmail && !alreadyWelcomed) {
    try {
      const emailResult = await sendWelcomeEmail({
        email: userEmail,
        firstName,
        userId,
      });

      if (emailResult.success) {
        // Mark welcome email as sent
        await adminDb.collection('users').doc(userId).set({
          welcomeEmailSent: true,
          welcomeEmailSentAt: new Date().toISOString(),
        }, { merge: true });
        console.log(`[STRIPE_WEBHOOK] Welcome email sent to user ${userId}`);
      } else {
        console.error(`[STRIPE_WEBHOOK] Failed to send welcome email to user ${userId}:`, emailResult.error);
      }
    } catch (emailError) {
      // Don't fail the webhook if email fails
      console.error(`[STRIPE_WEBHOOK] Error sending welcome email to user ${userId}:`, emailError);
    }
  } else if (alreadyWelcomed) {
    console.log(`[STRIPE_WEBHOOK] Skipping welcome email for user ${userId} - already sent`);
  }
}

/**
 * Handle coach subscription checkout completion
 * 
 * Called when a coach completes their subscription checkout from the marketplace flow.
 * Updates the coach_onboarding status to 'active' and sets up billing in org_settings.
 */
async function handleCoachCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const organizationId = session.metadata?.organizationId;
  const tier = session.metadata?.tier as 'starter' | 'growth' | 'scale' | undefined;
  
  if (!userId || !organizationId) {
    console.error('[STRIPE_WEBHOOK] Coach checkout missing required metadata:', { userId, organizationId });
    return;
  }
  
  console.log(`[STRIPE_WEBHOOK] Coach checkout completed for user ${userId}, org ${organizationId}, tier ${tier}`);
  
  const stripe = getStripe();
  const now = new Date().toISOString();
  
  // Get subscription details
  let subscriptionId: string | undefined;
  let customerId: string | undefined;
  let currentPeriodEnd: string | undefined;
  let subscriptionStatus: string = 'active';
  
  if (session.subscription) {
    subscriptionId = typeof session.subscription === 'string' 
      ? session.subscription 
      : session.subscription.id;
    
    // Fetch full subscription to get period end and status
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
      subscriptionStatus = subscription.status;
      
      // Determine if this is a trial
      if (subscription.status === 'trialing') {
        subscriptionStatus = 'trialing';
      }
    } catch (error) {
      console.error('[STRIPE_WEBHOOK] Error fetching coach subscription:', error);
    }
  }
  
  if (session.customer) {
    customerId = typeof session.customer === 'string'
      ? session.customer
      : session.customer.id;
  }
  
  // Update org_settings with billing info
  const orgSettingsRef = adminDb.collection('org_settings').doc(organizationId);
  await orgSettingsRef.set({
    billing: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      tier: tier || 'starter',
      status: subscriptionStatus,
      currentPeriodEnd,
    },
    subscriptionStatus,
    updatedAt: now,
  }, { merge: true });
  
  console.log(`[STRIPE_WEBHOOK] Updated org_settings for ${organizationId} with billing info`);

  // Allocate AI call summary credits based on tier
  const effectiveTier = (tier as CoachTier) || 'starter';
  const allocatedCredits = TIER_CALL_CREDITS[effectiveTier] || 20;

  // Set initial credits, preserving purchased credits
  const orgRef = adminDb.collection('organizations').doc(organizationId);
  const orgDoc = await orgRef.get();
  const existingCredits = orgDoc.exists ? orgDoc.data()?.summaryCredits : null;

  await orgRef.set({
    summaryCredits: {
      allocatedCredits,
      usedCredits: 0, // Reset plan usage at start of billing period
      purchasedCredits: existingCredits?.purchasedCredits || 0, // Preserve purchased
      usedPurchasedCredits: existingCredits?.usedPurchasedCredits || 0, // Preserve purchased usage
      periodStart: now,
      periodEnd: currentPeriodEnd || null,
    },
  }, { merge: true });

  console.log(`[STRIPE_WEBHOOK] Allocated ${allocatedCredits} credits for org ${organizationId}`);

  // Update coach_onboarding status to 'active'
  const onboardingRef = adminDb.collection('coach_onboarding').doc(organizationId);
  await onboardingRef.set({
    status: 'active',
    tier: tier || 'starter',
    subscriptionId,
    billingActivatedAt: now,
    updatedAt: now,
  }, { merge: true });
  
  console.log(`[STRIPE_WEBHOOK] Updated coach_onboarding for ${organizationId} to active`);
  
  // Update the user's publicMetadata via Clerk to reflect active billing
  try {
    const { clerkClient } = await import('@clerk/nextjs/server');
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: {
        billingStatus: subscriptionStatus,
        billingPeriodEnd: currentPeriodEnd,
      },
    });
    console.log(`[STRIPE_WEBHOOK] Updated Clerk metadata for coach user ${userId}`);
  } catch (clerkError) {
    console.error('[STRIPE_WEBHOOK] Error updating Clerk metadata for coach:', clerkError);
  }
  
  // CRITICAL: Sync billing state to Clerk org publicMetadata for middleware gating
  await syncBillingToClerkOrg(organizationId, {
    plan: (tier as CoachTier) || 'starter',
    subscriptionStatus: subscriptionStatus as CoachSubscriptionStatus,
    currentPeriodEnd,
    trialEnd: undefined,
    cancelAtPeriodEnd: false,
    onboardingState: 'active',
  });
}

/**
 * Handle guest checkout completion (LEGACY)
 * 
 * @deprecated This handles the old /start guest flow which used guestSessions.
 * The new /join funnel flow uses flow_sessions and PaymentIntents handled by handleFunnelPaymentSucceeded.
 * This function is kept for any remaining in-flight checkout sessions.
 * Safe to remove after confirming no guestSessions with paymentStatus='pending' exist.
 */
async function handleGuestCheckoutCompleted(
  session: Stripe.Checkout.Session,
  guestSessionId: string | undefined,
  plan: 'trial' | 'standard' | 'premium' | undefined
) {
  console.warn('[STRIPE_WEBHOOK] DEPRECATED: handleGuestCheckoutCompleted called - this is the old guest flow');
  const isTrial = session.metadata?.isTrial === 'true';
  const effectiveTier = session.metadata?.effectiveTier as 'standard' | 'premium' | undefined;
  
  console.log(`[STRIPE_WEBHOOK] Guest checkout completed - guestSessionId: ${guestSessionId}, plan: ${plan}, isTrial: ${isTrial}`);

  const stripe = getStripe();

  // Get subscription details
  let subscriptionId: string | undefined;
  let customerId: string | undefined;
  let currentPeriodEnd: string | undefined;
  let subscription: Stripe.Subscription | undefined;

  if (session.subscription) {
    subscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription.id;

    // Fetch full subscription to get period end
    try {
      subscription = await stripe.subscriptions.retrieve(subscriptionId);
      currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
    } catch (error) {
      console.error('[STRIPE_WEBHOOK] Error fetching subscription:', error);
    }
  }

  if (session.customer) {
    customerId = typeof session.customer === 'string'
      ? session.customer
      : session.customer.id;
  }

  // For trial plans in guest checkout, create subscription schedule
  if (isTrial && subscription && customerId) {
    try {
      console.log(`[STRIPE_WEBHOOK] Creating subscription schedule for trial guest session ${guestSessionId}`);
      
      const schedule = await stripe.subscriptionSchedules.create({
        from_subscription: subscriptionId!,
      });

      await stripe.subscriptionSchedules.update(schedule.id, {
        end_behavior: 'release',
        phases: [
          {
            items: [{ price: MEMBERSHIP_PRICE_IDS.trial_weekly, quantity: 1 }],
            iterations: 1,
          },
          {
            items: [{ price: MEMBERSHIP_PRICE_IDS.standard_monthly, quantity: 1 }],
          },
        ],
      });

      console.log(`[STRIPE_WEBHOOK] Subscription schedule created for trial guest: ${schedule.id}`);
    } catch (scheduleError) {
      console.error(`[STRIPE_WEBHOOK] Failed to create subscription schedule for trial guest:`, scheduleError);
    }
  }

  const customerEmail = session.customer_email || session.customer_details?.email;

  // Determine effective tier for guest sessions
  const tier = effectiveTier || (plan === 'premium' ? 'premium' : 'standard');

  // If we have a guestSessionId, update the guest session
  if (guestSessionId) {
    await adminDb.collection('guestSessions').doc(guestSessionId).set({
      paymentStatus: 'completed',
      selectedPlan: plan || 'standard',
      effectiveTier: tier,
      isTrial: isTrial,
      stripeSessionId: session.id,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripeCurrentPeriodEnd: currentPeriodEnd,
      email: customerEmail,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    console.log(`[STRIPE_WEBHOOK] Updated guest session ${guestSessionId} with payment info`);
  } else {
    // No guest session ID - log warning but don't fail
    console.warn('[STRIPE_WEBHOOK] Guest checkout without guestSessionId - payment info may not be linked');
  }

  console.log(`[STRIPE_WEBHOOK] Guest checkout completed - customerId: ${customerId}, subscriptionId: ${subscriptionId}`);
}

/**
 * Handle subscription updates
 * Routes to appropriate handler based on subscription type:
 * - coach_subscription: Platform subscription for coaches (Starter/Pro/Scale)
 * - squad_subscription: Recurring squad membership (via Connect)
 * - program_subscription: Recurring program enrollment (via Connect)
 * - coaching: 1:1 coaching product
 * - other: User membership subscription
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const subscriptionType = subscription.metadata?.type;
  
  // Check if this is a coach platform subscription (Starter/Pro/Scale)
  if (subscriptionType === 'coach_subscription') {
    await updateCoachPlatformSubscriptionStatus(subscription);
    return;
  }

  // Check if this is a squad subscription (recurring squad membership)
  if (subscriptionType === 'squad_subscription') {
    const status = mapStripeStatusToSubscriptionStatus(subscription.status);
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
    await updateSquadMemberSubscriptionStatus(
      subscription.id,
      status,
      currentPeriodEnd,
      subscription.cancel_at_period_end
    );
    return;
  }

  // Check if this is a program subscription (recurring program enrollment)
  if (subscriptionType === 'program_subscription') {
    const status = mapStripeStatusToSubscriptionStatus(subscription.status);
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
    await updateProgramEnrollmentSubscriptionStatus(
      subscription.id,
      status,
      currentPeriodEnd,
      subscription.cancel_at_period_end
    );
    return;
  }
  
  // Check if this is a coaching subscription (1:1 coaching product)
  const coachingPlan = getCoachingPlanFromSubscription(subscription);
  const isCoachingSubscription = coachingPlan !== null;
  
  const userId = subscription.metadata?.userId;
  
  if (!userId) {
    // Try to find user by customer ID
    const customerId = typeof subscription.customer === 'string' 
      ? subscription.customer 
      : subscription.customer.id;
    
    // Try finding by billing customer ID first
    let usersSnapshot = await adminDb.collection('users')
      .where('billing.stripeCustomerId', '==', customerId)
      .limit(1)
      .get();

    // If coaching, also try finding by coaching subscription's customer ID
    if (usersSnapshot.empty && isCoachingSubscription) {
      usersSnapshot = await adminDb.collection('users')
        .where('coaching.stripeSubscriptionId', '==', subscription.id)
        .limit(1)
        .get();
    }

    if (usersSnapshot.empty) {
      console.error('[STRIPE_WEBHOOK] No user found for subscription:', subscription.id);
      return;
    }

    const userDoc = usersSnapshot.docs[0];
    
    if (isCoachingSubscription) {
      await updateUserCoachingStatus(userDoc.id, subscription, coachingPlan);
    } else {
      await updateUserBillingStatus(userDoc.id, subscription);
    }
    return;
  }

  if (isCoachingSubscription) {
    await updateUserCoachingStatus(userId, subscription, coachingPlan);
  } else {
    await updateUserBillingStatus(userId, subscription);
  }
}

/**
 * Update coach platform subscription status (Starter/Pro/Scale)
 * This is for coaches subscribing to the platform, not user memberships
 */
async function updateCoachPlatformSubscriptionStatus(subscription: Stripe.Subscription) {
  const organizationId = subscription.metadata?.organizationId;
  const tier = subscription.metadata?.tier as CoachTier | undefined;
  
  if (!organizationId) {
    console.error('[STRIPE_WEBHOOK] Coach platform subscription missing organizationId:', subscription.id);
    return;
  }
  
  // Map Stripe status to our status
  let status: CoachSubscriptionStatus = 'active';
  switch (subscription.status) {
    case 'active':
      status = 'active';
      break;
    case 'trialing':
      status = 'trialing';
      break;
    case 'past_due':
      status = 'past_due';
      break;
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      status = 'canceled';
      break;
    default:
      status = 'none';
  }
  
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
  const trialEnd = subscription.trial_end 
    ? new Date(subscription.trial_end * 1000).toISOString() 
    : undefined;
  const cancelAtPeriodEnd = subscription.cancel_at_period_end;
  const now = new Date().toISOString();
  
  // Grace period handling for payment failures
  // When status becomes past_due, set a 3-day grace period
  // When status becomes active/trialing, clear the grace period
  let graceEndsAt: string | null = null;
  
  // Find existing subscription to check current state
  const subscriptionQuery = await adminDb
    .collection('coach_subscriptions')
    .where('stripeSubscriptionId', '==', subscription.id)
    .limit(1)
    .get();
  
  const existingData = !subscriptionQuery.empty ? subscriptionQuery.docs[0].data() : null;
  const wasActive = existingData?.status === 'active' || existingData?.status === 'trialing';
  const isNowPastDue = status === 'past_due';
  const isNowActive = status === 'active' || status === 'trialing';
  
  if (isNowPastDue) {
    // If transitioning to past_due and no existing grace period, set one
    if (!existingData?.graceEndsAt) {
      const graceEnd = new Date();
      graceEnd.setDate(graceEnd.getDate() + 3); // 3-day grace period
      graceEndsAt = graceEnd.toISOString();
      console.log(`[STRIPE_WEBHOOK] Setting 3-day grace period for org ${organizationId}, ends: ${graceEndsAt}`);
      // TODO: Add payment failed email notification when email function is implemented
    } else {
      // Keep existing grace period (don't extend it)
      graceEndsAt = existingData.graceEndsAt;
    }
  } else if (isNowActive) {
    // Clear grace period when payment succeeds
    graceEndsAt = null;
    if (existingData?.graceEndsAt) {
      console.log(`[STRIPE_WEBHOOK] Clearing grace period for org ${organizationId} - payment successful`);
    }
  }
  
  // Update coach_subscriptions document
  if (!subscriptionQuery.empty) {
    const subDoc = subscriptionQuery.docs[0];
    await subDoc.ref.update({
      status,
      tier: tier || subDoc.data().tier,
      currentPeriodEnd,
      trialEnd,
      cancelAtPeriodEnd,
      graceEndsAt,
      updatedAt: now,
    });
  }
  
  // Update org_settings
  await adminDb.collection('org_settings').doc(organizationId).set({
    coachTier: tier,
    subscriptionStatus: status,
    graceEndsAt,
    updatedAt: now,
  }, { merge: true });

  // Recalculate credits if tier changed
  const previousTier = existingData?.tier as CoachTier | undefined;
  if (tier && tier !== previousTier) {
    const newAllocatedCredits = TIER_CALL_CREDITS[tier] || 20;

    const orgDoc = await adminDb.collection('organizations').doc(organizationId).get();
    const existingCredits = orgDoc.data()?.summaryCredits;

    await adminDb.collection('organizations').doc(organizationId).set({
      summaryCredits: {
        ...existingCredits,
        allocatedCredits: newAllocatedCredits,
      }
    }, { merge: true });

    console.log(`[STRIPE_WEBHOOK] Updated credits for org ${organizationId}: tier changed ${previousTier} -> ${tier}, allocatedCredits=${newAllocatedCredits}`);
  }

  console.log(`[STRIPE_WEBHOOK] Updated coach platform subscription for org ${organizationId}: tier=${tier}, status=${status}, graceEndsAt=${graceEndsAt || 'none'}`);
  
  // CRITICAL: Sync to Clerk org publicMetadata for instant middleware gating
  await syncBillingToClerkOrg(organizationId, {
    plan: tier || 'starter',
    subscriptionStatus: status,
    currentPeriodEnd,
    trialEnd,
    cancelAtPeriodEnd,
    graceEndsAt: graceEndsAt || undefined,
    onboardingState: status === 'active' || status === 'trialing' ? 'active' : 'needs_plan',
  });
}

/**
 * Handle coach platform subscription deletion (Starter/Pro/Scale)
 * Downgrades the organization to no active subscription
 */
async function handleCoachPlatformSubscriptionDeleted(subscription: Stripe.Subscription) {
  const organizationId = subscription.metadata?.organizationId;
  
  if (!organizationId) {
    console.error('[STRIPE_WEBHOOK] Coach platform subscription deletion missing organizationId:', subscription.id);
    return;
  }
  
  const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();
  const now = new Date().toISOString();
  
  // Find and update the coach_subscriptions document
  const subscriptionQuery = await adminDb
    .collection('coach_subscriptions')
    .where('stripeSubscriptionId', '==', subscription.id)
    .limit(1)
    .get();
  
  if (!subscriptionQuery.empty) {
    const subDoc = subscriptionQuery.docs[0];
    await subDoc.ref.update({
      status: 'canceled',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: periodEnd,
      updatedAt: now,
    });
  }
  
  // Update org_settings
  await adminDb.collection('org_settings').doc(organizationId).set({
    subscriptionStatus: 'canceled',
    updatedAt: now,
  }, { merge: true });
  
  console.log(`[STRIPE_WEBHOOK] Coach platform subscription deleted for org ${organizationId}`);
  
  // Sync to Clerk org publicMetadata
  const tier = subscription.metadata?.tier as CoachTier | undefined;
  await syncBillingToClerkOrg(organizationId, {
    plan: tier || 'starter',
    subscriptionStatus: 'canceled',
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: false,
    onboardingState: 'needs_plan',
  });
}

/**
 * Map Stripe subscription status to our internal status
 */
function mapStripeStatusToSubscriptionStatus(
  stripeStatus: string
): 'active' | 'past_due' | 'canceled' | 'expired' {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return 'canceled';
    default:
      return 'active';
  }
}

/**
 * Handle subscription deletion (final cancellation)
 * 
 * This fires when the subscription is actually deleted (not just scheduled to cancel).
 * This happens at the end of the billing period if cancel_at_period_end was true,
 * or immediately if the subscription was canceled without waiting for period end.
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const subscriptionType = subscription.metadata?.type;
  
  // Check if this is a coach platform subscription (Starter/Pro/Scale)
  if (subscriptionType === 'coach_subscription') {
    await handleCoachPlatformSubscriptionDeleted(subscription);
    return;
  }

  // Check if this is a squad subscription
  if (subscriptionType === 'squad_subscription') {
    await handleSquadSubscriptionDeleted(subscription);
    return;
  }

  // Check if this is a program subscription
  if (subscriptionType === 'program_subscription') {
    await handleProgramSubscriptionDeleted(subscription);
    return;
  }
  
  // Check if this is a coaching subscription (1:1 coaching product)
  const coachingPlan = getCoachingPlanFromSubscription(subscription);
  const isCoachingSubscription = coachingPlan !== null;
  
  const userId = subscription.metadata?.userId;
  
  // The period end when the subscription was deleted
  const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();
  
  if (!userId) {
    // Try to find user by customer ID
    const customerId = typeof subscription.customer === 'string' 
      ? subscription.customer 
      : subscription.customer.id;
    
    // Try finding by billing customer ID first
    let usersSnapshot = await adminDb.collection('users')
      .where('billing.stripeCustomerId', '==', customerId)
      .limit(1)
      .get();

    // If coaching, also try finding by coaching subscription ID
    if (usersSnapshot.empty && isCoachingSubscription) {
      usersSnapshot = await adminDb.collection('users')
        .where('coaching.stripeSubscriptionId', '==', subscription.id)
        .limit(1)
        .get();
    }

    if (usersSnapshot.empty) {
      console.error('[STRIPE_WEBHOOK] No user found for deleted subscription:', subscription.id);
      return;
    }

    const userDoc = usersSnapshot.docs[0];
    
    if (isCoachingSubscription) {
      await handleCoachingSubscriptionDeleted(userDoc.id, periodEnd);
    } else {
      await handleMembershipSubscriptionDeleted(userDoc.id, periodEnd);
    }
    return;
  }

  if (isCoachingSubscription) {
    await handleCoachingSubscriptionDeleted(userId, periodEnd);
  } else {
    await handleMembershipSubscriptionDeleted(userId, periodEnd);
  }
}

/**
 * Handle membership subscription deletion - downgrades tier to free
 */
async function handleMembershipSubscriptionDeleted(userId: string, periodEnd: string) {
  const updateData = {
    billing: {
      status: 'canceled' as const,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false, // No longer pending, it's done
    },
    // Downgrade tier when subscription ends (but NOT coaching - it's separate)
    tier: 'free' as const,
    updatedAt: new Date().toISOString(),
  };

  await adminDb.collection('users').doc(userId).set(updateData, { merge: true });

  // Sync to Clerk with tier downgrade
  try {
    await updateUserBillingInClerk(userId, 'canceled', periodEnd, 'free');
  } catch (clerkError) {
    console.error(`[STRIPE_WEBHOOK] Failed to update Clerk billing for user ${userId}:`, clerkError);
  }

  console.log(`[STRIPE_WEBHOOK] Membership subscription deleted for user ${userId}, access ends: ${periodEnd}`);
}

/**
 * Handle coaching subscription deletion - only affects coaching status, NOT membership tier
 */
async function handleCoachingSubscriptionDeleted(userId: string, periodEnd: string) {
  const updateData = {
    coaching: {
      status: 'canceled' as const,
      endsAt: periodEnd,
    },
    updatedAt: new Date().toISOString(),
  };

  await adminDb.collection('users').doc(userId).set(updateData, { merge: true });

  // Sync coaching status to Clerk - DOES NOT affect membership tier
  try {
    await updateUserCoachingInClerk(userId, 'canceled', null, periodEnd);
  } catch (clerkError) {
    console.error(`[STRIPE_WEBHOOK] Failed to update Clerk coaching for user ${userId}:`, clerkError);
  }

  console.log(`[STRIPE_WEBHOOK] Coaching subscription deleted for user ${userId}, access ends: ${periodEnd}`);
}

/**
 * Handle failed payments
 * Supports both platform subscriptions and Connect account subscriptions (squads/programs)
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const now = new Date().toISOString();
  
  // Check if this is a Connect subscription payment failure (squad/program)
  const subscriptionId = typeof invoice.subscription === 'string' 
    ? invoice.subscription 
    : invoice.subscription?.id;

  if (subscriptionId) {
    // Check squadMembers for this subscription
    const squadMemberQuery = await adminDb
      .collection('squadMembers')
      .where('subscriptionId', '==', subscriptionId)
      .limit(1)
      .get();

    if (!squadMemberQuery.empty) {
      const memberDoc = squadMemberQuery.docs[0];
      const graceEnd = new Date();
      graceEnd.setDate(graceEnd.getDate() + 3); // 3-day grace period
      
      await memberDoc.ref.update({
        subscriptionStatus: 'past_due',
        accessEndsAt: graceEnd.toISOString(),
        updatedAt: now,
      });
      console.log(`[STRIPE_WEBHOOK] Squad subscription payment failed: subscriptionId=${subscriptionId}, memberId=${memberDoc.id}, graceEnds=${graceEnd.toISOString()}`);
      return;
    }

    // Check program_enrollments for this subscription
    const enrollmentQuery = await adminDb
      .collection('program_enrollments')
      .where('subscriptionId', '==', subscriptionId)
      .limit(1)
      .get();

    if (!enrollmentQuery.empty) {
      const enrollmentDoc = enrollmentQuery.docs[0];
      const graceEnd = new Date();
      graceEnd.setDate(graceEnd.getDate() + 3); // 3-day grace period
      
      await enrollmentDoc.ref.update({
        subscriptionStatus: 'past_due',
        accessEndsAt: graceEnd.toISOString(),
        updatedAt: now,
      });
      console.log(`[STRIPE_WEBHOOK] Program subscription payment failed: subscriptionId=${subscriptionId}, enrollmentId=${enrollmentDoc.id}, graceEnds=${graceEnd.toISOString()}`);
      return;
    }
  }

  // Handle platform subscription payment failures (user memberships)
  const customerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : invoice.customer?.id;

  if (!customerId) {
    console.error('[STRIPE_WEBHOOK] No customer ID in failed payment invoice');
    return;
  }

  const usersSnapshot = await adminDb.collection('users')
    .where('billing.stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    console.error('[STRIPE_WEBHOOK] No user found for failed payment:', invoice.id);
    return;
  }

  const userDoc = usersSnapshot.docs[0];
  
  await adminDb.collection('users').doc(userDoc.id).set({
    billing: {
      status: 'past_due',
    },
    // Downgrade tier on payment failure
    tier: 'free',
    updatedAt: now,
  }, { merge: true });

  // Update org_memberships with tier downgrade (multi-org support)
  try {
    const membershipsSnapshot = await adminDb
      .collection('org_memberships')
      .where('userId', '==', userDoc.id)
      .where('isActive', '==', true)
      .where('accessSource', '==', 'platform_billing')
      .get();
    
    if (!membershipsSnapshot.empty) {
      const batch = adminDb.batch();
      
      for (const doc of membershipsSnapshot.docs) {
        batch.update(doc.ref, {
          tier: 'free',
          updatedAt: now,
        });
      }
      
      await batch.commit();
      console.log(`[STRIPE_WEBHOOK] Downgraded ${membershipsSnapshot.size} org_memberships to free tier for user ${userDoc.id}`);
    }
  } catch (membershipError) {
    console.error(`[STRIPE_WEBHOOK] Failed to update org_memberships for user ${userDoc.id}:`, membershipError);
  }

  // Sync to Clerk with tier downgrade
  try {
    await updateUserBillingInClerk(userDoc.id, 'past_due', undefined, 'free');
  } catch (clerkError) {
    console.error(`[STRIPE_WEBHOOK] Failed to update Clerk billing for user ${userDoc.id}:`, clerkError);
  }

  console.log(`[STRIPE_WEBHOOK] Payment failed for user ${userDoc.id}, downgraded to free tier`);
}

/**
 * Handle subscription renewal (invoice.paid with billing_reason='subscription_cycle')
 * Resets AI call summary credits for the new billing period
 */
async function handleSubscriptionRenewal(invoice: Stripe.Invoice) {
  const stripe = getStripe();
  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription?.id;

  if (!subscriptionId) {
    console.log('[STRIPE_WEBHOOK] No subscription ID in renewal invoice');
    return;
  }

  // Fetch subscription to check if it's a coach subscription
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Check if this is a coach subscription by looking for metadata or org_settings
  const organizationId = subscription.metadata?.organizationId;

  if (!organizationId) {
    // Try to find org by stripeSubscriptionId in org_settings
    const orgSettingsQuery = await adminDb
      .collection('org_settings')
      .where('billing.stripeSubscriptionId', '==', subscriptionId)
      .limit(1)
      .get();

    if (orgSettingsQuery.empty) {
      console.log(`[STRIPE_WEBHOOK] Renewal invoice not for a coach subscription: ${subscriptionId}`);
      return;
    }

    const orgSettingsDoc = orgSettingsQuery.docs[0];
    const orgId = orgSettingsDoc.id;
    const orgSettings = orgSettingsDoc.data();
    const tier = (orgSettings.billing?.tier as CoachTier) || 'starter';

    await resetCreditsForOrg(orgId, tier, invoice);

    // Create invoice for subscription renewal
    await createRenewalInvoice(invoice, orgId, tier);
    return;
  }

  // Get tier from org_settings
  const orgSettingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
  if (!orgSettingsDoc.exists) {
    console.log(`[STRIPE_WEBHOOK] No org_settings for org ${organizationId}`);
    return;
  }

  const orgSettings = orgSettingsDoc.data();
  const tier = (orgSettings?.billing?.tier as CoachTier) || 'starter';

  await resetCreditsForOrg(organizationId, tier, invoice);

  // Create invoice for subscription renewal
  await createRenewalInvoice(invoice, organizationId, tier);
}

/**
 * Helper to reset credits for an organization on renewal
 */
async function resetCreditsForOrg(orgId: string, tier: CoachTier, invoice: Stripe.Invoice) {
  const now = new Date().toISOString();
  const allocatedCredits = TIER_CALL_CREDITS[tier] || 20;

  // Calculate new period end
  const periodEnd = invoice.lines.data[0]?.period?.end
    ? new Date(invoice.lines.data[0].period.end * 1000).toISOString()
    : null;

  // Get org to preserve purchased credits
  const orgRef = adminDb.collection('organizations').doc(orgId);
  const orgDoc = await orgRef.get();
  const existingCredits = orgDoc.exists ? orgDoc.data()?.summaryCredits : null;

  // Reset plan credits, preserve purchased credits
  await orgRef.set({
    summaryCredits: {
      allocatedCredits,
      usedCredits: 0, // Reset plan usage
      purchasedCredits: existingCredits?.purchasedCredits || 0,
      usedPurchasedCredits: existingCredits?.usedPurchasedCredits || 0,
      periodStart: now,
      periodEnd,
    },
  }, { merge: true });

  console.log(`[STRIPE_WEBHOOK] Reset credits for org ${orgId}: ${allocatedCredits} credits, tier: ${tier}`);
}

/**
 * Create invoice for subscription renewal
 */
async function createRenewalInvoice(invoice: Stripe.Invoice, orgId: string, tier: string) {
  if (!invoice.amount_paid || invoice.amount_paid <= 0) {
    return; // Skip $0 renewals
  }

  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription?.id;

  // Find the user who owns this organization (coach)
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) {
    console.log('[STRIPE_WEBHOOK] No customer ID in renewal invoice');
    return;
  }

  // Look up user by Stripe customer ID
  const userQuery = await adminDb
    .collection('users')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (userQuery.empty) {
    console.log(`[STRIPE_WEBHOOK] No user found for customer ${customerId}`);
    return;
  }

  const userId = userQuery.docs[0].id;

  createInvoiceFromPayment({
    userId,
    organizationId: orgId,
    paymentType: 'subscription_renewal',
    referenceId: subscriptionId || invoice.id,
    referenceName: `${tier.charAt(0).toUpperCase() + tier.slice(1)} Plan Renewal`,
    amountPaid: invoice.amount_paid,
    currency: invoice.currency || 'usd',
    stripeInvoiceId: invoice.id,
  }).catch(err => {
    console.error('[STRIPE_WEBHOOK] Failed to create renewal invoice:', err);
  });
}

/**
 * Handle successful funnel payment (one-time program enrollment payment)
 * This is a safety net in case the client-side flow fails after payment succeeds
 */
async function handleFunnelPaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const flowSessionId = paymentIntent.metadata?.flowSessionId;
  const userId = paymentIntent.metadata?.userId;
  const programId = paymentIntent.metadata?.programId;
  const organizationId = paymentIntent.metadata?.organizationId;

  if (!flowSessionId) {
    console.log(`[STRIPE_WEBHOOK] Funnel payment ${paymentIntent.id} has no flowSessionId, skipping`);
    return;
  }

  if (!userId) {
    console.error(`[STRIPE_WEBHOOK] Funnel payment ${paymentIntent.id} has no userId`);
    return;
  }

  // Get the flow session
  const sessionRef = adminDb.collection('flow_sessions').doc(flowSessionId);
  const sessionDoc = await sessionRef.get();

  if (!sessionDoc.exists) {
    console.error(`[STRIPE_WEBHOOK] Flow session ${flowSessionId} not found for payment ${paymentIntent.id}`);
    return;
  }

  const flowSession = sessionDoc.data() as FlowSession;

  // Check if already completed - don't double-process
  if (flowSession.completedAt) {
    console.log(`[STRIPE_WEBHOOK] Flow session ${flowSessionId} already completed, skipping`);
    return;
  }

  // Check if enrollment already exists for this payment intent
  const existingEnrollment = await adminDb
    .collection('program_enrollments')
    .where('stripePaymentIntentId', '==', paymentIntent.id)
    .limit(1)
    .get();

  if (!existingEnrollment.empty) {
    console.log(`[STRIPE_WEBHOOK] Enrollment already exists for payment ${paymentIntent.id}, marking session complete`);
    // Just mark the session as complete
    await sessionRef.update({
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  // Verify this is a program funnel
  if (!flowSession.programId) {
    console.error(`[STRIPE_WEBHOOK] Flow session ${flowSessionId} has no programId - may be a squad funnel`);
    return;
  }

  // Get program details
  const programDoc = await adminDb.collection('programs').doc(flowSession.programId).get();
  if (!programDoc.exists) {
    console.error(`[STRIPE_WEBHOOK] Program ${flowSession.programId} not found for flow session ${flowSessionId}`);
    return;
  }

  const program = programDoc.data() as Program;

  // Check for existing active/upcoming enrollment in this program
  // This prevents duplicate enrollments when webhook fires after user already enrolled via verify-payment
  const enrollmentCheck = await checkExistingEnrollment(userId, flowSession.programId);
  
  if (enrollmentCheck.exists && !enrollmentCheck.allowReEnrollment) {
    console.log(`[STRIPE_WEBHOOK] User ${userId} already enrolled in program ${flowSession.programId}, updating payment info`);
    
    // Update existing enrollment with payment info instead of creating duplicate
    const existingEnrollmentId = enrollmentCheck.enrollment!.id;
    await adminDb.collection('program_enrollments').doc(existingEnrollmentId).update({
      stripePaymentIntentId: paymentIntent.id,
      paidAt: new Date().toISOString(),
      amountPaid: paymentIntent.amount || program.priceInCents || 0,
      updatedAt: new Date().toISOString(),
    });
    
    // Mark flow session as completed
    await sessionRef.update({
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      data: {
        ...flowSession.data,
        stripePaymentIntentId: paymentIntent.id,
      },
    });
    
    console.log(`[STRIPE_WEBHOOK] Updated existing enrollment ${existingEnrollmentId} with payment info`);
    return;
  }

  // Handle invite if present
  let invite: ProgramInvite | null = null;
  let targetSquadId: string | null = null;
  let targetCohortId: string | null = null;

  if (flowSession.inviteId) {
    const inviteDoc = await adminDb.collection('program_invites').doc(flowSession.inviteId).get();
    if (inviteDoc.exists) {
      invite = inviteDoc.data() as ProgramInvite;
      targetSquadId = invite.targetSquadId || null;
      targetCohortId = invite.targetCohortId || null;

      // Update invite usage
      await adminDb.collection('program_invites').doc(flowSession.inviteId).update({
        useCount: FieldValue.increment(1),
        usedBy: userId,
        usedAt: new Date().toISOString(),
      });
    }
  }

  // For group programs, find or assign squad/cohort
  const assignedSquadId: string | null = targetSquadId;
  let assignedCohortId: string | null = targetCohortId;

  if (program.type === 'group' && !assignedCohortId) {
    // Find active cohort with enrollment open
    const cohortsSnapshot = await adminDb
      .collection('program_cohorts')
      .where('programId', '==', flowSession.programId)
      .where('enrollmentOpen', '==', true)
      .where('status', 'in', ['upcoming', 'active'])
      .orderBy('startDate', 'asc')
      .limit(1)
      .get();

    if (!cohortsSnapshot.empty) {
      const cohort = cohortsSnapshot.docs[0];
      assignedCohortId = cohort.id;

      // Update cohort enrollment count
      await cohort.ref.update({
        currentEnrollment: FieldValue.increment(1),
      });
    }
  }

  // Determine enrollment status
  let enrollmentStatus: NewProgramEnrollmentStatus = 'active';
  let startedAt = new Date().toISOString();

  if (assignedCohortId) {
    // Check if cohort has started
    const cohortDoc = await adminDb.collection('program_cohorts').doc(assignedCohortId).get();
    if (cohortDoc.exists) {
      const cohortData = cohortDoc.data();
      if (cohortData?.startDate && new Date(cohortData.startDate) > new Date()) {
        enrollmentStatus = 'upcoming';
        startedAt = cohortData.startDate;
      }
    }
  }

  // Create program enrollment
  const now = new Date().toISOString();
  const enrollmentData: Omit<ProgramEnrollment, 'id'> = {
    userId,
    programId: flowSession.programId,
    organizationId: flowSession.organizationId,
    cohortId: assignedCohortId,
    squadId: assignedSquadId,
    stripePaymentIntentId: paymentIntent.id,
    paidAt: now,
    amountPaid: invite?.paymentStatus === 'pre_paid' ? 0 : (paymentIntent.amount || program.priceInCents || 0),
    status: enrollmentStatus,
    startedAt,
    lastAssignedDayIndex: 0,
    createdAt: now,
    updatedAt: now,
  };

  const enrollmentRef = await adminDb.collection('program_enrollments').add(enrollmentData);

  // Mark flow session as completed
  await sessionRef.update({
    completedAt: now,
    updatedAt: now,
    data: {
      ...flowSession.data,
      stripePaymentIntentId: paymentIntent.id,
    },
  });

  // Update user record with program enrollment reference
  const userRef = adminDb.collection('users').doc(userId);
  const userDoc = await userRef.get();

  const userUpdate: Record<string, unknown> = {
    organizationId: flowSession.organizationId,
    currentProgramEnrollmentId: enrollmentRef.id,
    currentProgramId: flowSession.programId,
    // Flow session data (goal, identity, etc.)
    ...extractUserDataFromFlowSession(flowSession.data),
    updatedAt: now,
  };

  if (!userDoc.exists) {
    userUpdate.createdAt = now;
    userUpdate.id = userId;
  }

  await userRef.set(userUpdate, { merge: true });

  // Archive old squad memberships if user was assigned to a new squad
  if (assignedSquadId) {
    try {
      const archiveResult = await archiveOldSquadMemberships(userId, assignedSquadId);
      if (archiveResult.archivedSquads.length > 0) {
        console.log(`[STRIPE_WEBHOOK] Archived ${archiveResult.archivedSquads.length} old squad memberships for user ${userId}`);
      }
    } catch (archiveErr) {
      // Non-fatal - user is enrolled and in new squad
      console.error(`[STRIPE_WEBHOOK] Failed to archive old squads (non-fatal):`, archiveErr);
    }
  }

  console.log(`[STRIPE_WEBHOOK] Funnel payment processed: User ${userId} enrolled in program ${flowSession.programId}, enrollment ${enrollmentRef.id}`);

  // Process order bumps if any
  const orderBumpsJson = paymentIntent.metadata?.orderBumps;
  if (orderBumpsJson) {
    await processOrderBumps(
      userId,
      flowSession.organizationId || organizationId || '',
      paymentIntent.id,
      orderBumpsJson,
      now
    );
  }

  // Create invoice for the funnel payment (async, don't block webhook)
  const invoiceOrgId = flowSession.organizationId || organizationId;
  if (invoiceOrgId) {
    createInvoiceFromPayment({
      userId,
      organizationId: invoiceOrgId,
      paymentType: 'funnel_payment',
      referenceId: enrollmentRef.id,
      referenceName: program.name || 'Program enrollment',
      amountPaid: paymentIntent.amount || program.priceInCents || 0,
      currency: paymentIntent.currency || 'usd',
      stripePaymentIntentId: paymentIntent.id,
    }).catch((err) => {
      console.error('[STRIPE_WEBHOOK] Failed to create invoice for funnel payment:', err);
    });
  }
}

/**
 * Extract user-relevant data from flow session data (for webhook handler)
 */
function extractUserDataFromFlowSession(data: Record<string, unknown>): Record<string, unknown> {
  const userFields: Record<string, unknown> = {};

  // Standard fields that should be saved to user record
  if (data.goal) userFields.goal = data.goal;
  if (data.goalTargetDate) userFields.goalTargetDate = data.goalTargetDate;
  if (data.goalSummary) userFields.goalSummary = data.goalSummary;
  if (data.identity) userFields.identity = data.identity;
  if (data.workdayStyle) userFields.workdayStyle = data.workdayStyle;
  if (data.businessStage) userFields.businessStage = data.businessStage;
  if (data.obstacles) userFields.obstacles = data.obstacles;
  if (data.goalImpact) userFields.goalImpact = data.goalImpact;
  if (data.supportNeeds) userFields.supportNeeds = data.supportNeeds;

  return userFields;
}

/**
 * Update user COACHING status based on subscription
 * 
 * IMPORTANT: This only updates coaching status, NOT membership tier.
 * Coaching is a separate product from Standard/Premium membership.
 */
async function updateUserCoachingStatus(userId: string, subscription: Stripe.Subscription, coachingPlan: CoachingPlan) {
  console.log(`[STRIPE_WEBHOOK] updateUserCoachingStatus called for user ${userId}, plan: ${coachingPlan}`);
  
  // Map Stripe status to our coaching status
  let status: CoachingStatus = 'active';
  
  switch (subscription.status) {
    case 'active':
    case 'trialing':
      status = 'active';
      break;
    case 'past_due':
      status = 'past_due';
      break;
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      status = 'canceled';
      break;
    default:
      status = 'none';
  }

  // Track coaching period end
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

  console.log(`[STRIPE_WEBHOOK] Updating Firebase coaching for user ${userId}: status=${status}, plan=${coachingPlan}`);
  
  try {
    await adminDb.collection('users').doc(userId).set({
      coaching: {
        status,
        plan: coachingPlan,
        stripeSubscriptionId: subscription.id,
        endsAt: currentPeriodEnd,
      },
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    console.log(`[STRIPE_WEBHOOK] Firebase coaching update successful for user ${userId}`);
  } catch (firebaseError) {
    console.error(`[STRIPE_WEBHOOK] Firebase coaching update FAILED for user ${userId}:`, firebaseError);
    throw firebaseError;
  }

  console.log(`[STRIPE_WEBHOOK] Updated coaching for user ${userId}: status=${status}, plan=${coachingPlan}, periodEnd=${currentPeriodEnd}`);

  // CRITICAL: Sync coaching status to Clerk - DOES NOT affect membership tier
  console.log(`[STRIPE_WEBHOOK] Updating Clerk coaching for user ${userId}`);
  try {
    await updateUserCoachingInClerk(userId, status, coachingPlan, currentPeriodEnd);
    console.log(`[STRIPE_WEBHOOK] Clerk coaching update successful for user ${userId}`);
  } catch (clerkError) {
    const errorMessage = clerkError instanceof Error ? clerkError.message : 'Unknown error';
    console.error(`[STRIPE_WEBHOOK] Failed to update Clerk coaching for user ${userId}:`, {
      errorMessage,
      userId,
      status,
      coachingPlan,
    });
  }
}

/**
 * Handle successful content purchase (one-time payment via Stripe Connect)
 * Creates a user_content_purchases record
 * Also processes any order bumps included in the purchase
 */
async function handleContentPurchaseSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const userId = paymentIntent.metadata?.userId;
  const contentType = paymentIntent.metadata?.contentType as 'event' | 'article' | 'course' | 'download' | 'link';
  const contentId = paymentIntent.metadata?.contentId;
  const organizationId = paymentIntent.metadata?.organizationId;
  const orderBumpsJson = paymentIntent.metadata?.orderBumps;

  if (!userId || !contentType || !contentId) {
    console.error(`[STRIPE_WEBHOOK] Content purchase ${paymentIntent.id} missing required metadata:`, {
      userId,
      contentType,
      contentId,
    });
    return;
  }

  // Check if purchase already exists (idempotency)
  const existingPurchase = await adminDb
    .collection('user_content_purchases')
    .where('stripePaymentIntentId', '==', paymentIntent.id)
    .limit(1)
    .get();

  if (!existingPurchase.empty) {
    console.log(`[STRIPE_WEBHOOK] Content purchase already exists for payment ${paymentIntent.id}, skipping`);
    return;
  }

  // Create the purchase record
  const now = new Date().toISOString();
  const purchaseData = {
    userId,
    contentType,
    contentId,
    organizationId: organizationId || '',
    amountPaid: paymentIntent.amount || 0,
    currency: paymentIntent.currency || 'usd',
    stripePaymentIntentId: paymentIntent.id,
    purchasedAt: now,
    createdAt: now,
  };

  const purchaseRef = await adminDb.collection('user_content_purchases').add(purchaseData);

  console.log(`[STRIPE_WEBHOOK] Content purchase created: User ${userId} purchased ${contentType}/${contentId}, purchaseId: ${purchaseRef.id}`);

  // Process order bumps if any
  if (orderBumpsJson) {
    await processOrderBumps(userId, organizationId || '', paymentIntent.id, orderBumpsJson, now);
  }

  // Create invoice for the content purchase (async, don't block webhook)
  if (organizationId) {
    // Get content name for invoice
    let contentName = `${contentType} purchase`;
    try {
      const contentDoc = await adminDb.collection('content').doc(contentId).get();
      if (contentDoc.exists) {
        contentName = contentDoc.data()?.title || contentName;
      }
    } catch {
      // Use default name
    }

    createInvoiceFromPayment({
      userId,
      organizationId,
      paymentType: 'content_purchase',
      referenceId: purchaseRef.id,
      referenceName: contentName,
      amountPaid: paymentIntent.amount || 0,
      currency: paymentIntent.currency || 'usd',
      stripePaymentIntentId: paymentIntent.id,
    }).catch((err) => {
      console.error('[STRIPE_WEBHOOK] Failed to create invoice for content purchase:', err);
    });
  }
}

/**
 * Process order bumps from a payment
 * Creates appropriate records for each bump product type
 */
async function processOrderBumps(
  userId: string,
  organizationId: string,
  paymentIntentId: string,
  orderBumpsJson: string,
  now: string
) {
  try {
    const orderBumps = JSON.parse(orderBumpsJson) as Array<{
      productType: string;
      productId: string;
      contentType?: string;
      name: string;
      priceInCents: number;
      discountPercent?: number;
      finalPriceCents: number;
    }>;

    console.log(`[STRIPE_WEBHOOK] Processing ${orderBumps.length} order bumps for payment ${paymentIntentId}`);

    for (const bump of orderBumps) {
      if (bump.productType === 'program') {
        // Create a pending enrollment record for the program bump
        // Note: For programs, full enrollment might need additional processing
        console.log(`[STRIPE_WEBHOOK] Order bump: Program ${bump.productId} purchased, amount: $${(bump.finalPriceCents / 100).toFixed(2)}`);
        
        // Check if enrollment already exists
        const existingEnrollment = await adminDb
          .collection('program_enrollments')
          .where('userId', '==', userId)
          .where('programId', '==', bump.productId)
          .limit(1)
          .get();

        if (existingEnrollment.empty) {
          // Create pending enrollment - will need activation
          await adminDb.collection('program_enrollments').add({
            userId,
            programId: bump.productId,
            organizationId,
            status: 'pending_activation', // Needs separate activation flow
            amountPaid: bump.finalPriceCents,
            stripePaymentIntentId: paymentIntentId,
            isOrderBump: true,
            createdAt: now,
            updatedAt: now,
          });
        }
        
      } else if (bump.productType === 'squad') {
        // For squad bumps, we just note the purchase - squad joining may need user action
        console.log(`[STRIPE_WEBHOOK] Order bump: Squad ${bump.productId} purchased, amount: $${(bump.finalPriceCents / 100).toFixed(2)}`);
        
        // Create a squad purchase record
        await adminDb.collection('squad_purchases').add({
          userId,
          squadId: bump.productId,
          organizationId,
          amountPaid: bump.finalPriceCents,
          stripePaymentIntentId: paymentIntentId,
          isOrderBump: true,
          status: 'pending_activation',
          createdAt: now,
          updatedAt: now,
        });
        
      } else if (bump.productType === 'content') {
        // Create content purchase record
        console.log(`[STRIPE_WEBHOOK] Order bump: Content ${bump.contentType}/${bump.productId} purchased, amount: $${(bump.finalPriceCents / 100).toFixed(2)}`);
        
        // Check if already purchased
        const existingPurchase = await adminDb
          .collection('user_content_purchases')
          .where('userId', '==', userId)
          .where('contentType', '==', bump.contentType)
          .where('contentId', '==', bump.productId)
          .limit(1)
          .get();

        if (existingPurchase.empty) {
          await adminDb.collection('user_content_purchases').add({
            userId,
            contentType: bump.contentType,
            contentId: bump.productId,
            organizationId,
            amountPaid: bump.finalPriceCents,
            currency: 'usd',
            stripePaymentIntentId: paymentIntentId,
            isOrderBump: true,
            purchasedAt: now,
            createdAt: now,
          });
        }
      }
    }

    console.log(`[STRIPE_WEBHOOK] Processed ${orderBumps.length} order bumps successfully`);
  } catch (error) {
    console.error(`[STRIPE_WEBHOOK] Error processing order bumps:`, error);
    // Don't throw - the main purchase succeeded
  }
}

/**
 * Update user billing status based on subscription
 * 
 * Key insight: When a user cancels their subscription, Stripe sets cancel_at_period_end = true
 * but keeps status = 'active' until the period ends. We track both so we can:
 * 1. Show the user they've canceled but still have access
 * 2. Know exactly when their access should end
 * 
 * NOTE: This only handles MEMBERSHIP subscriptions, not coaching.
 * 
 * Price ID to Plan mapping:
 * - trial_weekly (price_1SaLTQGZhrOwy75wyu7kdVRN) -> standard tier
 * - standard_monthly (price_1SaLPhGZhrOwy75wesngK2M3) -> standard tier
 * - premium_monthly (price_1SXkqZGZhrOwy75wAG3mSczA) -> premium tier
 */
async function updateUserBillingStatus(userId: string, subscription: Stripe.Subscription) {
  console.log(`[STRIPE_WEBHOOK] updateUserBillingStatus called for user ${userId}`);
  
  // Map Stripe status to our status
  let status: 'active' | 'past_due' | 'canceled' | 'trialing' = 'active';
  
  switch (subscription.status) {
    case 'active':
      status = 'active';
      break;
    case 'past_due':
      status = 'past_due';
      break;
    case 'canceled':
    case 'unpaid':
      status = 'canceled';
      break;
    case 'trialing':
      status = 'trialing';
      break;
  }

  // Determine plan and tier from price ID
  // Trial and Standard prices both result in 'standard' tier
  // Premium price results in 'premium' tier
  let plan: 'standard' | 'premium' = 'standard';
  let tier: 'standard' | 'premium' | 'free' = 'standard';
  
  const priceId = subscription.items.data[0]?.price?.id;
  
  // Log for debugging
  console.log(`[STRIPE_WEBHOOK] Price detection - priceId: ${priceId}`);
  console.log(`[STRIPE_WEBHOOK] Known prices - trial: ${MEMBERSHIP_PRICE_IDS.trial_weekly}, standard: ${MEMBERSHIP_PRICE_IDS.standard_monthly}, premium: ${MEMBERSHIP_PRICE_IDS.premium_monthly}`);
  
  // Check if this is a premium subscription
  if (priceId === MEMBERSHIP_PRICE_IDS.premium_monthly || 
      priceId === process.env.STRIPE_PREMIUM_HALF_YEAR_PRICE_ID) {
    plan = 'premium';
    tier = 'premium';
  } else if (priceId === MEMBERSHIP_PRICE_IDS.trial_weekly || 
             priceId === MEMBERSHIP_PRICE_IDS.standard_monthly) {
    // Trial and standard both map to standard tier
    plan = 'standard';
    tier = 'standard';
  } else {
    // Unknown price - check metadata for effectiveTier
    const effectiveTier = subscription.metadata?.effectiveTier as 'standard' | 'premium' | undefined;
    if (effectiveTier === 'premium') {
      plan = 'premium';
      tier = 'premium';
    }
  }

  // Track billing period end and cancellation status
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
  const cancelAtPeriodEnd = subscription.cancel_at_period_end;

  // Downgrade tier to free if subscription is not active
  if (status !== 'active' && status !== 'trialing') {
    tier = 'free';
  }

  console.log(`[STRIPE_WEBHOOK] Updating Firebase for user ${userId}: status=${status}, plan=${plan}, tier=${tier}`);
  
  try {
    await adminDb.collection('users').doc(userId).set({
      billing: {
        plan,
        stripeSubscriptionId: subscription.id,
        status,
        currentPeriodEnd,
        cancelAtPeriodEnd,
      },
      // Sync tier with billing status
      tier,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    console.log(`[STRIPE_WEBHOOK] Firebase update successful for user ${userId}`);
  } catch (firebaseError) {
    console.error(`[STRIPE_WEBHOOK] Firebase update FAILED for user ${userId}:`, firebaseError);
    throw firebaseError; // Re-throw to trigger the main error handler
  }

  console.log(`[STRIPE_WEBHOOK] Updated subscription for user ${userId}: status=${status}, tier=${tier}, cancelAtPeriodEnd=${cancelAtPeriodEnd}, periodEnd=${currentPeriodEnd}`);

  // Update org_memberships with the new tier (multi-org support)
  try {
    const membershipsSnapshot = await adminDb
      .collection('org_memberships')
      .where('userId', '==', userId)
      .where('isActive', '==', true)
      .where('accessSource', '==', 'platform_billing')
      .get();
    
    if (!membershipsSnapshot.empty) {
      const batch = adminDb.batch();
      const now = new Date().toISOString();
      
      for (const doc of membershipsSnapshot.docs) {
        batch.update(doc.ref, {
          tier,
          updatedAt: now,
        });
      }
      
      await batch.commit();
      console.log(`[STRIPE_WEBHOOK] Updated ${membershipsSnapshot.size} org_memberships with tier=${tier} for user ${userId}`);
    }
  } catch (membershipError) {
    console.error(`[STRIPE_WEBHOOK] Failed to update org_memberships for user ${userId}:`, membershipError);
    // Don't fail the webhook - this is an enhancement
  }

  // CRITICAL: Sync billing status AND tier to Clerk for middleware access control
  console.log(`[STRIPE_WEBHOOK] Updating Clerk for user ${userId}`);
  try {
    await updateUserBillingInClerk(userId, status as BillingStatus, currentPeriodEnd, tier);
    console.log(`[STRIPE_WEBHOOK] Clerk update successful for user ${userId}`);
  } catch (clerkError) {
    // Log detailed error but don't fail - Firebase is already updated
    const errorMessage = clerkError instanceof Error ? clerkError.message : 'Unknown error';
    const errorStack = clerkError instanceof Error ? clerkError.stack : undefined;
    console.error(`[STRIPE_WEBHOOK] Failed to update Clerk billing for user ${userId}:`, {
      errorMessage,
      errorStack,
      userId,
      status,
      tier,
      currentPeriodEnd,
    });
  }
}

// =============================================================================
// SQUAD SUBSCRIPTION HANDLERS
// =============================================================================

/**
 * Handle squad subscription checkout completion
 * 
 * Called when a user completes checkout to join a recurring subscription squad.
 * Adds user to squad with subscription tracking.
 */
async function handleSquadSubscriptionCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const squadId = session.metadata?.squadId;
  const organizationId = session.metadata?.organizationId;
  
  if (!userId || !squadId) {
    console.error('[STRIPE_WEBHOOK] Squad subscription checkout missing required metadata:', { userId, squadId });
    return;
  }

  console.log(`[STRIPE_WEBHOOK] Squad subscription checkout completed - userId: ${userId}, squadId: ${squadId}`);

  const stripe = getStripe();
  const now = new Date().toISOString();

  // Get subscription details
  let subscriptionId: string | undefined;
  let currentPeriodEnd: string | undefined;

  if (session.subscription) {
    subscriptionId = typeof session.subscription === 'string' 
      ? session.subscription 
      : session.subscription.id;
    
    // We need to fetch from the connected account
    try {
      // Get the Connect account ID from org_settings
      const orgSettingsDoc = await adminDb.collection('org_settings').doc(organizationId!).get();
      const orgSettings = orgSettingsDoc.data();
      const stripeConnectAccountId = orgSettings?.stripeConnectAccountId;

      if (stripeConnectAccountId) {
        const subscription = await stripe.subscriptions.retrieve(
          subscriptionId,
          { stripeAccount: stripeConnectAccountId }
        );
        currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
      }
    } catch (error) {
      console.error('[STRIPE_WEBHOOK] Error fetching squad subscription:', error);
    }
  }

  // Get squad
  const squadDoc = await adminDb.collection('squads').doc(squadId).get();
  if (!squadDoc.exists) {
    console.error(`[STRIPE_WEBHOOK] Squad ${squadId} not found for subscription checkout`);
    return;
  }

  const squad = { id: squadDoc.id, ...squadDoc.data() } as Squad;
  const memberIds = squad.memberIds || [];

  // Check if user is already a member
  if (memberIds.includes(userId)) {
    console.log(`[STRIPE_WEBHOOK] User ${userId} is already a member of squad ${squadId}`);
    return;
  }

  // Get user info from Clerk
  const { clerkClient } = await import('@clerk/nextjs/server');
  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(userId);

  // Add user to squad memberIds
  await squadDoc.ref.update({
    memberIds: [...memberIds, userId],
    updatedAt: now,
  });

  // Create squadMember document with subscription tracking
  await adminDb.collection('squadMembers').add({
    squadId,
    userId,
    roleInSquad: 'member',
    firstName: clerkUser.firstName || '',
    lastName: clerkUser.lastName || '',
    imageUrl: clerkUser.imageUrl || '',
    // Subscription tracking
    subscriptionId: subscriptionId || null,
    subscriptionStatus: 'active',
    currentPeriodEnd: currentPeriodEnd || null,
    cancelAtPeriodEnd: false,
    accessEndsAt: null,
    createdAt: now,
    updatedAt: now,
  });

  // Update user's squad membership
  const userDoc = await adminDb.collection('users').doc(userId).get();
  const userData = userDoc.exists ? userDoc.data() : null;
  const currentSquadIds: string[] = userData?.squadIds || [];
  
  if (!currentSquadIds.includes(squadId)) {
    await adminDb.collection('users').doc(userId).set({
      squadIds: [...currentSquadIds, squadId],
      squadId: squadId, // Legacy field
      updatedAt: now,
    }, { merge: true });
  }

  // Add user to Stream Chat channel
  if (squad.chatChannelId) {
    try {
      const streamClient = await getStreamServerClient();
      
      // Upsert user in Stream
      await streamClient.upsertUser({
        id: userId,
        name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'User',
        image: clerkUser.imageUrl,
      });

      // Add to channel
      const channel = streamClient.channel('messaging', squad.chatChannelId);
      await channel.addMembers([userId]);

      // Send join message
      await channel.sendMessage({
        text: `${clerkUser.firstName || 'Someone'} has joined the squad!`,
        user_id: userId,
        type: 'system',
      });
    } catch (streamError) {
      console.error('[STRIPE_WEBHOOK] Error adding user to squad chat:', streamError);
    }
  }

  // Auto-assign user to squad's organization
  if (organizationId) {
    try {
      await addUserToOrganization(userId, organizationId, 'org:member');
      console.log(`[STRIPE_WEBHOOK] Added user ${userId} to organization ${organizationId}`);
    } catch (orgError) {
      console.error('[STRIPE_WEBHOOK] Error adding user to organization:', orgError);
    }
  }

  console.log(`[STRIPE_WEBHOOK] User ${userId} successfully joined squad ${squadId} with subscription ${subscriptionId}`);

  // Create invoice for the squad subscription (async, don't block webhook)
  if (organizationId) {
    createInvoiceFromPayment({
      userId,
      organizationId,
      paymentType: 'squad_subscription',
      referenceId: squadId,
      referenceName: squad.name || 'Squad membership',
      amountPaid: session.amount_total || 0,
      currency: session.currency || 'usd',
      stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
    }).catch((err) => {
      console.error('[STRIPE_WEBHOOK] Failed to create invoice for squad subscription:', err);
    });
  }
}

/**
 * Handle program subscription checkout completion
 *
 * Called when a user completes checkout for a recurring program enrollment.
 * Creates enrollment with subscription tracking.
 */
async function handleProgramSubscriptionCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const programId = session.metadata?.programId;
  const cohortId = session.metadata?.cohortId;
  const organizationId = session.metadata?.organizationId;
  
  if (!userId || !programId) {
    console.error('[STRIPE_WEBHOOK] Program subscription checkout missing required metadata:', { userId, programId });
    return;
  }

  console.log(`[STRIPE_WEBHOOK] Program subscription checkout completed - userId: ${userId}, programId: ${programId}`);

  const stripe = getStripe();
  const now = new Date().toISOString();

  // Get subscription details
  let subscriptionId: string | undefined;
  let currentPeriodEnd: string | undefined;

  if (session.subscription) {
    subscriptionId = typeof session.subscription === 'string' 
      ? session.subscription 
      : session.subscription.id;
    
    try {
      // Get the Connect account ID from org_settings
      const orgSettingsDoc = await adminDb.collection('org_settings').doc(organizationId!).get();
      const orgSettings = orgSettingsDoc.data();
      const stripeConnectAccountId = orgSettings?.stripeConnectAccountId;

      if (stripeConnectAccountId) {
        const subscription = await stripe.subscriptions.retrieve(
          subscriptionId,
          { stripeAccount: stripeConnectAccountId }
        );
        currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
      }
    } catch (error) {
      console.error('[STRIPE_WEBHOOK] Error fetching program subscription:', error);
    }
  }

  // Check if enrollment already exists
  const existingEnrollment = await adminDb
    .collection('program_enrollments')
    .where('userId', '==', userId)
    .where('programId', '==', programId)
    .where('status', 'in', ['active', 'upcoming'])
    .limit(1)
    .get();

  if (!existingEnrollment.empty) {
    console.log(`[STRIPE_WEBHOOK] User ${userId} already enrolled in program ${programId}`);
    // Update subscription info on existing enrollment
    await existingEnrollment.docs[0].ref.update({
      subscriptionId: subscriptionId || null,
      subscriptionStatus: 'active',
      currentPeriodEnd: currentPeriodEnd || null,
      updatedAt: now,
    });
    return;
  }

  // Get program details
  const programDoc = await adminDb.collection('programs').doc(programId).get();
  if (!programDoc.exists) {
    console.error(`[STRIPE_WEBHOOK] Program ${programId} not found`);
    return;
  }

  const program = programDoc.data() as Program;

  // Determine start date and status
  let startedAt = now.split('T')[0];
  let status: 'active' | 'upcoming' = 'active';

  if (cohortId) {
    const cohortDoc = await adminDb.collection('program_cohorts').doc(cohortId).get();
    if (cohortDoc.exists) {
      const cohort = cohortDoc.data();
      if (cohort?.startDate && new Date(cohort.startDate) > new Date()) {
        startedAt = cohort.startDate;
        status = 'upcoming';
      }
    }
  }

  // Create enrollment with subscription tracking
  const enrollmentData: Omit<ProgramEnrollment, 'id'> = {
    userId,
    programId,
    organizationId: organizationId || program.organizationId,
    cohortId: cohortId || null,
    squadId: null,
    stripeCheckoutSessionId: session.id,
    amountPaid: session.amount_total || program.priceInCents,
    paidAt: now,
    status,
    startedAt,
    lastAssignedDayIndex: 0,
    // Subscription tracking
    subscriptionId: subscriptionId || undefined,
    subscriptionStatus: 'active',
    currentPeriodEnd: currentPeriodEnd || undefined,
    cancelAtPeriodEnd: false,
    createdAt: now,
    updatedAt: now,
  };

  const enrollmentRef = await adminDb.collection('program_enrollments').add(enrollmentData);

  // Update user document
  await adminDb.collection('users').doc(userId).set({
    currentProgramEnrollmentId: enrollmentRef.id,
    currentProgramId: programId,
    organizationId: organizationId || program.organizationId,
    updatedAt: now,
  }, { merge: true });

  console.log(`[STRIPE_WEBHOOK] User ${userId} enrolled in program ${programId} with subscription ${subscriptionId}, enrollment: ${enrollmentRef.id}`);

  // Process order bumps if any
  const orderBumpsJson = session.metadata?.orderBumps;
  if (orderBumpsJson) {
    await processOrderBumps(
      userId,
      organizationId || program.organizationId,
      session.id,
      orderBumpsJson,
      now
    );
  }

  // Create invoice for the program subscription (async, don't block webhook)
  const invoiceOrgId = organizationId || program.organizationId;
  if (invoiceOrgId) {
    createInvoiceFromPayment({
      userId,
      organizationId: invoiceOrgId,
      paymentType: 'program_enrollment',
      referenceId: enrollmentRef.id,
      referenceName: program.name || 'Program enrollment',
      amountPaid: session.amount_total || program.priceInCents || 0,
      currency: session.currency || 'usd',
      stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
    }).catch((err) => {
      console.error('[STRIPE_WEBHOOK] Failed to create invoice for program subscription:', err);
    });
  }
}

/**
 * Handle credit pack purchase completion
 * Adds purchased credits to the organization's summary credits
 */
async function handleCreditPurchaseCompleted(session: Stripe.Checkout.Session) {
  const organizationId = session.metadata?.organizationId;
  const packSize = session.metadata?.packSize;
  const credits = session.metadata?.credits;

  if (!organizationId || !packSize || !credits) {
    console.error('[STRIPE_WEBHOOK] Credit purchase missing required metadata:', { organizationId, packSize, credits });
    return;
  }

  const creditsToAdd = parseInt(credits, 10);
  // Convert credits (calls) to minutes (60 min per call)
  const minutesToAdd = creditsToAdd * 60;

  console.log(`[STRIPE_WEBHOOK] Credit purchase completed - org: ${organizationId}, pack: ${packSize}, credits: ${creditsToAdd}`);

  try {
    const orgRef = adminDb.collection('organizations').doc(organizationId);

    await adminDb.runTransaction(async (transaction) => {
      const orgDoc = await transaction.get(orgRef);

      if (!orgDoc.exists) {
        throw new Error(`Organization ${organizationId} not found`);
      }

      const orgData = orgDoc.data();
      const currentCredits = orgData?.summaryCredits || {
        allocatedCredits: 0,
        usedCredits: 0,
        purchasedCredits: 0,
        usedPurchasedCredits: 0,
        periodStart: null,
        periodEnd: null,
      };

      // Add to purchased credits (never expire)
      transaction.update(orgRef, {
        'summaryCredits.purchasedCredits': (currentCredits.purchasedCredits || 0) + creditsToAdd,
      });
    });

    console.log(`[STRIPE_WEBHOOK] Added ${creditsToAdd} credits to org ${organizationId}`);
  } catch (error) {
    console.error('[STRIPE_WEBHOOK] Error adding credits:', error);
  }
}

/**
 * Handle credit purchase from PaymentIntent (embedded checkout)
 */
async function handleCreditPurchasePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const organizationId = paymentIntent.metadata?.organizationId;
  const packSize = paymentIntent.metadata?.packSize;
  const credits = paymentIntent.metadata?.credits;
  const creditsAddedDirectly = paymentIntent.metadata?.creditsAddedDirectly === 'true';

  if (!organizationId || !packSize || !credits) {
    console.error('[STRIPE_WEBHOOK] Credit purchase PaymentIntent missing required metadata:', { organizationId, packSize, credits });
    return;
  }

  // Skip if credits were already added directly by the API (saved payment method flow)
  if (creditsAddedDirectly) {
    console.log(`[STRIPE_WEBHOOK] Credits already added directly for PaymentIntent ${paymentIntent.id}, skipping`);
    return;
  }

  const creditsToAdd = parseInt(credits, 10);

  console.log(`[STRIPE_WEBHOOK] Credit purchase PaymentIntent succeeded - org: ${organizationId}, pack: ${packSize}, credits: ${creditsToAdd}`);

  try {
    const orgRef = adminDb.collection('organizations').doc(organizationId);

    await adminDb.runTransaction(async (transaction) => {
      const orgDoc = await transaction.get(orgRef);

      if (!orgDoc.exists) {
        throw new Error(`Organization ${organizationId} not found`);
      }

      const orgData = orgDoc.data();
      const processedPaymentIntents = orgData?.processedCreditPurchases || [];

      // Check if already processed (idempotency)
      if (processedPaymentIntents.includes(paymentIntent.id)) {
        console.log(`[STRIPE_WEBHOOK] PaymentIntent ${paymentIntent.id} already processed, skipping`);
        return;
      }

      const currentPurchasedCredits = orgData?.summaryCredits?.purchasedCredits || 0;

      // Add to purchased credits (never expire)
      transaction.update(orgRef, {
        'summaryCredits.purchasedCredits': currentPurchasedCredits + creditsToAdd,
        processedCreditPurchases: [...processedPaymentIntents.slice(-99), paymentIntent.id], // Keep last 100
      });
    });

    console.log(`[STRIPE_WEBHOOK] Added ${creditsToAdd} credits to org ${organizationId} via PaymentIntent`);
  } catch (error) {
    console.error('[STRIPE_WEBHOOK] Error adding credits from PaymentIntent:', error);
  }
}

/**
 * Update squad member subscription status
 * Called when a squad subscription is updated (payment success, failure, cancellation)
 */
async function updateSquadMemberSubscriptionStatus(
  subscriptionId: string,
  status: 'active' | 'past_due' | 'canceled' | 'expired',
  currentPeriodEnd: string,
  cancelAtPeriodEnd: boolean
) {
  const now = new Date().toISOString();
  
  // Find squad member by subscription ID
  const memberQuery = await adminDb
    .collection('squadMembers')
    .where('subscriptionId', '==', subscriptionId)
    .limit(1)
    .get();

  if (memberQuery.empty) {
    console.log(`[STRIPE_WEBHOOK] No squad member found for subscription ${subscriptionId}`);
    return;
  }

  const memberDoc = memberQuery.docs[0];
  const memberData = memberDoc.data() as SquadMember;

  // Calculate access end date
  let accessEndsAt: string | null = null;
  if (status === 'canceled' || status === 'expired') {
    accessEndsAt = currentPeriodEnd;
  } else if (status === 'past_due') {
    // 3-day grace period for failed payments
    const graceEnd = new Date();
    graceEnd.setDate(graceEnd.getDate() + 3);
    accessEndsAt = graceEnd.toISOString();
  }

  await memberDoc.ref.update({
    subscriptionStatus: status,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    accessEndsAt,
    updatedAt: now,
  });

  console.log(`[STRIPE_WEBHOOK] Updated squad member subscription: memberId=${memberDoc.id}, status=${status}, accessEndsAt=${accessEndsAt}`);
}

/**
 * Update program enrollment subscription status
 * Called when a program subscription is updated (payment success, failure, cancellation)
 */
async function updateProgramEnrollmentSubscriptionStatus(
  subscriptionId: string,
  status: 'active' | 'past_due' | 'canceled' | 'expired',
  currentPeriodEnd: string,
  cancelAtPeriodEnd: boolean
) {
  const now = new Date().toISOString();
  
  // Find enrollment by subscription ID
  const enrollmentQuery = await adminDb
    .collection('program_enrollments')
    .where('subscriptionId', '==', subscriptionId)
    .limit(1)
    .get();

  if (enrollmentQuery.empty) {
    console.log(`[STRIPE_WEBHOOK] No program enrollment found for subscription ${subscriptionId}`);
    return;
  }

  const enrollmentDoc = enrollmentQuery.docs[0];

  // Calculate access end date
  let accessEndsAt: string | null = null;
  if (status === 'canceled' || status === 'expired') {
    accessEndsAt = currentPeriodEnd;
  } else if (status === 'past_due') {
    // 3-day grace period for failed payments
    const graceEnd = new Date();
    graceEnd.setDate(graceEnd.getDate() + 3);
    accessEndsAt = graceEnd.toISOString();
  }

  await enrollmentDoc.ref.update({
    subscriptionStatus: status,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    accessEndsAt,
    updatedAt: now,
  });

  console.log(`[STRIPE_WEBHOOK] Updated program enrollment subscription: enrollmentId=${enrollmentDoc.id}, status=${status}, accessEndsAt=${accessEndsAt}`);
}

/**
 * Handle squad/program subscription updates from Connect accounts
 * This handles subscription lifecycle events for coach-created subscriptions
 */
async function handleConnectSubscriptionUpdate(subscription: Stripe.Subscription, connectedAccountId: string) {
  const subscriptionType = subscription.metadata?.type;
  
  if (subscriptionType !== 'squad_subscription' && subscriptionType !== 'program_subscription') {
    return; // Not a squad/program subscription
  }

  // Map Stripe status to our status
  let status: 'active' | 'past_due' | 'canceled' | 'expired' = 'active';
  switch (subscription.status) {
    case 'active':
      status = 'active';
      break;
    case 'past_due':
      status = 'past_due';
      break;
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      status = subscription.ended_at ? 'expired' : 'canceled';
      break;
  }

  const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
  const cancelAtPeriodEnd = subscription.cancel_at_period_end;

  if (subscriptionType === 'squad_subscription') {
    await updateSquadMemberSubscriptionStatus(subscription.id, status, currentPeriodEnd, cancelAtPeriodEnd);
  } else if (subscriptionType === 'program_subscription') {
    await updateProgramEnrollmentSubscriptionStatus(subscription.id, status, currentPeriodEnd, cancelAtPeriodEnd);
  }
}

/**
 * Handle squad subscription deletion - remove user from squad
 */
async function handleSquadSubscriptionDeleted(subscription: Stripe.Subscription) {
  const now = new Date().toISOString();
  
  // Find squad member by subscription ID
  const memberQuery = await adminDb
    .collection('squadMembers')
    .where('subscriptionId', '==', subscription.id)
    .limit(1)
    .get();

  if (memberQuery.empty) {
    console.log(`[STRIPE_WEBHOOK] No squad member found for deleted subscription ${subscription.id}`);
    return;
  }

  const memberDoc = memberQuery.docs[0];
  const memberData = memberDoc.data() as SquadMember;
  const { squadId, userId } = memberData;

  // Mark as expired with access end date
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
  await memberDoc.ref.update({
    subscriptionStatus: 'expired',
    currentPeriodEnd,
    accessEndsAt: currentPeriodEnd,
    updatedAt: now,
  });

  console.log(`[STRIPE_WEBHOOK] Squad subscription deleted: userId=${userId}, squadId=${squadId}, accessEnds=${currentPeriodEnd}`);
}

/**
 * Handle program subscription deletion - expire enrollment
 */
async function handleProgramSubscriptionDeleted(subscription: Stripe.Subscription) {
  const now = new Date().toISOString();
  
  // Find enrollment by subscription ID
  const enrollmentQuery = await adminDb
    .collection('program_enrollments')
    .where('subscriptionId', '==', subscription.id)
    .limit(1)
    .get();

  if (enrollmentQuery.empty) {
    console.log(`[STRIPE_WEBHOOK] No program enrollment found for deleted subscription ${subscription.id}`);
    return;
  }

  const enrollmentDoc = enrollmentQuery.docs[0];
  const enrollmentData = enrollmentDoc.data() as ProgramEnrollment;

  // Mark as expired with access end date
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
  await enrollmentDoc.ref.update({
    subscriptionStatus: 'expired',
    currentPeriodEnd,
    accessEndsAt: currentPeriodEnd,
    updatedAt: now,
  });

  console.log(`[STRIPE_WEBHOOK] Program subscription deleted: userId=${enrollmentData.userId}, programId=${enrollmentData.programId}, accessEnds=${currentPeriodEnd}`);
}

