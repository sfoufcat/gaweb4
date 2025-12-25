/**
 * Coach API: Squad Subscription Configuration
 * 
 * GET /api/coach/squads/[squadId]/subscription - Get subscription settings
 * POST /api/coach/squads/[squadId]/subscription - Create/update subscription pricing
 * DELETE /api/coach/squads/[squadId]/subscription - Disable subscription
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import Stripe from 'stripe';
import type { Squad, OrgSettings } from '@/types';

// Initialize Stripe with API version
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' });
}

/**
 * GET - Get subscription configuration
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ squadId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { squadId } = await params;

    // Get squad
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();
    if (!squadDoc.exists) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    const squad = squadDoc.data() as Squad;
    if (squad.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Squad not found in your organization' }, { status: 404 });
    }

    // Program squads cannot have subscriptions
    if (squad.programId) {
      return NextResponse.json({ 
        error: 'Program squads cannot have subscriptions - they are part of a program' 
      }, { status: 400 });
    }

    return NextResponse.json({
      subscriptionEnabled: squad.subscriptionEnabled || false,
      priceInCents: squad.priceInCents || 0,
      billingInterval: squad.billingInterval || 'monthly',
      stripePriceId: squad.stripePriceId,
      stripeProductId: squad.stripeProductId,
    });
  } catch (error) {
    console.error('[SQUAD_SUBSCRIPTION_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to get subscription settings' }, { status: 500 });
  }
}

/**
 * POST - Create or update subscription pricing
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ squadId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { squadId } = await params;
    const body = await request.json();

    const { priceInCents, billingInterval } = body as {
      priceInCents: number;
      billingInterval?: 'monthly' | 'quarterly' | 'yearly';
    };

    if (!priceInCents || priceInCents < 100) {
      return NextResponse.json({ 
        error: 'Price must be at least $1.00 (100 cents)' 
      }, { status: 400 });
    }

    const interval = billingInterval || 'monthly';
    if (!['monthly', 'quarterly', 'yearly'].includes(interval)) {
      return NextResponse.json({ error: 'Invalid billing interval' }, { status: 400 });
    }

    // Get squad
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();
    if (!squadDoc.exists) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    const squad = { id: squadDoc.id, ...squadDoc.data() } as Squad;
    if (squad.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Squad not found in your organization' }, { status: 404 });
    }

    // Program squads cannot have subscriptions
    if (squad.programId) {
      return NextResponse.json({ 
        error: 'Program squads cannot have subscriptions' 
      }, { status: 400 });
    }

    // Get org settings for Stripe Connect
    const orgSettingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
    const orgSettings = orgSettingsDoc.data() as OrgSettings | undefined;

    if (!orgSettings?.stripeConnectAccountId) {
      return NextResponse.json({ 
        error: 'Stripe Connect is not configured. Please set up payments in Settings first.' 
      }, { status: 400 });
    }

    const stripe = getStripe();
    const stripeAccount = orgSettings.stripeConnectAccountId;

    // Map interval to Stripe interval
    const stripeInterval: Stripe.PriceCreateParams.Recurring.Interval = 
      interval === 'yearly' ? 'year' : 
      interval === 'quarterly' ? 'month' : 'month';
    const intervalCount = interval === 'quarterly' ? 3 : 1;

    let productId = squad.stripeProductId;

    // Create or reuse product
    if (!productId) {
      const product = await stripe.products.create(
        {
          name: squad.name,
          description: `Membership to ${squad.name}`,
          metadata: {
            squadId,
            organizationId,
            type: 'squad_subscription',
          },
        },
        { stripeAccount }
      );
      productId = product.id;
    }

    // Always create a new price (prices are immutable in Stripe)
    const price = await stripe.prices.create(
      {
        product: productId,
        unit_amount: priceInCents,
        currency: 'usd',
        recurring: {
          interval: stripeInterval,
          interval_count: intervalCount,
        },
        metadata: {
          squadId,
          organizationId,
          billingInterval: interval,
        },
      },
      { stripeAccount }
    );
    const priceId = price.id;

    // Archive old price if exists
    if (squad.stripePriceId && squad.stripePriceId !== priceId) {
      try {
        await stripe.prices.update(
          squad.stripePriceId,
          { active: false },
          { stripeAccount }
        );
      } catch (archiveError) {
        console.error('[SQUAD_SUBSCRIPTION] Error archiving old price:', archiveError);
        // Continue - not critical
      }
    }

    // Update squad
    await squadDoc.ref.update({
      subscriptionEnabled: true,
      priceInCents,
      billingInterval: interval,
      stripePriceId: priceId,
      stripeProductId: productId,
      updatedAt: new Date().toISOString(),
    });

    console.log(`[SQUAD_SUBSCRIPTION] Configured subscription for squad ${squadId}: $${priceInCents / 100}/${interval}`);

    return NextResponse.json({
      success: true,
      subscriptionEnabled: true,
      priceInCents,
      billingInterval: interval,
      stripePriceId: priceId,
      stripeProductId: productId,
      message: 'Subscription pricing configured successfully',
    });
  } catch (error) {
    console.error('[SQUAD_SUBSCRIPTION_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to configure subscription' }, { status: 500 });
  }
}

/**
 * DELETE - Disable subscription
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ squadId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { squadId } = await params;

    // Get squad
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();
    if (!squadDoc.exists) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    const squad = squadDoc.data() as Squad;
    if (squad.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Squad not found in your organization' }, { status: 404 });
    }

    // Update squad to disable subscription
    await squadDoc.ref.update({
      subscriptionEnabled: false,
      updatedAt: new Date().toISOString(),
    });

    console.log(`[SQUAD_SUBSCRIPTION] Disabled subscription for squad ${squadId}`);

    return NextResponse.json({
      success: true,
      subscriptionEnabled: false,
      message: 'Subscription disabled. Existing subscribers will remain until they cancel.',
    });
  } catch (error) {
    console.error('[SQUAD_SUBSCRIPTION_DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to disable subscription' }, { status: 500 });
  }
}

