/**
 * Charge Saved Payment Method for Funnel Purchase
 * 
 * POST /api/funnel/charge-saved-method
 * 
 * Creates and confirms a Stripe PaymentIntent using a saved payment method
 * for one-click purchases in program funnels.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import Stripe from 'stripe';
import type { OrgSettings, FlowSession, Program } from '@/types';

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
 * POST /api/funnel/charge-saved-method
 * 
 * Body:
 * - paymentMethodId: string - The saved payment method to use
 * - priceInCents: number
 * - currency: string (default: 'usd')
 * - programId?: string
 * - flowSessionId?: string
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { paymentMethodId, priceInCents, currency = 'usd', programId, flowSessionId } = body;

    if (!paymentMethodId) {
      return NextResponse.json(
        { error: 'Missing required field: paymentMethodId' },
        { status: 400 }
      );
    }

    if (!priceInCents || priceInCents <= 0) {
      return NextResponse.json(
        { error: 'Invalid price' },
        { status: 400 }
      );
    }

    // Build metadata
    const metadata: Record<string, string> = {
      userId,
      type: 'funnel_payment_saved_method',
    };

    let organizationId: string | undefined;
    let program: Program | undefined;

    // Get flow session for context
    if (flowSessionId) {
      metadata.flowSessionId = flowSessionId;
      
      const sessionDoc = await adminDb.collection('flow_sessions').doc(flowSessionId).get();
      if (sessionDoc.exists) {
        const session = sessionDoc.data() as FlowSession;
        organizationId = session.organizationId;
        metadata.organizationId = session.organizationId;
        metadata.funnelId = session.funnelId;
        
        // Get program from flow session if not provided
        if (!programId && session.programId) {
          metadata.programId = session.programId;
        }
      }
    }

    // Get program details
    const targetProgramId = programId || metadata.programId;
    if (targetProgramId) {
      metadata.programId = targetProgramId;
      const programDoc = await adminDb.collection('programs').doc(targetProgramId).get();
      if (programDoc.exists) {
        program = programDoc.data() as Program;
        // Use program's organizationId if not already set
        if (!organizationId) {
          organizationId = program.organizationId;
          metadata.organizationId = program.organizationId;
        }
      }
    }

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization not found - cannot process payment' },
        { status: 400 }
      );
    }

    // Get organization settings for Stripe Connect
    const orgSettingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
    const orgSettings = orgSettingsDoc.data() as OrgSettings | undefined;

    const stripeConnectAccountId = orgSettings?.stripeConnectAccountId;
    if (!stripeConnectAccountId) {
      return NextResponse.json(
        { error: 'Payment is not configured for this organization. Please contact support.' },
        { status: 400 }
      );
    }

    const stripe = getStripe();

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

    // Calculate platform fee
    const platformFeePercent = orgSettings?.platformFeePercent ?? 1;
    const applicationFeeAmount = Math.round(priceInCents * (platformFeePercent / 100));

    // Build description
    const description = program 
      ? `${program.name} - Program enrollment (saved card)`
      : 'Program enrollment (saved card)';

    // ========================================
    // CHECK FOR RECURRING/SUBSCRIPTION PROGRAM
    // ========================================
    if (program?.subscriptionEnabled && program.billingInterval) {
      // For subscription programs, we need a Stripe Price ID
      let stripePriceId = program.stripePriceId;
      
      if (!stripePriceId) {
        // Create or get a Stripe Product for this program
        let stripeProductId = program.stripeProductId;
        
        if (!stripeProductId) {
          // Create a new product on the connected account
          const product = await stripe.products.create(
            {
              name: program.name,
              description: program.description || `${program.name} - ${program.lengthDays} day program`,
              metadata: {
                programId: targetProgramId!,
                organizationId,
              },
            },
            { stripeAccount: stripeConnectAccountId }
          );
          stripeProductId = product.id;
          
          // Save the product ID back to the program
          await adminDb.collection('programs').doc(targetProgramId!).update({
            stripeProductId,
            updatedAt: new Date().toISOString(),
          });
        }
        
        // Determine the billing interval for Stripe
        const intervalMap: Record<string, Stripe.PriceCreateParams.Recurring.Interval> = {
          'monthly': 'month',
          'quarterly': 'month', // 3 months
          'yearly': 'year',
        };
        const interval = intervalMap[program.billingInterval] || 'month';
        const intervalCount = program.billingInterval === 'quarterly' ? 3 : 1;
        
        // Create a recurring price on the connected account
        const price = await stripe.prices.create(
          {
            product: stripeProductId,
            unit_amount: priceInCents,
            currency: currency.toLowerCase(),
            recurring: {
              interval,
              interval_count: intervalCount,
            },
            metadata: {
              programId: targetProgramId!,
              organizationId,
            },
          },
          { stripeAccount: stripeConnectAccountId }
        );
        stripePriceId = price.id;
        
        // Save the price ID back to the program
        await adminDb.collection('programs').doc(targetProgramId!).update({
          stripePriceId,
          updatedAt: new Date().toISOString(),
        });
        
        console.log(`[FUNNEL_CHARGE_SAVED] Created Stripe product ${stripeProductId} and price ${stripePriceId} for program ${targetProgramId}`);
      }
      
      try {
        // Create a subscription with the saved payment method
        const subscription = await stripe.subscriptions.create(
          {
            customer: customerId,
            items: [{ price: stripePriceId }],
            default_payment_method: paymentMethodId,
            application_fee_percent: platformFeePercent,
            expand: ['latest_invoice.payment_intent'],
            metadata: {
              ...metadata,
              type: 'funnel_subscription_saved_method',
            },
          },
          { stripeAccount: stripeConnectAccountId }
        );
        
        // Get the payment intent from the subscription's latest invoice
        const invoice = subscription.latest_invoice as Stripe.Invoice;
        const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;
        
        // Store payment method ID in flow session for upsells
        if (flowSessionId) {
          const sessionDoc = await adminDb.collection('flow_sessions').doc(flowSessionId).get();
          if (sessionDoc.exists) {
            const session = sessionDoc.data() as FlowSession;
            await sessionDoc.ref.update({
              data: {
                ...(session.data || {}),
                stripePaymentMethodId: paymentMethodId,
                stripeConnectAccountId: stripeConnectAccountId,
                stripeSubscriptionId: subscription.id,
              },
              updatedAt: new Date().toISOString(),
            });
          }
        }
        
        console.log(
          `[FUNNEL_CHARGE_SAVED] Created subscription ${subscription.id} for user ${userId} on connected account ${stripeConnectAccountId}`
        );
        
        return NextResponse.json({
          success: true,
          subscriptionId: subscription.id,
          paymentIntentId: paymentIntent?.id,
          connectedAccountId: stripeConnectAccountId,
          isSubscription: true,
        });
      } catch (stripeError) {
        console.error('[FUNNEL_CHARGE_SAVED] Stripe subscription error:', stripeError);
        
        if (stripeError instanceof Stripe.errors.StripeCardError) {
          return NextResponse.json(
            { error: 'Payment failed: ' + stripeError.message },
            { status: 400 }
          );
        }
        
        throw stripeError;
      }
    }

    // ========================================
    // ONE-TIME PAYMENT FLOW
    // ========================================
    // Create and confirm payment intent immediately with the saved payment method
    let paymentIntent: Stripe.PaymentIntent;
    
    try {
      paymentIntent = await stripe.paymentIntents.create(
        {
          amount: priceInCents,
          currency: currency.toLowerCase(),
          customer: customerId,
          payment_method: paymentMethodId,
          confirm: true, // Confirm immediately for one-click
          off_session: true, // Customer not present
          description,
          metadata,
          application_fee_amount: applicationFeeAmount,
        },
        { stripeAccount: stripeConnectAccountId }
      );
    } catch (stripeError) {
      console.error('[FUNNEL_CHARGE_SAVED] Stripe error:', stripeError);
      
      if (stripeError instanceof Stripe.errors.StripeCardError) {
        return NextResponse.json(
          { error: 'Payment failed: ' + stripeError.message },
          { status: 400 }
        );
      }
      
      throw stripeError;
    }

    // Check if payment succeeded
    if (paymentIntent.status !== 'succeeded') {
      console.error('[FUNNEL_CHARGE_SAVED] Payment not succeeded:', paymentIntent.status);
      return NextResponse.json(
        { 
          error: 'Payment not completed', 
          status: paymentIntent.status,
          requiresAction: paymentIntent.status === 'requires_action',
        },
        { status: 400 }
      );
    }

    // Store payment method ID in flow session for upsells
    if (flowSessionId) {
      const sessionDoc = await adminDb.collection('flow_sessions').doc(flowSessionId).get();
      if (sessionDoc.exists) {
        const session = sessionDoc.data() as FlowSession;
        await sessionDoc.ref.update({
          data: {
            ...(session.data || {}),
            stripePaymentMethodId: paymentMethodId,
            stripeConnectAccountId: stripeConnectAccountId,
          },
          updatedAt: new Date().toISOString(),
        });
      }
    }

    console.log(
      `[FUNNEL_CHARGE_SAVED] Successfully charged saved method for user ${userId} on connected account ${stripeConnectAccountId}`
    );

    return NextResponse.json({
      success: true,
      paymentIntentId: paymentIntent.id,
      connectedAccountId: stripeConnectAccountId,
      isSubscription: false,
    });
  } catch (error) {
    console.error('[FUNNEL_CHARGE_SAVED] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

