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
import { getStreamServerClient } from '@/lib/stream-server';
import { FieldValue } from 'firebase-admin/firestore';
import type { UserTier, UserTrack, Squad } from '@/types';

/**
 * Add a user to a squad with full data sync
 */
async function addUserToSquad(
  userId: string,
  squadId: string,
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  const now = new Date().toISOString();
  
  // Verify squad belongs to the organization
  const squadDoc = await adminDb.collection('squads').doc(squadId).get();
  if (!squadDoc.exists) {
    return { success: false, error: 'Squad not found' };
  }
  
  const squadData = squadDoc.data() as Squad;
  if (squadData?.organizationId !== organizationId) {
    return { success: false, error: 'Squad does not belong to your organization' };
  }
  
  // Check if user is already in this squad
  const existingMembership = await adminDb.collection('squadMembers')
    .where('squadId', '==', squadId)
    .where('userId', '==', userId)
    .limit(1)
    .get();
  
  if (!existingMembership.empty) {
    return { success: false, error: 'User is already in this squad' };
  }
  
  // Get user info from Clerk for the squadMember record
  let firstName = '';
  let lastName = '';
  let imageUrl = '';
  
  try {
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);
    firstName = clerkUser.firstName || '';
    lastName = clerkUser.lastName || '';
    imageUrl = clerkUser.imageUrl || '';
  } catch (err) {
    console.warn(`[ADD_TO_SQUAD] Could not fetch Clerk user ${userId}:`, err);
  }
  
  // 1. Create squadMember record
  await adminDb.collection('squadMembers').add({
    squadId,
    userId,
    roleInSquad: 'member',
    firstName,
    lastName,
    imageUrl,
    createdAt: now,
    updatedAt: now,
  });
  
  // 2. Update squads.memberIds array
  await adminDb.collection('squads').doc(squadId).update({
    memberIds: FieldValue.arrayUnion(userId),
    updatedAt: now,
  });
  
  // 3. Update user's squadIds array
  const userDoc = await adminDb.collection('users').doc(userId).get();
  const userData = userDoc.exists ? userDoc.data() : null;
  const currentSquadIds: string[] = userData?.squadIds || [];
  
  if (!currentSquadIds.includes(squadId)) {
    const updatedSquadIds = [...currentSquadIds, squadId];
    await adminDb.collection('users').doc(userId).update({
      squadIds: updatedSquadIds,
      // Keep legacy fields in sync - set standardSquadId if not already set
      ...(userData?.standardSquadId ? {} : { standardSquadId: squadId }),
      updatedAt: now,
    });
  }
  
  // 4. Add to Stream Chat channel
  if (squadData?.chatChannelId) {
    try {
      const streamClient = await getStreamServerClient();
      
      // Upsert user in Stream Chat
      await streamClient.upsertUser({
        id: userId,
        name: `${firstName} ${lastName}`.trim() || 'User',
        image: imageUrl,
      });
      
      // Add to channel
      const channel = streamClient.channel('messaging', squadData.chatChannelId);
      await channel.addMembers([userId]);
      
      console.log(`[ADD_TO_SQUAD] Added user ${userId} to Stream channel ${squadData.chatChannelId}`);
    } catch (streamError) {
      console.error('[ADD_TO_SQUAD] Stream Chat error:', streamError);
      // Don't fail - user is still added to squad
    }
  }
  
  console.log(`[ADD_TO_SQUAD] Successfully added user ${userId} to squad ${squadId}`);
  return { success: true };
}

/**
 * Remove a user from a squad with full data sync
 */
async function removeUserFromSquad(
  userId: string,
  squadId: string,
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  const now = new Date().toISOString();
  
  // Verify squad belongs to the organization
  const squadDoc = await adminDb.collection('squads').doc(squadId).get();
  if (!squadDoc.exists) {
    // Squad was deleted - just clean up user data
    await cleanupUserSquadData(userId, squadId);
    return { success: true };
  }
  
  const squadData = squadDoc.data() as Squad;
  if (squadData?.organizationId !== organizationId) {
    return { success: false, error: 'Squad does not belong to your organization' };
  }
  
  // Check if user is the coach - they can't be removed via this method
  if (squadData.coachId === userId) {
    return { success: false, error: 'Cannot remove the coach from their squad. Reassign the coach first.' };
  }
  
  // 1. Delete squadMember record(s)
  const membershipSnapshot = await adminDb.collection('squadMembers')
    .where('squadId', '==', squadId)
    .where('userId', '==', userId)
    .get();
  
  const batch = adminDb.batch();
  membershipSnapshot.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  // 2. Update squads.memberIds array
  batch.update(adminDb.collection('squads').doc(squadId), {
    memberIds: FieldValue.arrayRemove(userId),
    updatedAt: now,
  });
  
  // 3. Update user's squadIds array and legacy fields
  const userDoc = await adminDb.collection('users').doc(userId).get();
  const userData = userDoc.exists ? userDoc.data() : null;
  const currentSquadIds: string[] = userData?.squadIds || [];
  const updatedSquadIds = currentSquadIds.filter(id => id !== squadId);
  
  const userUpdate: Record<string, unknown> = {
    squadIds: updatedSquadIds,
    updatedAt: now,
  };
  
  // Clear legacy fields if they match
  if (userData?.squadId === squadId) userUpdate.squadId = null;
  if (userData?.standardSquadId === squadId) userUpdate.standardSquadId = null;
  if (userData?.premiumSquadId === squadId) userUpdate.premiumSquadId = null;
  
  // If user has other squads, set standardSquadId to the first one
  if (updatedSquadIds.length > 0 && userUpdate.standardSquadId === null) {
    userUpdate.standardSquadId = updatedSquadIds[0];
  }
  
  batch.update(adminDb.collection('users').doc(userId), userUpdate);
  
  await batch.commit();
  
  // 4. Remove from Stream Chat channel
  if (squadData?.chatChannelId) {
    try {
      const streamClient = await getStreamServerClient();
      const channel = streamClient.channel('messaging', squadData.chatChannelId);
      await channel.removeMembers([userId]);
      
      console.log(`[REMOVE_FROM_SQUAD] Removed user ${userId} from Stream channel ${squadData.chatChannelId}`);
    } catch (streamError) {
      console.error('[REMOVE_FROM_SQUAD] Stream Chat error:', streamError);
      // Don't fail - user is still removed from squad
    }
  }
  
  console.log(`[REMOVE_FROM_SQUAD] Successfully removed user ${userId} from squad ${squadId}`);
  return { success: true };
}

/**
 * Clean up user's squad data when squad is deleted
 */
async function cleanupUserSquadData(userId: string, squadId: string): Promise<void> {
  const now = new Date().toISOString();
  
  const userDoc = await adminDb.collection('users').doc(userId).get();
  const userData = userDoc.exists ? userDoc.data() : null;
  const currentSquadIds: string[] = userData?.squadIds || [];
  const updatedSquadIds = currentSquadIds.filter(id => id !== squadId);
  
  const userUpdate: Record<string, unknown> = {
    squadIds: updatedSquadIds,
    updatedAt: now,
  };
  
  if (userData?.squadId === squadId) userUpdate.squadId = null;
  if (userData?.standardSquadId === squadId) userUpdate.standardSquadId = null;
  if (userData?.premiumSquadId === squadId) userUpdate.premiumSquadId = null;
  
  if (updatedSquadIds.length > 0 && userUpdate.standardSquadId === null) {
    userUpdate.standardSquadId = updatedSquadIds[0];
  }
  
  await adminDb.collection('users').doc(userId).update(userUpdate);
}

/**
 * PATCH /api/coach/org-users/[userId]
 * Update a member's tier, track, squad, or access settings
 * 
 * Body (all optional):
 * - tier: 'free' | 'standard' | 'premium'
 * - track: UserTrack | null
 * - addSquadId: string - Add user to this squad (proper membership)
 * - removeSquadId: string - Remove user from this squad (proper membership)
 * - accessExpiresAt: string | null (ISO date)
 * - isActive: boolean
 * 
 * DEPRECATED (use addSquadId/removeSquadId instead):
 * - squadId: string | null
 * - premiumSquadId: string | null
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: targetUserId } = await params;
    const { organizationId } = await requireCoachWithOrg();
    
    const body = await request.json();
    const { 
      tier, 
      track, 
      addSquadId, 
      removeSquadId,
      // Legacy fields - still supported but deprecated
      squadId, 
      premiumSquadId, 
      accessExpiresAt, 
      isActive 
    } = body;
    
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
    
    // Handle squad add operation (NEW - proper way)
    if (addSquadId) {
      const result = await addUserToSquad(targetUserId, addSquadId, organizationId);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      
      // Update org_membership squadIds
      const currentMembership = membershipDoc.data();
      const currentSquadIds: string[] = currentMembership.squadIds || [];
      if (!currentSquadIds.includes(addSquadId)) {
        await membershipDoc.ref.update({
          squadIds: FieldValue.arrayUnion(addSquadId),
          // Keep legacy field in sync
          squadId: currentMembership.squadId || addSquadId,
          updatedAt: now,
        });
      }
    }
    
    // Handle squad remove operation (NEW - proper way)
    if (removeSquadId) {
      const result = await removeUserFromSquad(targetUserId, removeSquadId, organizationId);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      
      // Update org_membership squadIds
      const currentMembership = membershipDoc.data();
      const currentSquadIds: string[] = currentMembership.squadIds || [];
      const updatedSquadIds = currentSquadIds.filter(id => id !== removeSquadId);
      
      const membershipUpdate: Record<string, unknown> = {
        squadIds: updatedSquadIds,
        updatedAt: now,
      };
      
      // Update legacy field if it was the removed squad
      if (currentMembership.squadId === removeSquadId) {
        membershipUpdate.squadId = updatedSquadIds.length > 0 ? updatedSquadIds[0] : null;
      }
      
      await membershipDoc.ref.update(membershipUpdate);
    }
    
    // Build update object for non-squad fields
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
    
    // DEPRECATED: Legacy squadId handling (still works for backward compatibility)
    // But warns and won't do full membership sync
    if (squadId !== undefined && !addSquadId && !removeSquadId) {
      console.warn('[COACH_ORG_USERS] Using deprecated squadId field. Use addSquadId/removeSquadId instead.');
      updates.squadId = squadId;
    }
    
    // DEPRECATED: Legacy premiumSquadId handling
    if (premiumSquadId !== undefined) {
      console.warn('[COACH_ORG_USERS] Using deprecated premiumSquadId field.');
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
    
    // Update the membership (only if we have non-squad updates)
    if (Object.keys(updates).length > 1) {
      await membershipDoc.ref.update(updates);
    }
    
    // Also update Firebase user document with relevant fields
    const userUpdates: Record<string, unknown> = { updatedAt: now };
    if (tier !== undefined) userUpdates.tier = tier;
    if (track !== undefined) userUpdates.track = track;
    // Don't update squad fields here - they're handled by addUserToSquad/removeUserFromSquad
    
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
