/**
 * Payment Methods API
 * 
 * GET /api/payment-methods - List saved payment methods for a connected account
 * POST /api/payment-methods - Set default payment method
 * DELETE /api/payment-methods - Remove a saved payment method
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import Stripe from 'stripe';

// Lazy initialization of Stripe
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
    _stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia' });
  }
  return _stripe;
}

// Response types
export interface SavedPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

interface PaymentMethodsResponse {
  paymentMethods: SavedPaymentMethod[];
  defaultPaymentMethodId: string | null;
  customerId: string | null;
}

/**
 * GET /api/payment-methods?organizationId=xxx
 * 
 * Lists saved payment methods for the user on a specific coach's connected Stripe account.
 * 
 * Query params:
 * - organizationId: The organization ID to get payment methods for
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Missing organizationId parameter' },
        { status: 400 }
      );
    }

    // Get organization's Stripe Connect account ID
    const orgSettingsDoc = await adminDb
      .collection('org_settings')
      .doc(organizationId)
      .get();
    const orgSettings = orgSettingsDoc.data();

    const stripeConnectAccountId = orgSettings?.stripeConnectAccountId;
    if (!stripeConnectAccountId) {
      return NextResponse.json({
        paymentMethods: [],
        defaultPaymentMethodId: null,
        customerId: null,
      } as PaymentMethodsResponse);
    }

    // Get user's customer ID for this connected account
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const connectedCustomerIds = userData?.stripeConnectedCustomerIds || {};
    const customerId = connectedCustomerIds[stripeConnectAccountId];

    if (!customerId) {
      return NextResponse.json({
        paymentMethods: [],
        defaultPaymentMethodId: null,
        customerId: null,
      } as PaymentMethodsResponse);
    }

    // Get saved payment methods from Stripe on the connected account
    const stripe = getStripe();
    
    const paymentMethodsResult = await stripe.paymentMethods.list(
      {
        customer: customerId,
        type: 'card',
      },
      { stripeAccount: stripeConnectAccountId }
    );

    // Get the customer to find default payment method
    const customer = await stripe.customers.retrieve(
      customerId,
      { stripeAccount: stripeConnectAccountId }
    );

    const defaultPaymentMethodId = 
      typeof customer !== 'string' && !customer.deleted
        ? (customer.invoice_settings?.default_payment_method as string | null)
        : null;

    // Also check user's preferences for default payment method for this org
    const userDefaultPaymentMethods = userData?.defaultPaymentMethods || {};
    const userDefaultForOrg = userDefaultPaymentMethods[organizationId] as string | undefined;

    // User preference takes precedence, fallback to Stripe customer default
    const effectiveDefault = userDefaultForOrg || defaultPaymentMethodId;

    // Deduplicate cards by fingerprint (same physical card) or by brand+last4+exp combo
    // Keep the most recently created one (first in Stripe's list, which is ordered by created desc)
    const seenFingerprints = new Set<string>();
    const seenCardKeys = new Set<string>();

    const paymentMethods: SavedPaymentMethod[] = paymentMethodsResult.data
      .filter((pm) => {
        // Prefer fingerprint for deduplication (unique per physical card)
        const fingerprint = pm.card?.fingerprint;
        if (fingerprint) {
          if (seenFingerprints.has(fingerprint)) {
            return false; // Skip duplicate
          }
          seenFingerprints.add(fingerprint);
          return true;
        }

        // Fallback: dedupe by brand + last4 + expiration
        const cardKey = `${pm.card?.brand}-${pm.card?.last4}-${pm.card?.exp_month}-${pm.card?.exp_year}`;
        if (seenCardKeys.has(cardKey)) {
          return false; // Skip duplicate
        }
        seenCardKeys.add(cardKey);
        return true;
      })
      .map((pm) => ({
        id: pm.id,
        brand: pm.card?.brand || 'unknown',
        last4: pm.card?.last4 || '****',
        expMonth: pm.card?.exp_month || 0,
        expYear: pm.card?.exp_year || 0,
        isDefault: pm.id === effectiveDefault,
      }));

    return NextResponse.json({
      paymentMethods,
      defaultPaymentMethodId: effectiveDefault,
      customerId,
    } as PaymentMethodsResponse);
  } catch (error) {
    console.error('[PAYMENT_METHODS_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch payment methods';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/payment-methods
 * 
 * Set or update the default payment method for an organization.
 * 
 * Body:
 * - organizationId: The organization ID
 * - paymentMethodId: The payment method ID to set as default
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { organizationId, paymentMethodId } = body as {
      organizationId: string;
      paymentMethodId: string;
    };

    if (!organizationId || !paymentMethodId) {
      return NextResponse.json(
        { error: 'Missing required fields: organizationId and paymentMethodId' },
        { status: 400 }
      );
    }

    // Update user's default payment method preference for this organization
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const defaultPaymentMethods = userData?.defaultPaymentMethods || {};

    await adminDb.collection('users').doc(userId).set(
      {
        defaultPaymentMethods: {
          ...defaultPaymentMethods,
          [organizationId]: paymentMethodId,
        },
      },
      { merge: true }
    );

    // Also update Stripe customer's default on the connected account
    const orgSettingsDoc = await adminDb
      .collection('org_settings')
      .doc(organizationId)
      .get();
    const orgSettings = orgSettingsDoc.data();
    const stripeConnectAccountId = orgSettings?.stripeConnectAccountId;

    if (stripeConnectAccountId) {
      const connectedCustomerIds = userData?.stripeConnectedCustomerIds || {};
      const customerId = connectedCustomerIds[stripeConnectAccountId];

      if (customerId) {
        const stripe = getStripe();
        await stripe.customers.update(
          customerId,
          {
            invoice_settings: {
              default_payment_method: paymentMethodId,
            },
          },
          { stripeAccount: stripeConnectAccountId }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PAYMENT_METHODS_SET_DEFAULT] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to set default payment method';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/payment-methods
 * 
 * Remove a saved payment method.
 * 
 * Body:
 * - organizationId: The organization ID
 * - paymentMethodId: The payment method ID to remove
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { organizationId, paymentMethodId } = body as {
      organizationId: string;
      paymentMethodId: string;
    };

    if (!organizationId || !paymentMethodId) {
      return NextResponse.json(
        { error: 'Missing required fields: organizationId and paymentMethodId' },
        { status: 400 }
      );
    }

    // Get organization's Stripe Connect account ID
    const orgSettingsDoc = await adminDb
      .collection('org_settings')
      .doc(organizationId)
      .get();
    const orgSettings = orgSettingsDoc.data();
    const stripeConnectAccountId = orgSettings?.stripeConnectAccountId;

    if (!stripeConnectAccountId) {
      return NextResponse.json(
        { error: 'Payment configuration not found' },
        { status: 400 }
      );
    }

    // Detach payment method from customer on connected account
    const stripe = getStripe();
    await stripe.paymentMethods.detach(
      paymentMethodId,
      { stripeAccount: stripeConnectAccountId }
    );

    // If this was the default, clear it from user preferences
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const defaultPaymentMethods = userData?.defaultPaymentMethods || {};

    if (defaultPaymentMethods[organizationId] === paymentMethodId) {
      delete defaultPaymentMethods[organizationId];
      await adminDb.collection('users').doc(userId).set(
        { defaultPaymentMethods },
        { merge: true }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PAYMENT_METHODS_DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to remove payment method';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

