/**
 * Coach API: Single Discount Code Management
 * 
 * GET /api/coach/discount-codes/[codeId] - Get discount code details with usage stats
 * PATCH /api/coach/discount-codes/[codeId] - Update discount code
 * DELETE /api/coach/discount-codes/[codeId] - Delete discount code
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { DiscountCode, DiscountCodeUsage } from '@/types';

/**
 * GET - Get discount code details with usage stats
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ codeId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { codeId } = await params;

    // Get discount code
    const codeDoc = await adminDb.collection('discount_codes').doc(codeId).get();
    if (!codeDoc.exists) {
      return NextResponse.json({ error: 'Discount code not found' }, { status: 404 });
    }

    const codeData = codeDoc.data();
    if (codeData?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Discount code not found in your organization' }, { status: 404 });
    }

    const discountCode: DiscountCode = {
      id: codeDoc.id,
      ...codeData,
      createdAt: codeData.createdAt?.toDate?.()?.toISOString?.() || codeData.createdAt,
      updatedAt: codeData.updatedAt?.toDate?.()?.toISOString?.() || codeData.updatedAt,
    } as DiscountCode;

    // Get usage history
    const usagesSnapshot = await adminDb
      .collection('discount_code_usages')
      .where('discountCodeId', '==', codeId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const usages: DiscountCodeUsage[] = usagesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
    } as DiscountCodeUsage));

    // Calculate stats
    const totalDiscountGiven = usages.reduce((sum, u) => sum + u.discountAmountCents, 0);

    return NextResponse.json({ 
      discountCode,
      usages,
      stats: {
        totalRedemptions: discountCode.useCount,
        totalDiscountGiven,
        recentUsages: usages.length,
      },
    });
  } catch (error) {
    console.error('[COACH_DISCOUNT_CODE_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch discount code' }, { status: 500 });
  }
}

/**
 * PATCH - Update discount code
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ codeId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { codeId } = await params;
    const body = await request.json();

    // Get discount code
    const codeDoc = await adminDb.collection('discount_codes').doc(codeId).get();
    if (!codeDoc.exists) {
      return NextResponse.json({ error: 'Discount code not found' }, { status: 404 });
    }

    const codeData = codeDoc.data();
    if (codeData?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Discount code not found in your organization' }, { status: 404 });
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    // Name update
    if (body.name !== undefined) {
      updateData.name = body.name?.trim() || null;
    }

    // Value update (only if code hasn't been used)
    if (body.value !== undefined) {
      if (codeData.useCount > 0) {
        return NextResponse.json(
          { error: 'Cannot change discount value after code has been used' },
          { status: 400 }
        );
      }
      if (body.value < 0) {
        return NextResponse.json({ error: 'Value must be positive' }, { status: 400 });
      }
      if (codeData.type === 'percentage' && body.value > 100) {
        return NextResponse.json({ error: 'Percentage cannot exceed 100%' }, { status: 400 });
      }
      updateData.value = Number(body.value);
    }

    // Applicability updates
    if (body.applicableTo !== undefined) {
      if (!['all', 'programs', 'squads'].includes(body.applicableTo)) {
        return NextResponse.json({ error: 'Invalid applicableTo value' }, { status: 400 });
      }
      updateData.applicableTo = body.applicableTo;
    }
    if (body.programIds !== undefined) {
      updateData.programIds = body.programIds || null;
    }
    if (body.squadIds !== undefined) {
      updateData.squadIds = body.squadIds || null;
    }

    // Limits
    if (body.maxUses !== undefined) {
      updateData.maxUses = body.maxUses || null;
    }
    if (body.maxUsesPerUser !== undefined) {
      updateData.maxUsesPerUser = body.maxUsesPerUser || null;
    }

    // Validity period
    if (body.startsAt !== undefined) {
      updateData.startsAt = body.startsAt || null;
    }
    if (body.expiresAt !== undefined) {
      updateData.expiresAt = body.expiresAt || null;
    }

    // Status
    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive === true;
    }

    await adminDb.collection('discount_codes').doc(codeId).update(updateData);

    console.log(`[COACH_DISCOUNT_CODE_PATCH] Updated discount code: ${codeId}`);

    // Fetch updated code
    const updatedDoc = await adminDb.collection('discount_codes').doc(codeId).get();
    const updatedData = updatedDoc.data();
    const discountCode = {
      id: updatedDoc.id,
      ...updatedData,
      createdAt: updatedData?.createdAt?.toDate?.()?.toISOString?.() || updatedData?.createdAt,
      updatedAt: updatedData?.updatedAt,
    } as DiscountCode;

    return NextResponse.json({ 
      success: true, 
      discountCode,
      message: 'Discount code updated successfully',
    });
  } catch (error) {
    console.error('[COACH_DISCOUNT_CODE_PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to update discount code' }, { status: 500 });
  }
}

/**
 * DELETE - Delete discount code
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ codeId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { codeId } = await params;

    // Get discount code
    const codeDoc = await adminDb.collection('discount_codes').doc(codeId).get();
    if (!codeDoc.exists) {
      return NextResponse.json({ error: 'Discount code not found' }, { status: 404 });
    }

    const codeData = codeDoc.data();
    if (codeData?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Discount code not found in your organization' }, { status: 404 });
    }

    // Delete the code (keep usage history for analytics)
    await adminDb.collection('discount_codes').doc(codeId).delete();

    console.log(`[COACH_DISCOUNT_CODE_DELETE] Deleted discount code: ${codeId} (${codeData.code})`);

    return NextResponse.json({ 
      success: true, 
      message: 'Discount code deleted successfully',
    });
  } catch (error) {
    console.error('[COACH_DISCOUNT_CODE_DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to delete discount code' }, { status: 500 });
  }
}

