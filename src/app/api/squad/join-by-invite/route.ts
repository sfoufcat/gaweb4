import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getStreamServerClient } from '@/lib/stream-server';
import { MAX_SQUAD_MEMBERS } from '@/lib/squad-constants';
import { addUserToOrganization } from '@/lib/clerk-organizations';
import { 
  verifyInviteToken, 
  isShortCode,
  inviteLinkToPayload,
  isInviteLinkExpired,
  type InviteTokenPayload,
  type InviteLinkData,
} from '@/lib/invite-tokens';
import type { Squad } from '@/types';

/**
 * POST /api/squad/join-by-invite
 * Join a squad using an invite code or token.
 * 
 * MULTI-SQUAD SUPPORT:
 * - Users can be in multiple squads (e.g., program squad + standalone squad)
 * - No tier-based restrictions - access controlled by squad/program pricing
 * 
 * Supports both:
 * - Short codes (8 alphanumeric chars) - stored in Firestore
 * - JWT tokens - for backward compatibility
 * 
 * Body:
 * - token: string (required) - The invite code or JWT token
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { token } = body as { token: string };

    if (!token) {
      return NextResponse.json({ error: 'Invite token is required' }, { status: 400 });
    }

    // Resolve token to payload (supports both short codes and JWTs)
    let payload: InviteTokenPayload;
    
    if (isShortCode(token)) {
      // Lookup in Firestore
      const inviteLinkDoc = await adminDb.collection('inviteLinks').doc(token.toUpperCase()).get();
      
      if (!inviteLinkDoc.exists) {
        return NextResponse.json({ error: 'Invalid invite link' }, { status: 400 });
      }

      const inviteLink = inviteLinkDoc.data() as InviteLinkData;
      
      if (isInviteLinkExpired(inviteLink)) {
        return NextResponse.json({ error: 'This invite link has expired' }, { status: 400 });
      }

      payload = inviteLinkToPayload(inviteLink);
    } else {
      // Verify as JWT (backward compatibility)
      const decoded = await verifyInviteToken(token);
      if (!decoded.valid || !decoded.payload) {
        return NextResponse.json({ 
          error: decoded.error || 'Invalid invite link' 
        }, { status: 400 });
      }
      payload = decoded.payload;
    }

    // Get the target squad first to determine its type
    const squadRef = adminDb.collection('squads').doc(payload.inviterSquadId);
    const squadDoc = await squadRef.get();

    if (!squadDoc.exists) {
      return NextResponse.json({ error: 'Squad not found or no longer exists' }, { status: 404 });
    }

    const squad = squadDoc.data() as Squad;
    const squadHasCoach = !!squad.coachId;

    // Check user's existing squad memberships
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    
    // Get current squad IDs (support new squadIds array, legacy fields)
    const currentSquadIds: string[] = userData?.squadIds || [];
    
    // Fallback for legacy fields
    if (currentSquadIds.length === 0) {
      if (userData?.standardSquadId) currentSquadIds.push(userData.standardSquadId);
      if (userData?.premiumSquadId && userData.premiumSquadId !== userData.standardSquadId) {
        currentSquadIds.push(userData.premiumSquadId);
      }
      if (userData?.squadId && !currentSquadIds.includes(userData.squadId)) {
        currentSquadIds.push(userData.squadId);
      }
    }

    // Check if already in the target squad
    if (currentSquadIds.includes(payload.inviterSquadId)) {
      return NextResponse.json({ 
        success: true, 
        alreadyMember: true,
        squadId: payload.inviterSquadId,
        hasCoach: squadHasCoach,
      });
    }

    // Check if squad is at capacity
    if ((squad.memberIds || []).length >= MAX_SQUAD_MEMBERS) {
      return NextResponse.json({ 
        error: 'SQUAD_FULL',
        message: 'This squad is full and cannot accept new members.',
        squadName: squad.name,
      }, { status: 400 });
    }

    // For private squads, verify the join code matches
    if (payload.squadType === 'private' && squad.visibility === 'private') {
      if (payload.joinCode !== squad.inviteCode) {
        return NextResponse.json({ 
          error: 'This private squad\'s invite code has changed. Please request a new invite link.' 
        }, { status: 400 });
      }
    }

    // Add user to squad
    const now = new Date().toISOString();
    const memberIds = squad.memberIds || [];
    
    // Check if already a member (double check)
    if (memberIds.includes(userId)) {
      return NextResponse.json({ 
        success: true, 
        alreadyMember: true,
        squadId: payload.inviterSquadId,
        hasCoach: squadHasCoach,
      });
    }

    // Update squad memberIds
    await squadRef.update({
      memberIds: [...memberIds, userId],
      updatedAt: now,
    });

    // Get user info from Clerk
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);

    // Create squadMember document
    await adminDb.collection('squadMembers').add({
      squadId: payload.inviterSquadId,
      userId,
      roleInSquad: 'member',
      firstName: clerkUser.firstName || '',
      lastName: clerkUser.lastName || '',
      imageUrl: clerkUser.imageUrl || '',
      createdAt: now,
      updatedAt: now,
    });

    // Update user's squad membership - add to squadIds array
    const updatedSquadIds = [...currentSquadIds, payload.inviterSquadId];
    const userUpdate: Record<string, unknown> = {
      squadIds: updatedSquadIds,
      invitedBy: payload.inviterUserId,
      inviteCode: isShortCode(token) ? token.toUpperCase() : token.substring(0, 20) + '...',
      invitedAt: now,
      updatedAt: now,
      // Keep legacy fields in sync for backward compatibility
      squadId: payload.inviterSquadId,
    };
    
    await adminDb.collection('users').doc(userId).update(userUpdate);

    // Add user to Stream Chat channel
    if (squad.chatChannelId) {
      try {
        const streamClient = await getStreamServerClient();
        
        // Upsert user in Stream
        await streamClient.upsertUser({
          id: userId,
          name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'User',
          image: clerkUser.imageUrl,
        });

        // Add to channel
        const channel = streamClient.channel('messaging', squad.chatChannelId);
        await channel.addMembers([userId]);

        // Send join message
        const inviterUser = await clerk.users.getUser(payload.inviterUserId);
        const inviterName = inviterUser.firstName || 'A friend';
        
        await channel.sendMessage({
          text: `${clerkUser.firstName || 'Someone'} joined the squad via ${inviterName}'s invite! 🎉`,
          user_id: userId,
          type: 'system',
        });
      } catch (streamError) {
        console.error('[STREAM_ADD_MEMBER_ERROR]', streamError);
        // Don't fail the join if Stream fails
      }
    }

    // Auto-assign user to squad's organization (if squad has one)
    // This makes them an actual Clerk Organization member for multi-tenancy
    if (squad.organizationId) {
      try {
        await addUserToOrganization(userId, squad.organizationId, 'org:member');
        console.log(`[SQUAD_JOIN_BY_INVITE] Added user ${userId} to organization ${squad.organizationId}`);
      } catch (orgError) {
        console.error('[SQUAD_JOIN_BY_INVITE_ORG_ERROR]', orgError);
        // Don't fail the join if org assignment fails
      }
    }

    return NextResponse.json({ 
      success: true,
      squadId: payload.inviterSquadId,
      squadName: squad.name,
      hasCoach: squadHasCoach,
    });
  } catch (error) {
    console.error('[SQUAD_JOIN_BY_INVITE_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

/**
 * Helper function to leave a squad
 * Removes squad from user's squadIds array
 */
async function leaveSquad(userId: string, squadId: string): Promise<void> {
  const now = new Date().toISOString();
  
  // Get squad
  const squadRef = adminDb.collection('squads').doc(squadId);
  const squadDoc = await squadRef.get();
  
  if (!squadDoc.exists) return;
  
  const squad = squadDoc.data() as Squad;
  
  // Remove from memberIds
  const memberIds = squad.memberIds || [];
  const updatedMemberIds = memberIds.filter((id: string) => id !== userId);
  
  await squadRef.update({
    memberIds: updatedMemberIds,
    updatedAt: now,
  });
  
  // Delete squadMember document
  const memberQuery = await adminDb.collection('squadMembers')
    .where('squadId', '==', squadId)
    .where('userId', '==', userId)
    .get();
  
  const deletePromises = memberQuery.docs.map(doc => doc.ref.delete());
  await Promise.all(deletePromises);
  
  // Remove from Stream Chat channel
  if (squad.chatChannelId) {
    try {
      const streamClient = await getStreamServerClient();
      const channel = streamClient.channel('messaging', squad.chatChannelId);
      await channel.removeMembers([userId]);
    } catch (streamError) {
      console.error('[STREAM_REMOVE_MEMBER_ERROR]', streamError);
    }
  }
  
  // Remove from user's squadIds array
  const userDoc = await adminDb.collection('users').doc(userId).get();
  if (userDoc.exists) {
    const userData = userDoc.data();
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
    
    await adminDb.collection('users').doc(userId).update(userUpdate);
  }
}
