import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { adminDb } from '@/lib/firebase-admin';
import { isDemoRequest } from '@/lib/demo-api';

/**
 * GET /api/coach/org-settings
 * Get organization settings for the coach's dashboard
 */
export async function GET() {
  try {
    // Demo mode: return mock data
    if (await isDemoRequest()) {
      return NextResponse.json({
        stripeConnectStatus: 'connected',
        coachDashboardChecklistDismissed: false,
        defaultFunnelId: 'demo-funnel',
      });
    }

    const { organizationId } = await requireCoachWithOrg();

    const settingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();

    if (!settingsDoc.exists) {
      return NextResponse.json({
        stripeConnectStatus: 'not_connected',
        coachDashboardChecklistDismissed: false,
        defaultFunnelId: null,
      });
    }

    const settings = settingsDoc.data();

    return NextResponse.json({
      stripeConnectStatus: settings?.stripeConnectStatus || 'not_connected',
      coachDashboardChecklistDismissed: settings?.coachDashboardChecklistDismissed === true,
      defaultFunnelId: settings?.defaultFunnelId || null,
    });
  } catch (error) {
    console.error('[ORG_SETTINGS_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch settings';

    if (message === 'Unauthorized' || message.includes('Forbidden')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/coach/org-settings
 * Update organization settings (partial update)
 */
export async function PATCH(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body = await request.json();

    // Whitelist of fields that can be updated via this endpoint
    const allowedFields = ['coachDashboardChecklistDismissed', 'defaultFunnelId'];
    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Update org settings
    const settingsRef = adminDb.collection('org_settings').doc(organizationId);

    await settingsRef.set(
      {
        ...updates,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true, ...updates });
  } catch (error) {
    console.error('[ORG_SETTINGS_PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update settings';

    if (message === 'Unauthorized' || message.includes('Forbidden')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
