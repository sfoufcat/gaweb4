/**
 * Subscription Portal API
 * 
 * POST /api/billing/subscription-portal
 * Creates a Stripe Customer Portal session for squad/program subscriptions
 * that are on Connect accounts.
 * 
 * Body:
 * - resourceType: 'squad' | 'program'
 * - resourceId: string
 * - returnUrl?: string
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import type { OrgSettings, SquadMember, ProgramEnrollment } from '@/types';

// Initialize Stripe
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' });
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { resourceType, resourceId, returnUrl } = body as {
      resourceType: 'squad' | 'program';
      resourceId: string;
      returnUrl?: string;
    };

    if (!resourceType || !resourceId) {
      return NextResponse.json({ 
        error: 'resourceType and resourceId are required' 
      }, { status: 400 });
    }

    const stripe = getStripe();
    let subscriptionId: string | null = null;
    let organizationId: string | null = null;
    let customerId: string | null = null;

    if (resourceType === 'squad') {
      // Get squad member record
      const memberQuery = await adminDb
        .collection('squadMembers')
        .where('squadId', '==', resourceId)
        .where('userId', '==', userId)
        .limit(1)
        .get();

      if (memberQuery.empty) {
        return NextResponse.json({ 
          error: 'You are not a member of this squad' 
        }, { status: 404 });
      }

      const memberData = memberQuery.docs[0].data() as SquadMember;
      subscriptionId = memberData.subscriptionId || null;

      // Get squad for org ID
      const squadDoc = await adminDb.collection('squads').doc(resourceId).get();
      if (squadDoc.exists) {
        organizationId = squadDoc.data()?.organizationId || null;
      }
    } else if (resourceType === 'program') {
      // Get enrollment record
      const enrollmentQuery = await adminDb
        .collection('program_enrollments')
        .where('programId', '==', resourceId)
        .where('userId', '==', userId)
        .where('status', 'in', ['active', 'upcoming'])
        .limit(1)
        .get();

      if (enrollmentQuery.empty) {
        return NextResponse.json({ 
          error: 'You are not enrolled in this program' 
        }, { status: 404 });
      }

      const enrollmentData = enrollmentQuery.docs[0].data() as ProgramEnrollment;
      subscriptionId = enrollmentData.subscriptionId || null;
      organizationId = enrollmentData.organizationId || null;
    }

    if (!subscriptionId) {
      return NextResponse.json({ 
        error: 'No active subscription found for this resource' 
      }, { status: 400 });
    }

    if (!organizationId) {
      return NextResponse.json({ 
        error: 'Organization not found for this resource' 
      }, { status: 400 });
    }

    // Get org settings for Stripe Connect account
    const orgSettingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
    const orgSettings = orgSettingsDoc.data() as OrgSettings | undefined;

    if (!orgSettings?.stripeConnectAccountId) {
      return NextResponse.json({ 
        error: 'Payment configuration not found' 
      }, { status: 400 });
    }

    const stripeAccount = orgSettings.stripeConnectAccountId;

    // Get the subscription to find the customer
    try {
      const subscription = await stripe.subscriptions.retrieve(
        subscriptionId,
        { stripeAccount }
      );
      customerId = typeof subscription.customer === 'string' 
        ? subscription.customer 
        : subscription.customer?.id || null;
    } catch (error) {
      console.error('[SUBSCRIPTION_PORTAL] Error fetching subscription:', error);
      return NextResponse.json({ 
        error: 'Could not find subscription' 
      }, { status: 400 });
    }

    if (!customerId) {
      return NextResponse.json({ 
        error: 'Customer not found for subscription' 
      }, { status: 400 });
    }

    // Build return URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const defaultReturnUrl = resourceType === 'squad'
      ? `${appUrl}/squad`
      : `${appUrl}/programs`;
    const finalReturnUrl = returnUrl || defaultReturnUrl;

    // Create billing portal session on the Connect account
    const session = await stripe.billingPortal.sessions.create(
      {
        customer: customerId,
        return_url: finalReturnUrl,
      },
      { stripeAccount }
    );

    console.log(`[SUBSCRIPTION_PORTAL] Created portal session for user ${userId}, ${resourceType} ${resourceId}, account ${stripeAccount}`);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[SUBSCRIPTION_PORTAL] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create portal session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

