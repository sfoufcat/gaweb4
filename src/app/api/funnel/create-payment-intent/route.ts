import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import type { FlowSession, Program } from '@/types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

/**
 * POST /api/funnel/create-payment-intent
 * Create a Stripe PaymentIntent for program enrollment
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

    // Get or create Stripe customer
    let customerId: string | undefined;
    
    // Check if user has existing Stripe customer ID
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (userData?.stripeCustomerId) {
      customerId = userData.stripeCustomerId;
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email,
        metadata: {
          userId,
        },
      });
      customerId = customer.id;

      // Save to user record
      await adminDb.collection('users').doc(userId).set(
        { stripeCustomerId: customerId },
        { merge: true }
      );
    }

    // Build metadata
    const metadata: Record<string, string> = {
      userId,
      type: 'funnel_payment',
    };

    if (programId) {
      metadata.programId = programId;
    }

    if (flowSessionId) {
      metadata.flowSessionId = flowSessionId;
      
      // Get flow session for additional context
      const sessionDoc = await adminDb.collection('flow_sessions').doc(flowSessionId).get();
      if (sessionDoc.exists) {
        const session = sessionDoc.data() as FlowSession;
        metadata.organizationId = session.organizationId;
        metadata.funnelId = session.funnelId;
      }
    }

    // Get program name for description
    let description = 'Program enrollment';
    if (programId) {
      const programDoc = await adminDb.collection('programs').doc(programId).get();
      if (programDoc.exists) {
        const program = programDoc.data() as Program;
        description = `${program.name} - Program enrollment`;
      }
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: priceInCents,
      currency: currency.toLowerCase(),
      customer: customerId,
      description,
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    console.log(`[FUNNEL_PAYMENT_INTENT] Created payment intent ${paymentIntent.id} for user ${userId}`);

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error('[FUNNEL_PAYMENT_INTENT_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}

