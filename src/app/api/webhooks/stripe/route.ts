import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { sendWelcomeEmail } from '@/lib/email';
import { updateUserBillingInClerk, updateUserCoachingInClerk, type BillingStatus } from '@/lib/admin-utils-clerk';
import { archiveOldSquadMemberships } from '@/lib/program-engine';
import type { CoachingStatus, CoachingPlan, FlowSession, Program, ProgramEnrollment, ProgramInvite, NewProgramEnrollmentStatus } from '@/types';

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
        } else {
          console.log(`[STRIPE_WEBHOOK] payment_intent.succeeded - paymentIntentId: ${paymentIntent.id} (not a funnel or content payment, skipping)`);
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
 * Routes to appropriate handler based on whether it's coaching or membership
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  // Check if this is a coaching subscription
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
 * Handle subscription deletion (final cancellation)
 * 
 * This fires when the subscription is actually deleted (not just scheduled to cancel).
 * This happens at the end of the billing period if cancel_at_period_end was true,
 * or immediately if the subscription was canceled without waiting for period end.
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  // Check if this is a coaching subscription
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
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
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
    updatedAt: new Date().toISOString(),
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
      const now = new Date().toISOString();
      
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
 */
async function handleContentPurchaseSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const userId = paymentIntent.metadata?.userId;
  const contentType = paymentIntent.metadata?.contentType as 'event' | 'article' | 'course' | 'download' | 'link';
  const contentId = paymentIntent.metadata?.contentId;
  const organizationId = paymentIntent.metadata?.organizationId;

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

