import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { OrgSettings } from '@/types';

/**
 * GET /api/org/settings
 * Get organization settings for the current user's org
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get org from tenant context
    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization context' }, { status: 400 });
    }

    // Fetch org settings
    const settingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
    
    if (!settingsDoc.exists) {
      return NextResponse.json({ settings: null }, { status: 200 });
    }

    const settings = { id: settingsDoc.id, ...settingsDoc.data() } as OrgSettings;

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('[ORG_SETTINGS_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/org/settings
 * Update organization settings (coach only)
 */
export async function PATCH(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const body = await request.json();

    // Build update object with allowed fields
    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    // Alumni & Community settings
    if (body.defaultConvertToCommunity !== undefined) {
      updateData.defaultConvertToCommunity = body.defaultConvertToCommunity === true;
    }
    if (body.alumniDiscountEnabled !== undefined) {
      updateData.alumniDiscountEnabled = body.alumniDiscountEnabled === true;
    }
    if (body.alumniDiscountType !== undefined) {
      if (!['percentage', 'fixed'].includes(body.alumniDiscountType)) {
        return NextResponse.json({ error: 'Invalid discount type' }, { status: 400 });
      }
      updateData.alumniDiscountType = body.alumniDiscountType;
    }
    if (body.alumniDiscountValue !== undefined) {
      const value = Number(body.alumniDiscountValue);
      if (isNaN(value) || value < 0) {
        return NextResponse.json({ error: 'Invalid discount value' }, { status: 400 });
      }
      updateData.alumniDiscountValue = value;
    }

    // Feed settings
    if (body.feedEnabled !== undefined) {
      updateData.feedEnabled = body.feedEnabled === true;
    }

    // Check if settings doc exists
    const settingsRef = adminDb.collection('org_settings').doc(organizationId);
    const settingsDoc = await settingsRef.get();

    if (settingsDoc.exists) {
      await settingsRef.update(updateData);
    } else {
      // Create settings doc if it doesn't exist
      await settingsRef.set({
        id: organizationId,
        organizationId,
        createdAt: new Date().toISOString(),
        ...updateData,
      });
    }

    // Fetch updated settings
    const updatedDoc = await settingsRef.get();
    const settings = { id: updatedDoc.id, ...updatedDoc.data() } as OrgSettings;

    console.log(`[ORG_SETTINGS_PATCH] Updated settings for org ${organizationId}`);

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('[ORG_SETTINGS_PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}

