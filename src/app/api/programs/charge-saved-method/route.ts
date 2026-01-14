/**
 * Charge Saved Payment Method for Program Enrollment
 *
 * POST /api/programs/charge-saved-method
 *
 * Charges a saved payment method for program enrollment.
 * Falls back to requiring card setup if 3DS is needed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import Stripe from 'stripe';
import type { Program, OrgSettings, OrderBumpConfig } from '@/types';
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

interface ChargeSavedMethodRequest {
  programId: string;
  cohortId?: string;
  paymentMethodId: string;
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

    const body = await request.json() as ChargeSavedMethodRequest;
    const { programId, cohortId, paymentMethodId, joinCommunity = true, startDate, discountCode, orderBumps } = body;

    if (!programId || !paymentMethodId) {
      return NextResponse.json({ error: 'Program ID and Payment Method ID are required' }, { status: 400 });
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
    let discountCodeId: string | null = null;
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
        appliedDiscountCode = discountCode.trim().toUpperCase();
        discountCodeId = discountResult.discountCodeId || null;
      } else if (discountResult.error) {
        return NextResponse.json({ error: discountResult.error }, { status: 400 });
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

    // Free program
    if (totalAmountCents === 0) {
      return NextResponse.json({
        free: true,
        message: 'This is a free program. No payment required.'
      });
    }

    const stripe = getStripe();

    // Get customer ID for this organization
    const customerDoc = await adminDb
      .collection('stripe_customers')
      .where('userId', '==', userId)
      .where('connectedAccountId', '==', orgSettings.stripeConnectAccountId)
      .limit(1)
      .get();

    if (customerDoc.empty) {
      return NextResponse.json({
        requiresAction: true,
        message: 'No saved payment methods found'
      }, { status: 400 });
    }

    const customerId = customerDoc.docs[0].data().customerId;

    // Create and confirm payment intent with saved method
    try {
      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: totalAmountCents,
          currency: program.currency || 'usd',
          customer: customerId,
          payment_method: paymentMethodId,
          off_session: true,
          confirm: true,
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
            discountCodeId: discountCodeId || '',
            discountAmountCents: discountAmountCents.toString(),
            orderBumps: orderBumps ? JSON.stringify(orderBumps) : '',
          },
        },
        {
          stripeAccount: orgSettings.stripeConnectAccountId,
        }
      );

      if (paymentIntent.status === 'succeeded') {
        // Complete the enrollment
        const completeResponse = await fetch(new URL('/api/programs/complete-enrollment', request.url), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || '',
          },
          body: JSON.stringify({
            programId,
            paymentIntentId: paymentIntent.id,
            cohortId,
            joinCommunity,
            startDate,
          }),
        });

        const completeResult = await completeResponse.json();

        if (!completeResponse.ok) {
          throw new Error(completeResult.error || 'Failed to complete enrollment');
        }

        return NextResponse.json({
          success: true,
          ...completeResult,
        });
      } else if (paymentIntent.status === 'requires_action') {
        // Card requires 3DS - tell frontend to use full payment form
        return NextResponse.json({
          requiresAction: true,
          message: 'Additional verification required'
        }, { status: 400 });
      } else {
        throw new Error('Payment failed');
      }
    } catch (stripeError) {
      // If card declined or requires action, return appropriate response
      if (stripeError instanceof Stripe.errors.StripeCardError) {
        return NextResponse.json({
          error: stripeError.message,
        }, { status: 400 });
      }

      // For authentication required errors, fall back to full payment form
      if (stripeError instanceof Stripe.errors.StripeError &&
          stripeError.code === 'authentication_required') {
        return NextResponse.json({
          requiresAction: true,
          message: 'Additional verification required'
        }, { status: 400 });
      }

      throw stripeError;
    }
  } catch (error) {
    console.error('[CHARGE_SAVED_METHOD] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process payment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Validate and apply discount code for programs
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
  discountCodeId?: string;
  error?: string;
}> {
  try {
    const normalizedCode = code.trim().toUpperCase();

    // Find the discount code
    const discountsSnapshot = await adminDb
      .collection('discount_codes')
      .where('organizationId', '==', organizationId)
      .where('code', '==', normalizedCode)
      .limit(1)
      .get();

    if (discountsSnapshot.empty) {
      return { valid: false, finalAmountCents: originalAmountCents, discountAmountCents: 0, error: 'Invalid discount code' };
    }

    const discountDoc = discountsSnapshot.docs[0];
    const discount = discountDoc.data();

    // Check if active
    if (!discount.isActive) {
      return { valid: false, finalAmountCents: originalAmountCents, discountAmountCents: 0, error: 'This discount code is no longer active' };
    }

    // Check start date
    if (discount.startsAt && new Date(discount.startsAt) > new Date()) {
      return { valid: false, finalAmountCents: originalAmountCents, discountAmountCents: 0, error: 'This discount code is not yet active' };
    }

    // Check expiration
    if (discount.expiresAt && new Date(discount.expiresAt) < new Date()) {
      return { valid: false, finalAmountCents: originalAmountCents, discountAmountCents: 0, error: 'This discount code has expired' };
    }

    // Check usage limit
    if (discount.maxUses != null && discount.useCount >= discount.maxUses) {
      return { valid: false, finalAmountCents: originalAmountCents, discountAmountCents: 0, error: 'This discount code has reached its maximum uses' };
    }

    // Check per-user limit
    if (discount.maxUsesPerUser) {
      const userUsages = await adminDb
        .collection('discount_code_usages')
        .where('discountCodeId', '==', discountDoc.id)
        .where('userId', '==', userId)
        .count()
        .get();

      if (userUsages.data().count >= discount.maxUsesPerUser) {
        return { valid: false, finalAmountCents: originalAmountCents, discountAmountCents: 0, error: 'You have already used this discount code the maximum number of times' };
      }
    }

    // Check applicability
    switch (discount.applicableTo) {
      case 'squads':
      case 'content':
        return { valid: false, finalAmountCents: originalAmountCents, discountAmountCents: 0, error: 'This discount code is not valid for programs' };

      case 'programs':
        if (discount.programIds?.length && !discount.programIds.includes(programId)) {
          return { valid: false, finalAmountCents: originalAmountCents, discountAmountCents: 0, error: 'This discount code is not valid for this program' };
        }
        break;

      case 'custom':
        const hasProgramRestrictions = discount.programIds && discount.programIds.length > 0;
        const hasSquadRestrictions = discount.squadIds && discount.squadIds.length > 0;
        const hasContentRestrictions = discount.contentIds && discount.contentIds.length > 0;

        if ((hasSquadRestrictions || hasContentRestrictions) && !hasProgramRestrictions) {
          return { valid: false, finalAmountCents: originalAmountCents, discountAmountCents: 0, error: 'This discount code is not valid for programs' };
        }

        if (hasProgramRestrictions && !discount.programIds.includes(programId)) {
          return { valid: false, finalAmountCents: originalAmountCents, discountAmountCents: 0, error: 'This discount code is not valid for this program' };
        }
        break;

      case 'all':
        break;

      default:
        // Legacy support
        if (discount.applicableProducts && discount.applicableProducts.length > 0) {
          if (!discount.applicableProducts.includes(programId)) {
            return { valid: false, finalAmountCents: originalAmountCents, discountAmountCents: 0, error: 'This discount code is not valid for this program' };
          }
        }
    }

    // Calculate discount
    let discountAmountCents = 0;
    if (discount.type === 'percentage' || discount.discountType === 'percentage') {
      const value = discount.value ?? discount.discountValue ?? 0;
      discountAmountCents = Math.round(originalAmountCents * (value / 100));
    } else {
      const value = discount.value ?? discount.discountValue ?? 0;
      discountAmountCents = Math.min(value, originalAmountCents);
    }

    const finalAmountCents = Math.max(0, originalAmountCents - discountAmountCents);

    return {
      valid: true,
      finalAmountCents,
      discountAmountCents,
      discountCodeId: discountDoc.id,
    };
  } catch (error) {
    console.error('[VALIDATE_DISCOUNT] Error:', error);
    return { valid: false, finalAmountCents: originalAmountCents, discountAmountCents: 0, error: 'Failed to validate discount' };
  }
}
