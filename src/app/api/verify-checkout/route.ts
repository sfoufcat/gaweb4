import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { sendWelcomeEmail } from '@/lib/email';
import { updateUserBillingInClerk } from '@/lib/admin-utils-clerk';

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

/**
 * POST /api/verify-checkout
 * Directly verifies a Stripe checkout session and updates billing status
 * This is a fallback in case webhooks are delayed
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stripe = getStripeClient();
    const body = await req.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    // Verify the session belongs to this user
    if (session.metadata?.userId !== userId) {
      console.error('[VERIFY_CHECKOUT] Session userId mismatch:', session.metadata?.userId, userId);
      return NextResponse.json({ error: 'Session does not belong to user' }, { status: 403 });
    }

    // Check if payment was successful
    if (session.payment_status !== 'paid') {
      return NextResponse.json({ 
        success: false, 
        status: 'pending',
        message: 'Payment not yet completed' 
      });
    }

    // Get subscription details
    const subscription = session.subscription as Stripe.Subscription | null;
    
    if (!subscription) {
      return NextResponse.json({ 
        success: false, 
        status: 'no_subscription',
        message: 'No subscription found' 
      });
    }

    const plan = session.metadata?.plan as 'standard' | 'premium' || 'standard';
    const customerId = typeof session.customer === 'string' 
      ? session.customer 
      : session.customer?.id;
    const subscriptionId = typeof subscription === 'string' 
      ? subscription 
      : subscription.id;
    const currentPeriodEnd = typeof subscription !== 'string' 
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : undefined;

    // Fetch current user data
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userEmail = userData?.email || session.customer_email;
    const firstName = userData?.firstName || userData?.name?.split(' ')[0];
    const alreadyWelcomed = userData?.welcomeEmailSent === true;

    // Check if billing is already set (webhook beat us to it)
    if (userData?.billing?.status === 'active') {
      return NextResponse.json({ 
        success: true, 
        status: 'active',
        message: 'Subscription already active' 
      });
    }

    // Update user document with billing info
    await adminDb.collection('users').doc(userId).set({
      billing: {
        plan,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        status: 'active',
        currentPeriodEnd,
        cancelAtPeriodEnd: false,
      },
      // Sync tier with billing plan
      tier: plan,
      // Mark onboarding as completed
      onboardingStatus: 'completed',
      hasCompletedOnboarding: true,
      // Mark as converted member
      convertedToMember: true,
      convertedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    console.log(`[VERIFY_CHECKOUT] Updated billing for user ${userId}, plan: ${plan}`);

    // CRITICAL: Sync billing status AND tier to Clerk for middleware access control
    try {
      await updateUserBillingInClerk(userId, 'active', currentPeriodEnd, plan);
      console.log(`[VERIFY_CHECKOUT] Updated Clerk billing for user ${userId}, tier: ${plan}`);
    } catch (clerkError) {
      console.error(`[VERIFY_CHECKOUT] Failed to update Clerk billing for user ${userId}:`, clerkError);
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
          await adminDb.collection('users').doc(userId).set({
            welcomeEmailSent: true,
            welcomeEmailSentAt: new Date().toISOString(),
          }, { merge: true });
          console.log(`[VERIFY_CHECKOUT] Welcome email sent to user ${userId}`);
        }
      } catch (emailError) {
        // Don't fail if email fails
        console.error(`[VERIFY_CHECKOUT] Error sending welcome email:`, emailError);
      }
    }

    return NextResponse.json({ 
      success: true, 
      status: 'active',
      plan,
      message: 'Subscription verified and activated' 
    });

  } catch (error) {
    console.error('[VERIFY_CHECKOUT_ERROR]', error);
    
    // Handle specific Stripe errors
    const errorType = (error as { type?: string })?.type;
    if (errorType === 'StripeInvalidRequestError') {
      return NextResponse.json({ 
        success: false, 
        status: 'invalid_session',
        message: 'Invalid checkout session' 
      }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : 'Failed to verify checkout';
    return NextResponse.json(
      { error: message }, 
      { status: 500 }
    );
  }
}



