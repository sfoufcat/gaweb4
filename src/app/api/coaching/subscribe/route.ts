import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { updateUserCoachingInClerk } from '@/lib/admin-utils-clerk';
import type { CoachingPlanType, CoachingIntakeForm, CoachingStatus } from '@/types';

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

// Coaching product ID
const COACHING_PRODUCT_ID = 'prod_TV2dhbvP1vJ69e';

interface SubscribeRequest {
  priceId: string;
  planLabel: CoachingPlanType;
  phoneNumber?: string;
  goalsSelected: string[];
  coachPreference: string;
  commitment: 'commit' | 'not_ready';
}

/**
 * POST /api/coaching/subscribe
 * 
 * Creates a new coaching subscription for the user.
 * This is an ADDITIONAL subscription, not a replacement.
 * Updates Clerk metadata with coaching: true while preserving existing tier.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stripe = getStripeClient();
    const body: SubscribeRequest = await req.json();
    const { 
      priceId, 
      planLabel, 
      phoneNumber, 
      goalsSelected, 
      coachPreference,
      commitment 
    } = body;

    // Validate commitment - never subscribe if not committed
    if (commitment !== 'commit') {
      return NextResponse.json(
        { error: 'You must commit to proceed with coaching.' }, 
        { status: 400 }
      );
    }

    // Validate price ID
    const validPriceId = COACHING_PRICE_IDS[planLabel];
    if (!validPriceId || priceId !== validPriceId) {
      return NextResponse.json(
        { error: 'Invalid price configuration.' }, 
        { status: 400 }
      );
    }

    // Validate required fields
    if (!goalsSelected || goalsSelected.length === 0) {
      return NextResponse.json(
        { error: 'Please select at least one goal.' }, 
        { status: 400 }
      );
    }

    if (!coachPreference) {
      return NextResponse.json(
        { error: 'Please select a coach preference.' }, 
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

    const userEmail = userData.email;
    const userName = userData.name || `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
    const existingPhone = userData.phoneNumber;

    // Get the phone number to use (new or existing)
    const finalPhoneNumber = phoneNumber || existingPhone || '';

    // Validate phone number is provided if not already in profile
    if (!existingPhone && !phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required.' }, 
        { status: 400 }
      );
    }

    // Get existing Stripe customer ID
    const stripeCustomerId = userData.billing?.stripeCustomerId;

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: 'No payment method found. Please contact support.' }, 
        { status: 400 }
      );
    }

    let stripeSubscriptionSuccessful = false;
    let coachingSubscriptionId: string | undefined;

    try {
      // First, check if user already has a coaching subscription
      const existingSubscriptions = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: 'active',
      });

      const hasExistingCoaching = existingSubscriptions.data.some(sub => 
        sub.items.data.some(item => item.price.product === COACHING_PRODUCT_ID)
      );

      if (hasExistingCoaching) {
        return NextResponse.json(
          { error: 'You already have an active coaching subscription.' }, 
          { status: 400 }
        );
      }

      // Get customer to find default payment method
      const customer = await stripe.customers.retrieve(stripeCustomerId) as Stripe.Customer;
      
      if (!customer.invoice_settings?.default_payment_method && !customer.default_source) {
        return NextResponse.json(
          { error: 'No default payment method found. Please update your payment method and try again.' }, 
          { status: 400 }
        );
      }

      // Create a NEW coaching subscription (doesn't replace existing subscription)
      const subscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: priceId }],
        default_payment_method: customer.invoice_settings?.default_payment_method as string || undefined,
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          userId: userId,
          type: 'coaching',
          planLabel: planLabel,
          coachPreference: coachPreference,
          createdAt: new Date().toISOString(),
        },
      });

      coachingSubscriptionId = subscription.id;

      // Check if payment is required and handle it
      const latestInvoice = subscription.latest_invoice as Stripe.Invoice;
      
      if (latestInvoice && latestInvoice.status === 'open') {
        // Invoice needs to be paid
        const paidInvoice = await stripe.invoices.pay(latestInvoice.id);
        
        if (paidInvoice.status !== 'paid') {
          console.error(`[COACHING_SUBSCRIBE] Invoice ${latestInvoice.id} payment failed: status=${paidInvoice.status}`);
          
          // Cancel the subscription since payment failed
          await stripe.subscriptions.cancel(subscription.id);
          
          return NextResponse.json(
            { error: 'Payment could not be processed. Please update your payment method and try again.' }, 
            { status: 402 }
          );
        }
        
        console.log(`[COACHING_SUBSCRIBE] Invoice ${latestInvoice.id} paid successfully for user ${userId}`);
        stripeSubscriptionSuccessful = true;
      } else if (subscription.status === 'active') {
        // Subscription is already active (e.g., $0 first payment)
        stripeSubscriptionSuccessful = true;
        console.log(`[COACHING_SUBSCRIBE] Subscription active for user ${userId}`);
      }

      // CRITICAL: Only update Firebase/Clerk AFTER payment is confirmed
      if (stripeSubscriptionSuccessful) {
        const coachingStatus: CoachingStatus = 'active';
        const now = new Date().toISOString();
        
        // Update user with coaching subscription info in Firestore
        // Note: Coaching is SEPARATE from membership tier - we don't change tier here
        await userRef.set({
          // New coaching object structure
          coaching: {
            status: coachingStatus,
            plan: planLabel,
            stripeSubscriptionId: coachingSubscriptionId,
            coachPreference: coachPreference,
            startedAt: now,
          },
          // Legacy field for backward compatibility (will be removed later)
          coachingSubscription: {
            stripeSubscriptionId: coachingSubscriptionId,
            priceId: priceId,
            planLabel: planLabel,
            status: 'active',
            coachPreference: coachPreference,
            createdAt: now,
          },
          // Update phone number if newly provided
          ...(phoneNumber && !existingPhone ? { phoneNumber: phoneNumber.trim() } : {}),
          updatedAt: now,
        }, { merge: true });

        // Update Clerk with coaching status (preserving existing tier/role)
        // IMPORTANT: This does NOT change the membership tier
        try {
          await updateUserCoachingInClerk(userId, coachingStatus, planLabel);
          console.log(`[COACHING_SUBSCRIBE] Updated Clerk metadata for user ${userId}: coachingStatus=${coachingStatus}, plan=${planLabel}`);
        } catch (clerkError) {
          console.error('[COACHING_SUBSCRIBE] Failed to update Clerk coaching:', clerkError);
          // Don't fail the request - Firestore is updated
        }
      } else {
        // This shouldn't happen, but handle gracefully
        console.error('[COACHING_SUBSCRIBE] Unexpected state: stripeSubscriptionSuccessful=false after payment flow');
        return NextResponse.json(
          { error: 'An unexpected error occurred during payment processing. Please contact support.' }, 
          { status: 500 }
        );
      }

    } catch (stripeError: any) {
      console.error('[COACHING_SUBSCRIBE] Stripe error:', stripeError);
      
      // Return appropriate error based on failure type
      const errorMessage = stripeError.code === 'card_declined' 
        ? 'Your card was declined. Please update your payment method and try again.'
        : stripeError.type === 'StripeCardError'
        ? 'There was an issue with your card. Please update your payment method and try again.'
        : stripeError.message || 'Failed to create coaching subscription. Please try again.';
      
      return NextResponse.json(
        { error: errorMessage }, 
        { status: stripeError.statusCode || 500 }
      );
    }

    // Create the form submission record
    const formId = `${userId}_coaching_${Date.now()}`;
    const formData: CoachingIntakeForm = {
      id: formId,
      userId,
      email: userEmail,
      name: userName,
      phone: finalPhoneNumber,
      priceId,
      planLabel,
      goalsSelected,
      coachPreference,
      commitment,
      stripeSubscriptionSuccessful,
      createdAt: new Date().toISOString(),
    };

    // Save form submission to Firestore
    await adminDb.collection('coachingIntakeForms').doc(formId).set(formData);

    console.log(`[COACHING_SUBSCRIBE] User ${userId} subscribed to coaching (${planLabel})`);

    return NextResponse.json({
      success: true,
      message: 'Successfully subscribed to coaching!',
      plan: planLabel,
      subscriptionId: coachingSubscriptionId,
    });

  } catch (error: any) {
    console.error('[COACHING_SUBSCRIBE] Error:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred.' }, 
      { status: 500 }
    );
  }
}


