import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { OrgSettings, UpsellProductType, Program, Squad } from '@/types';

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
 * POST /api/funnel/create-upsell-price
 * Create or retrieve a Stripe Price (and optionally a Coupon) for an upsell/downsell step
 * 
 * Body:
 * - productType: 'program' | 'squad' | 'course' | 'content'
 * - productId: string
 * - priceInCents: number (the final price after discount)
 * - originalPriceInCents: number (the original price before discount)
 * - discountType: 'none' | 'percent' | 'fixed'
 * - discountValue?: number (percent 0-100 or cents)
 * - isRecurring: boolean
 * - recurringInterval?: 'month' | 'year'
 */
export async function POST(req: Request) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body = await req.json();
    const { 
      productType,
      productId,
      priceInCents,
      originalPriceInCents,
      discountType,
      discountValue,
      isRecurring,
      recurringInterval = 'month',
    } = body as {
      productType: UpsellProductType;
      productId: string;
      priceInCents: number;
      originalPriceInCents: number;
      discountType: 'none' | 'percent' | 'fixed';
      discountValue?: number;
      isRecurring: boolean;
      recurringInterval?: 'month' | 'year';
    };

    if (!productType || !productId || priceInCents === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get organization settings for Stripe Connect
    const orgSettingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
    const orgSettings = orgSettingsDoc.data() as OrgSettings | undefined;

    const stripeConnectAccountId = orgSettings?.stripeConnectAccountId;
    if (!stripeConnectAccountId) {
      return NextResponse.json(
        { error: 'Stripe Connect not configured. Please connect your Stripe account first.' },
        { status: 400 }
      );
    }

    // Get product details
    let productName = '';
    let productImageUrl: string | undefined;
    
    if (productType === 'program') {
      const programDoc = await adminDb.collection('programs').doc(productId).get();
      if (!programDoc.exists) {
        return NextResponse.json({ error: 'Program not found' }, { status: 404 });
      }
      const program = programDoc.data() as Program;
      
      // Verify program belongs to this organization
      if (program.organizationId !== organizationId) {
        return NextResponse.json({ error: 'Program does not belong to your organization' }, { status: 403 });
      }
      
      productName = program.name;
      productImageUrl = program.coverImageUrl;
    } else if (productType === 'squad') {
      const squadDoc = await adminDb.collection('squads').doc(productId).get();
      if (!squadDoc.exists) {
        return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
      }
      const squad = squadDoc.data() as Squad;
      
      // Verify squad belongs to this organization
      if (squad.organizationId !== organizationId) {
        return NextResponse.json({ error: 'Squad does not belong to your organization' }, { status: 403 });
      }
      
      productName = squad.name;
      productImageUrl = squad.avatarUrl;
    } else {
      // For future product types, just use generic name
      productName = `${productType} - ${productId}`;
    }

    const stripe = getStripe();

    // Find or create Stripe Product on the Connected account
    const stripeProductId = `upsell_${productType}_${productId}`;
    
    let stripeProduct: Stripe.Product;
    try {
      stripeProduct = await stripe.products.retrieve(
        stripeProductId,
        { stripeAccount: stripeConnectAccountId }
      );
    } catch {
      // Product doesn't exist, create it
      stripeProduct = await stripe.products.create(
        {
          id: stripeProductId,
          name: productName,
          ...(productImageUrl && { images: [productImageUrl] }),
          metadata: {
            productType,
            productId,
            organizationId,
          },
        },
        { stripeAccount: stripeConnectAccountId }
      );
    }

    // Create Price on the Connected account
    // For discounted prices, we create a price for the original amount and a coupon
    // This allows showing the original price with a strikethrough
    const priceToCreate = discountType !== 'none' ? originalPriceInCents : priceInCents;
    
    const priceData: Stripe.PriceCreateParams = {
      product: stripeProduct.id,
      currency: 'usd',
      metadata: {
        productType,
        productId,
        organizationId,
        isUpsellPrice: 'true',
      },
    };

    if (isRecurring) {
      priceData.recurring = {
        interval: recurringInterval,
      };
      priceData.unit_amount = priceToCreate;
    } else {
      priceData.unit_amount = priceToCreate;
    }

    const stripePrice = await stripe.prices.create(
      priceData,
      { stripeAccount: stripeConnectAccountId }
    );

    // Create coupon if discounted
    let stripeCouponId: string | undefined;
    
    if (discountType !== 'none' && discountValue) {
      const couponData: Stripe.CouponCreateParams = {
        metadata: {
          productType,
          productId,
          organizationId,
          isUpsellCoupon: 'true',
        },
      };

      if (discountType === 'percent') {
        couponData.percent_off = discountValue;
      } else if (discountType === 'fixed') {
        couponData.amount_off = discountValue;
        couponData.currency = 'usd';
      }

      // For one-time coupons
      if (!isRecurring) {
        couponData.duration = 'once';
      } else {
        // For recurring, apply to first payment only
        couponData.duration = 'once';
      }

      const stripeCoupon = await stripe.coupons.create(
        couponData,
        { stripeAccount: stripeConnectAccountId }
      );
      
      stripeCouponId = stripeCoupon.id;
    }

    console.log(`[CREATE_UPSELL_PRICE] Created price ${stripePrice.id} for ${productType} ${productId} (coupon: ${stripeCouponId || 'none'})`);

    return NextResponse.json({
      success: true,
      stripePriceId: stripePrice.id,
      stripeCouponId,
      stripeProductId: stripeProduct.id,
      productName,
      productImageUrl,
    });

  } catch (error) {
    console.error('[CREATE_UPSELL_PRICE_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to create Stripe price' },
      { status: 500 }
    );
  }
}

