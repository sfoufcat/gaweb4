import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import type { CoachingPlanType } from '@/types';

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

// Coaching price IDs
const COACHING_PRICE_IDS = {
  monthly: 'price_1SY2YIGZhrOwy75wdbPeTjtl',
  quarterly: 'price_1SY2ZBGZhrOwy75w5sniKZrq',
};

interface PreviewRequest {
  planLabel: CoachingPlanType;
}

/**
 * POST /api/coaching/preview
 * 
 * Calculates the cost for adding a coaching subscription.
 * Returns the full amount since coaching is a NEW subscription (not an upgrade).
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
    const priceId = COACHING_PRICE_IDS[planLabel];
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

    // Get existing Stripe customer ID
    const stripeCustomerId = userData.billing?.stripeCustomerId;

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: 'No active subscription found.' }, 
        { status: 400 }
      );
    }

    try {
      // Fetch the price to get the amount
      const price = await stripe.prices.retrieve(priceId);
      
      if (!price.unit_amount) {
        return NextResponse.json(
          { error: 'Invalid price configuration.' }, 
          { status: 400 }
        );
      }

      // For coaching, it's a NEW subscription, so we charge the full price immediately
      // No proration calculation needed - it's the full price
      const dueToday = price.unit_amount / 100;
      const currency = price.currency.toUpperCase();

      // Calculate next billing date (1 month or 3 months from now)
      const nextBillingDate = new Date();
      if (planLabel === 'monthly') {
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
      } else {
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 3);
      }

      return NextResponse.json({
        success: true,
        preview: {
          dueToday,
          currency,
          creditAmount: 0, // No credits for new subscription
          chargeAmount: dueToday,
          nextBillingDate: nextBillingDate.toISOString(),
        },
      });

    } catch (stripeError: any) {
      console.error('[COACHING_PREVIEW] Stripe error:', stripeError);
      return NextResponse.json(
        { error: stripeError.message || 'Failed to calculate coaching cost.' }, 
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('[COACHING_PREVIEW] Error:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred.' }, 
      { status: 500 }
    );
  }
}









