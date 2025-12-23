import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import type { FlowSession, Program, OrgSettings } from '@/types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

/**
 * POST /api/funnel/create-payment-intent
 * Create a Stripe PaymentIntent for program enrollment using Stripe Connect
 * 
 * Payment goes directly to the coach's connected Stripe account with platform fee deducted.
 * 
 * Body:
 * - priceInCents: number
 * - currency: string (default: 'usd')
 * - programId?: string
 * - flowSessionId?: string
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { priceInCents, currency = 'usd', programId, flowSessionId } = body;

    if (!priceInCents || priceInCents <= 0) {
      return NextResponse.json(
        { error: 'Invalid price' },
        { status: 400 }
      );
    }

    // Get user email from Clerk (for Stripe)
    const { clerkClient } = await import('@clerk/nextjs/server');
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const email = user.emailAddresses[0]?.emailAddress;

    // Build metadata
    const metadata: Record<string, string> = {
      userId,
      type: 'funnel_payment',
    };

    let organizationId: string | undefined;
    let program: Program | undefined;

    // Get flow session for context
    if (flowSessionId) {
      metadata.flowSessionId = flowSessionId;
      
      const sessionDoc = await adminDb.collection('flow_sessions').doc(flowSessionId).get();
      if (sessionDoc.exists) {
        const session = sessionDoc.data() as FlowSession;
        organizationId = session.organizationId;
        metadata.organizationId = session.organizationId;
        metadata.funnelId = session.funnelId;
        
        // Get program from flow session if not provided
        if (!programId && session.programId) {
          metadata.programId = session.programId;
        }
      }
    }

    // Get program details
    const targetProgramId = programId || metadata.programId;
    if (targetProgramId) {
      metadata.programId = targetProgramId;
      const programDoc = await adminDb.collection('programs').doc(targetProgramId).get();
      if (programDoc.exists) {
        program = programDoc.data() as Program;
        // Use program's organizationId if not already set
        if (!organizationId) {
          organizationId = program.organizationId;
          metadata.organizationId = program.organizationId;
        }
      }
    }

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization not found - cannot process payment' },
        { status: 400 }
      );
    }

    // Get organization settings for Stripe Connect
    const orgSettingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
    const orgSettings = orgSettingsDoc.data() as OrgSettings | undefined;

    const stripeConnectAccountId = orgSettings?.stripeConnectAccountId;
    if (!stripeConnectAccountId) {
      return NextResponse.json(
        { error: 'Payment is not configured for this organization. Please contact support.' },
        { status: 400 }
      );
    }

    // Verify the connected account is ready to accept payments
    try {
      const account = await stripe.accounts.retrieve(stripeConnectAccountId);
      if (!account.charges_enabled) {
        return NextResponse.json(
          { error: 'Payment processing is not yet enabled for this organization. Please try again later.' },
          { status: 400 }
        );
      }
    } catch (accountError) {
      console.error('[FUNNEL_PAYMENT_INTENT] Error checking Stripe Connect account:', accountError);
      return NextResponse.json(
        { error: 'Unable to verify payment configuration. Please contact support.' },
        { status: 500 }
      );
    }

    // Calculate platform fee (default 1%)
    const platformFeePercent = orgSettings?.platformFeePercent ?? 1;
    const applicationFeeAmount = Math.round(priceInCents * (platformFeePercent / 100));

    // Get or create Stripe customer on the Connected account
    let customerId: string | undefined;
    
    // For Connected accounts, we need to create the customer on that account
    // Check if we have a customer ID for this specific connected account
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    // Store connected account customer IDs in a map
    const connectedCustomerIds = userData?.stripeConnectedCustomerIds || {};
    
    if (connectedCustomerIds[stripeConnectAccountId]) {
      customerId = connectedCustomerIds[stripeConnectAccountId];
    } else {
      // Create new Stripe customer on the Connected account
      const customer = await stripe.customers.create(
        {
          email,
          metadata: {
            userId,
            platformUserId: userId, // Reference back to platform user
          },
        },
        { stripeAccount: stripeConnectAccountId }
      );
      customerId = customer.id;

      // Save customer ID for this connected account
      await adminDb.collection('users').doc(userId).set(
        { 
          stripeConnectedCustomerIds: {
            ...connectedCustomerIds,
            [stripeConnectAccountId]: customerId,
          }
        },
        { merge: true }
      );
    }

    // Build description
    const description = program 
      ? `${program.name} - Program enrollment`
      : 'Program enrollment';

    // Create payment intent on the Connected account with application fee
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: priceInCents,
        currency: currency.toLowerCase(),
        customer: customerId,
        description,
        metadata,
        application_fee_amount: applicationFeeAmount,
        automatic_payment_methods: {
          enabled: true,
        },
      },
      { stripeAccount: stripeConnectAccountId }
    );

    console.log(`[FUNNEL_PAYMENT_INTENT] Created payment intent ${paymentIntent.id} for user ${userId} on connected account ${stripeConnectAccountId} (fee: ${applicationFeeAmount})`);

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      connectedAccountId: stripeConnectAccountId,
    });
  } catch (error) {
    console.error('[FUNNEL_PAYMENT_INTENT_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}
