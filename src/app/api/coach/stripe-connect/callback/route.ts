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
import { registerDomainForApplePay } from '@/lib/stripe-domains';
import { getOrgCustomDomains } from '@/lib/tenant/resolveTenant';

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
    const returnDomain = searchParams.get('return_domain');
    
    // Use the return domain if provided, otherwise fall back to primary domain
    const primaryDomain = process.env.NEXT_PUBLIC_APP_URL || 'https://growthaddicts.app';
    const baseUrl = returnDomain || primaryDomain;
    
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in', baseUrl));
    }
    
    if (!accountId) {
      console.error('[STRIPE_CONNECT_CALLBACK] No account_id provided');
      return NextResponse.redirect(new URL('/coach?tab=customize&stripe=error', baseUrl));
    }
    
    // Verify this account belongs to the user's org
    const settingsSnap = await adminDb
      .collection('org_settings')
      .where('stripeConnectAccountId', '==', accountId)
      .limit(1)
      .get();
    
    if (settingsSnap.empty) {
      console.error('[STRIPE_CONNECT_CALLBACK] Account not found in org_settings:', accountId);
      return NextResponse.redirect(new URL('/coach?tab=customize&stripe=error', baseUrl));
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
    
    // If newly connected, register any existing custom domains for Apple Pay
    if (status === 'connected') {
      try {
        const customDomains = await getOrgCustomDomains(organizationId);
        for (const domain of customDomains) {
          if (domain.status === 'verified') {
            const result = await registerDomainForApplePay(domain.domain, accountId);
            if (result.success) {
              console.log(`[STRIPE_CONNECT_CALLBACK] Registered ${domain.domain} for Apple Pay`);
            } else {
              console.warn(`[STRIPE_CONNECT_CALLBACK] Failed to register ${domain.domain} for Apple Pay: ${result.error}`);
            }
          }
        }
      } catch (domainError) {
        // Don't fail the callback - Apple Pay registration is non-critical
        console.error('[STRIPE_CONNECT_CALLBACK] Error registering domains for Apple Pay:', domainError);
      }
    }
    
    // Redirect back to the coach dashboard with success indicator
    // Use the original domain the coach came from
    const redirectStatus = status === 'connected' ? 'success' : 'pending';
    console.log(`[STRIPE_CONNECT_CALLBACK] Redirecting to ${baseUrl}/coach?tab=customize&stripe=${redirectStatus}`);
    return NextResponse.redirect(
      new URL(`/coach?tab=customize&stripe=${redirectStatus}`, baseUrl)
    );
  } catch (error) {
    console.error('[STRIPE_CONNECT_CALLBACK] Error:', error);
    const primaryDomainFallback = process.env.NEXT_PUBLIC_APP_URL || 'https://growthaddicts.app';
    return NextResponse.redirect(new URL('/coach?tab=customize&stripe=error', primaryDomainFallback));
  }
}

