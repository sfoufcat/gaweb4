import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getStreamServerClient } from '@/lib/stream-server';
import type { Squad, SquadType } from '@/types';

/**
 * POST /api/squad/leave
 * Leave a squad.
 * 
 * DUAL SQUAD SUPPORT:
 * - Accepts optional `type` parameter ('premium' | 'standard') to specify which squad to leave
 * - If no type specified, will leave the squad matching the squadId (for backward compatibility)
 * 
 * Body (optional):
 * - type: 'premium' | 'standard' - Which squad type to leave
 * - squadId: string - Specific squad ID to leave (for backward compatibility)
 * 
 * Removes user from:
 * - squad.memberIds array
 * - squadMembers collection
 * - user.standardSquadId or user.premiumSquadId (based on squad type)
 * - Stream Chat channel
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Parse request body (optional)
    let requestedType: SquadType | null = null;
    let requestedSquadId: string | null = null;
    
    try {
      const body = await req.json();
      requestedType = body.type || null;
      requestedSquadId = body.squadId || null;
    } catch {
      // Body is optional, ignore parsing errors
    }

    // Get user's current squad info
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    
    // Get current squad IDs
    let standardSquadId = userData?.standardSquadId || null;
    let premiumSquadId = userData?.premiumSquadId || null;
    const legacySquadId = userData?.squadId || null;
    
    // Handle legacy squadId if new fields not set
    if (!standardSquadId && !premiumSquadId && legacySquadId) {
      const legacySquadDoc = await adminDb.collection('squads').doc(legacySquadId).get();
      if (legacySquadDoc.exists) {
        const legacySquadData = legacySquadDoc.data();
        if (legacySquadData?.isPremium) {
          premiumSquadId = legacySquadId;
        } else {
          standardSquadId = legacySquadId;
        }
      }
    }

    // Determine which squad to leave
    let squadIdToLeave: string | null = null;
    let isPremiumSquad = false;
    
    if (requestedSquadId) {
      // Specific squad ID requested - verify user is actually in it
      if (requestedSquadId === premiumSquadId) {
        squadIdToLeave = premiumSquadId;
        isPremiumSquad = true;
      } else if (requestedSquadId === standardSquadId) {
        squadIdToLeave = standardSquadId;
        isPremiumSquad = false;
      } else if (requestedSquadId === legacySquadId) {
        squadIdToLeave = legacySquadId;
        // Determine if it's premium
        const squadDoc = await adminDb.collection('squads').doc(legacySquadId).get();
        isPremiumSquad = squadDoc.exists && squadDoc.data()?.isPremium;
      }
    } else if (requestedType) {
      // Squad type requested
      if (requestedType === 'premium' && premiumSquadId) {
        squadIdToLeave = premiumSquadId;
        isPremiumSquad = true;
      } else if (requestedType === 'standard' && standardSquadId) {
        squadIdToLeave = standardSquadId;
        isPremiumSquad = false;
      }
    } else {
      // No type specified - for backward compatibility, check squadMembers collection
      // or use the first available squad
      const membershipSnapshot = await adminDb.collection('squadMembers')
        .where('userId', '==', userId)
        .limit(1)
        .get();
      
      if (!membershipSnapshot.empty) {
        squadIdToLeave = membershipSnapshot.docs[0].data().squadId;
        // Determine if it's premium
        const squadDoc = await adminDb.collection('squads').doc(squadIdToLeave!).get();
        isPremiumSquad = squadDoc.exists && squadDoc.data()?.isPremium;
      } else if (premiumSquadId) {
        squadIdToLeave = premiumSquadId;
        isPremiumSquad = true;
      } else if (standardSquadId) {
        squadIdToLeave = standardSquadId;
        isPremiumSquad = false;
      }
    }

    if (!squadIdToLeave) {
      return NextResponse.json({ 
        error: requestedType 
          ? `You are not in a ${requestedType} squad` 
          : 'You are not in a squad' 
      }, { status: 400 });
    }

    // Get squad data
    const squadRef = adminDb.collection('squads').doc(squadIdToLeave);
    const squadDoc = await squadRef.get();

    if (!squadDoc.exists) {
      // Squad was deleted, just clear user's squad fields
      const userUpdate: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (isPremiumSquad) {
        userUpdate.premiumSquadId = null;
      } else {
        userUpdate.standardSquadId = null;
      }
      if (legacySquadId === squadIdToLeave) {
        userUpdate.squadId = null;
      }
      await adminDb.collection('users').doc(userId).update(userUpdate);
      return NextResponse.json({ success: true, squadType: isPremiumSquad ? 'premium' : 'standard' });
    }

    const squad = squadDoc.data() as Squad;
    isPremiumSquad = squad.isPremium; // Use actual squad data as source of truth

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

    // Clear the appropriate user squad field
    const userUpdate: Record<string, unknown> = { updatedAt: now };
    if (isPremiumSquad) {
      userUpdate.premiumSquadId = null;
    } else {
      userUpdate.standardSquadId = null;
    }
    // Also clear legacy squadId if it matches
    if (legacySquadId === squadIdToLeave) {
      userUpdate.squadId = null;
    }
    
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
      squadType: isPremiumSquad ? 'premium' : 'standard',
    });
  } catch (error) {
    console.error('[SQUAD_LEAVE_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
