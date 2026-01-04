import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { isDemoRequest, demoNotAvailable } from '@/lib/demo-api';
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
 * POST /api/coach/subscription/portal
 * Create a Stripe Customer Portal session for managing subscription
 */
export async function POST() {
  try {
    // Demo mode: block portal access
    const isDemo = await isDemoRequest();
    if (isDemo) {
      return demoNotAvailable('Managing subscription');
    }
    
    const { organizationId } = await requireCoachWithOrg();

    // Get subscription directly by organizationId (primary lookup)
    // coach_subscriptions are keyed by organizationId
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
        { error: 'No subscription found. If you were manually added as a coach, please contact support.' },
        { status: 400 }
      );
    }

    if (!subscription.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No Stripe customer associated with this subscription' },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://coachful.co';

    // Create portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${baseUrl}/coach?tab=plan`,
    });

    console.log(`[COACH_PORTAL] Created portal session for org ${organizationId}`);

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error('[COACH_PORTAL]', error);
    const message = error instanceof Error ? error.message : 'Failed to create portal session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

