import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { adminDb } from '@/lib/firebase-admin';
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

