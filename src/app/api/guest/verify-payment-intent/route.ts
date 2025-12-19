import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';

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

/**
 * POST /api/guest/verify-payment-intent
 * Verifies a PaymentIntent from embedded checkout and updates the guest session
 * 
 * This is called after a guest user completes payment via embedded checkout.
 * The embedded checkout redirects with payment_intent and redirect_status params.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { paymentIntentId, guestSessionId } = body;

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'Payment intent ID is required' },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();

    // Retrieve the payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['invoice', 'invoice.subscription'],
    });

    // Check payment status
    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json({
        success: false,
        status: paymentIntent.status,
        error: `Payment not completed. Status: ${paymentIntent.status}`,
      });
    }

    // Get subscription info from the invoice
    const invoice = paymentIntent.invoice as Stripe.Invoice | null;
    const subscription = invoice?.subscription as Stripe.Subscription | null;
    
    // Try to get guestSessionId from subscription metadata, payment intent metadata, or request body
    const resolvedGuestSessionId = 
      subscription?.metadata?.guestSessionId ||
      paymentIntent.metadata?.guestSessionId ||
      guestSessionId;

    // Get subscription details
    const subscriptionId = subscription?.id;
    const customerId = typeof paymentIntent.customer === 'string' 
      ? paymentIntent.customer 
      : paymentIntent.customer?.id;

    // Get customer email
    let customerEmail: string | null = null;
    if (customerId) {
      try {
        const customer = await stripe.customers.retrieve(customerId);
        if (customer && !customer.deleted) {
          customerEmail = customer.email;
        }
      } catch (e) {
        console.error('[VERIFY_PAYMENT_INTENT] Error fetching customer:', e);
      }
    }

    // Fall back to receipt email if customer email not found
    if (!customerEmail) {
      customerEmail = paymentIntent.receipt_email;
    }

    // Get plan from subscription metadata
    const plan = subscription?.metadata?.plan || 'standard';

    // If we have a guest session ID, update it with payment info
    if (resolvedGuestSessionId) {
      const currentPeriodEnd = subscription?.current_period_end 
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : undefined;

      await adminDb.collection('guestSessions').doc(resolvedGuestSessionId).set({
        paymentStatus: 'completed',
        stripePaymentIntentId: paymentIntentId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        stripeCurrentPeriodEnd: currentPeriodEnd,
        selectedPlan: plan,
        email: customerEmail,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      console.log(`[VERIFY_PAYMENT_INTENT] Updated guest session ${resolvedGuestSessionId} with payment info`);
    } else {
      console.warn('[VERIFY_PAYMENT_INTENT] No guest session ID found - payment verified but session not updated');
    }

    return NextResponse.json({
      success: true,
      status: 'active',
      email: customerEmail,
      plan,
      guestSessionId: resolvedGuestSessionId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
    });

  } catch (error) {
    console.error('[VERIFY_PAYMENT_INTENT_ERROR]', error);
    
    // Handle specific Stripe errors
    const errorType = (error as { type?: string })?.type;
    if (errorType === 'StripeInvalidRequestError') {
      return NextResponse.json({
        success: false,
        error: 'Invalid payment intent',
      }, { status: 400 });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to verify payment' },
      { status: 500 }
    );
  }
}

