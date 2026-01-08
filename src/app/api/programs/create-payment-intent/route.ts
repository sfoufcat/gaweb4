/**
 * Create Payment Intent for Program Enrollment
 *
 * POST /api/programs/create-payment-intent
 *
 * Creates a Stripe PaymentIntent for embedded checkout in the modal.
 * Returns clientSecret for Stripe Elements.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import Stripe from 'stripe';
import type { Program, ProgramCohort, OrgSettings, OrderBumpConfig } from '@/types';
import { checkExistingEnrollment } from '@/lib/enrollment-check';

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' });
}

interface OrderBumpSelection {
  productType: 'content';
  productId: string;
  contentType?: string;
  discountPercent?: number;
}

interface CreatePaymentIntentRequest {
  programId: string;
  cohortId?: string;
  joinCommunity?: boolean;
  startDate?: string;
  discountCode?: string;
  orderBumps?: OrderBumpSelection[];
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as CreatePaymentIntentRequest;
    const { programId, cohortId, joinCommunity = true, startDate, discountCode, orderBumps } = body;

    if (!programId) {
      return NextResponse.json({ error: 'Program ID is required' }, { status: 400 });
    }

    // Get program
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }
    const program = { id: programDoc.id, ...programDoc.data() } as Program & { orderBumps?: OrderBumpConfig };

    // Check for existing enrollment
    const enrollmentCheck = await checkExistingEnrollment(userId, programId, cohortId || null);
    if (enrollmentCheck.exists && !enrollmentCheck.allowReEnrollment) {
      return NextResponse.json({
        error: enrollmentCheck.reason || 'You are already enrolled in this program'
      }, { status: 400 });
    }

    // Validate cohort for group programs
    let cohort: ProgramCohort | null = null;
    if (program.type === 'group') {
      if (!cohortId) {
        return NextResponse.json({ error: 'Cohort selection required for group programs' }, { status: 400 });
      }

      const cohortDoc = await adminDb.collection('program_cohorts').doc(cohortId).get();
      if (!cohortDoc.exists) {
        return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
      }
      cohort = { id: cohortDoc.id, ...cohortDoc.data() } as ProgramCohort;

      // Check cohort capacity
      if (cohort.maxEnrollment && cohort.currentEnrollment >= cohort.maxEnrollment) {
        return NextResponse.json({ error: 'This cohort is full' }, { status: 400 });
      }
    }

    // Get org settings for Stripe Connect
    const orgSettingsDoc = await adminDb.collection('org_settings').doc(program.organizationId).get();
    const orgSettings = orgSettingsDoc.data() as OrgSettings | undefined;

    if (!orgSettings?.stripeConnectAccountId) {
      return NextResponse.json({ error: 'Payment not configured for this organization' }, { status: 400 });
    }

    // Calculate final price
    let finalPriceCents = program.priceInCents;
    let discountAmountCents = 0;
    let appliedDiscountCode: string | null = null;

    // Apply discount code if provided
    if (discountCode) {
      const discountResult = await validateAndApplyDiscount(
        discountCode,
        program.priceInCents,
        program.organizationId,
        programId,
        userId
      );

      if (discountResult.valid) {
        finalPriceCents = discountResult.finalAmountCents;
        discountAmountCents = discountResult.discountAmountCents;
        appliedDiscountCode = discountCode;
      }
    }

    // Calculate order bumps total
    let orderBumpTotal = 0;
    if (orderBumps && orderBumps.length > 0 && program.orderBumps?.enabled) {
      for (const bump of orderBumps) {
        const configuredBump = program.orderBumps.bumps.find(b => b.productId === bump.productId);
        if (configuredBump) {
          const originalPrice = configuredBump.priceInCents || 0;
          const discount = configuredBump.discountPercent || 0;
          const bumpPrice = Math.round(originalPrice * (1 - discount / 100));
          orderBumpTotal += bumpPrice;
        }
      }
    }

    const totalAmountCents = finalPriceCents + orderBumpTotal;

    // Free program - no payment needed
    if (totalAmountCents === 0) {
      return NextResponse.json({
        free: true,
        message: 'This is a free program. No payment required.'
      });
    }

    const stripe = getStripe();

    // Get user info from Clerk for customer creation
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || undefined;

    // Get or create Stripe customer on the Connected account
    let customerId: string | undefined;
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const connectedCustomerIds = userData?.stripeConnectedCustomerIds || {};

    if (connectedCustomerIds[orgSettings.stripeConnectAccountId]) {
      customerId = connectedCustomerIds[orgSettings.stripeConnectAccountId];
    } else {
      // Create new Stripe customer on the Connected account
      const customer = await stripe.customers.create(
        {
          email,
          name,
          metadata: {
            userId,
            platformUserId: userId,
          },
        },
        { stripeAccount: orgSettings.stripeConnectAccountId }
      );
      customerId = customer.id;

      // Save customer ID for this connected account
      await adminDb.collection('users').doc(userId).set(
        {
          stripeConnectedCustomerIds: {
            ...connectedCustomerIds,
            [orgSettings.stripeConnectAccountId]: customerId,
          },
        },
        { merge: true }
      );
    }

    // Create PaymentIntent on the connected account
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: totalAmountCents,
        currency: program.currency || 'usd',
        customer: customerId,
        setup_future_usage: 'off_session',
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          type: 'program_enrollment',
          userId,
          programId,
          programName: program.name,
          cohortId: cohortId || '',
          organizationId: program.organizationId,
          joinCommunity: joinCommunity.toString(),
          startDate: startDate || '',
          discountCode: appliedDiscountCode || '',
          discountAmountCents: discountAmountCents.toString(),
          orderBumps: orderBumps ? JSON.stringify(orderBumps) : '',
        },
      },
      {
        stripeAccount: orgSettings.stripeConnectAccountId,
      }
    );

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      connectedAccountId: orgSettings.stripeConnectAccountId,
      paymentIntentId: paymentIntent.id,
      amount: totalAmountCents,
      currency: program.currency || 'usd',
      programName: program.name,
      cohortName: cohort?.name,
    });
  } catch (error) {
    console.error('[CREATE_PAYMENT_INTENT] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create payment intent';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Validate and apply discount code
 */
async function validateAndApplyDiscount(
  code: string,
  originalAmountCents: number,
  organizationId: string,
  programId: string,
  userId: string
): Promise<{
  valid: boolean;
  finalAmountCents: number;
  discountAmountCents: number;
  error?: string;
}> {
  try {
    // Find the discount code
    const discountsSnapshot = await adminDb
      .collection('discount_codes')
      .where('organizationId', '==', organizationId)
      .where('code', '==', code.toUpperCase())
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (discountsSnapshot.empty) {
      return { valid: false, finalAmountCents: originalAmountCents, discountAmountCents: 0, error: 'Invalid discount code' };
    }

    const discountDoc = discountsSnapshot.docs[0];
    const discount = discountDoc.data();

    // Check expiration
    if (discount.expiresAt && new Date(discount.expiresAt) < new Date()) {
      return { valid: false, finalAmountCents: originalAmountCents, discountAmountCents: 0, error: 'Discount code has expired' };
    }

    // Check usage limit
    if (discount.maxUses && discount.useCount >= discount.maxUses) {
      return { valid: false, finalAmountCents: originalAmountCents, discountAmountCents: 0, error: 'Discount code usage limit reached' };
    }

    // Check if it applies to this program
    if (discount.applicableProducts && discount.applicableProducts.length > 0) {
      if (!discount.applicableProducts.includes(programId)) {
        return { valid: false, finalAmountCents: originalAmountCents, discountAmountCents: 0, error: 'Discount code not valid for this program' };
      }
    }

    // Calculate discount
    let discountAmountCents = 0;
    if (discount.discountType === 'percentage') {
      discountAmountCents = Math.round(originalAmountCents * (discount.discountValue / 100));
    } else {
      discountAmountCents = Math.min(discount.discountValue, originalAmountCents);
    }

    const finalAmountCents = Math.max(0, originalAmountCents - discountAmountCents);

    return { valid: true, finalAmountCents, discountAmountCents };
  } catch (error) {
    console.error('[VALIDATE_DISCOUNT] Error:', error);
    return { valid: false, finalAmountCents: originalAmountCents, discountAmountCents: 0, error: 'Failed to validate discount' };
  }
}
