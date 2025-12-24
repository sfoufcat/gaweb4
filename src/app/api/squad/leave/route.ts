import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getStreamServerClient } from '@/lib/stream-server';
import type { Squad } from '@/types';

/**
 * POST /api/squad/leave
 * Leave a squad.
 * 
 * MULTI-SQUAD SUPPORT:
 * - Users can be in multiple squads
 * - Must specify squadId to leave a specific squad
 * 
 * Body:
 * - squadId: string (required) - Specific squad ID to leave
 * 
 * Removes user from:
 * - squad.memberIds array
 * - squadMembers collection
 * - user.squadIds array
 * - Stream Chat channel
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Parse request body
    let requestedSquadId: string | null = null;
    
    try {
      const body = await req.json();
      requestedSquadId = body.squadId || null;
    } catch {
      // Body parsing error
    }

    // Get user's current squad info
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

    // Determine which squad to leave
    let squadIdToLeave: string | null = null;
    
    if (requestedSquadId) {
      // Specific squad ID requested - verify user is actually in it
      if (currentSquadIds.includes(requestedSquadId)) {
        squadIdToLeave = requestedSquadId;
      }
    } else if (currentSquadIds.length === 1) {
      // Only one squad - leave it
      squadIdToLeave = currentSquadIds[0];
    } else if (currentSquadIds.length > 1) {
      // Multiple squads but no specific one requested
      return NextResponse.json({ 
        error: 'You are in multiple squads. Please specify which squad to leave.',
        squads: currentSquadIds,
      }, { status: 400 });
    }

    if (!squadIdToLeave) {
      return NextResponse.json({ 
        error: 'You are not in a squad or the specified squad' 
      }, { status: 400 });
    }

    // Get squad data
    const squadRef = adminDb.collection('squads').doc(squadIdToLeave);
    const squadDoc = await squadRef.get();

    if (!squadDoc.exists) {
      // Squad was deleted, just clear user's squad fields
      const updatedSquadIds = currentSquadIds.filter(id => id !== squadIdToLeave);
      const userUpdate: Record<string, unknown> = { 
        squadIds: updatedSquadIds,
        updatedAt: new Date().toISOString(),
      };
      // Clear legacy fields if they match
      if (userData?.squadId === squadIdToLeave) userUpdate.squadId = null;
      if (userData?.standardSquadId === squadIdToLeave) userUpdate.standardSquadId = null;
      if (userData?.premiumSquadId === squadIdToLeave) userUpdate.premiumSquadId = null;
      
      await adminDb.collection('users').doc(userId).update(userUpdate);
      return NextResponse.json({ success: true });
    }

    const squad = squadDoc.data() as Squad;
    // Use hasCoach if available, fall back to isPremium for migration
    const squadHasCoach = squad.hasCoach ?? squad.isPremium ?? false;

    // Check if user is the coach - coaches can't leave (must be removed by admin)
    if (squad.coachId === userId) {
      return NextResponse.json({ 
        error: 'Coaches cannot leave their squad. Contact an admin to reassign.' 
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Remove from memberIds array
    const memberIds = squad.memberIds || [];
    const updatedMemberIds = memberIds.filter(id => id !== userId);
    await squadRef.update({
      memberIds: updatedMemberIds,
      updatedAt: now,
    });

    // Delete squadMember document
    const membershipSnapshot = await adminDb.collection('squadMembers')
      .where('squadId', '==', squadIdToLeave)
      .where('userId', '==', userId)
      .get();

    const batch = adminDb.batch();
    membershipSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Remove from user's squadIds array and clear legacy fields if they match
    const updatedSquadIds = currentSquadIds.filter(id => id !== squadIdToLeave);
    const userUpdate: Record<string, unknown> = { 
      squadIds: updatedSquadIds,
      updatedAt: now,
    };
    if (userData?.squadId === squadIdToLeave) userUpdate.squadId = null;
    if (userData?.standardSquadId === squadIdToLeave) userUpdate.standardSquadId = null;
    if (userData?.premiumSquadId === squadIdToLeave) userUpdate.premiumSquadId = null;
    
    batch.update(adminDb.collection('users').doc(userId), userUpdate);

    await batch.commit();

    // Remove from Stream Chat channel
    const channelIdsToTry = [
      squad.chatChannelId,
      `squad-${squadIdToLeave}`, // Standard convention
    ].filter((id): id is string => Boolean(id));

    const uniqueChannelIds = [...new Set(channelIdsToTry)];

    try {
      const streamClient = await getStreamServerClient();
      let removed = false;

      for (const channelId of uniqueChannelIds) {
        try {
          const channel = streamClient.channel('messaging', channelId);
          await channel.removeMembers([userId]);
          console.log(`[SQUAD_LEAVE] Successfully removed user ${userId} from channel ${channelId}`);
          removed = true;
        } catch (channelError) {
          console.warn(`[SQUAD_LEAVE] Failed to remove user ${userId} from channel ${channelId}:`, channelError);
        }
      }

      if (!removed && uniqueChannelIds.length > 0) {
        console.error(`[SQUAD_LEAVE] Could not remove user ${userId} from any squad chat channel. Tried: ${uniqueChannelIds.join(', ')}`);
      }
    } catch (streamError) {
      console.error('[STREAM_REMOVE_MEMBER_ERROR] Failed to initialize Stream client:', streamError);
      // Don't fail the leave if Stream fails - user is already removed from squad in DB
    }

    return NextResponse.json({ 
      success: true,
      hasCoach: squadHasCoach,
    });
  } catch (error) {
    console.error('[SQUAD_LEAVE_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
