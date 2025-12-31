import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { adminDb } from '@/lib/firebase-admin';

/**
 * GET /api/coach/stories-settings
 * Get stories settings for the coach's organization
 */
export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const settingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
    
    if (!settingsDoc.exists) {
      // Default to true - stories are enabled by default
      return NextResponse.json({ storiesEnabled: true });
    }

    const settings = settingsDoc.data();
    
    // storiesEnabled defaults to true if not explicitly set
    return NextResponse.json({
      storiesEnabled: settings?.storiesEnabled !== false,
    });
  } catch (error) {
    console.error('[STORIES_SETTINGS_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch settings';
    
    if (message === 'Unauthorized' || message.includes('Forbidden')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/coach/stories-settings
 * Update stories settings for the coach's organization
 */
export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body = await request.json();
    const { storiesEnabled } = body;

    if (typeof storiesEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'storiesEnabled must be a boolean' },
        { status: 400 }
      );
    }

    // Update org settings
    const settingsRef = adminDb.collection('org_settings').doc(organizationId);
    
    await settingsRef.set(
      { 
        storiesEnabled,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    console.log(`[STORIES_SETTINGS_POST] Updated storiesEnabled=${storiesEnabled} for org ${organizationId}`);

    return NextResponse.json({
      success: true,
      storiesEnabled,
    });
  } catch (error) {
    console.error('[STORIES_SETTINGS_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update settings';
    
    if (message === 'Unauthorized' || message.includes('Forbidden')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

