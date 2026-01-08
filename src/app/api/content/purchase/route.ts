/**
 * Unified Content Purchase API
 * 
 * POST /api/content/purchase - Purchase any content type (event, article, course, download, link)
 * 
 * Uses Stripe Connect to process payments to the coach's connected account.
 * Creates a user_content_purchases record upon successful payment.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import type { 
  OrgSettings,
  ContentPurchase,
  ContentPurchaseType,
} from '@/types';

// Initialize Stripe
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' });
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
  thumbnailUrl?: string;
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
    thumbnailUrl: data?.thumbnailUrl,
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
 * Check if user has access via program enrollment
 */
async function hasAccessViaProgram(
  userId: string,
  programIds?: string[]
): Promise<{ hasAccess: boolean; programId?: string; programName?: string }> {
  if (!programIds || programIds.length === 0) {
    return { hasAccess: false };
  }

  // Check if user is enrolled in any of the programs
  const enrollmentSnapshot = await adminDb
    .collection('program_enrollments')
    .where('userId', '==', userId)
    .where('programId', 'in', programIds)
    .where('status', 'in', ['active', 'upcoming', 'completed'])
    .limit(1)
    .get();

  if (!enrollmentSnapshot.empty) {
    const enrollment = enrollmentSnapshot.docs[0].data();
    
    // Get program name
    const programDoc = await adminDb.collection('programs').doc(enrollment.programId).get();
    const programName = programDoc.exists ? programDoc.data()?.name : undefined;

    return {
      hasAccess: true,
      programId: enrollment.programId,
      programName,
    };
  }

  return { hasAccess: false };
}

/**
 * Create a free purchase record (for free content or content included in program)
 */
async function createFreePurchase(
  userId: string,
  contentType: ContentPurchaseType,
  contentId: string,
  organizationId: string,
  includedInProgramId?: string,
  includedInProgramName?: string
): Promise<string> {
  const now = new Date().toISOString();
  
  const purchaseData: Omit<ContentPurchase, 'id'> = {
    userId,
    contentType,
    contentId,
    organizationId,
    amountPaid: 0,
    currency: 'usd',
    purchasedAt: now,
    createdAt: now,
    ...(includedInProgramId && { includedInProgramId }),
    ...(includedInProgramName && { includedInProgramName }),
  };

  const docRef = await adminDb.collection('user_content_purchases').add(purchaseData);
  return docRef.id;
}

/**
 * POST /api/content/purchase
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

    // Check if content is included in a program user is enrolled in
    const programAccess = await hasAccessViaProgram(userId, content.programIds);
    if (programAccess.hasAccess) {
      // Create purchase record for included content
      const purchaseId = await createFreePurchase(
        userId,
        contentType,
        contentId,
        content.organizationId || '',
        programAccess.programId,
        programAccess.programName
      );

      return NextResponse.json({
        success: true,
        purchaseId,
        message: 'Content unlocked via program enrollment',
        includedInProgram: true,
        programName: programAccess.programName,
      });
    }

    // If content is free (no price or price is 0)
    if (!content.priceInCents || content.priceInCents === 0) {
      const purchaseId = await createFreePurchase(
        userId,
        contentType,
        contentId,
        content.organizationId || ''
      );

      return NextResponse.json({
        success: true,
        purchaseId,
        message: 'Free content added to your library',
      });
    }

    // For paid content, create Stripe checkout session
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

    if (!orgSettings?.stripeConnectAccountId) {
      return NextResponse.json(
        { error: 'Payment is not configured for this content' },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const stripeAccount = orgSettings.stripeConnectAccountId;

    // Get user email and name
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || undefined;

    // Get or create Stripe customer on the Connected account
    let customerId: string | undefined;
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const connectedCustomerIds = userData?.stripeConnectedCustomerIds || {};

    if (connectedCustomerIds[stripeAccount]) {
      customerId = connectedCustomerIds[stripeAccount];
    } else {
      const customer = await stripe.customers.create(
        {
          email,
          name,
          metadata: {
            userId,
            platformUserId: userId,
          },
        },
        { stripeAccount }
      );
      customerId = customer.id;

      // Save customer ID for this connected account
      await adminDb.collection('users').doc(userId).set(
        {
          stripeConnectedCustomerIds: {
            ...connectedCustomerIds,
            [stripeAccount]: customerId,
          },
        },
        { merge: true }
      );
    }

    // Calculate platform fee (same as programs)
    const platformFeePercent = orgSettings.platformFeePercent ?? 1;
    const applicationFeeAmount = Math.round(content.priceInCents * (platformFeePercent / 100));

    // Build success/cancel URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    // Determine the success redirect URL based on content type
    const contentPath = contentType === 'download' ? 'downloads' :
                       contentType === 'link' ? 'links' :
                       contentType === 'event' ? 'events' :
                       contentType === 'article' ? 'articles' :
                       'courses';
    
    const successUrl = `${baseUrl}/discover/${contentPath}/${contentId}?purchased=true&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/discover/${contentPath}/${contentId}?checkout=canceled`;

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: content.currency || 'usd',
              product_data: {
                name: content.title,
                description: content.shortDescription || content.description || undefined,
                images: content.coverImageUrl ? [content.coverImageUrl] : undefined,
              },
              unit_amount: content.priceInCents,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          application_fee_amount: applicationFeeAmount,
          setup_future_usage: 'off_session', // Save card for future purchases
          metadata: {
            contentType,
            contentId,
            userId,
            organizationId: content.organizationId,
            type: 'content_purchase',
          },
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer: customerId,
        metadata: {
          contentType,
          contentId,
          userId,
          organizationId: content.organizationId,
          type: 'content_purchase',
        },
      },
      { stripeAccount }
    );

    console.log(`[CONTENT_PURCHASE] Created checkout session ${session.id} for ${contentType}/${contentId}`);

    return NextResponse.json({
      requiresPayment: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      priceInCents: content.priceInCents,
      currency: content.currency,
    });

  } catch (error) {
    console.error('[CONTENT_PURCHASE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

