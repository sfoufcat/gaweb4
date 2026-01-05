/**
 * Payment Methods API for Credit Purchases
 *
 * GET /api/coach/credits/payment-methods
 *
 * Returns saved payment methods for the organization's Stripe customer.
 */

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { UserRole, OrgRole, ClerkPublicMetadata } from '@/types';

// Lazy Stripe initialization
let stripeInstance: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-02-24.acacia',
    });
  }
  return stripeInstance;
}

/**
 * GET /api/coach/credits/payment-methods
 *
 * Get saved payment methods for the organization
 */
export async function GET() {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata & { role?: UserRole; orgRole?: OrgRole };
    const role = publicMetadata?.role;
    const orgRole = publicMetadata?.orgRole;

    if (!canAccessCoachDashboard(role, orgRole)) {
      return NextResponse.json({ error: 'Coach access required' }, { status: 403 });
    }

    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    // Get organization's Stripe customer ID
    const orgDoc = await adminDb.collection('organizations').doc(organizationId).get();
    if (!orgDoc.exists) {
      return NextResponse.json({ paymentMethods: [] });
    }

    const orgData = orgDoc.data();
    const stripeCustomerId = orgData?.stripeCustomerId;

    if (!stripeCustomerId) {
      return NextResponse.json({ paymentMethods: [] });
    }

    const stripe = getStripe();

    // Fetch payment methods from Stripe
    const paymentMethods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: 'card',
    });

    // Get customer to check default payment method
    const customer = await stripe.customers.retrieve(stripeCustomerId);
    const defaultPaymentMethodId =
      typeof customer !== 'string' && !customer.deleted
        ? customer.invoice_settings?.default_payment_method
        : null;

    // Transform to our format
    const methods = paymentMethods.data.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand || 'unknown',
      last4: pm.card?.last4 || '****',
      expMonth: pm.card?.exp_month || 0,
      expYear: pm.card?.exp_year || 0,
      isDefault: pm.id === defaultPaymentMethodId,
    }));

    return NextResponse.json({ paymentMethods: methods });
  } catch (error) {
    console.error('[CREDITS_PAYMENT_METHODS_API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
