/**
 * Confirm Content Purchase API
 * 
 * POST /api/content/confirm-purchase
 * 
 * Called by the client after a successful Stripe PaymentElement payment.
 * Verifies the PaymentIntent succeeded and creates the purchase record.
 * This provides immediate confirmation without relying on webhooks.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import Stripe from 'stripe';
import type { OrgSettings, ContentPurchaseType } from '@/types';
import { createInvoiceFromPayment } from '@/lib/invoice-generator';

// Lazy initialization of Stripe
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
    _stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia' });
  }
  return _stripe;
}

// Collection mapping for content types
const CONTENT_COLLECTIONS: Record<ContentPurchaseType, string> = {
  event: 'events',
  article: 'articles',
  course: 'courses',
  download: 'program_downloads',
  link: 'program_links',
};

interface ContentData {
  id: string;
  title: string;
  priceInCents?: number;
  currency?: string;
  organizationId?: string;
}

/**
 * Get content data from Firestore
 */
async function getContentData(
  contentType: ContentPurchaseType,
  contentId: string
): Promise<ContentData | null> {
  const collection = CONTENT_COLLECTIONS[contentType];
  if (!collection) return null;

  const doc = await adminDb.collection(collection).doc(contentId).get();
  if (!doc.exists) return null;

  const data = doc.data();
  return {
    id: doc.id,
    title: data?.title || data?.name || 'Untitled',
    priceInCents: data?.priceInCents,
    currency: data?.currency || 'usd',
    organizationId: data?.organizationId,
  };
}

/**
 * POST /api/content/confirm-purchase
 * 
 * Body:
 * - paymentIntentId: string - The Stripe PaymentIntent ID
 * - contentType: 'event' | 'article' | 'course' | 'download' | 'link'
 * - contentId: string
 * - connectedAccountId: string - The Stripe Connect account ID
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { paymentIntentId, contentType, contentId, connectedAccountId } = body as {
      paymentIntentId: string;
      contentType: ContentPurchaseType;
      contentId: string;
      connectedAccountId: string;
    };

    // Validate input
    if (!paymentIntentId || !contentType || !contentId || !connectedAccountId) {
      return NextResponse.json(
        { error: 'Missing required fields: paymentIntentId, contentType, contentId, connectedAccountId' },
        { status: 400 }
      );
    }

    if (!CONTENT_COLLECTIONS[contentType]) {
      return NextResponse.json(
        { error: 'Invalid content type' },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    // Retrieve the PaymentIntent from the connected account to verify it succeeded
    let paymentIntent: Stripe.PaymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId,
        { stripeAccount: connectedAccountId }
      );
    } catch (stripeError) {
      console.error('[CONFIRM_PURCHASE] Failed to retrieve PaymentIntent:', stripeError);
      return NextResponse.json(
        { error: 'Failed to verify payment. Please contact support.' },
        { status: 400 }
      );
    }

    // Verify payment succeeded
    if (paymentIntent.status !== 'succeeded') {
      console.error('[CONFIRM_PURCHASE] PaymentIntent not succeeded:', paymentIntent.status);
      return NextResponse.json(
        { error: `Payment not completed. Status: ${paymentIntent.status}` },
        { status: 400 }
      );
    }

    // Verify the PaymentIntent metadata matches the request
    const metadata = paymentIntent.metadata || {};
    if (metadata.contentType !== contentType || metadata.contentId !== contentId) {
      console.error('[CONFIRM_PURCHASE] Metadata mismatch:', {
        expected: { contentType, contentId },
        actual: { contentType: metadata.contentType, contentId: metadata.contentId },
      });
      return NextResponse.json(
        { error: 'Payment verification failed. Metadata mismatch.' },
        { status: 400 }
      );
    }

    // Verify the user matches
    if (metadata.userId !== userId) {
      console.error('[CONFIRM_PURCHASE] User mismatch:', {
        expected: userId,
        actual: metadata.userId,
      });
      return NextResponse.json(
        { error: 'Payment verification failed. User mismatch.' },
        { status: 403 }
      );
    }

    // Check if purchase already exists (idempotent - webhook might have created it)
    const existingPurchase = await adminDb
      .collection('user_content_purchases')
      .where('stripePaymentIntentId', '==', paymentIntentId)
      .limit(1)
      .get();

    if (!existingPurchase.empty) {
      console.log('[CONFIRM_PURCHASE] Purchase already exists for PaymentIntent:', paymentIntentId);
      return NextResponse.json({
        success: true,
        purchaseId: existingPurchase.docs[0].id,
        alreadyExists: true,
      });
    }

    // Get content data for the purchase record
    const content = await getContentData(contentType, contentId);
    if (!content) {
      console.error('[CONFIRM_PURCHASE] Content not found:', { contentType, contentId });
      // Still create the purchase record - payment was valid
    }

    // Get user info for the purchase record
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);

    // Create the purchase record
    const now = new Date().toISOString();
    const purchaseData = {
      userId,
      contentType,
      contentId,
      contentTitle: content?.title || 'Unknown',
      organizationId: metadata.organizationId || content?.organizationId || '',
      amountPaid: paymentIntent.amount || 0,
      currency: paymentIntent.currency || 'usd',
      stripePaymentIntentId: paymentIntentId,
      status: 'completed',
      purchasedAt: now,
      createdAt: now,
      userEmail: clerkUser.emailAddresses[0]?.emailAddress,
      userName: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim(),
    };

    const purchaseRef = await adminDb.collection('user_content_purchases').add(purchaseData);

    // Create invoice for content purchase
    createInvoiceFromPayment({
      userId,
      organizationId: metadata.organizationId || content?.organizationId || '',
      paymentType: 'content_purchase',
      referenceId: purchaseRef.id,
      referenceName: content?.title || 'Content purchase',
      amountPaid: paymentIntent.amount || 0,
      currency: paymentIntent.currency || 'usd',
      stripePaymentIntentId: paymentIntentId,
    }).catch(err => {
      console.error('[CONFIRM_PURCHASE] Failed to create invoice:', err);
    });

    console.log(
      `[CONFIRM_PURCHASE] Created purchase record: User ${userId} purchased ${contentType}/${contentId}, purchaseId: ${purchaseRef.id}`
    );

    return NextResponse.json({
      success: true,
      purchaseId: purchaseRef.id,
    });
  } catch (error) {
    console.error('[CONFIRM_PURCHASE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

