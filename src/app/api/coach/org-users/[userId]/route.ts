/**
 * Coach Org User Management API
 * 
 * PATCH /api/coach/org-users/[userId] - Update member tier/track/squad/access
 * DELETE /api/coach/org-users/[userId] - Remove member from organization
 */

import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { UserTier, UserTrack } from '@/types';

/**
 * PATCH /api/coach/org-users/[userId]
 * Update a member's tier, track, squad, or access settings
 * 
 * Body (all optional):
 * - tier: 'free' | 'standard' | 'premium'
 * - track: UserTrack | null
 * - squadId: string | null
 * - premiumSquadId: string | null
 * - accessExpiresAt: string | null (ISO date)
 * - isActive: boolean
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: targetUserId } = await params;
    const { organizationId } = await requireCoachWithOrg();
    
    const body = await request.json();
    const { tier, track, squadId, premiumSquadId, accessExpiresAt, isActive } = body;
    
    // Find the user's membership in this org
    const membershipQuery = await adminDb
      .collection('org_memberships')
      .where('userId', '==', targetUserId)
      .where('organizationId', '==', organizationId)
      .limit(1)
      .get();
    
    if (membershipQuery.empty) {
      return NextResponse.json({ error: 'User is not a member of this organization' }, { status: 404 });
    }
    
    const membershipDoc = membershipQuery.docs[0];
    const now = new Date().toISOString();
    
    // Build update object
    const updates: Record<string, unknown> = {
      updatedAt: now,
    };
    
    // Validate and apply tier
    if (tier !== undefined) {
      const validTiers: UserTier[] = ['free', 'standard', 'premium'];
      if (!validTiers.includes(tier)) {
        return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
      }
      updates.tier = tier;
    }
    
    // Apply track (can be null to remove)
    if (track !== undefined) {
      updates.track = track as UserTrack | null;
    }
    
    // Apply squadId (can be null to remove)
    if (squadId !== undefined) {
      updates.squadId = squadId;
    }
    
    // Apply premiumSquadId (can be null to remove)
    if (premiumSquadId !== undefined) {
      updates.premiumSquadId = premiumSquadId;
    }
    
    // Apply accessExpiresAt (can be null for indefinite access)
    if (accessExpiresAt !== undefined) {
      if (accessExpiresAt !== null && isNaN(Date.parse(accessExpiresAt))) {
        return NextResponse.json({ error: 'Invalid accessExpiresAt date' }, { status: 400 });
      }
      updates.accessExpiresAt = accessExpiresAt;
    }
    
    // Apply isActive
    if (isActive !== undefined) {
      updates.isActive = isActive === true;
    }
    
    // Update the membership
    await membershipDoc.ref.update(updates);
    
    // Also update Firebase user document with relevant fields
    const userUpdates: Record<string, unknown> = { updatedAt: now };
    if (tier !== undefined) userUpdates.tier = tier;
    if (track !== undefined) userUpdates.track = track;
    if (squadId !== undefined) userUpdates.standardSquadId = squadId;
    if (premiumSquadId !== undefined) userUpdates.premiumSquadId = premiumSquadId;
    
    if (Object.keys(userUpdates).length > 1) {
      try {
        await adminDb.collection('users').doc(targetUserId).update(userUpdates);
      } catch (error) {
        // User doc might not exist if they haven't fully onboarded
        console.warn(`[COACH_ORG_USERS] Could not update user doc for ${targetUserId}:`, error);
      }
    }
    
    console.log(`[COACH_ORG_USERS] Updated membership for user ${targetUserId} in org ${organizationId}`);
    
    return NextResponse.json({
      success: true,
      userId: targetUserId,
      updates,
    });
  } catch (error) {
    console.error('[COACH_ORG_USERS_PATCH_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/coach/org-users/[userId]
 * Remove a member from the organization
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: targetUserId } = await params;
    const { userId: coachUserId, organizationId } = await requireCoachWithOrg();
    
    // Can't remove yourself
    if (targetUserId === coachUserId) {
      return NextResponse.json({ error: 'Cannot remove yourself from the organization' }, { status: 400 });
    }
    
    // Find and delete the membership
    const membershipQuery = await adminDb
      .collection('org_memberships')
      .where('userId', '==', targetUserId)
      .where('organizationId', '==', organizationId)
      .limit(1)
      .get();
    
    if (membershipQuery.empty) {
      return NextResponse.json({ error: 'User is not a member of this organization' }, { status: 404 });
    }
    
    const membershipDoc = membershipQuery.docs[0];
    const membershipData = membershipDoc.data();
    
    // Check if trying to remove a super_coach (not allowed)
    if (membershipData.orgRole === 'super_coach') {
      return NextResponse.json({ error: 'Cannot remove the Super Coach from the organization' }, { status: 403 });
    }
    
    // Delete the membership
    await membershipDoc.ref.delete();
    
    // Also remove from Clerk organization
    const client = await clerkClient();
    try {
      await client.organizations.deleteOrganizationMembership({
        organizationId,
        userId: targetUserId,
      });
    } catch (clerkError) {
      // User might not be in Clerk org (legacy data)
      console.warn(`[COACH_ORG_USERS] Could not remove from Clerk org:`, clerkError);
    }
    
    // Update user's publicMetadata if this was their primary org
    try {
      const user = await client.users.getUser(targetUserId);
      const metadata = user.publicMetadata as Record<string, unknown>;
      
      if (metadata?.primaryOrganizationId === organizationId || metadata?.organizationId === organizationId) {
        // Find their next org (if any)
        const otherMemberships = await adminDb
          .collection('org_memberships')
          .where('userId', '==', targetUserId)
          .where('isActive', '==', true)
          .limit(1)
          .get();
        
        const newPrimaryOrgId = otherMemberships.empty ? null : otherMemberships.docs[0].data().organizationId;
        
        await client.users.updateUserMetadata(targetUserId, {
          publicMetadata: {
            ...metadata,
            primaryOrganizationId: newPrimaryOrgId,
            organizationId: newPrimaryOrgId,
          },
        });
      }
    } catch (error) {
      console.warn(`[COACH_ORG_USERS] Could not update user metadata for ${targetUserId}:`, error);
    }
    
    // Clear org-specific fields from Firebase user
    try {
      await adminDb.collection('users').doc(targetUserId).update({
        primaryOrganizationId: null,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.warn(`[COACH_ORG_USERS] Could not update user doc for ${targetUserId}:`, error);
    }
    
    console.log(`[COACH_ORG_USERS] Removed user ${targetUserId} from org ${organizationId}`);
    
    return NextResponse.json({
      success: true,
      userId: targetUserId,
      message: 'User removed from organization',
    });
  } catch (error) {
    console.error('[COACH_ORG_USERS_DELETE_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

