/**
 * Debug endpoint to check integration data in Firestore
 * GET /api/admin/debug-integrations
 */

import { NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { adminDb } from '@/lib/firebase-admin';
import { getConfiguredIntegrations } from '@/lib/integrations/config';

export async function GET() {
  try {
    const { organizationId, userId } = await requireCoachWithOrg();

    // Get all integrations from Firestore
    const integrationsRef = adminDb
      .collection('organizations')
      .doc(organizationId)
      .collection('integrations');

    const snapshot = await integrationsRef.get();

    const integrations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Mask sensitive data
      accessToken: doc.data().accessToken ? '[EXISTS]' : '[MISSING]',
      refreshToken: doc.data().refreshToken ? '[EXISTS]' : '[MISSING]',
      apiKey: doc.data().apiKey ? '[EXISTS]' : '[MISSING]',
    }));

    // Get configured integrations (env var check)
    const configured = getConfiguredIntegrations();

    // Check env vars directly (masked)
    const envVars = {
      GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID ? '[SET]' : '[NOT SET]',
      GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET ? '[SET]' : '[NOT SET]',
      MICROSOFT_OAUTH_CLIENT_ID: process.env.MICROSOFT_OAUTH_CLIENT_ID ? '[SET]' : '[NOT SET]',
      MICROSOFT_OAUTH_CLIENT_SECRET: process.env.MICROSOFT_OAUTH_CLIENT_SECRET ? '[SET]' : '[NOT SET]',
      MS_OAUTH_CLIENT_ID: process.env.MS_OAUTH_CLIENT_ID ? '[SET]' : '[NOT SET]',
      MS_OAUTH_CLIENT_SECRET: process.env.MS_OAUTH_CLIENT_SECRET ? '[SET]' : '[NOT SET]',
      AZURE_AD_CLIENT_ID: process.env.AZURE_AD_CLIENT_ID ? '[SET]' : '[NOT SET]',
      AZURE_AD_CLIENT_SECRET: process.env.AZURE_AD_CLIENT_SECRET ? '[SET]' : '[NOT SET]',
      ZOOM_OAUTH_CLIENT_ID: process.env.ZOOM_OAUTH_CLIENT_ID ? '[SET]' : '[NOT SET]',
      ZOOM_OAUTH_CLIENT_SECRET: process.env.ZOOM_OAUTH_CLIENT_SECRET ? '[SET]' : '[NOT SET]',
    };

    return NextResponse.json({
      organizationId,
      userId,
      integrationCount: integrations.length,
      integrations,
      configured,
      envVars,
    });
  } catch (error) {
    console.error('[DEBUG_INTEGRATIONS_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
