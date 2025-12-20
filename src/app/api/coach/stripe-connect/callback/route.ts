/**
 * Stripe Connect Callback Handler
 * 
 * This route handles the redirect from Stripe after a coach completes onboarding.
 * It checks the account status and updates org_settings accordingly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import Stripe from 'stripe';
import type { StripeConnectStatus } from '@/types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

/**
 * GET /api/coach/stripe-connect/callback
 * Handle Stripe Connect onboarding return
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account_id');
    
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }
    
    if (!accountId) {
      console.error('[STRIPE_CONNECT_CALLBACK] No account_id provided');
      return NextResponse.redirect(new URL('/coach?tab=customize&stripe=error', request.url));
    }
    
    // Verify this account belongs to the user's org
    const settingsSnap = await adminDb
      .collection('org_settings')
      .where('stripeConnectAccountId', '==', accountId)
      .limit(1)
      .get();
    
    if (settingsSnap.empty) {
      console.error('[STRIPE_CONNECT_CALLBACK] Account not found in org_settings:', accountId);
      return NextResponse.redirect(new URL('/coach?tab=customize&stripe=error', request.url));
    }
    
    const settingsDoc = settingsSnap.docs[0];
    const organizationId = settingsDoc.id;
    
    // Get the account status from Stripe
    const account = await stripe.accounts.retrieve(accountId);
    
    // Determine the connection status
    let status: StripeConnectStatus = 'pending';
    
    if (account.charges_enabled && account.payouts_enabled) {
      status = 'connected';
      console.log(`[STRIPE_CONNECT_CALLBACK] Account ${accountId} fully connected`);
    } else if (account.details_submitted) {
      status = 'pending';
      console.log(`[STRIPE_CONNECT_CALLBACK] Account ${accountId} details submitted, pending verification`);
    } else {
      status = 'pending';
      console.log(`[STRIPE_CONNECT_CALLBACK] Account ${accountId} onboarding incomplete`);
    }
    
    // Update org_settings with the new status
    await adminDb.collection('org_settings').doc(organizationId).update({
      stripeConnectStatus: status,
      // If fully connected, switch to coach billing mode
      ...(status === 'connected' && { billingMode: 'coach' }),
      updatedAt: new Date().toISOString(),
    });
    
    // Redirect back to the coach dashboard with success indicator
    const redirectStatus = status === 'connected' ? 'success' : 'pending';
    return NextResponse.redirect(
      new URL(`/coach?tab=customize&stripe=${redirectStatus}`, request.url)
    );
  } catch (error) {
    console.error('[STRIPE_CONNECT_CALLBACK] Error:', error);
    return NextResponse.redirect(new URL('/coach?tab=customize&stripe=error', request.url));
  }
}

