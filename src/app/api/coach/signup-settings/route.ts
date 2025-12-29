import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { adminDb } from '@/lib/firebase-admin';

/**
 * GET /api/coach/signup-settings
 * Get public signup settings for the coach's organization
 */
export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const settingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
    
    if (!settingsDoc.exists) {
      // Default to enabled if no settings exist
      return NextResponse.json({ publicSignupEnabled: true });
    }

    const settings = settingsDoc.data();
    
    return NextResponse.json({
      // Default to true if not explicitly set
      publicSignupEnabled: settings?.publicSignupEnabled !== false,
    });
  } catch (error) {
    console.error('[SIGNUP_SETTINGS_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch settings';
    
    if (message === 'Unauthorized' || message.includes('Forbidden')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/coach/signup-settings
 * Update public signup settings for the coach's organization
 */
export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body = await request.json();
    const { publicSignupEnabled } = body;

    if (typeof publicSignupEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'publicSignupEnabled must be a boolean' },
        { status: 400 }
      );
    }

    // Update org settings
    const settingsRef = adminDb.collection('org_settings').doc(organizationId);
    
    await settingsRef.set(
      { 
        publicSignupEnabled,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    console.log(`[SIGNUP_SETTINGS_POST] Updated publicSignupEnabled=${publicSignupEnabled} for org ${organizationId}`);

    return NextResponse.json({
      success: true,
      publicSignupEnabled,
    });
  } catch (error) {
    console.error('[SIGNUP_SETTINGS_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update settings';
    
    if (message === 'Unauthorized' || message.includes('Forbidden')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


