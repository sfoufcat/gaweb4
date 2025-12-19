import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';

// Lazy initialization of Stripe
function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(key, {
    apiVersion: '2025-02-24.acacia',
  });
}

/**
 * POST /api/guest/update-email
 * Updates the email for a guest session in Firebase and Stripe
 * 
 * This is used when a user wants to change their email during account creation
 * (after payment but before completing Clerk verification).
 * 
 * The guest session ID preserves the payment linkage, while this endpoint
 * updates the email in:
 * 1. Firebase guestSessions document
 * 2. Stripe customer (if stripeCustomerId exists)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, newEmail } = body;

    // Validate inputs
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    if (!newEmail || typeof newEmail !== 'string') {
      return NextResponse.json(
        { error: 'New email is required' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate session ID format
    if (!sessionId.startsWith('guest_')) {
      return NextResponse.json(
        { error: 'Invalid session ID format' },
        { status: 400 }
      );
    }

    // Get the guest session from Firebase
    const docRef = adminDb.collection('guestSessions').doc(sessionId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Guest session not found' },
        { status: 404 }
      );
    }

    const sessionData = doc.data();

    // Check if payment was completed (user should have paid before changing email)
    if (sessionData?.paymentStatus !== 'completed') {
      return NextResponse.json(
        { error: 'Payment not completed for this session' },
        { status: 400 }
      );
    }

    // Update Firebase guest session with new email
    await docRef.update({
      email: newEmail,
      emailUpdatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    console.log(`[UPDATE_EMAIL] Updated Firebase guest session ${sessionId} with new email`);

    // If there's a Stripe customer, update their email too
    if (sessionData?.stripeCustomerId) {
      try {
        const stripe = getStripeClient();
        await stripe.customers.update(sessionData.stripeCustomerId, {
          email: newEmail,
        });
        console.log(`[UPDATE_EMAIL] Updated Stripe customer ${sessionData.stripeCustomerId} email`);
      } catch (stripeError) {
        // Log but don't fail - Firebase is already updated
        console.error('[UPDATE_EMAIL] Failed to update Stripe customer email:', stripeError);
        // Still return success since the critical Firebase update succeeded
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Email updated successfully',
    });

  } catch (error: any) {
    console.error('[UPDATE_EMAIL_ERROR]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update email' },
      { status: 500 }
    );
  }
}








