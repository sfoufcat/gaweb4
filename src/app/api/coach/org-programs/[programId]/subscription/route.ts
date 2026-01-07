/**
 * Coach API: Program Subscription Configuration
 * 
 * GET /api/coach/org-programs/[programId]/subscription - Get subscription settings
 * POST /api/coach/org-programs/[programId]/subscription - Create/update subscription pricing
 * DELETE /api/coach/org-programs/[programId]/subscription - Disable subscription
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import Stripe from 'stripe';
import type { Program, OrgSettings } from '@/types';

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
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId } = await params;

    // Get program
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const program = programDoc.data() as Program;
    if (program.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    return NextResponse.json({
      subscriptionEnabled: program.subscriptionEnabled || false,
      priceInCents: program.priceInCents || 0,
      billingInterval: program.billingInterval || 'monthly',
      stripePriceId: program.stripePriceId,
      stripeProductId: program.stripeProductId,
    });
  } catch (error) {
    console.error('[PROGRAM_SUBSCRIPTION_GET] Error:', error);
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
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId } = await params;
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

    // Get program
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const program = { id: programDoc.id, ...programDoc.data() } as Program;
    if (program.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    // Validate that recurring billing is only allowed for evergreen programs
    const durationType = program.durationType || 'fixed';
    if (durationType !== 'evergreen') {
      return NextResponse.json({ 
        error: 'Recurring billing is only available for Evergreen programs. Fixed-duration programs must use one-time billing.' 
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

    let productId = program.stripeProductId;

    // Create or reuse product
    if (!productId) {
      const product = await stripe.products.create(
        {
          name: program.name,
          description: program.description || `Enrollment in ${program.name}`,
          images: program.coverImageUrl ? [program.coverImageUrl] : undefined,
          metadata: {
            programId,
            organizationId,
            type: 'program_subscription',
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
        currency: program.currency || 'usd',
        recurring: {
          interval: stripeInterval,
          interval_count: intervalCount,
        },
        metadata: {
          programId,
          organizationId,
          billingInterval: interval,
          type: 'program_subscription',
        },
      },
      { stripeAccount }
    );
    const priceId = price.id;

    // Archive old price if exists
    if (program.stripePriceId && program.stripePriceId !== priceId) {
      try {
        await stripe.prices.update(
          program.stripePriceId,
          { active: false },
          { stripeAccount }
        );
      } catch (archiveError) {
        console.error('[PROGRAM_SUBSCRIPTION] Error archiving old price:', archiveError);
        // Continue - not critical
      }
    }

    // Update program
    await programDoc.ref.update({
      subscriptionEnabled: true,
      priceInCents,
      billingInterval: interval,
      stripePriceId: priceId,
      stripeProductId: productId,
      updatedAt: new Date().toISOString(),
    });

    console.log(`[PROGRAM_SUBSCRIPTION] Configured subscription for program ${programId}: $${priceInCents / 100}/${interval}`);

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
    console.error('[PROGRAM_SUBSCRIPTION_POST] Error:', error);
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
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId } = await params;

    // Get program
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const program = programDoc.data() as Program;
    if (program.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    // Update program to disable subscription
    await programDoc.ref.update({
      subscriptionEnabled: false,
      updatedAt: new Date().toISOString(),
    });

    console.log(`[PROGRAM_SUBSCRIPTION] Disabled subscription for program ${programId}`);

    return NextResponse.json({
      success: true,
      subscriptionEnabled: false,
      message: 'Subscription disabled. Existing subscribers will remain until they cancel.',
    });
  } catch (error) {
    console.error('[PROGRAM_SUBSCRIPTION_DELETE] Error:', error);
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




