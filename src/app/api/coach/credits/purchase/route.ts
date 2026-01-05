/**
 * Credit Purchase API
 *
 * Allows coaches to purchase additional call summary credits.
 * Creates a Stripe checkout session for one-time payment.
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { CREDIT_PACK_PRICING, type CreditPackType } from '@/types';
import type { UserRole, OrgRole, ClerkPublicMetadata } from '@/types';

// Lazy Stripe initialization (avoid build-time errors)
let stripeInstance: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-02-24.acacia',
    });
  }
  return stripeInstance;
}

// Credit pack configurations
const CREDIT_PACKS: Record<CreditPackType, { name: string; credits: number; priceInCents: number }> = {
  5: { name: '5 Call Credits', credits: 5, priceInCents: CREDIT_PACK_PRICING[5] },
  10: { name: '10 Call Credits', credits: 10, priceInCents: CREDIT_PACK_PRICING[10] },
  20: { name: '20 Call Credits', credits: 20, priceInCents: CREDIT_PACK_PRICING[20] },
};

/**
 * POST /api/coach/credits/purchase
 *
 * Create a Stripe checkout session for purchasing credits
 *
 * Body:
 * - packSize: 5 | 10 | 20
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { packSize } = body;

    // Validate pack size
    if (!packSize || !CREDIT_PACKS[packSize as CreditPackType]) {
      return NextResponse.json(
        { error: 'Invalid pack size. Must be 5, 10, or 20.' },
        { status: 400 }
      );
    }

    const pack = CREDIT_PACKS[packSize as CreditPackType];

    // Get or create Stripe customer
    const orgDoc = await adminDb.collection('organizations').doc(organizationId).get();
    if (!orgDoc.exists) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const orgData = orgDoc.data();
    let stripeCustomerId = orgData?.stripeCustomerId;

    if (!stripeCustomerId) {
      // Create Stripe customer
      const customer = await getStripe().customers.create({
        metadata: {
          organizationId,
          userId,
        },
      });
      stripeCustomerId = customer.id;

      // Save customer ID
      await adminDb.collection('organizations').doc(organizationId).update({
        stripeCustomerId,
      });
    }

    // Create checkout session
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.coachful.co';

    const session = await getStripe().checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: pack.name,
              description: `${pack.credits} AI call summary credits for your coaching practice`,
            },
            unit_amount: pack.priceInCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'credit_purchase',
        organizationId,
        userId,
        packSize: String(packSize),
        credits: String(pack.credits),
      },
      success_url: `${baseUrl}/coach/settings/organization?credits=success&pack=${packSize}`,
      cancel_url: `${baseUrl}/coach/settings/organization?credits=cancelled`,
    });

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error('[CREDITS_PURCHASE_API] Error creating checkout:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/coach/credits/purchase
 *
 * Get current credit balance and available packs
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

    const orgDoc = await adminDb.collection('organizations').doc(organizationId).get();
    if (!orgDoc.exists) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const orgData = orgDoc.data();
    const summaryCredits = orgData?.summaryCredits || {
      allocatedMinutes: 0,
      usedMinutes: 0,
      purchasedMinutes: 0,
      usedPurchasedMinutes: 0,
      periodStart: null,
      periodEnd: null,
    };

    // Calculate remaining credits (in calls, assuming 60 min per call)
    const planRemainingMinutes = Math.max(0, summaryCredits.allocatedMinutes - summaryCredits.usedMinutes);
    const purchasedRemainingMinutes = Math.max(0, summaryCredits.purchasedMinutes - summaryCredits.usedPurchasedMinutes);
    const totalRemainingMinutes = planRemainingMinutes + purchasedRemainingMinutes;

    // Convert to calls (60 min per call)
    const planRemainingCalls = Math.floor(planRemainingMinutes / 60);
    const purchasedRemainingCalls = Math.floor(purchasedRemainingMinutes / 60);
    const totalRemainingCalls = Math.floor(totalRemainingMinutes / 60);
    const planAllocatedCalls = Math.floor(summaryCredits.allocatedMinutes / 60);

    return NextResponse.json({
      credits: {
        planAllocated: planAllocatedCalls,
        planUsed: Math.floor(summaryCredits.usedMinutes / 60),
        planRemaining: planRemainingCalls,
        purchasedRemaining: purchasedRemainingCalls,
        totalRemaining: totalRemainingCalls,
        periodStart: summaryCredits.periodStart,
        periodEnd: summaryCredits.periodEnd,
      },
      availablePacks: Object.entries(CREDIT_PACKS).map(([size, pack]) => ({
        size: parseInt(size, 10),
        name: pack.name,
        credits: pack.credits,
        priceInCents: pack.priceInCents,
        priceFormatted: `$${(pack.priceInCents / 100).toFixed(2)}`,
      })),
    });
  } catch (error) {
    console.error('[CREDITS_PURCHASE_API] Error getting credits:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
