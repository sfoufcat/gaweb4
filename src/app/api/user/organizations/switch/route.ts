/**
 * Switch Organization API
 * 
 * POST /api/user/organizations/switch
 * Switch the user's active/primary organization
 */

import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { organizationId } = body;
    
    if (!organizationId || typeof organizationId !== 'string') {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }
    
    // Verify user is a member of this organization
    const membershipQuery = await adminDb
      .collection('org_memberships')
      .where('userId', '==', userId)
      .where('organizationId', '==', organizationId)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    
    if (membershipQuery.empty) {
      return NextResponse.json({ error: 'You are not a member of this organization' }, { status: 403 });
    }
    
    const membership = membershipQuery.docs[0].data();
    
    // Update user's publicMetadata with new primary org
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const currentMetadata = user.publicMetadata as Record<string, unknown>;
    
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...currentMetadata,
        primaryOrganizationId: organizationId,
        // Also update legacy field
        organizationId: organizationId,
      },
    });
    
    // Update Firebase user
    const now = new Date().toISOString();
    await adminDb.collection('users').doc(userId).update({
      primaryOrganizationId: organizationId,
      // Also update org-specific settings from membership
      tier: membership.tier,
      track: membership.track,
      updatedAt: now,
    });
    
    console.log(`[SWITCH_ORG] User ${userId} switched to org ${organizationId}`);
    
    return NextResponse.json({
      success: true,
      organizationId,
      message: 'Organization switched successfully',
    });
  } catch (error) {
    console.error('[SWITCH_ORG_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}









