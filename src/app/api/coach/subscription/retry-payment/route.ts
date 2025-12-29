import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { CoachSubscription, OrgSettings } from '@/types';

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
 * POST /api/coach/subscription/retry-payment
 * 
 * Retry payment for a failed subscription.
 * Gets the latest unpaid invoice and attempts to pay it.
 */
export async function POST() {
  try {
    const { organizationId } = await requireCoachWithOrg();

    // Get subscription directly by organizationId (primary lookup)
    const subscriptionDoc = await adminDb
      .collection('coach_subscriptions')
      .doc(organizationId)
      .get();

    let subscription: CoachSubscription | undefined;

    if (subscriptionDoc.exists) {
      subscription = subscriptionDoc.data() as CoachSubscription;
    } else {
      // Fallback: check org_settings for legacy coachSubscriptionId
      const settingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
      const settings = settingsDoc.data() as OrgSettings | undefined;

      if (settings?.coachSubscriptionId) {
        const legacyDoc = await adminDb
          .collection('coach_subscriptions')
          .doc(settings.coachSubscriptionId)
          .get();
        
        if (legacyDoc.exists) {
          subscription = legacyDoc.data() as CoachSubscription;
        }
      }
    }

    if (!subscription) {
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 400 }
      );
    }

    if (!subscription.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No Stripe customer associated with this subscription' },
        { status: 400 }
      );
    }

    // Only allow retry for past_due subscriptions
    if (subscription.status !== 'past_due') {
      return NextResponse.json(
        { error: 'Payment retry is only available for past due subscriptions' },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();

    // Find the latest open/unpaid invoice for this subscription
    const invoices = await stripe.invoices.list({
      subscription: subscription.stripeSubscriptionId!,
      status: 'open',
      limit: 1,
    });

    if (invoices.data.length === 0) {
      // Check for draft invoices
      const draftInvoices = await stripe.invoices.list({
        subscription: subscription.stripeSubscriptionId!,
        status: 'draft',
        limit: 1,
      });

      if (draftInvoices.data.length === 0) {
        return NextResponse.json(
          { error: 'No open invoice found to retry', requiresUpdate: true },
          { status: 400 }
        );
      }

      // First finalize the draft, then pay
      const draftInvoice = draftInvoices.data[0];
      const finalizedInvoice = await stripe.invoices.finalizeInvoice(draftInvoice.id);
      
      // Now try to pay
      await stripe.invoices.pay(finalizedInvoice.id);
    } else {
      // Attempt to pay the open invoice
      const invoice = invoices.data[0];
      
      try {
        await stripe.invoices.pay(invoice.id);
      } catch (stripeError) {
        // Payment failed - likely card issue
        const err = stripeError as { message?: string; code?: string };
        console.error('[RETRY_PAYMENT] Stripe payment failed:', err.message);
        
        return NextResponse.json(
          { 
            error: 'Payment failed. Please update your payment method.',
            requiresUpdate: true,
            stripeError: err.code,
          },
          { status: 400 }
        );
      }
    }

    console.log(`[RETRY_PAYMENT] Successfully retried payment for org ${organizationId}`);

    // Note: The Stripe webhook will handle updating the subscription status
    // to 'active' and clearing the graceEndsAt field

    return NextResponse.json({ 
      success: true,
      message: 'Payment successful! Your subscription has been restored.',
    });
  } catch (error) {
    console.error('[RETRY_PAYMENT]', error);
    const message = error instanceof Error ? error.message : 'Failed to retry payment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

