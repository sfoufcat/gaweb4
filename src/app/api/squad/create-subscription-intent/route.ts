/**
 * Create Subscription Intent for Squad Membership
 * 
 * POST /api/squad/create-subscription-intent
 * 
 * Creates a Stripe Subscription with payment_behavior: 'default_incomplete'
 * which returns a PaymentIntent clientSecret for embedded checkout.
 * Uses Stripe Connect to process payments to the coach's connected account.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { MAX_SQUAD_MEMBERS } from '@/lib/squad-constants';
import Stripe from 'stripe';
import type { Squad, OrgSettings } from '@/types';

// Lazy initialization of Stripe
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
    _stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia' });
  }
  return _stripe;
}

/**
 * POST /api/squad/create-subscription-intent
 * 
 * Body:
 * - squadId: string
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { squadId } = body as { squadId: string };

    if (!squadId) {
      return NextResponse.json({ error: 'Squad ID is required' }, { status: 400 });
    }

    // Get the squad
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();

    if (!squadDoc.exists) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    const squad = squadDoc.data() as Squad;

    // Verify squad is public
    if (squad.visibility !== 'public') {
      return NextResponse.json({ 
        error: 'This squad is private. Use an invite code to join.' 
      }, { status: 403 });
    }

    // Check if squad is at capacity
    const memberIds = squad.memberIds || [];
    if (memberIds.length >= MAX_SQUAD_MEMBERS) {
      return NextResponse.json({ 
        error: 'This squad is full and cannot accept new members.' 
      }, { status: 400 });
    }

    // Check if already a member
    if (memberIds.includes(userId)) {
      return NextResponse.json({ error: 'You are already a member of this squad' }, { status: 400 });
    }

    // Verify subscription is required
    if (!squad.subscriptionEnabled || !squad.stripePriceId || !squad.priceInCents || squad.priceInCents <= 0) {
      return NextResponse.json({ 
        error: 'This squad does not require payment' 
      }, { status: 400 });
    }

    // Get org settings for Stripe Connect
    if (!squad.organizationId) {
      return NextResponse.json({ 
        error: 'Squad is not properly configured' 
      }, { status: 400 });
    }

    const orgSettingsDoc = await adminDb.collection('org_settings').doc(squad.organizationId).get();
    const orgSettings = orgSettingsDoc.data() as OrgSettings | undefined;

    const stripeConnectAccountId = orgSettings?.stripeConnectAccountId;
    if (!stripeConnectAccountId) {
      return NextResponse.json({ 
        error: 'Payment is not configured for this squad' 
      }, { status: 400 });
    }

    const stripe = getStripe();

    // Verify the connected account is ready to accept payments
    try {
      const account = await stripe.accounts.retrieve(stripeConnectAccountId);
      if (!account.charges_enabled) {
        return NextResponse.json({ 
          error: 'Payment processing is not yet enabled. Please try again later.' 
        }, { status: 400 });
      }
    } catch (accountError) {
      console.error('[SQUAD_SUBSCRIPTION_INTENT] Error checking Stripe Connect account:', accountError);
      return NextResponse.json({ 
        error: 'Unable to verify payment configuration. Please contact support.' 
      }, { status: 500 });
    }

    // Get user email
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);
    const email = clerkUser.emailAddresses[0]?.emailAddress;

    // Get or create Stripe customer on the Connected account
    let customerId: string | undefined;
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const connectedCustomerIds = userData?.stripeConnectedCustomerIds || {};

    if (connectedCustomerIds[stripeConnectAccountId]) {
      customerId = connectedCustomerIds[stripeConnectAccountId];
      
      // Verify the customer still exists
      try {
        await stripe.customers.retrieve(customerId, { stripeAccount: stripeConnectAccountId });
      } catch {
        // Customer doesn't exist, create new one
        customerId = undefined;
      }
    }

    if (!customerId) {
      // Create new Stripe customer on the Connected account
      const customer = await stripe.customers.create(
        {
          email,
          name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || undefined,
          metadata: {
            userId,
            platformUserId: userId,
          },
        },
        { stripeAccount: stripeConnectAccountId }
      );
      customerId = customer.id;

      // Save customer ID for this connected account
      await adminDb.collection('users').doc(userId).set(
        {
          stripeConnectedCustomerIds: {
            ...connectedCustomerIds,
            [stripeConnectAccountId]: customerId,
          },
        },
        { merge: true }
      );
    }

    // Calculate platform fee (1% default or org-specific)
    const platformFeePercent = orgSettings?.platformFeePercent ?? 1;
    const applicationFeeAmount = Math.round(squad.priceInCents * (platformFeePercent / 100));

    // Create subscription with payment_behavior: 'default_incomplete'
    // This creates a subscription in 'incomplete' status with a PaymentIntent
    const subscription = await stripe.subscriptions.create(
      {
        customer: customerId,
        items: [{ price: squad.stripePriceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription',
        },
        application_fee_percent: platformFeePercent,
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          squadId,
          userId,
          organizationId: squad.organizationId,
          type: 'squad_subscription',
        },
      },
      { stripeAccount: stripeConnectAccountId }
    );

    // Get the PaymentIntent client secret
    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice?.payment_intent as Stripe.PaymentIntent;

    if (!paymentIntent?.client_secret) {
      console.error('[SQUAD_SUBSCRIPTION_INTENT] No payment intent returned from subscription creation');
      return NextResponse.json({ 
        error: 'Failed to create payment intent' 
      }, { status: 500 });
    }

    console.log(
      `[SQUAD_SUBSCRIPTION_INTENT] Created subscription ${subscription.id} for squad ${squadId} user ${userId}`
    );

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      subscriptionId: subscription.id,
      connectedAccountId: stripeConnectAccountId,
      priceInCents: squad.priceInCents,
      currency: squad.currency || 'usd',
      billingInterval: squad.billingInterval || 'monthly',
      squadName: squad.name,
    });
  } catch (error) {
    console.error('[SQUAD_SUBSCRIPTION_INTENT] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

