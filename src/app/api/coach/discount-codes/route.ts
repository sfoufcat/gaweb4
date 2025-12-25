/**
 * Coach API: Discount Codes Management
 * 
 * GET /api/coach/discount-codes - List all discount codes for the organization
 * POST /api/coach/discount-codes - Create a new discount code
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { DiscountCode } from '@/types';

/**
 * GET - List all discount codes
 */
export async function GET(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { searchParams } = new URL(request.url);
    
    // Optional filters
    const activeOnly = searchParams.get('active') === 'true';
    const applicableTo = searchParams.get('applicableTo');

    // Build query
    let query = adminDb
      .collection('discount_codes')
      .where('organizationId', '==', organizationId);

    if (activeOnly) {
      query = query.where('isActive', '==', true);
    }

    if (applicableTo && ['all', 'programs', 'squads'].includes(applicableTo)) {
      query = query.where('applicableTo', '==', applicableTo);
    }

    const snapshot = await query.orderBy('createdAt', 'desc').get();

    const discountCodes: DiscountCode[] = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt,
      } as DiscountCode;
    });

    return NextResponse.json({ 
      discountCodes,
      totalCount: discountCodes.length,
    });
  } catch (error) {
    console.error('[COACH_DISCOUNT_CODES_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch discount codes' }, { status: 500 });
  }
}

/**
 * POST - Create a new discount code
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, organizationId } = await requireCoachWithOrg();
    const body = await request.json();

    // Validate required fields
    if (!body.code?.trim()) {
      return NextResponse.json({ error: 'Discount code is required' }, { status: 400 });
    }
    if (!body.type || !['percentage', 'fixed'].includes(body.type)) {
      return NextResponse.json({ error: 'Valid discount type is required (percentage or fixed)' }, { status: 400 });
    }
    if (body.value === undefined || body.value < 0) {
      return NextResponse.json({ error: 'Valid discount value is required' }, { status: 400 });
    }
    if (body.type === 'percentage' && body.value > 100) {
      return NextResponse.json({ error: 'Percentage discount cannot exceed 100%' }, { status: 400 });
    }

    // Normalize code (uppercase, no spaces)
    const code = body.code.trim().toUpperCase().replace(/\s+/g, '');
    
    // Check for duplicate codes in the organization
    const existingCode = await adminDb
      .collection('discount_codes')
      .where('organizationId', '==', organizationId)
      .where('code', '==', code)
      .limit(1)
      .get();

    if (!existingCode.empty) {
      return NextResponse.json(
        { error: `Discount code "${code}" already exists` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const discountCodeData: Omit<DiscountCode, 'id'> = {
      organizationId,
      code,
      name: body.name?.trim() || undefined,
      type: body.type,
      value: Number(body.value),
      applicableTo: body.applicableTo || 'all',
      programIds: body.programIds || undefined,
      squadIds: body.squadIds || undefined,
      maxUses: body.maxUses || null,
      useCount: 0,
      maxUsesPerUser: body.maxUsesPerUser || null,
      startsAt: body.startsAt || null,
      expiresAt: body.expiresAt || null,
      isActive: body.isActive !== false,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await adminDb.collection('discount_codes').add(discountCodeData);

    console.log(`[COACH_DISCOUNT_CODES_POST] Created discount code: ${code} (${docRef.id}) for org ${organizationId}`);

    return NextResponse.json({ 
      success: true, 
      id: docRef.id,
      discountCode: { 
        id: docRef.id, 
        ...discountCodeData,
      },
      message: 'Discount code created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('[COACH_DISCOUNT_CODES_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to create discount code' }, { status: 500 });
  }
}

