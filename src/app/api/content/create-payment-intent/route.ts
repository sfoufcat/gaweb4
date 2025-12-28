/**
 * Create Payment Intent for Content Purchase
 * 
 * POST /api/content/create-payment-intent
 * 
 * Creates a Stripe PaymentIntent for embedded checkout in the purchase popup.
 * Uses Stripe Connect to process payments to the coach's connected account.
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
  coverImageUrl?: string;
  description?: string;
  shortDescription?: string;
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
    coverImageUrl: data?.coverImageUrl,
    description: data?.description || data?.shortDescription || data?.longDescription,
    shortDescription: data?.shortDescription,
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
 * POST /api/content/create-payment-intent
 * 
 * Body:
 * - contentType: 'event' | 'article' | 'course' | 'download' | 'link'
 * - contentId: string
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { contentType, contentId } = body as {
      contentType: ContentPurchaseType;
      contentId: string;
    };

    // Validate input
    if (!contentType || !contentId) {
      return NextResponse.json(
        { error: 'Missing required fields: contentType and contentId' },
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

    // Verify the connected account is ready to accept payments
    try {
      const account = await stripe.accounts.retrieve(stripeConnectAccountId);
      if (!account.charges_enabled) {
        return NextResponse.json(
          { error: 'Payment processing is not yet enabled. Please try again later.' },
          { status: 400 }
        );
      }
    } catch (accountError) {
      console.error('[CONTENT_PAYMENT_INTENT] Error checking Stripe Connect account:', accountError);
      return NextResponse.json(
        { error: 'Unable to verify payment configuration. Please contact support.' },
        { status: 500 }
      );
    }

    // Get user email
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);
    const email = clerkUser.emailAddresses[0]?.emailAddress;

    // Calculate platform fee
    const platformFeePercent = orgSettings?.platformFeePercent ?? 1;
    const applicationFeeAmount = Math.round(content.priceInCents * (platformFeePercent / 100));

    // Get or create Stripe customer on the Connected account
    let customerId: string | undefined;
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
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
            platformUserId: userId,
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
          },
        },
        { merge: true }
      );
    }

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

    // Create payment intent on the Connected account with application fee
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: content.priceInCents,
        currency: (content.currency || 'usd').toLowerCase(),
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

    console.log(
      `[CONTENT_PAYMENT_INTENT] Created payment intent ${paymentIntent.id} for ${contentType}/${contentId} user ${userId}`
    );

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      connectedAccountId: stripeConnectAccountId,
      priceInCents: content.priceInCents,
      currency: content.currency || 'usd',
    });
  } catch (error) {
    console.error('[CONTENT_PAYMENT_INTENT] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

