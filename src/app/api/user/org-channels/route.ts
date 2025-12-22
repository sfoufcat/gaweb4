import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { getOrgChannels } from '@/lib/org-channels';

/**
 * GET /api/user/org-channels
 * 
 * Fetch the organization channels for the current user.
 * Returns empty array if user doesn't belong to an organization.
 * 
 * This is used by regular users (not coaches) to see their org's chat channels.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get org from tenant domain (null on platform domain)
    const organizationId = await getEffectiveOrgId();
    
    if (!organizationId) {
      // User doesn't belong to an org - return empty channels
      return NextResponse.json({
        channels: [],
        organizationId: null,
      });
    }

    // Fetch org channels
    const channels = await getOrgChannels(organizationId);

    return NextResponse.json({
      channels,
      organizationId,
    });
  } catch (error) {
    console.error('[USER_ORG_CHANNELS_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

