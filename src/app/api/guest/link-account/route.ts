import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { updateUserBillingInClerk } from '@/lib/admin-utils-clerk';
import { sendWelcomeEmail } from '@/lib/email';
import { setUserTrack, isValidTrack } from '@/lib/track';

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
 * POST /api/guest/link-account
 * Links a guest session to a newly created Clerk user account
 * 
 * This should be called AFTER the user creates their Clerk account
 * (after verifying their email). It:
 * 1. Copies all guest session data to the user document
 * 2. Updates the Stripe subscription with the Clerk userId
 * 3. Updates Clerk metadata with billing info
 * 4. Marks the guest session as linked
 */
export async function POST(req: Request) {
  try {
    // Require authentication - the user should have just created their account
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { guestSessionId } = body;

    if (!guestSessionId) {
      return NextResponse.json(
        { error: 'Guest session ID is required' },
        { status: 400 }
      );
    }

    // Get guest session data
    const guestDoc = await adminDb.collection('guestSessions').doc(guestSessionId).get();

    if (!guestDoc.exists) {
      return NextResponse.json(
        { error: 'Guest session not found' },
        { status: 404 }
      );
    }

    const guestData = guestDoc.data();

    // Check if already linked to another user
    if (guestData?.linkedUserId && guestData.linkedUserId !== userId) {
      return NextResponse.json(
        { error: 'This session has already been linked to another account' },
        { status: 400 }
      );
    }

    // Check if payment was completed
    if (guestData?.paymentStatus !== 'completed') {
      return NextResponse.json(
        { error: 'Payment has not been completed for this session' },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();

    // Get subscription details if available
    let currentPeriodEnd: string | undefined;
    if (guestData.stripeSubscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(guestData.stripeSubscriptionId);
        currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

        // Update subscription metadata with the new userId
        await stripe.subscriptions.update(guestData.stripeSubscriptionId, {
          metadata: {
            userId: userId,
            plan: guestData.selectedPlan || 'standard',
            guestSessionId: guestSessionId,
            linkedAt: new Date().toISOString(),
          },
        });

        // Also update the customer metadata
        if (guestData.stripeCustomerId) {
          await stripe.customers.update(guestData.stripeCustomerId, {
            metadata: {
              userId: userId,
            },
          });
        }
      } catch (error) {
        console.error('[LINK_ACCOUNT] Error updating Stripe:', error);
        // Continue even if Stripe update fails - we'll fix it manually if needed
      }
    }

    // Build user document from guest data
    const plan = guestData.selectedPlan || 'standard';
    const preselectedTrack = guestData.preselectedTrack;
    
    const userDocument: Record<string, unknown> = {
      // Basic info
      id: userId,
      email: guestData.email,
      firstName: guestData.firstName || '',
      lastName: guestData.lastName || '',
      
      // Mission & Goal
      mission: guestData.mission || '',
      goal: guestData.goal || '',
      goalTargetDate: guestData.goalTargetDate || null,
      
      // Onboarding quiz answers
      onboarding: {
        workdayStyle: guestData.workdayStyle || null,
        peerAccountability: guestData.peerAccountability || null,
        businessStage: guestData.businessStage || null,
        goalImpact: guestData.goalImpact || [],
        supportNeeds: guestData.supportNeeds || [],
      },
      
      // Billing info
      billing: {
        plan: plan,
        stripeCustomerId: guestData.stripeCustomerId,
        stripeSubscriptionId: guestData.stripeSubscriptionId,
        status: 'active',
        currentPeriodEnd: currentPeriodEnd,
        cancelAtPeriodEnd: false,
      },
      
      // Sync tier with billing plan
      tier: plan,
      
      // Onboarding status - mark as completed to prevent redirect loops
      // Profile setup is handled by /start/profile before reaching home
      onboardingStatus: 'completed',
      hasCompletedOnboarding: true,
      
      // Conversion tracking
      convertedToMember: true,
      convertedAt: new Date().toISOString(),
      
      // Guest session reference
      linkedFromGuestSession: guestSessionId,
      
      // Timestamps
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Add preselected track if it was set via funnel URL
    if (preselectedTrack && isValidTrack(preselectedTrack)) {
      userDocument.track = preselectedTrack;
      console.log(`[LINK_ACCOUNT] Setting preselected track: ${preselectedTrack} for ${userId}`);
    }

    // Create/update user document in Firebase
    // IMPORTANT: First, forcefully clear any stale onboarding status to prevent redirect loops
    // This handles cases where user started regular onboarding before trying guest flow
    const existingDoc = await adminDb.collection('users').doc(userId).get();
    if (existingDoc.exists) {
      const existingData = existingDoc.data();
      // If user has incomplete onboarding from a previous attempt, clear it
      if (existingData?.onboardingStatus && existingData.onboardingStatus !== 'completed') {
        console.log(`[LINK_ACCOUNT] Clearing stale onboardingStatus: ${existingData.onboardingStatus} for ${userId}`);
      }
    }
    
    // Use set with merge, but our document explicitly sets onboardingStatus: 'completed'
    // which will overwrite any existing value
    await adminDb.collection('users').doc(userId).set(userDocument, { merge: true });

    console.log(`[LINK_ACCOUNT] Created user document for ${userId} from guest session ${guestSessionId}`);

    // Update Clerk metadata with billing info
    try {
      await updateUserBillingInClerk(userId, 'active', currentPeriodEnd, plan as 'standard' | 'premium');
      console.log(`[LINK_ACCOUNT] Updated Clerk billing for ${userId}`);
    } catch (clerkError) {
      console.error(`[LINK_ACCOUNT] Failed to update Clerk billing:`, clerkError);
      // Continue - Firebase is already updated
    }
    
    // Update Clerk metadata with track if preselected
    if (preselectedTrack && isValidTrack(preselectedTrack)) {
      try {
        await setUserTrack(userId, preselectedTrack);
        console.log(`[LINK_ACCOUNT] Set track in Clerk: ${preselectedTrack} for ${userId}`);
      } catch (trackError) {
        console.error(`[LINK_ACCOUNT] Failed to set track in Clerk:`, trackError);
        // Continue - Firebase is already updated
      }
    }

    // Mark guest session as linked and complete
    await adminDb.collection('guestSessions').doc(guestSessionId).set({
      linkedUserId: userId,
      linkedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentStep: 'complete', // Track successful completion in admin analytics
    }, { merge: true });

    // Send welcome email
    if (guestData.email) {
      try {
        const emailResult = await sendWelcomeEmail({
          email: guestData.email,
          firstName: guestData.firstName,
          userId,
        });

        if (emailResult.success) {
          await adminDb.collection('users').doc(userId).set({
            welcomeEmailSent: true,
            welcomeEmailSentAt: new Date().toISOString(),
          }, { merge: true });
          console.log(`[LINK_ACCOUNT] Welcome email sent to ${userId}`);
        }
      } catch (emailError) {
        console.error(`[LINK_ACCOUNT] Failed to send welcome email:`, emailError);
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({
      success: true,
      userId,
      plan,
      message: 'Account linked successfully',
    });

  } catch (error) {
    console.error('[LINK_ACCOUNT_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Failed to link account';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

