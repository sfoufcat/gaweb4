/**
 * POST /api/user/sync-squad-ids
 *
 * One-time sync endpoint to backfill user's squadIds from squadMembers collection.
 * This fixes users who enrolled in programs before the squadIds update was added.
 *
 * Can be removed after all affected users have synced.
 */

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getStreamServerClient } from '@/lib/stream-server';

export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all squad memberships for this user
    const membershipsSnapshot = await adminDb.collection('squadMembers')
      .where('userId', '==', userId)
      .get();

    if (membershipsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'No squad memberships found',
        squadIds: [],
        debug: { membershipsFound: 0 },
      });
    }

    const squadIds = membershipsSnapshot.docs.map(doc => doc.data().squadId);

    // Fetch squad details to check chatChannelIds
    const squadDetails = [];
    for (const squadId of squadIds) {
      const squadDoc = await adminDb.collection('squads').doc(squadId).get();
      if (squadDoc.exists) {
        const data = squadDoc.data();
        squadDetails.push({
          squadId,
          name: data?.name,
          chatChannelId: data?.chatChannelId || null,
          organizationId: data?.organizationId,
          programId: data?.programId || null,
        });
      } else {
        squadDetails.push({ squadId, error: 'Squad document not found' });
      }
    }

    // Update user document with all squadIds
    await adminDb.collection('users').doc(userId).set({
      squadIds: FieldValue.arrayUnion(...squadIds),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Check Stream Chat membership for squads with chatChannelId
    const streamClient = await getStreamServerClient();
    const streamMembership = [];

    for (const squad of squadDetails) {
      if (squad.chatChannelId) {
        try {
          const channel = streamClient.channel('messaging', squad.chatChannelId);
          await channel.watch();
          const members = Object.keys(channel.state.members);
          const isMember = members.includes(userId);
          // If not a member, add them
          let addedToChannel = false;
          if (!isMember) {
            await channel.addMembers([userId]);
            addedToChannel = true;
          }

          streamMembership.push({
            chatChannelId: squad.chatChannelId,
            squadName: squad.name,
            isMember,
            memberCount: members.length,
            addedToChannel,
          });
        } catch (err) {
          streamMembership.push({
            chatChannelId: squad.chatChannelId,
            squadName: squad.name,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }
    }

    console.log(`[SYNC_SQUAD_IDS] Synced ${squadIds.length} squadIds for user ${userId}:`, squadIds);

    return NextResponse.json({
      success: true,
      message: `Synced ${squadIds.length} squad(s)`,
      squadIds,
      debug: {
        userId,
        membershipsFound: membershipsSnapshot.size,
        squadDetails,
        streamMembership,
      },
    });
  } catch (error) {
    console.error('[SYNC_SQUAD_IDS_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
