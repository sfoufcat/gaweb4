import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { CoachCallSettings } from '@/types';

/**
 * GET /api/scheduling/call-settings
 * Get the coach's call settings for the current user's organization
 * This is the user-facing endpoint (for clients)
 */
export async function GET() {
  try {
    const { userId, orgId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 400 }
      );
    }

    // Get call settings from organization document
    const orgDoc = await adminDb.collection('organizations').doc(orgId).get();
    
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
    console.error('[SCHEDULING_CALL_SETTINGS] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

