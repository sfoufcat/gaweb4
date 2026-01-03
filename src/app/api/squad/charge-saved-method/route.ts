/**
 * Charge Saved Payment Method for Squad Subscription
 * 
 * POST /api/squad/charge-saved-method
 * 
 * Creates and confirms a Stripe Subscription using a saved payment method
 * for one-click squad membership purchases.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getStreamServerClient } from '@/lib/stream-server';
import { MAX_SQUAD_MEMBERS } from '@/lib/squad-constants';
import { addUserToOrganization } from '@/lib/clerk-organizations';
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
 * POST /api/squad/charge-saved-method
 * 
 * Body:
 * - squadId: string - The squad to join
 * - paymentMethodId: string - The saved payment method to use
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { squadId, paymentMethodId } = body as {
      squadId: string;
      paymentMethodId: string;
    };

    if (!squadId) {
      return NextResponse.json({ error: 'Squad ID is required' }, { status: 400 });
    }

    if (!paymentMethodId) {
      return NextResponse.json({ error: 'Payment method ID is required' }, { status: 400 });
    }

    // Get the squad
    const squadRef = adminDb.collection('squads').doc(squadId);
    const squadDoc = await squadRef.get();

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
      console.error('[SQUAD_CHARGE_SAVED] Error checking Stripe Connect account:', accountError);
      return NextResponse.json({ 
        error: 'Unable to verify payment configuration. Please contact support.' 
      }, { status: 500 });
    }

    // Get user's customer ID for this connected account
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const connectedCustomerIds = userData?.stripeConnectedCustomerIds || {};
    const customerId = connectedCustomerIds[stripeConnectAccountId];

    if (!customerId) {
      return NextResponse.json(
        { error: 'No saved payment method found. Please add a payment method first.' },
        { status: 400 }
      );
    }

    // Verify the payment method belongs to this customer
    try {
      const paymentMethod = await stripe.paymentMethods.retrieve(
        paymentMethodId,
        { stripeAccount: stripeConnectAccountId }
      );
      if (paymentMethod.customer !== customerId) {
        return NextResponse.json(
          { error: 'Invalid payment method' },
          { status: 400 }
        );
      }
    } catch (pmError) {
      console.error('[SQUAD_CHARGE_SAVED] Error verifying payment method:', pmError);
      return NextResponse.json(
        { error: 'Payment method not found or invalid' },
        { status: 400 }
      );
    }

    // Calculate platform fee
    const platformFeePercent = orgSettings?.platformFeePercent ?? 1;

    // Create subscription with the saved payment method
    let subscription: Stripe.Subscription;
    try {
      subscription = await stripe.subscriptions.create(
        {
          customer: customerId,
          items: [{ price: squad.stripePriceId }],
          default_payment_method: paymentMethodId,
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
    } catch (stripeError) {
      console.error('[SQUAD_CHARGE_SAVED] Stripe subscription error:', stripeError);
      
      if (stripeError instanceof Stripe.errors.StripeCardError) {
        return NextResponse.json(
          { error: 'Payment failed: ' + stripeError.message },
          { status: 400 }
        );
      }
      
      throw stripeError;
    }

    // Check if subscription was created successfully
    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
      // Get the payment intent to check for issues
      const invoice = subscription.latest_invoice as Stripe.Invoice;
      const paymentIntent = invoice?.payment_intent as Stripe.PaymentIntent;
      
      if (paymentIntent?.status === 'requires_action') {
        // Need 3D Secure or other action - can't do with saved card one-click
        return NextResponse.json(
          { 
            error: 'This card requires additional authentication. Please use the full payment form.',
            requiresAction: true,
          },
          { status: 400 }
        );
      }
      
      console.error('[SQUAD_CHARGE_SAVED] Subscription not active:', subscription.status);
      return NextResponse.json(
        { error: 'Payment failed. Please try again.' },
        { status: 400 }
      );
    }

    // Get the payment intent from the subscription's latest invoice
    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice?.payment_intent as Stripe.PaymentIntent;

    console.log(
      `[SQUAD_CHARGE_SAVED] Created subscription ${subscription.id} for user ${userId} squad ${squadId}`
    );

    // ================================
    // ADD USER TO SQUAD (same as complete-subscription)
    // ================================
    const now = new Date().toISOString();

    // Update squad memberIds
    await squadRef.update({
      memberIds: [...memberIds, userId],
      updatedAt: now,
    });

    // Get user info from Clerk
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);

    // Get current period end from subscription
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

    // Create squadMember document with subscription info
    await adminDb.collection('squadMembers').add({
      squadId,
      userId,
      roleInSquad: 'member',
      firstName: clerkUser.firstName || '',
      lastName: clerkUser.lastName || '',
      imageUrl: clerkUser.imageUrl || '',
      // Subscription info
      subscriptionId: subscription.id,
      subscriptionStatus: 'active',
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    });

    // Update user's squad membership - add to squadIds array
    const currentSquadIds: string[] = userData?.squadIds || [];
    
    if (!currentSquadIds.includes(squadId)) {
      const updatedSquadIds = [...currentSquadIds, squadId];
      await adminDb.collection('users').doc(userId).update({
        squadIds: updatedSquadIds,
        squadId: squadId, // Legacy field
        updatedAt: now,
      });
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
        console.error('[SQUAD_CHARGE_SAVED] Stream error:', streamError);
        // Don't fail if Stream fails
      }
    }

    // Auto-assign user to squad's organization
    if (squad.organizationId) {
      try {
        await addUserToOrganization(userId, squad.organizationId, 'org:member');
        console.log(`[SQUAD_CHARGE_SAVED] Added user ${userId} to organization ${squad.organizationId}`);
      } catch (orgError) {
        console.error('[SQUAD_CHARGE_SAVED] Org assignment error:', orgError);
        // Don't fail if org assignment fails
      }
    }

    console.log(`[SQUAD_CHARGE_SAVED] User ${userId} joined squad ${squadId} with subscription ${subscription.id}`);

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      paymentIntentId: paymentIntent?.id,
      message: 'Successfully joined the squad!',
    });
  } catch (error) {
    console.error('[SQUAD_CHARGE_SAVED] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

