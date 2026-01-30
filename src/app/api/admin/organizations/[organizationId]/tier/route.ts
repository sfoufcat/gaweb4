import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin-utils-clerk';
import { updateOrgTier } from '@/lib/clerk-organizations';
import type { CoachTier } from '@/types';

interface TierUpdateBody {
  tier: CoachTier;
  manualBilling?: boolean;
  manualExpiresAt?: string | null;
  creditsToAdd?: number; // Number of call credits to add (60 min each)
}

/**
 * PATCH /api/admin/organizations/[organizationId]/tier
 * Updates an organization's subscription tier (super_admin only)
 * 
 * This allows super_admins to:
 * - Set any tier (starter, pro, scale) for an organization
 * - Enable/disable manual billing (bypass Stripe)
 * - Set an expiration date for manual billing
 * 
 * Body: { tier: 'starter' | 'pro' | 'scale', manualBilling?: boolean, manualExpiresAt?: string }
 */
export async function PATCH(
  req: Request,
  context: { params: Promise<{ organizationId: string }> }
) {
  try {
    // Check authorization - only super_admin can use this endpoint
    await requireSuperAdmin();

    const { organizationId } = await context.params;
    const body = await req.json() as TierUpdateBody;
    const { tier, manualBilling = true, manualExpiresAt, creditsToAdd } = body;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    }

    if (!tier) {
      return NextResponse.json({ error: 'Tier is required' }, { status: 400 });
    }

    // Validate tier value
    const validTiers: CoachTier[] = ['starter', 'pro', 'scale'];
    if (!validTiers.includes(tier)) {
      return NextResponse.json({ 
        error: 'Invalid tier. Must be "starter", "pro", or "scale"' 
      }, { status: 400 });
    }

    // Validate expiration date if provided
    if (manualExpiresAt) {
      const expirationDate = new Date(manualExpiresAt);
      if (isNaN(expirationDate.getTime())) {
        return NextResponse.json({ error: 'Invalid expiration date format' }, { status: 400 });
      }
    }

    // Update the organization tier
    await updateOrgTier(organizationId, {
      tier,
      manualBilling,
      manualExpiresAt: manualExpiresAt || null,
    });

    console.log(`[ADMIN_ORG_TIER] Updated org ${organizationId} to tier: ${tier}, manualBilling: ${manualBilling}, expires: ${manualExpiresAt || 'never'}`);

    // Add credits if specified
    let creditsAdded = 0;
    if (creditsToAdd && creditsToAdd > 0) {
      const { adminDb } = await import('@/lib/firebase-admin');

      const orgRef = adminDb.collection('organizations').doc(organizationId);
      await adminDb.runTransaction(async (transaction) => {
        const orgDoc = await transaction.get(orgRef);
        const orgData = orgDoc.data() || {};
        const currentPurchasedCredits = orgData?.summaryCredits?.purchasedCredits || 0;

        transaction.set(orgRef, {
          'summaryCredits.purchasedCredits': currentPurchasedCredits + creditsToAdd,
        }, { merge: true });
      });

      creditsAdded = creditsToAdd;
      console.log(`[ADMIN_ORG_TIER] Added ${creditsToAdd} credits to org ${organizationId}`);
    }

    return NextResponse.json({
      success: true,
      organizationId,
      tier,
      manualBilling,
      manualExpiresAt: manualExpiresAt || null,
      creditsAdded,
    });
  } catch (error) {
    console.error('[ADMIN_ORG_TIER_UPDATE_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    if (message.includes('Forbidden')) {
      return new NextResponse('Forbidden', { status: 403 });
    }
    
    return new NextResponse('Internal Error', { status: 500 });
  }
}

/**
 * GET /api/admin/organizations/[organizationId]/tier
 * Get the current tier and subscription status for an organization
 */
export async function GET(
  _req: Request,
  context: { params: Promise<{ organizationId: string }> }
) {
  try {
    // Check authorization
    await requireSuperAdmin();

    const { organizationId } = await context.params;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    }

    // Get subscription from Firestore
    const { adminDb } = await import('@/lib/firebase-admin');
    const subscriptionDoc = await adminDb.collection('coach_subscriptions').doc(organizationId).get();
    
    if (!subscriptionDoc.exists) {
      return NextResponse.json({
        organizationId,
        tier: 'starter',
        status: 'none',
        manualBilling: false,
        manualExpiresAt: null,
        message: 'No subscription record found - defaults to starter',
      });
    }

    const subscription = subscriptionDoc.data();
    
    return NextResponse.json({
      organizationId,
      tier: subscription?.tier || 'starter',
      status: subscription?.status || 'none',
      manualBilling: subscription?.manualBilling || false,
      manualExpiresAt: subscription?.manualExpiresAt || null,
      stripeSubscriptionId: subscription?.stripeSubscriptionId || null,
      currentPeriodEnd: subscription?.currentPeriodEnd || null,
    });
  } catch (error) {
    console.error('[ADMIN_ORG_TIER_GET_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    if (message.includes('Forbidden')) {
      return new NextResponse('Forbidden', { status: 403 });
    }
    
    return new NextResponse('Internal Error', { status: 500 });
  }
}

