import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import Stripe from 'stripe';
import type { UnifiedEvent, CoachCallSettings, UserCallCredits } from '@/types';

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
    _stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia' });
  }
  return _stripe;
}

/**
 * POST /api/scheduling/payment
 * Create a payment intent for a paid call
 * 
 * Body:
 * - eventId: string - The event ID to pay for
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { eventId } = body;

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    // Get the event
    const eventDoc = await adminDb.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const event = eventDoc.data() as UnifiedEvent;

    // Verify user is a participant
    if (!event.attendeeIds.includes(userId)) {
      return NextResponse.json(
        { error: 'You are not a participant of this event' },
        { status: 403 }
      );
    }

    // Check if already paid
    if (event.paidAt) {
      return NextResponse.json(
        { error: 'This call has already been paid for' },
        { status: 400 }
      );
    }

    // Check if the call is actually paid
    if (!event.isPaid || !event.priceInCents) {
      return NextResponse.json(
        { error: 'This call is not a paid call' },
        { status: 400 }
      );
    }

    // Check for available credits first
    const creditsDoc = await adminDb
      .collection('user_call_credits')
      .doc(`${orgId}_${userId}`)
      .get();

    if (creditsDoc.exists) {
      const credits = creditsDoc.data() as UserCallCredits;
      if (credits.creditsRemaining > 0) {
        // Use credit instead of payment
        return NextResponse.json({
          useCredits: true,
          creditsRemaining: credits.creditsRemaining - 1,
        });
      }
    }

    // Get user email for Stripe
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userEmail = userData?.email || userData?.primaryEmail;

    // Create Stripe payment intent
    const paymentIntent = await getStripe().paymentIntents.create({
      amount: event.priceInCents,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        eventId: event.id,
        userId,
        orgId,
        type: 'coaching_call',
      },
      receipt_email: userEmail,
      description: `Coaching call: ${event.title}`,
    });

    // Store payment intent ID on event
    await adminDb.collection('events').doc(eventId).update({
      paymentIntentId: paymentIntent.id,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: event.priceInCents,
    });
  } catch (error) {
    console.error('[SCHEDULING_PAYMENT] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/scheduling/payment
 * Confirm payment completion or use credits
 * 
 * Body:
 * - eventId: string - The event ID
 * - useCredits?: boolean - If true, use credits instead of payment
 */
export async function PUT(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { eventId, useCredits } = body;

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    // Get the event
    const eventDoc = await adminDb.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const event = eventDoc.data() as UnifiedEvent;

    // Verify user is a participant
    if (!event.attendeeIds.includes(userId)) {
      return NextResponse.json(
        { error: 'You are not a participant of this event' },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();

    if (useCredits) {
      // Deduct credit
      const creditsRef = adminDb
        .collection('user_call_credits')
        .doc(`${orgId}_${userId}`);
      const creditsDoc = await creditsRef.get();

      if (!creditsDoc.exists) {
        return NextResponse.json(
          { error: 'No credits available' },
          { status: 400 }
        );
      }

      const credits = creditsDoc.data() as UserCallCredits;
      if (credits.creditsRemaining <= 0) {
        return NextResponse.json(
          { error: 'No credits remaining' },
          { status: 400 }
        );
      }

      // Deduct credit
      await creditsRef.update({
        creditsRemaining: credits.creditsRemaining - 1,
        creditsUsedThisMonth: (credits.creditsUsedThisMonth || 0) + 1,
        lastUpdated: now,
      });

      // Mark event as paid with credits
      await adminDb.collection('events').doc(eventId).update({
        paidAt: now,
        isPaid: true,
        priceInCents: 0, // Credit was used
        updatedAt: now,
      });

      return NextResponse.json({
        success: true,
        paidWithCredits: true,
        creditsRemaining: credits.creditsRemaining - 1,
      });
    } else {
      // Verify payment was successful via webhook or client confirmation
      if (event.paymentIntentId) {
        const paymentIntent = await getStripe().paymentIntents.retrieve(event.paymentIntentId);
        
        if (paymentIntent.status !== 'succeeded') {
          return NextResponse.json(
            { error: 'Payment not completed' },
            { status: 400 }
          );
        }
      }

      // Mark event as paid
      await adminDb.collection('events').doc(eventId).update({
        paidAt: now,
        updatedAt: now,
      });

      return NextResponse.json({
        success: true,
        paidWithCredits: false,
      });
    }
  } catch (error) {
    console.error('[SCHEDULING_PAYMENT_PUT] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

