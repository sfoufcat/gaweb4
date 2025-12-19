import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import type { PremiumPlanType } from '@/types';

// Lazy initialization of Stripe to avoid build-time errors
function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(key, {
    apiVersion: '2025-02-24.acacia',
  });
}

// Premium price IDs
const PREMIUM_PRICE_IDS = {
  monthly: 'price_1SXkqZGZhrOwy75wAG3mSczA',
  sixMonth: 'price_1SXkqZGZhrOwy75wPUyBuKxs',
};

interface PreviewRequest {
  planLabel: PremiumPlanType;
}

/**
 * POST /api/subscription/preview-upgrade
 * 
 * Calculates the prorated amount for upgrading to Premium.
 * Returns the amount_due that will be charged immediately.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stripe = getStripeClient();
    const body: PreviewRequest = await req.json();
    const { planLabel } = body;

    // Validate plan
    const priceId = PREMIUM_PRICE_IDS[planLabel];
    if (!priceId) {
      return NextResponse.json(
        { error: 'Invalid plan selected.' }, 
        { status: 400 }
      );
    }

    // Get user data from Firestore
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const userData = userDoc.data();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get existing Stripe subscription
    const stripeSubscriptionId = userData.billing?.stripeSubscriptionId;
    const stripeCustomerId = userData.billing?.stripeCustomerId;

    if (!stripeSubscriptionId || !stripeCustomerId) {
      return NextResponse.json(
        { error: 'No active subscription found.' }, 
        { status: 400 }
      );
    }

    try {
      // Fetch the current subscription
      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

      if (subscription.status !== 'active' && subscription.status !== 'trialing') {
        return NextResponse.json(
          { error: 'Your subscription is not active.' }, 
          { status: 400 }
        );
      }

      // Get the current subscription item
      const currentItem = subscription.items.data[0];
      
      if (!currentItem) {
        return NextResponse.json(
          { error: 'Invalid subscription configuration.' }, 
          { status: 400 }
        );
      }

      // Retrieve the upcoming invoice to see the prorated amount
      const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
        customer: stripeCustomerId,
        subscription: stripeSubscriptionId,
        subscription_items: [
          {
            id: currentItem.id,
            price: priceId,
          },
        ],
        subscription_proration_behavior: 'create_prorations',
      });

      const currency = upcomingInvoice.currency.toUpperCase();

      // Get breakdown of line items for transparency
      // Proration items are what the user pays TODAY (the difference for remaining period)
      const prorationItems = upcomingInvoice.lines.data.filter(
        line => line.proration
      );
      
      // Credit: negative amounts (refund for unused portion of old plan)
      const creditAmount = prorationItems
        .filter(item => item.amount < 0)
        .reduce((sum, item) => sum + Math.abs(item.amount), 0) / 100;
      
      // Charge: positive amounts (cost for remaining portion of new plan)
      const chargeAmount = prorationItems
        .filter(item => item.amount > 0)
        .reduce((sum, item) => sum + item.amount, 0) / 100;

      // DUE TODAY = proration charge minus proration credit
      // This is what gets charged immediately when we create an invoice
      // NOTE: upcomingInvoice.amount_due includes NEXT period too, which is wrong for "today"
      const dueToday = Math.max(0, chargeAmount - creditAmount);

      return NextResponse.json({
        success: true,
        preview: {
          dueToday, // The actual amount charged TODAY (proration only)
          currency,
          creditAmount, // What they're getting back from current plan
          chargeAmount, // What the new plan costs (prorated)
          nextBillingDate: new Date(subscription.current_period_end * 1000).toISOString(),
        },
      });

    } catch (stripeError) {
      console.error('[PREVIEW_UPGRADE] Stripe error:', stripeError);
      const message = stripeError instanceof Error ? stripeError.message : 'Failed to calculate upgrade cost.';
      return NextResponse.json(
        { error: message }, 
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[PREVIEW_UPGRADE] Error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return NextResponse.json(
      { error: message }, 
      { status: 500 }
    );
  }
}

