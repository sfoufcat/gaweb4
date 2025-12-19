import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { updateUserBillingInClerk } from '@/lib/admin-utils-clerk';
import type { PremiumPlanType, PremiumUpgradeForm } from '@/types';

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

interface UpgradeRequest {
  priceId: string;
  planLabel: PremiumPlanType;
  phoneNumber?: string;
  benefitsSelected: string[];
  upgradeWithFriends: boolean;
  friendsNames: string | null;
  commitment: 'commit' | 'not_ready';
}

/**
 * POST /api/subscription/upgrade-to-premium
 * 
 * Upgrades a user's subscription to Premium with proration.
 * Saves form answers to Firestore and updates the user's profile.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stripe = getStripeClient();
    const body: UpgradeRequest = await req.json();
    const { 
      priceId, 
      planLabel, 
      phoneNumber, 
      benefitsSelected, 
      upgradeWithFriends, 
      friendsNames, 
      commitment 
    } = body;

    // Validate commitment - never upgrade if not committed
    if (commitment !== 'commit') {
      return NextResponse.json(
        { error: 'You must commit to proceed with the upgrade.' }, 
        { status: 400 }
      );
    }

    // Validate price ID
    const validPriceId = PREMIUM_PRICE_IDS[planLabel];
    if (!validPriceId || priceId !== validPriceId) {
      return NextResponse.json(
        { error: 'Invalid price configuration.' }, 
        { status: 400 }
      );
    }

    // Validate required fields
    if (!benefitsSelected || benefitsSelected.length === 0) {
      return NextResponse.json(
        { error: 'Please select at least one benefit.' }, 
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

    // Get existing Stripe subscription
    const stripeSubscriptionId = userData.billing?.stripeSubscriptionId;
    const stripeCustomerId = userData.billing?.stripeCustomerId;

    if (!stripeSubscriptionId || !stripeCustomerId) {
      return NextResponse.json(
        { error: 'No active subscription found. Please contact support.' }, 
        { status: 400 }
      );
    }

    let stripeUpgradeSuccessful = false;
    let newPeriodEnd: string | undefined;

    try {
      // Fetch the current subscription
      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

      if (subscription.status !== 'active' && subscription.status !== 'trialing') {
        return NextResponse.json(
          { error: 'Your subscription is not active. Please contact support.' }, 
          { status: 400 }
        );
      }

      // Get the current subscription item
      const currentItem = subscription.items.data[0];
      const originalPriceId = currentItem?.price?.id;
      
      if (!currentItem) {
        return NextResponse.json(
          { error: 'Invalid subscription configuration. Please contact support.' }, 
          { status: 400 }
        );
      }

      // Update the subscription with the new premium price (with proration)
      const updatedSubscription = await stripe.subscriptions.update(stripeSubscriptionId, {
        items: [
          {
            id: currentItem.id,
            price: priceId,
          },
        ],
        proration_behavior: 'create_prorations',
        metadata: {
          userId: userId,
          plan: 'premium',
          upgradedAt: new Date().toISOString(),
        },
      });

      newPeriodEnd = new Date(updatedSubscription.current_period_end * 1000).toISOString();

      // Create an invoice immediately to capture the prorated amount
      const invoice = await stripe.invoices.create({
        customer: stripeCustomerId,
        subscription: stripeSubscriptionId,
        auto_advance: false, // Don't auto-finalize, we'll pay it manually
        metadata: {
          userId: userId,
          upgradeType: 'premium',
          planLabel: planLabel,
        },
      });

      // Finalize and pay the invoice immediately
      // CRITICAL: Only grant premium access AFTER payment succeeds
      if (invoice.id) {
        try {
          const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
          
          // Pay the invoice
          if (finalizedInvoice.status === 'open' && finalizedInvoice.amount_due > 0) {
            const paidInvoice = await stripe.invoices.pay(finalizedInvoice.id);
            
            // Verify payment actually succeeded
            if (paidInvoice.status !== 'paid') {
              console.error(`[UPGRADE_PREMIUM] Invoice ${finalizedInvoice.id} payment did not complete: status=${paidInvoice.status}`);
              
              // Revert the subscription back to original plan
              await stripe.subscriptions.update(stripeSubscriptionId, {
                items: [{ id: currentItem.id, price: originalPriceId }],
                proration_behavior: 'none',
              });
              
              return NextResponse.json(
                { error: 'Payment could not be processed. Please update your payment method and try again.' }, 
                { status: 402 }
              );
            }
            
            console.log(`[UPGRADE_PREMIUM] Invoice ${finalizedInvoice.id} paid successfully for user ${userId}`);
            stripeUpgradeSuccessful = true;
          } else if (finalizedInvoice.amount_due === 0) {
            // No charge needed (e.g., credits covered it)
            stripeUpgradeSuccessful = true;
            console.log(`[UPGRADE_PREMIUM] No charge needed for user ${userId}, upgrade successful`);
          }
        } catch (invoiceError) {
          // Payment failed - revert the subscription and notify user
          const invErr = invoiceError as { message?: string; code?: string; type?: string };
          console.error('[UPGRADE_PREMIUM] Invoice payment error:', invErr.message, invErr.code, invErr.type);
          
          // Revert the subscription back to original plan
          try {
            await stripe.subscriptions.update(stripeSubscriptionId, {
              items: [{ id: currentItem.id, price: originalPriceId }],
              proration_behavior: 'none',
            });
            console.log(`[UPGRADE_PREMIUM] Reverted subscription to original plan for user ${userId}`);
          } catch (revertError) {
            console.error('[UPGRADE_PREMIUM] Failed to revert subscription:', revertError);
          }
          
          // Return appropriate error based on failure type
          const errorMessage = invErr.code === 'card_declined' 
            ? 'Your card was declined. Please update your payment method and try again.'
            : invErr.type === 'StripeCardError'
            ? 'There was an issue with your card. Please update your payment method and try again.'
            : 'Payment failed. Please check your payment method and try again.';
          
          return NextResponse.json(
            { error: errorMessage }, 
            { status: 402 }
          );
        }
      }

      // CRITICAL: Only update Firebase/Clerk AFTER payment is confirmed
      if (stripeUpgradeSuccessful && newPeriodEnd) {
        // Update user billing info in Firestore
        await userRef.set({
          billing: {
            plan: 'premium',
            status: 'active',
            currentPeriodEnd: newPeriodEnd,
            cancelAtPeriodEnd: false,
          },
          tier: 'premium',
          // Update phone number if newly provided
          ...(phoneNumber && !existingPhone ? { phoneNumber: phoneNumber.trim() } : {}),
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        // Sync to Clerk
        try {
          await updateUserBillingInClerk(userId, 'active', newPeriodEnd, 'premium');
        } catch (clerkError) {
          console.error('[UPGRADE_PREMIUM] Failed to update Clerk:', clerkError);
          // Don't fail the request - Firestore is updated
        }
      } else {
        // This shouldn't happen, but handle gracefully
        console.error('[UPGRADE_PREMIUM] Unexpected state: stripeUpgradeSuccessful=false after invoice flow');
        return NextResponse.json(
          { error: 'An unexpected error occurred during payment processing. Please contact support.' }, 
          { status: 500 }
        );
      }

    } catch (stripeError) {
      console.error('[UPGRADE_PREMIUM] Stripe error:', stripeError);
      const message = stripeError instanceof Error ? stripeError.message : 'Failed to upgrade subscription. Please try again.';
      return NextResponse.json(
        { error: message }, 
        { status: 500 }
      );
    }

    // Create the form submission record
    const formId = `${userId}_${Date.now()}`;
    const formData: PremiumUpgradeForm = {
      id: formId,
      userId,
      email: userEmail,
      name: userName,
      phone: finalPhoneNumber,
      priceId,
      planLabel,
      benefitsSelected,
      upgradeWithFriends,
      friendsNames: friendsNames || null,
      commitment,
      stripeUpgradeSuccessful,
      createdAt: new Date().toISOString(),
    };

    // Save form submission to Firestore
    await adminDb.collection('premiumUpgradeForms').doc(formId).set(formData);

    console.log(`[UPGRADE_PREMIUM] User ${userId} upgraded to premium (${planLabel})`);

    return NextResponse.json({
      success: true,
      message: 'Successfully upgraded to Premium!',
      plan: planLabel,
    });

  } catch (error) {
    console.error('[UPGRADE_PREMIUM] Error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return NextResponse.json(
      { error: message }, 
      { status: 500 }
    );
  }
}

