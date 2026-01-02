import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { CoachCallSettings, CallPricingModel } from '@/types';

/**
 * GET /api/coach/call-settings
 * Get the coach's call pricing and request settings
 */
export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();

    // Get call settings from organization document or dedicated collection
    const orgDoc = await adminDb.collection('organizations').doc(organizationId).get();
    
    if (!orgDoc.exists) {
      // Return default settings
      const defaultSettings: CoachCallSettings = {
        allowClientRequests: true,
        pricingModel: 'free',
        notifyOnRequest: true,
        autoDeclineIfNoResponse: false,
      };
      return NextResponse.json({ settings: defaultSettings, isDefault: true });
    }

    const orgData = orgDoc.data();
    const callSettings = orgData?.callSettings as CoachCallSettings | undefined;

    if (!callSettings) {
      // Return default settings
      const defaultSettings: CoachCallSettings = {
        allowClientRequests: true,
        pricingModel: 'free',
        notifyOnRequest: true,
        autoDeclineIfNoResponse: false,
      };
      return NextResponse.json({ settings: defaultSettings, isDefault: true });
    }

    return NextResponse.json({ settings: callSettings, isDefault: false });
  } catch (error) {
    console.error('[CALL_SETTINGS_GET] Error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/coach/call-settings
 * Update the coach's call pricing and request settings
 */
export async function PUT(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const body = await request.json();

    const {
      allowClientRequests,
      pricingModel,
      pricePerCallCents,
      creditsIncludedMonthly,
      callRequestButtonLabel,
      callRequestDescription,
      notifyOnRequest,
      autoDeclineIfNoResponse,
      autoDeclineDays,
    } = body;

    // Validate pricingModel if provided
    if (pricingModel) {
      const validModels: CallPricingModel[] = ['free', 'per_call', 'credits', 'both'];
      if (!validModels.includes(pricingModel)) {
        return NextResponse.json(
          { error: `Invalid pricing model. Must be one of: ${validModels.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate price if per_call or both pricing
    if ((pricingModel === 'per_call' || pricingModel === 'both') && pricePerCallCents !== undefined) {
      if (typeof pricePerCallCents !== 'number' || pricePerCallCents < 0) {
        return NextResponse.json(
          { error: 'Price per call must be a non-negative number' },
          { status: 400 }
        );
      }
    }

    // Validate credits if credits or both pricing
    if ((pricingModel === 'credits' || pricingModel === 'both') && creditsIncludedMonthly !== undefined) {
      if (typeof creditsIncludedMonthly !== 'number' || creditsIncludedMonthly < 0) {
        return NextResponse.json(
          { error: 'Credits included monthly must be a non-negative number' },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updateData: Partial<CoachCallSettings> = {};
    
    if (allowClientRequests !== undefined) updateData.allowClientRequests = allowClientRequests;
    if (pricingModel !== undefined) updateData.pricingModel = pricingModel;
    if (pricePerCallCents !== undefined) updateData.pricePerCallCents = pricePerCallCents;
    if (creditsIncludedMonthly !== undefined) updateData.creditsIncludedMonthly = creditsIncludedMonthly;
    if (callRequestButtonLabel !== undefined) updateData.callRequestButtonLabel = callRequestButtonLabel;
    if (callRequestDescription !== undefined) updateData.callRequestDescription = callRequestDescription;
    if (notifyOnRequest !== undefined) updateData.notifyOnRequest = notifyOnRequest;
    if (autoDeclineIfNoResponse !== undefined) updateData.autoDeclineIfNoResponse = autoDeclineIfNoResponse;
    if (autoDeclineDays !== undefined) updateData.autoDeclineDays = autoDeclineDays;

    const orgRef = adminDb.collection('organizations').doc(organizationId);
    const orgDoc = await orgRef.get();

    if (orgDoc.exists) {
      // Update existing call settings
      const existingSettings = orgDoc.data()?.callSettings || {};
      await orgRef.update({
        callSettings: { ...existingSettings, ...updateData },
        updatedAt: new Date().toISOString(),
      });
    } else {
      // Create org document with call settings (shouldn't happen normally)
      await orgRef.set({
        id: organizationId,
        callSettings: {
          allowClientRequests: allowClientRequests ?? true,
          pricingModel: pricingModel ?? 'free',
          notifyOnRequest: notifyOnRequest ?? true,
          autoDeclineIfNoResponse: autoDeclineIfNoResponse ?? false,
          ...updateData,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Fetch and return updated settings
    const updatedDoc = await orgRef.get();
    const settings = updatedDoc.data()?.callSettings as CoachCallSettings;

    return NextResponse.json({ settings, success: true });
  } catch (error) {
    console.error('[CALL_SETTINGS_PUT] Error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

