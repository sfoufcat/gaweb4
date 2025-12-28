import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { adminDb } from '@/lib/firebase-admin';

/**
 * GET /api/feed/community
 * Fetches organization members for the feed stories row
 * Returns a limited list of community members with their basic info
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get org context
    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    // Check if feed is enabled
    const orgSettingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
    const orgSettings = orgSettingsDoc.data();
    
    if (!orgSettings?.feedEnabled) {
      return NextResponse.json({ error: 'Feed not enabled' }, { status: 403 });
    }

    // Get organization members from Clerk
    const client = await clerkClient();
    const memberships = await client.organizations.getOrganizationMembershipList({
      organizationId,
      limit: 50, // Limit to 50 members for the stories row
    });

    // Get member user IDs (excluding current user)
    const memberUserIds = memberships.data
      .map(m => m.publicUserData?.userId)
      .filter((id): id is string => !!id && id !== userId);

    // Fetch user data from Firebase for profile info
    const members = await Promise.all(
      memberUserIds.map(async (memberId) => {
        try {
          const userDoc = await adminDb.collection('users').doc(memberId).get();
          const userData = userDoc.exists ? userDoc.data() : null;
          
          return {
            userId: memberId,
            firstName: userData?.firstName || '',
            lastName: userData?.lastName || '',
            imageUrl: userData?.avatarUrl || userData?.imageUrl || '',
          };
        } catch {
          return null;
        }
      })
    );

    // Filter out null results and users with no names
    const validMembers = members.filter(
      (m): m is { userId: string; firstName: string; lastName: string; imageUrl: string } =>
        m !== null && !!(m.firstName || m.lastName)
    );

    return NextResponse.json({
      members: validMembers,
      total: validMembers.length,
    });
  } catch (error) {
    console.error('[FEED_COMMUNITY] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch community members' },
      { status: 500 }
    );
  }
}






