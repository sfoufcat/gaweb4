import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { adminDb } from '@/lib/firebase-admin';

/**
 * GET /api/coach/feed-settings
 * Get feed settings for the coach's organization
 */
export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const settingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
    
    if (!settingsDoc.exists) {
      return NextResponse.json({ feedEnabled: false });
    }

    const settings = settingsDoc.data();
    
    return NextResponse.json({
      feedEnabled: settings?.feedEnabled === true,
    });
  } catch (error) {
    console.error('[FEED_SETTINGS_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch settings';
    
    if (message === 'Unauthorized' || message.includes('Forbidden')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/coach/feed-settings
 * Update feed settings for the coach's organization
 */
export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body = await request.json();
    const { feedEnabled } = body;

    if (typeof feedEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'feedEnabled must be a boolean' },
        { status: 400 }
      );
    }

    // Update org settings
    const settingsRef = adminDb.collection('org_settings').doc(organizationId);
    
    await settingsRef.set(
      { 
        feedEnabled,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      feedEnabled,
    });
  } catch (error) {
    console.error('[FEED_SETTINGS_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update settings';
    
    if (message === 'Unauthorized' || message.includes('Forbidden')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

