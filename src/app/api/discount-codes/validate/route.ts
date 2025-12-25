/**
 * Public API: Validate Discount Code
 * 
 * POST /api/discount-codes/validate - Validate a discount code for checkout
 * 
 * This is a public endpoint (no auth required) that validates a discount code
 * and returns the discount details if valid.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { DiscountCode, OrgSettings } from '@/types';

interface ValidateRequest {
  code: string;
  organizationId: string;
  programId?: string;
  squadId?: string;
  originalAmountCents: number;
}

interface ValidateResponse {
  valid: boolean;
  discountCode?: DiscountCode;
  discountAmountCents?: number;
  finalAmountCents?: number;
  error?: string;
  isAlumniDiscount?: boolean;
}

/**
 * POST - Validate discount code and calculate discount
 */
export async function POST(request: NextRequest) {
  try {
    const body: ValidateRequest = await request.json();
    const { userId } = await auth();

    const { code, organizationId, programId, squadId, originalAmountCents } = body;

    if (!code?.trim()) {
      return NextResponse.json<ValidateResponse>({ 
        valid: false, 
        error: 'Discount code is required',
      });
    }

    if (!organizationId) {
      return NextResponse.json<ValidateResponse>({ 
        valid: false, 
        error: 'Organization is required',
      });
    }

    if (originalAmountCents === undefined || originalAmountCents < 0) {
      return NextResponse.json<ValidateResponse>({ 
        valid: false, 
        error: 'Valid amount is required',
      });
    }

    // Normalize code
    const normalizedCode = code.trim().toUpperCase();

    // Check for alumni auto-discount first (if user is authenticated)
    if (userId && normalizedCode === 'ALUMNI') {
      const alumniResult = await checkAlumniDiscount(userId, organizationId, originalAmountCents);
      if (alumniResult) {
        return NextResponse.json<ValidateResponse>(alumniResult);
      }
    }

    // Look up the discount code
    const codeSnapshot = await adminDb
      .collection('discount_codes')
      .where('organizationId', '==', organizationId)
      .where('code', '==', normalizedCode)
      .limit(1)
      .get();

    if (codeSnapshot.empty) {
      return NextResponse.json<ValidateResponse>({ 
        valid: false, 
        error: 'Invalid discount code',
      });
    }

    const codeDoc = codeSnapshot.docs[0];
    const discountCode = {
      id: codeDoc.id,
      ...codeDoc.data(),
      createdAt: codeDoc.data().createdAt?.toDate?.()?.toISOString?.() || codeDoc.data().createdAt,
      updatedAt: codeDoc.data().updatedAt?.toDate?.()?.toISOString?.() || codeDoc.data().updatedAt,
    } as DiscountCode;

    // Validate the code
    const validationError = await validateDiscountCode(discountCode, userId, programId, squadId);
    if (validationError) {
      return NextResponse.json<ValidateResponse>({ 
        valid: false, 
        error: validationError,
      });
    }

    // Calculate discount
    const discountAmountCents = calculateDiscount(discountCode, originalAmountCents);
    const finalAmountCents = Math.max(0, originalAmountCents - discountAmountCents);

    return NextResponse.json<ValidateResponse>({
      valid: true,
      discountCode,
      discountAmountCents,
      finalAmountCents,
    });
  } catch (error) {
    console.error('[DISCOUNT_VALIDATE] Error:', error);
    return NextResponse.json<ValidateResponse>({ 
      valid: false, 
      error: 'Failed to validate discount code',
    });
  }
}

/**
 * Check if user qualifies for alumni discount
 */
async function checkAlumniDiscount(
  userId: string,
  organizationId: string,
  originalAmountCents: number
): Promise<ValidateResponse | null> {
  // Get org settings
  const orgSettingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
  if (!orgSettingsDoc.exists) {
    return null;
  }

  const orgSettings = orgSettingsDoc.data() as OrgSettings;
  if (!orgSettings.alumniDiscountEnabled || !orgSettings.alumniDiscountValue) {
    return { valid: false, error: 'Alumni discount is not available' };
  }

  // Check if user is alumni
  const userDoc = await adminDb.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    return { valid: false, error: 'User not found' };
  }

  const userData = userDoc.data();
  if (!userData?.isAlumni) {
    return { valid: false, error: 'Alumni discount is only available to program alumni' };
  }

  // Calculate discount
  let discountAmountCents: number;
  if (orgSettings.alumniDiscountType === 'percentage') {
    discountAmountCents = Math.round(originalAmountCents * (orgSettings.alumniDiscountValue / 100));
  } else {
    discountAmountCents = orgSettings.alumniDiscountValue;
  }

  const finalAmountCents = Math.max(0, originalAmountCents - discountAmountCents);

  return {
    valid: true,
    discountAmountCents,
    finalAmountCents,
    isAlumniDiscount: true,
  };
}

/**
 * Validate discount code constraints
 */
async function validateDiscountCode(
  code: DiscountCode,
  userId: string | null,
  programId?: string,
  squadId?: string
): Promise<string | null> {
  // Check if active
  if (!code.isActive) {
    return 'This discount code is no longer active';
  }

  // Check start date
  if (code.startsAt && new Date(code.startsAt) > new Date()) {
    return 'This discount code is not yet active';
  }

  // Check expiration
  if (code.expiresAt && new Date(code.expiresAt) < new Date()) {
    return 'This discount code has expired';
  }

  // Check max uses
  if (code.maxUses != null && code.useCount >= code.maxUses) {
    return 'This discount code has reached its maximum uses';
  }

  // Check per-user limit
  if (userId && code.maxUsesPerUser) {
    const userUsages = await adminDb
      .collection('discount_code_usages')
      .where('discountCodeId', '==', code.id)
      .where('userId', '==', userId)
      .count()
      .get();

    if (userUsages.data().count >= code.maxUsesPerUser) {
      return 'You have already used this discount code the maximum number of times';
    }
  }

  // Check applicability
  if (code.applicableTo === 'programs' && !programId) {
    return 'This discount code is only valid for programs';
  }
  if (code.applicableTo === 'squads' && !squadId) {
    return 'This discount code is only valid for squads';
  }

  // Check specific program/squad restrictions
  if (programId && code.programIds?.length && !code.programIds.includes(programId)) {
    return 'This discount code is not valid for this program';
  }
  if (squadId && code.squadIds?.length && !code.squadIds.includes(squadId)) {
    return 'This discount code is not valid for this squad';
  }

  return null;
}

/**
 * Calculate discount amount in cents
 */
function calculateDiscount(code: DiscountCode, originalAmountCents: number): number {
  if (code.type === 'percentage') {
    return Math.round(originalAmountCents * (code.value / 100));
  } else {
    // Fixed amount - cannot exceed original amount
    return Math.min(code.value, originalAmountCents);
  }
}

