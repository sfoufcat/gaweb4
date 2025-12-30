import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import type { FlowSession, Program, OrgSettings } from '@/types';

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

/**
 * POST /api/funnel/create-payment-intent
 * Create a Stripe PaymentIntent for program enrollment using Stripe Connect
 * 
 * Supports both authenticated users and guest checkout:
 * - Authenticated: Uses userId from Clerk auth
 * - Guest: Uses flowSessionId to track the payment (userId linked after signup)
 * 
 * Payment goes directly to the coach's connected Stripe account with platform fee deducted.
 * 
 * Body:
 * - priceInCents: number
 * - currency: string (default: 'usd')
 * - programId?: string
 * - flowSessionId: string (required for guest checkout)
 */
export async function POST(req: Request) {
  try {
    // Auth is optional - supports guest checkout
    const { userId } = await auth();

    const body = await req.json();
    const { priceInCents, currency = 'usd', programId, flowSessionId } = body;

    // Require either authentication OR a valid flowSessionId for guest checkout
    if (!userId && !flowSessionId) {
      return NextResponse.json(
        { error: 'Unauthorized - authentication or flowSessionId required' },
        { status: 401 }
      );
    }

    if (!priceInCents || priceInCents <= 0) {
      return NextResponse.json(
        { error: 'Invalid price' },
        { status: 400 }
      );
    }

    // Build metadata
    const metadata: Record<string, string> = {
      type: 'funnel_payment',
    };
    
    // Add userId to metadata if authenticated
    if (userId) {
      metadata.userId = userId;
    }

    let organizationId: string | undefined;
    let program: Program | undefined;
    let session: FlowSession | null = null;

    // Get flow session for context (required for guest checkout)
    if (flowSessionId) {
      metadata.flowSessionId = flowSessionId;
      
      const sessionDoc = await adminDb.collection('flow_sessions').doc(flowSessionId).get();
      if (sessionDoc.exists) {
        session = sessionDoc.data() as FlowSession;
        organizationId = session.organizationId;
        metadata.organizationId = session.organizationId;
        metadata.funnelId = session.funnelId;
        
        // Get program from flow session if not provided
        if (!programId && session.programId) {
          metadata.programId = session.programId;
        }
      } else if (!userId) {
        // Guest checkout requires a valid flow session
        return NextResponse.json(
          { error: 'Invalid flow session' },
          { status: 400 }
        );
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
      const account = await getStripe().accounts.retrieve(stripeConnectAccountId);
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

    // Get or create Stripe customer - different paths for authenticated vs guest
    let customerId: string | undefined;
    let email: string | undefined;

    if (userId) {
      // ========================================
      // AUTHENTICATED USER FLOW
      // ========================================
      
      // Get user email from Clerk
      const { clerkClient } = await import('@clerk/nextjs/server');
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      email = user.emailAddresses[0]?.emailAddress;

      // Check if we have a customer ID for this specific connected account
      const userDoc = await adminDb.collection('users').doc(userId).get();
      const userData = userDoc.data();
      
      // Store connected account customer IDs in a map
      const connectedCustomerIds = userData?.stripeConnectedCustomerIds || {};
      
      if (connectedCustomerIds[stripeConnectAccountId]) {
        customerId = connectedCustomerIds[stripeConnectAccountId];
      } else {
        // Create new Stripe customer on the Connected account
        const customer = await getStripe().customers.create(
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
      
      console.log(`[FUNNEL_PAYMENT_INTENT] Authenticated user ${userId}, customer ${customerId}`);
      
    } else {
      // ========================================
      // GUEST CHECKOUT FLOW
      // ========================================
      
      // Get email from flow session data (collected in earlier step)
      const sessionData = session?.data || {};
      email = sessionData.email as string | undefined;
      
      // Check if we already have a customer ID stored in the session
      const existingCustomerId = sessionData[`stripeCustomerId_${stripeConnectAccountId}`] as string | undefined;
      
      if (existingCustomerId) {
        customerId = existingCustomerId;
        console.log(`[FUNNEL_PAYMENT_INTENT] Guest checkout - reusing customer ${customerId}`);
      } else {
        // Create new Stripe customer on the Connected account for guest
        const customerData: Stripe.CustomerCreateParams = {
          metadata: {
            flowSessionId: flowSessionId!,
            type: 'guest_checkout',
          },
        };
        
        // Add email if available (may be collected via Stripe Payment Element instead)
        if (email) {
          customerData.email = email;
        }
        
        const customer = await getStripe().customers.create(
          customerData,
          { stripeAccount: stripeConnectAccountId }
        );
        customerId = customer.id;

        // Store customer ID in flow session for future use (upsells, etc.)
        await adminDb.collection('flow_sessions').doc(flowSessionId!).update({
          data: {
            ...sessionData,
            [`stripeCustomerId_${stripeConnectAccountId}`]: customerId,
            stripeConnectAccountId: stripeConnectAccountId,
          },
          updatedAt: new Date().toISOString(),
        });
        
        console.log(`[FUNNEL_PAYMENT_INTENT] Guest checkout - created customer ${customerId} for session ${flowSessionId}`);
      }
    }

    // Build description
    const description = program 
      ? `${program.name} - Program enrollment`
      : 'Program enrollment';

    // Create payment intent on the Connected account with application fee
    // Using setup_future_usage: 'off_session' to save the payment method for future use (upsells)
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: priceInCents,
      currency: currency.toLowerCase(),
      customer: customerId,
      description,
      metadata,
      application_fee_amount: applicationFeeAmount,
      automatic_payment_methods: {
        enabled: true,
      },
      setup_future_usage: 'off_session', // Save card for future one-click purchases
    };
    
    // For guest checkout without email, Stripe Payment Element will collect it
    // If we have an email, attach it to the payment intent receipt
    if (email) {
      paymentIntentParams.receipt_email = email;
    }
    
    const paymentIntent = await getStripe().paymentIntents.create(
      paymentIntentParams,
      { stripeAccount: stripeConnectAccountId }
    );

    const logUser = userId ? `user ${userId}` : `guest session ${flowSessionId}`;
    console.log(`[FUNNEL_PAYMENT_INTENT] Created payment intent ${paymentIntent.id} for ${logUser} on connected account ${stripeConnectAccountId} (fee: ${applicationFeeAmount})`);

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
