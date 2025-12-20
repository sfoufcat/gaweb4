/**
 * Check Organization Membership API
 * 
 * Called by middleware to verify if a user is a member of a specific organization.
 * Supports multi-org membership by checking the org_memberships collection.
 * 
 * This is an internal API - should only be called by middleware.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: Request) {
  // Only allow internal requests
  const internalHeader = request.headers.get('x-internal-request');
  if (internalHeader !== 'true') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const organizationId = searchParams.get('organizationId');

  if (!userId || !organizationId) {
    return NextResponse.json({ error: 'Missing userId or organizationId' }, { status: 400 });
  }

  try {
    // Check org_memberships collection for active membership
    const membershipSnapshot = await adminDb
      .collection('org_memberships')
      .where('userId', '==', userId)
      .where('organizationId', '==', organizationId)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (!membershipSnapshot.empty) {
      const membership = membershipSnapshot.docs[0].data();
      return NextResponse.json({
        isMember: true,
        membership: {
          id: membershipSnapshot.docs[0].id,
          orgRole: membership.orgRole,
          tier: membership.tier,
          track: membership.track,
        },
      });
    }

    // No active membership found
    return NextResponse.json({ isMember: false });
  } catch (error) {
    console.error('[CHECK_MEMBERSHIP] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

