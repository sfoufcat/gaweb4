import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import type { ClerkPublicMetadata, OrgSettings } from '@/types';

// Lazy initialization of Stripe to avoid build-time errors
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    _stripe = new Stripe(key, {
      apiVersion: '2025-02-24.acacia',
    });
  }
  return _stripe;
}

/**
 * POST /api/billing/coach-portal
 * Creates a Stripe Customer Portal session for the user on their coach's Stripe Connect account
 * 
 * This redirects users to their coach's billing portal (not the platform's),
 * where they can:
 * - Update payment method
 * - View invoices from their coach
 */
export async function POST() {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization ID from session claims
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const organizationId = publicMetadata?.primaryOrganizationId || publicMetadata?.organizationId;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'No organization found. Please contact your coach.' },
        { status: 400 }
      );
    }

    // Get organization settings to find the coach's Stripe Connect account
    const orgSettingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
    const orgSettings = orgSettingsDoc.data() as OrgSettings | undefined;

    if (!orgSettings?.stripeConnectAccountId) {
      return NextResponse.json(
        { error: 'Payment portal is not configured for this coach. Please contact your coach.' },
        { status: 400 }
      );
    }

    const stripeConnectAccountId = orgSettings.stripeConnectAccountId;

    // Get user's customer ID for this connected account
    const userDoc = await adminDb.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const connectedCustomerIds = userData?.stripeConnectedCustomerIds || {};
    const customerId = connectedCustomerIds[stripeConnectAccountId];

    if (!customerId) {
      return NextResponse.json(
        { error: 'No payment record found. You may not have any active subscriptions with this coach.' },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    // Verify the customer exists on the connected account
    try {
      await stripe.customers.retrieve(customerId, {
        stripeAccount: stripeConnectAccountId,
      });
    } catch (stripeError) {
      const errorCode = (stripeError as { code?: string })?.code;
      if (errorCode === 'resource_missing') {
        return NextResponse.json(
          { error: 'Payment record not found. Please contact your coach.' },
          { status: 400 }
        );
      }
      throw stripeError;
    }

    // Build return URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || 'http://localhost:3000';
    const returnUrl = `${appUrl}/profile`;

    // Create Stripe Billing Portal session on the connected account
    const session = await stripe.billingPortal.sessions.create(
      {
        customer: customerId,
        return_url: returnUrl,
      },
      { stripeAccount: stripeConnectAccountId }
    );

    console.log(`[COACH_BILLING_PORTAL] Created portal session for user ${userId} on connected account ${stripeConnectAccountId}`);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[COACH_BILLING_PORTAL] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create billing portal session';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}





