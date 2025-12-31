/**
 * Coach Payment Methods API
 * 
 * GET /api/coach/payment-methods - List saved payment methods for the coach's platform Stripe customer
 * 
 * This is different from /api/payment-methods which handles connected account payment methods.
 * This endpoint handles the coach's own billing (platform billing from GA to coach).
 */

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { CoachSubscription, OrgSettings } from '@/types';

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
export interface CoachSavedPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

interface CoachPaymentMethodsResponse {
  paymentMethods: CoachSavedPaymentMethod[];
  defaultPaymentMethodId: string | null;
  customerId: string | null;
}

/**
 * GET /api/coach/payment-methods
 * 
 * Lists saved payment methods for the coach's platform Stripe customer.
 * Used for upgrade flows where the coach can reuse their saved card.
 */
export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();

    // Get org settings to find subscription
    const settingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
    const settings = settingsDoc.data() as OrgSettings | undefined;

    // Get subscription to find stripeCustomerId
    let customerId: string | null = null;
    
    if (settings?.coachSubscriptionId) {
      const subscriptionDoc = await adminDb
        .collection('coach_subscriptions')
        .doc(settings.coachSubscriptionId)
        .get();
      
      if (subscriptionDoc.exists) {
        const subscription = subscriptionDoc.data() as CoachSubscription;
        customerId = subscription.stripeCustomerId;
      }
    }

    // If no customer ID found, return empty
    if (!customerId) {
      return NextResponse.json({
        paymentMethods: [],
        defaultPaymentMethodId: null,
        customerId: null,
      } as CoachPaymentMethodsResponse);
    }

    const stripe = getStripe();

    // Get saved payment methods from Stripe
    const paymentMethodsResult = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    // Get the customer to find default payment method
    const customer = await stripe.customers.retrieve(customerId);

    const defaultPaymentMethodId = 
      typeof customer !== 'string' && !customer.deleted
        ? (customer.invoice_settings?.default_payment_method as string | null)
        : null;

    // Map to response format
    const paymentMethods: CoachSavedPaymentMethod[] = paymentMethodsResult.data.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand || 'unknown',
      last4: pm.card?.last4 || '****',
      expMonth: pm.card?.exp_month || 0,
      expYear: pm.card?.exp_year || 0,
      isDefault: pm.id === defaultPaymentMethodId,
    }));

    console.log(`[COACH_PAYMENT_METHODS] Found ${paymentMethods.length} payment methods for org ${organizationId}`);

    return NextResponse.json({
      paymentMethods,
      defaultPaymentMethodId,
      customerId,
    } as CoachPaymentMethodsResponse);
  } catch (error) {
    console.error('[COACH_PAYMENT_METHODS] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch payment methods';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

