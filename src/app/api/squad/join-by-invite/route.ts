import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getStreamServerClient } from '@/lib/stream-server';
import { MAX_SQUAD_MEMBERS } from '@/lib/squad-constants';
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
 * DUAL SQUAD SUPPORT:
 * - Premium users can join BOTH a standard squad AND a premium squad via invite
 * - Standard users can only join standard squads
 * - If joining same type as current squad, must leave first (or forceSwitch)
 * 
 * Supports both:
 * - Short codes (8 alphanumeric chars) - stored in Firestore
 * - JWT tokens - for backward compatibility
 * 
 * Body:
 * - token: string (required) - The invite code or JWT token
 * - forceSwitch: boolean (optional) - If true, leave current squad of same type and join new one
 */
export async function POST(req: Request) {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { token, forceSwitch = false } = body as { token: string; forceSwitch?: boolean };

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
    const isTargetSquadPremium = squad.isPremium;

    // Get user tier from Clerk session
    const publicMetadata = sessionClaims?.publicMetadata as { tier?: string } | undefined;
    const userTier = publicMetadata?.tier || 'standard';
    const isPremiumUser = userTier === 'premium';

    // Premium squad enforcement - standard users cannot join premium squads
    if (isTargetSquadPremium && !isPremiumUser) {
      return NextResponse.json({ 
        error: 'PREMIUM_REQUIRED',
        squadName: squad.name,
        squadId: payload.inviterSquadId,
        message: 'This is a premium squad. Upgrade to premium to join.',
      }, { status: 403 });
    }

    // Check user's existing squad memberships
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    
    // Get current squad IDs (support both new fields and legacy)
    let currentStandardSquadId = userData?.standardSquadId || null;
    let currentPremiumSquadId = userData?.premiumSquadId || null;
    
    // Fallback for legacy squadId
    if (!currentStandardSquadId && !currentPremiumSquadId && userData?.squadId) {
      const legacySquadDoc = await adminDb.collection('squads').doc(userData.squadId).get();
      if (legacySquadDoc.exists) {
        const legacySquadData = legacySquadDoc.data();
        if (legacySquadData?.isPremium) {
          currentPremiumSquadId = userData.squadId;
        } else {
          currentStandardSquadId = userData.squadId;
        }
      }
    }

    // Determine the relevant current squad ID based on target squad type
    const relevantCurrentSquadId = isTargetSquadPremium ? currentPremiumSquadId : currentStandardSquadId;
    const squadTypeLabel = isTargetSquadPremium ? 'premium' : 'standard';

    // Check if already in the target squad
    if (relevantCurrentSquadId === payload.inviterSquadId) {
      return NextResponse.json({ 
        success: true, 
        alreadyMember: true,
        squadId: payload.inviterSquadId,
        squadType: squadTypeLabel,
      });
    }

    // Check if user already has a squad of the same type
    if (relevantCurrentSquadId) {
      if (!forceSwitch) {
        // Get current squad info for the confirmation dialog
        const currentSquadDoc = await adminDb.collection('squads').doc(relevantCurrentSquadId).get();
        const currentSquadName = currentSquadDoc.exists ? currentSquadDoc.data()?.name : `your current ${squadTypeLabel} squad`;
        
        return NextResponse.json({ 
          error: 'ALREADY_IN_SQUAD',
          currentSquadId: relevantCurrentSquadId,
          currentSquadName,
          newSquadName: squad.name,
          squadType: squadTypeLabel,
          message: `You are already in "${currentSquadName}". Do you want to leave and join "${squad.name}"?`
        }, { status: 409 }); // 409 Conflict
      }
      
      // forceSwitch is true - leave current squad of same type first
      await leaveSquad(userId, relevantCurrentSquadId, isTargetSquadPremium);
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
        squadType: squadTypeLabel,
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

    // Update user's squad field based on squad type and store referral tracking data
    const userUpdate: Record<string, unknown> = {
      invitedBy: payload.inviterUserId,
      inviteCode: isShortCode(token) ? token.toUpperCase() : token.substring(0, 20) + '...',
      invitedAt: now,
      updatedAt: now,
    };
    
    if (isTargetSquadPremium) {
      userUpdate.premiumSquadId = payload.inviterSquadId;
    } else {
      userUpdate.standardSquadId = payload.inviterSquadId;
    }
    
    // Also update legacy squadId for backward compatibility if user has no squads yet
    if (!currentStandardSquadId && !currentPremiumSquadId) {
      userUpdate.squadId = payload.inviterSquadId;
    }
    
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

    return NextResponse.json({ 
      success: true,
      squadId: payload.inviterSquadId,
      squadName: squad.name,
      squadType: squadTypeLabel,
    });
  } catch (error) {
    console.error('[SQUAD_JOIN_BY_INVITE_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

/**
 * Helper function to leave a squad
 * Updates the appropriate squad ID field based on squad type
 */
async function leaveSquad(userId: string, squadId: string, isPremiumSquad: boolean): Promise<void> {
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
  
  // Clear the appropriate squad ID field
  const userUpdate: Record<string, unknown> = { updatedAt: now };
  if (isPremiumSquad) {
    userUpdate.premiumSquadId = null;
  } else {
    userUpdate.standardSquadId = null;
  }
  // Also clear legacy squadId if it matches
  const userDoc = await adminDb.collection('users').doc(userId).get();
  if (userDoc.exists && userDoc.data()?.squadId === squadId) {
    userUpdate.squadId = null;
  }
  
  await adminDb.collection('users').doc(userId).update(userUpdate);
}
