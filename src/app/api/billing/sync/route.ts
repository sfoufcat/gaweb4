import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { updateUserBillingInClerk, type BillingStatus } from '@/lib/admin-utils-clerk';

// Lazy initialization of Stripe to avoid build-time errors when env vars aren't available
function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(key, {
    apiVersion: '2025-02-24.acacia',
  });
}

/**
 * POST /api/billing/sync
 * 
 * BULLETPROOF billing sync with Stripe.
 * This is the ultimate fallback to ensure users have access after payment.
 * 
 * It tries multiple methods to find the subscription:
 * 1. By existing subscriptionId in Firebase
 * 2. By existing customerId in Firebase  
 * 3. By user's email (finds customer, then subscriptions)
 * 
 * Called on app load to verify subscription status.
 */
export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize Stripe client
    const stripe = getStripeClient();

    // Get user's current data from Firebase
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ synced: false, reason: 'no_user' });
    }

    const userData = userDoc.data();
    const subscriptionId = userData?.billing?.stripeSubscriptionId;
    const customerId = userData?.billing?.stripeCustomerId;
    const userEmail = userData?.email;

    // STRATEGY 1: Try by existing subscription ID
    if (subscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await updateBillingFromSubscription(userId, subscription);
        
        console.log(`[BILLING_SYNC] Synced by subscriptionId for user ${userId}: status=${subscription.status}`);
        
        return NextResponse.json({ 
          synced: true, 
          method: 'subscription_id',
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });
      } catch (stripeError: unknown) {
        const error = stripeError as { code?: string; message?: string };
        if (error.code === 'resource_missing') {
          console.log(`[BILLING_SYNC] Subscription ${subscriptionId} not found, trying other methods...`);
          // Fall through to try other methods
        } else {
          throw stripeError;
        }
      }
    }

    // STRATEGY 2: Try by customer ID - find their active subscriptions
    if (customerId) {
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: customerId,
          status: 'active',
          limit: 1,
        });

        if (subscriptions.data.length > 0) {
          const subscription = subscriptions.data[0];
          await updateBillingFromSubscription(userId, subscription);
          
          console.log(`[BILLING_SYNC] Found subscription by customerId for user ${userId}: status=${subscription.status}`);
          
          return NextResponse.json({ 
            synced: true, 
            method: 'customer_id',
            status: subscription.status,
          });
        }

        // Also check for trialing subscriptions
        const trialingSubscriptions = await stripe.subscriptions.list({
          customer: customerId,
          status: 'trialing',
          limit: 1,
        });

        if (trialingSubscriptions.data.length > 0) {
          const subscription = trialingSubscriptions.data[0];
          await updateBillingFromSubscription(userId, subscription);
          
          console.log(`[BILLING_SYNC] Found trialing subscription by customerId for user ${userId}`);
          
          return NextResponse.json({ 
            synced: true, 
            method: 'customer_id_trialing',
            status: subscription.status,
          });
        }
      } catch (error) {
        console.error(`[BILLING_SYNC] Error checking customer ${customerId}:`, error);
        // Fall through to try email method
      }
    }

    // STRATEGY 3: Try by email - find customer, then their subscriptions
    if (userEmail) {
      try {
        // Find customer by email
        const customers = await stripe.customers.list({
          email: userEmail,
          limit: 1,
        });

        if (customers.data.length > 0) {
          const customer = customers.data[0];
          
          // Save customer ID for future syncs
          await userRef.set({
            billing: {
              stripeCustomerId: customer.id,
            },
          }, { merge: true });

          // Find their active subscriptions
          const subscriptions = await stripe.subscriptions.list({
            customer: customer.id,
            status: 'active',
            limit: 1,
          });

          if (subscriptions.data.length > 0) {
            const subscription = subscriptions.data[0];
            await updateBillingFromSubscription(userId, subscription);
            
            console.log(`[BILLING_SYNC] Found subscription by email for user ${userId}: status=${subscription.status}`);
            
            return NextResponse.json({ 
              synced: true, 
              method: 'email_lookup',
              status: subscription.status,
            });
          }

          // Check trialing subscriptions too
          const trialingSubscriptions = await stripe.subscriptions.list({
            customer: customer.id,
            status: 'trialing',
            limit: 1,
          });

          if (trialingSubscriptions.data.length > 0) {
            const subscription = trialingSubscriptions.data[0];
            await updateBillingFromSubscription(userId, subscription);
            
            console.log(`[BILLING_SYNC] Found trialing subscription by email for user ${userId}`);
            
            return NextResponse.json({ 
              synced: true, 
              method: 'email_lookup_trialing',
              status: subscription.status,
            });
          }

          console.log(`[BILLING_SYNC] Found customer but no active subscription for user ${userId}`);
        }
      } catch (error) {
        console.error(`[BILLING_SYNC] Error checking by email ${userEmail}:`, error);
      }
    }

    // No subscription found by any method
    console.log(`[BILLING_SYNC] No subscription found for user ${userId}`);
    return NextResponse.json({ synced: false, reason: 'no_subscription_found' });

  } catch (error) {
    console.error('[BILLING_SYNC] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * Update Firebase billing status from Stripe subscription
 * Similar to the webhook handler, but called on-demand
 */
async function updateBillingFromSubscription(userId: string, subscription: Stripe.Subscription) {
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

  // Determine plan from price
  let plan: 'standard' | 'premium' = 'standard';
  const priceId = subscription.items.data[0]?.price?.id;
  
  if (priceId === process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID || 
      priceId === process.env.STRIPE_PREMIUM_HALF_YEAR_PRICE_ID) {
    plan = 'premium';
  }

  // Track billing period end and cancellation status
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
  const cancelAtPeriodEnd = subscription.cancel_at_period_end;

  // Determine tier based on billing status
  // Active/trialing subscriptions get their plan tier, otherwise downgrade to free
  const tier = (status === 'active' || status === 'trialing') ? plan : 'free';

  await adminDb.collection('users').doc(userId).set({
    billing: {
      plan,
      stripeSubscriptionId: subscription.id,
      status,
      currentPeriodEnd,
      cancelAtPeriodEnd,
    },
    tier,
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  // CRITICAL: Sync billing status AND tier to Clerk for middleware access control
  // This is the self-healing mechanism that fixes access if webhook failed
  try {
    await updateUserBillingInClerk(userId, status as BillingStatus, currentPeriodEnd, tier);
    console.log(`[BILLING_SYNC] Updated Clerk billing for user ${userId}: status=${status}, tier=${tier}`);
  } catch (clerkError) {
    console.error(`[BILLING_SYNC] Failed to update Clerk billing for user ${userId}:`, clerkError);
  }
}

