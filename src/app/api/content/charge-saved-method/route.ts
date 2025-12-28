/**
 * Charge Saved Payment Method for Content Purchase
 * 
 * POST /api/content/charge-saved-method
 * 
 * Creates and confirms a Stripe PaymentIntent using a saved payment method
 * for one-click purchases without re-entering card details.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import Stripe from 'stripe';
import type { OrgSettings, ContentPurchaseType } from '@/types';

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
  programIds?: string[];
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
    programIds: data?.programIds,
  };
}

/**
 * Check if user has already purchased this content
 */
async function hasExistingPurchase(
  userId: string,
  contentType: ContentPurchaseType,
  contentId: string
): Promise<boolean> {
  const purchaseSnapshot = await adminDb
    .collection('user_content_purchases')
    .where('userId', '==', userId)
    .where('contentType', '==', contentType)
    .where('contentId', '==', contentId)
    .limit(1)
    .get();

  return !purchaseSnapshot.empty;
}

/**
 * POST /api/content/charge-saved-method
 * 
 * Body:
 * - contentType: 'event' | 'article' | 'course' | 'download' | 'link'
 * - contentId: string
 * - paymentMethodId: string - The saved payment method to use
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { contentType, contentId, paymentMethodId } = body as {
      contentType: ContentPurchaseType;
      contentId: string;
      paymentMethodId: string;
    };

    // Validate input
    if (!contentType || !contentId || !paymentMethodId) {
      return NextResponse.json(
        { error: 'Missing required fields: contentType, contentId, and paymentMethodId' },
        { status: 400 }
      );
    }

    if (!CONTENT_COLLECTIONS[contentType]) {
      return NextResponse.json(
        { error: 'Invalid content type' },
        { status: 400 }
      );
    }

    // Get content data
    const content = await getContentData(contentType, contentId);
    if (!content) {
      return NextResponse.json(
        { error: 'Content not found' },
        { status: 404 }
      );
    }

    // Check if already purchased
    const alreadyPurchased = await hasExistingPurchase(userId, contentType, contentId);
    if (alreadyPurchased) {
      return NextResponse.json(
        { error: 'You have already purchased this content', alreadyOwned: true },
        { status: 400 }
      );
    }

    // Validate pricing
    if (!content.priceInCents || content.priceInCents <= 0) {
      return NextResponse.json(
        { error: 'This content is free and does not require payment' },
        { status: 400 }
      );
    }

    if (!content.organizationId) {
      return NextResponse.json(
        { error: 'Content is not properly configured for purchase' },
        { status: 400 }
      );
    }

    // Get organization settings for Stripe Connect
    const orgSettingsDoc = await adminDb
      .collection('org_settings')
      .doc(content.organizationId)
      .get();
    const orgSettings = orgSettingsDoc.data() as OrgSettings | undefined;

    const stripeConnectAccountId = orgSettings?.stripeConnectAccountId;
    if (!stripeConnectAccountId) {
      return NextResponse.json(
        { error: 'Payment is not configured for this content' },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    // Get user's customer ID for this connected account
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const connectedCustomerIds = userData?.stripeConnectedCustomerIds || {};
    const customerId = connectedCustomerIds[stripeConnectAccountId];

    if (!customerId) {
      return NextResponse.json(
        { error: 'No saved payment method found. Please add a payment method first.' },
        { status: 400 }
      );
    }

    // Calculate platform fee
    const platformFeePercent = orgSettings?.platformFeePercent ?? 1;
    const applicationFeeAmount = Math.round(content.priceInCents * (platformFeePercent / 100));

    // Build metadata
    const metadata: Record<string, string> = {
      contentType,
      contentId,
      userId,
      organizationId: content.organizationId,
      type: 'content_purchase',
    };

    // Build description
    const description = `${content.title} - ${contentType.charAt(0).toUpperCase() + contentType.slice(1)} purchase`;

    // Create and confirm payment intent immediately with the saved payment method
    let paymentIntent: Stripe.PaymentIntent;
    
    try {
      paymentIntent = await stripe.paymentIntents.create(
        {
          amount: content.priceInCents,
          currency: (content.currency || 'usd').toLowerCase(),
          customer: customerId,
          payment_method: paymentMethodId,
          confirm: true, // Confirm immediately for one-click
          off_session: true, // Customer not present
          description,
          metadata,
          application_fee_amount: applicationFeeAmount,
        },
        { stripeAccount: stripeConnectAccountId }
      );
    } catch (stripeError) {
      console.error('[CONTENT_CHARGE_SAVED] Stripe error:', stripeError);
      
      if (stripeError instanceof Stripe.errors.StripeCardError) {
        return NextResponse.json(
          { error: 'Payment failed: ' + stripeError.message },
          { status: 400 }
        );
      }
      
      throw stripeError;
    }

    // Check if payment succeeded
    if (paymentIntent.status !== 'succeeded') {
      console.error('[CONTENT_CHARGE_SAVED] Payment not succeeded:', paymentIntent.status);
      return NextResponse.json(
        { 
          error: 'Payment not completed', 
          status: paymentIntent.status,
          requiresAction: paymentIntent.status === 'requires_action',
        },
        { status: 400 }
      );
    }

    // Payment succeeded - create purchase record
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);
    
    const purchaseRecord = {
      userId,
      contentType,
      contentId,
      contentTitle: content.title,
      organizationId: content.organizationId,
      priceInCents: content.priceInCents,
      currency: content.currency || 'usd',
      stripePaymentIntentId: paymentIntent.id,
      status: 'completed',
      purchasedAt: new Date().toISOString(),
      userEmail: clerkUser.emailAddresses[0]?.emailAddress,
      userName: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim(),
    };

    await adminDb.collection('user_content_purchases').add(purchaseRecord);

    console.log(
      `[CONTENT_CHARGE_SAVED] Successfully charged saved method for ${contentType}/${contentId} user ${userId}`
    );

    return NextResponse.json({
      success: true,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error('[CONTENT_CHARGE_SAVED] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

