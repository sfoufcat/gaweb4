/**
 * Stripe Connect API for Coach Billing
 * 
 * GET: Get current Stripe Connect status for the coach's organization
 * POST: Generate Stripe Connect onboarding link
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import Stripe from 'stripe';
import type { StripeConnectStatus } from '@/types';

// Lazy initialization to avoid build-time errors
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia',
    });
  }
  return _stripe;
}

// Helper to get coach's organization ID
async function getCoachOrganizationId(userId: string): Promise<string | null> {
  // Check org_memberships for super_coach role
  const membershipsSnap = await adminDb
    .collection('org_memberships')
    .where('userId', '==', userId)
    .where('orgRole', '==', 'super_coach')
    .where('isActive', '==', true)
    .limit(1)
    .get();
  
  if (!membershipsSnap.empty) {
    return membershipsSnap.docs[0].data().organizationId;
  }
  
  // Fallback to user's publicMetadata.organizationId for legacy users
  const userDoc = await adminDb.collection('users').doc(userId).get();
  if (userDoc.exists) {
    const userData = userDoc.data();
    if (userData?.clerkPublicMetadata?.orgRole === 'super_coach') {
      return userData.clerkPublicMetadata.organizationId || null;
    }
  }
  
  return null;
}

/**
 * GET /api/coach/stripe-connect
 * Get current Stripe Connect status
 */
export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const organizationId = await getCoachOrganizationId(userId);
    
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Not authorized - must be a super_coach' },
        { status: 403 }
      );
    }
    
    // Get org_settings
    const settingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
    const settings = settingsDoc.data();
    
    const result: {
      stripeConnectStatus: StripeConnectStatus;
      stripeConnectAccountId: string | null;
      platformFeePercent: number;
      chargesEnabled?: boolean;
      payoutsEnabled?: boolean;
      detailsSubmitted?: boolean;
    } = {
      stripeConnectStatus: (settings?.stripeConnectStatus as StripeConnectStatus) || 'not_connected',
      stripeConnectAccountId: settings?.stripeConnectAccountId || null,
      platformFeePercent: settings?.platformFeePercent ?? 1,
    };
    
    // If connected, get account details from Stripe
    if (result.stripeConnectAccountId) {
      try {
        const account = await getStripe().accounts.retrieve(result.stripeConnectAccountId);
        result.chargesEnabled = account.charges_enabled;
        result.payoutsEnabled = account.payouts_enabled;
        result.detailsSubmitted = account.details_submitted;
        
        // Update status based on actual account state
        if (account.charges_enabled && account.payouts_enabled) {
          result.stripeConnectStatus = 'connected';
        } else if (account.details_submitted) {
          result.stripeConnectStatus = 'pending';
        } else {
          result.stripeConnectStatus = 'pending';
        }
        
        // Sync status to Firestore if it changed
        if (settings?.stripeConnectStatus !== result.stripeConnectStatus) {
          await adminDb.collection('org_settings').doc(organizationId).update({
            stripeConnectStatus: result.stripeConnectStatus,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (stripeError) {
        console.error('[STRIPE_CONNECT] Error fetching account:', stripeError);
        // Account may have been deleted
        result.stripeConnectStatus = 'not_connected';
      }
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[STRIPE_CONNECT] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get Stripe Connect status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/coach/stripe-connect
 * Generate Stripe Connect onboarding link
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const organizationId = await getCoachOrganizationId(userId);
    
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Not authorized - must be a super_coach' },
        { status: 403 }
      );
    }
    
    // Get current settings
    const settingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
    const settings = settingsDoc.data();
    
    // Use primary domain for Stripe account links (must be registered in Stripe Dashboard)
    // Store the original domain to redirect back after completion
    const primaryDomain = process.env.NEXT_PUBLIC_APP_URL || 'https://growthaddicts.com';
    const returnDomain = request.headers.get('origin') || primaryDomain;
    
    let accountId = settings?.stripeConnectAccountId;
    
    // Create a new Connect account if one doesn't exist
    if (!accountId) {
      const account = await getStripe().accounts.create({
        type: 'standard',
        metadata: {
          organizationId,
          userId,
        },
      });
      
      accountId = account.id;
      
      // Save to org_settings
      const updateData = {
        stripeConnectAccountId: accountId,
        stripeConnectStatus: 'pending' as StripeConnectStatus,
        updatedAt: new Date().toISOString(),
      };
      
      if (!settingsDoc.exists) {
        // Create settings if they don't exist
        await adminDb.collection('org_settings').doc(organizationId).set({
          id: organizationId,
          organizationId,
          billingMode: 'coach',
          allowExternalBilling: true,
          defaultTier: 'standard',
          defaultTrack: null,
          stripeConnectAccountId: accountId,
          stripeConnectStatus: 'pending' as StripeConnectStatus,
          platformFeePercent: 1,
          requireApproval: false,
          autoJoinSquadId: null,
          welcomeMessage: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else {
        await adminDb.collection('org_settings').doc(organizationId).update(updateData);
      }
      
      console.log(`[STRIPE_CONNECT] Created account ${accountId} for org ${organizationId}`);
    }
    
    // Create an account link for onboarding
    // Use primary domain (registered in Stripe) with return_domain param for redirect back
    const accountLink = await getStripe().accountLinks.create({
      account: accountId,
      refresh_url: `${primaryDomain}/coach?tab=customize&stripe=refresh&return_domain=${encodeURIComponent(returnDomain)}`,
      return_url: `${primaryDomain}/api/coach/stripe-connect/callback?account_id=${accountId}&return_domain=${encodeURIComponent(returnDomain)}`,
      type: 'account_onboarding',
    });
    
    console.log(`[STRIPE_CONNECT] Generated onboarding link for account ${accountId}`);
    
    return NextResponse.json({
      url: accountLink.url,
      accountId,
    });
  } catch (error) {
    console.error('[STRIPE_CONNECT] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create Stripe Connect onboarding link' },
      { status: 500 }
    );
  }
}

