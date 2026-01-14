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
import type { OrgSettings, ContentPurchaseType, OrderBumpProductType, OrderBumpContentType, DiscountCode, DiscountContentType } from '@/types';

/** Order bump selection from client */
interface OrderBumpSelection {
  productType: OrderBumpProductType;
  productId: string;
  contentType?: OrderBumpContentType;
  discountPercent?: number;
}

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
 * Fetch order bump product details for validation and pricing
 */
async function fetchOrderBumpProduct(
  bump: OrderBumpSelection,
  organizationId: string
): Promise<{ name: string; priceInCents: number; imageUrl?: string } | null> {
  try {
    let collection: string;
    
    if (bump.productType === 'program') {
      collection = 'programs';
    } else if (bump.productType === 'squad') {
      collection = 'squads';
    } else if (bump.productType === 'content') {
      switch (bump.contentType) {
        case 'article':
          collection = 'discover_articles';
          break;
        case 'course':
          collection = 'discover_courses';
          break;
        case 'event':
          collection = 'discover_events';
          break;
        case 'download':
          collection = 'discover_downloads';
          break;
        case 'link':
          collection = 'discover_links';
          break;
        default:
          console.warn(`[CONTENT_PAYMENT_INTENT] Unknown content type for order bump: ${bump.contentType}`);
          return null;
      }
    } else {
      console.warn(`[CONTENT_PAYMENT_INTENT] Unknown product type for order bump: ${bump.productType}`);
      return null;
    }

    const doc = await adminDb.collection(collection).doc(bump.productId).get();
    if (!doc.exists) {
      console.warn(`[CONTENT_PAYMENT_INTENT] Order bump product not found: ${collection}/${bump.productId}`);
      return null;
    }

    const data = doc.data();
    if (!data) return null;

    // Verify organization match
    if (data.organizationId !== organizationId) {
      console.warn(`[CONTENT_PAYMENT_INTENT] Order bump product org mismatch: ${data.organizationId} !== ${organizationId}`);
      return null;
    }

    return {
      name: data.name || data.title || 'Add-on',
      priceInCents: data.priceInCents || 0,
      imageUrl: data.coverImageUrl || data.thumbnailUrl || data.avatarUrl,
    };
  } catch (error) {
    console.error(`[CONTENT_PAYMENT_INTENT] Error fetching order bump product:`, error);
    return null;
  }
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
 * Validate and calculate discount for content purchase
 */
async function validateDiscountCode(
  code: string,
  organizationId: string,
  contentId: string,
  contentType: ContentPurchaseType,
  userId: string,
  originalAmountCents: number
): Promise<{ valid: boolean; discountCode?: DiscountCode; discountAmountCents: number; error?: string }> {
  if (!code?.trim()) {
    return { valid: false, discountAmountCents: 0 };
  }

  const normalizedCode = code.trim().toUpperCase();

  // Look up the discount code
  const codeSnapshot = await adminDb
    .collection('discount_codes')
    .where('organizationId', '==', organizationId)
    .where('code', '==', normalizedCode)
    .limit(1)
    .get();

  if (codeSnapshot.empty) {
    return { valid: false, discountAmountCents: 0, error: 'Invalid discount code' };
  }

  const codeDoc = codeSnapshot.docs[0];
  const discountCode = {
    id: codeDoc.id,
    ...codeDoc.data(),
  } as DiscountCode;

  // Validate the code
  if (!discountCode.isActive) {
    return { valid: false, discountAmountCents: 0, error: 'This discount code is no longer active' };
  }

  if (discountCode.startsAt && new Date(discountCode.startsAt) > new Date()) {
    return { valid: false, discountAmountCents: 0, error: 'This discount code is not yet active' };
  }

  if (discountCode.expiresAt && new Date(discountCode.expiresAt) < new Date()) {
    return { valid: false, discountAmountCents: 0, error: 'This discount code has expired' };
  }

  if (discountCode.maxUses != null && discountCode.useCount >= discountCode.maxUses) {
    return { valid: false, discountAmountCents: 0, error: 'This discount code has reached its maximum uses' };
  }

  // Check per-user limit
  if (discountCode.maxUsesPerUser) {
    const userUsages = await adminDb
      .collection('discount_code_usages')
      .where('discountCodeId', '==', discountCode.id)
      .where('userId', '==', userId)
      .count()
      .get();

    if (userUsages.data().count >= discountCode.maxUsesPerUser) {
      return { valid: false, discountAmountCents: 0, error: 'You have already used this discount code the maximum number of times' };
    }
  }

  // Check applicability for content
  const isContent = true;
  const discountContentType = contentType as DiscountContentType;

  switch (discountCode.applicableTo) {
    case 'programs':
    case 'squads':
      return { valid: false, discountAmountCents: 0, error: 'This discount code is not valid for content purchases' };

    case 'content':
      if (discountCode.contentTypes?.length && !discountCode.contentTypes.includes(discountContentType)) {
        return { valid: false, discountAmountCents: 0, error: `This discount code is not valid for ${contentType}s` };
      }
      break;

    case 'custom':
      const hasContentRestrictions = discountCode.contentIds && discountCode.contentIds.length > 0;
      const hasContentTypeRestrictions = discountCode.contentTypes && discountCode.contentTypes.length > 0;
      const hasProgramRestrictions = discountCode.programIds && discountCode.programIds.length > 0;
      const hasSquadRestrictions = discountCode.squadIds && discountCode.squadIds.length > 0;

      // If there are program or squad restrictions but no content restrictions, this code doesn't apply to content
      if ((hasProgramRestrictions || hasSquadRestrictions) && !hasContentRestrictions && !hasContentTypeRestrictions) {
        return { valid: false, discountAmountCents: 0, error: 'This discount code is not valid for content purchases' };
      }

      // Check specific content ID restrictions
      if (hasContentRestrictions && !discountCode.contentIds!.includes(contentId)) {
        return { valid: false, discountAmountCents: 0, error: 'This discount code is not valid for this content' };
      }

      // Check content type restrictions
      if (hasContentTypeRestrictions && !discountCode.contentTypes!.includes(discountContentType)) {
        return { valid: false, discountAmountCents: 0, error: `This discount code is not valid for ${contentType}s` };
      }
      break;

    case 'all':
      // Valid for everything
      break;
  }

  // Calculate discount amount
  let discountAmountCents: number;
  if (discountCode.type === 'percentage') {
    discountAmountCents = Math.round(originalAmountCents * (discountCode.value / 100));
  } else {
    discountAmountCents = Math.min(discountCode.value, originalAmountCents);
  }

  return { valid: true, discountCode, discountAmountCents };
}

/**
 * POST /api/content/create-payment-intent
 *
 * Body:
 * - contentType: 'event' | 'article' | 'course' | 'download' | 'link'
 * - contentId: string
 * - orderBumps?: Array of order bump selections
 * - discountCode?: string - Optional discount code to apply
 * - checkOnly?: boolean - If true, only return org info without creating intent
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { contentType, contentId, orderBumps, discountCode: discountCodeInput, checkOnly } = body as {
      contentType: ContentPurchaseType;
      contentId: string;
      orderBumps?: OrderBumpSelection[];
      discountCode?: string;
      checkOnly?: boolean;
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

    // If checkOnly, just return org info
    if (checkOnly) {
      return NextResponse.json({ organizationId: content.organizationId });
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

    // Process order bumps if provided
    let orderBumpTotalCents = 0;
    const validatedOrderBumps: Array<{
      productType: string;
      productId: string;
      contentType?: string;
      name: string;
      priceInCents: number;
      discountPercent?: number;
      finalPriceCents: number;
    }> = [];

    if (orderBumps && orderBumps.length > 0) {
      for (const bump of orderBumps) {
        const bumpProduct = await fetchOrderBumpProduct(bump, content.organizationId);
        if (bumpProduct) {
          const finalPrice = bump.discountPercent 
            ? Math.round(bumpProduct.priceInCents * (1 - bump.discountPercent / 100))
            : bumpProduct.priceInCents;
          
          orderBumpTotalCents += finalPrice;
          validatedOrderBumps.push({
            productType: bump.productType,
            productId: bump.productId,
            contentType: bump.contentType,
            name: bumpProduct.name,
            priceInCents: bumpProduct.priceInCents,
            discountPercent: bump.discountPercent,
            finalPriceCents: finalPrice,
          });
        }
      }
      
      console.log(`[CONTENT_PAYMENT_INTENT] Order bumps: ${validatedOrderBumps.length} items, total: $${(orderBumpTotalCents / 100).toFixed(2)}`);
    }

    // Validate and apply discount code if provided
    let discountAmountCents = 0;
    let appliedDiscountCode: DiscountCode | undefined;

    if (discountCodeInput) {
      const subtotalBeforeDiscount = content.priceInCents + orderBumpTotalCents;
      const discountResult = await validateDiscountCode(
        discountCodeInput,
        content.organizationId,
        contentId,
        contentType,
        userId,
        subtotalBeforeDiscount
      );

      if (discountResult.valid && discountResult.discountCode) {
        discountAmountCents = discountResult.discountAmountCents;
        appliedDiscountCode = discountResult.discountCode;
        console.log(`[CONTENT_PAYMENT_INTENT] Applied discount code ${appliedDiscountCode.code}: -$${(discountAmountCents / 100).toFixed(2)}`);
      } else if (discountResult.error) {
        return NextResponse.json({ error: discountResult.error }, { status: 400 });
      }
    }

    // Calculate total amount including order bumps minus discount
    const totalAmount = Math.max(0, content.priceInCents + orderBumpTotalCents - discountAmountCents);

    // Calculate platform fee on total (after discount)
    const platformFeePercent = orgSettings?.platformFeePercent ?? 1;
    const applicationFeeAmount = Math.round(totalAmount * (platformFeePercent / 100));

    // Get or create Stripe customer on the Connected account
    let customerId: string | undefined;
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const connectedCustomerIds = userData?.stripeConnectedCustomerIds || {};

    if (connectedCustomerIds[stripeConnectAccountId]) {
      customerId = connectedCustomerIds[stripeConnectAccountId];
    } else {
      // Create new Stripe customer on the Connected account
      const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || undefined;
      const customer = await stripe.customers.create(
        {
          email,
          name,
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
      // Include order bumps in metadata
      orderBumps: validatedOrderBumps.length > 0 ? JSON.stringify(validatedOrderBumps) : '',
      // Include discount code info
      discountCode: appliedDiscountCode?.code || '',
      discountCodeId: appliedDiscountCode?.id || '',
      discountAmountCents: discountAmountCents.toString(),
    };

    // Build description
    const bumpSuffix = validatedOrderBumps.length > 0 
      ? ` + ${validatedOrderBumps.length} add-on${validatedOrderBumps.length > 1 ? 's' : ''}`
      : '';
    const description = `${content.title} - ${contentType.charAt(0).toUpperCase() + contentType.slice(1)} purchase${bumpSuffix}`;

    // Create payment intent on the Connected account with application fee
    // Using setup_future_usage: 'off_session' to save the payment method for future use
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: totalAmount, // Include order bumps in total
        currency: (content.currency || 'usd').toLowerCase(),
        customer: customerId,
        description,
        metadata,
        application_fee_amount: applicationFeeAmount,
        automatic_payment_methods: {
          enabled: true,
        },
        setup_future_usage: 'off_session', // Save card for future one-click purchases
      },
      { stripeAccount: stripeConnectAccountId }
    );

    console.log(
      `[CONTENT_PAYMENT_INTENT] Created payment intent ${paymentIntent.id} for ${contentType}/${contentId} user ${userId}, total: $${(totalAmount / 100).toFixed(2)} (content: $${(content.priceInCents / 100).toFixed(2)}, bumps: $${(orderBumpTotalCents / 100).toFixed(2)}, discount: -$${(discountAmountCents / 100).toFixed(2)})`
    );

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      connectedAccountId: stripeConnectAccountId,
      priceInCents: content.priceInCents,
      totalAmount,
      orderBumpTotalCents,
      discountAmountCents,
      discountCode: appliedDiscountCode?.code,
      currency: content.currency || 'usd',
    });
  } catch (error) {
    console.error('[CONTENT_PAYMENT_INTENT] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


