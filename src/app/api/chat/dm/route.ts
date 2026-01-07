import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getStreamServerClient } from '@/lib/stream-server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { isUserOrgAdmin } from '@/lib/clerk-organizations';
import { adminDb } from '@/lib/firebase-admin';
import type { ClientCoachingData } from '@/types';

/**
 * POST /api/chat/dm
 * 
 * Creates or finds an existing 1:1 DM channel between the current user
 * and another user. Returns the channel ID for navigation.
 * 
 * IMPORTANT: If one of the users is a coach (org:admin), this endpoint
 * automatically uses or creates a coaching channel instead of a regular DM.
 * This ensures there's only ONE consolidated chat between coach and client.
 * 
 * Returns:
 * - channelId: The channel ID
 * - channelType: 'messaging'
 * - cid: The full channel identifier
 * - isCoachingChannel: true if this is a coaching channel (optional)
 */
export async function POST(request: Request) {
  try {
    const { userId: currentUserId } = await auth();

    if (!currentUserId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const { otherUserId } = body;

    if (!otherUserId) {
      return NextResponse.json(
        { error: 'otherUserId is required' },
        { status: 400 }
      );
    }

    if (otherUserId === currentUserId) {
      return NextResponse.json(
        { error: 'Cannot create DM with yourself' },
        { status: 400 }
      );
    }

    // Check if this should be a coaching channel instead of a regular DM
    // This happens when one of the users is a coach (org:admin) in the current org
    const organizationId = await getEffectiveOrgId();
    
    if (organizationId) {
      // Check if either user is a coach
      const [currentUserIsCoach, otherUserIsCoach] = await Promise.all([
        isUserOrgAdmin(currentUserId, organizationId),
        isUserOrgAdmin(otherUserId, organizationId),
      ]);

      // If one user is a coach, use the coaching channel
      if (currentUserIsCoach || otherUserIsCoach) {
        const coachId = currentUserIsCoach ? currentUserId : otherUserId;
        const clientId = currentUserIsCoach ? otherUserId : currentUserId;

        // Check for existing coaching channel
        const coachingDocId = `${organizationId}_${clientId}`;
        const coachingDoc = await adminDb.collection('clientCoachingData').doc(coachingDocId).get();

        if (coachingDoc.exists) {
          const data = coachingDoc.data() as ClientCoachingData;
          const existingChannelId = data.chatChannelId;

          if (existingChannelId) {
            // Verify channel exists in Stream
            try {
              const streamClient = await getStreamServerClient();
              const channel = streamClient.channel('messaging', existingChannelId);
              await channel.watch();

              // Return existing coaching channel
              console.log(`[CHAT_DM] Returning existing coaching channel ${existingChannelId}`);
              return NextResponse.json({
                channelId: existingChannelId,
                channelType: 'messaging',
                cid: `messaging:${existingChannelId}`,
                isCoachingChannel: true,
              });
            } catch {
              // Channel doesn't exist in Stream, will create new one below
              console.log(`[CHAT_DM] Coaching channel ${existingChannelId} not found in Stream`);
            }
          }
        }

        // Create a new coaching channel
        const streamClient = await getStreamServerClient();
        const clerk = await clerkClient();

        // Get user info
        const [coachUser, clientUser] = await Promise.all([
          clerk.users.getUser(coachId),
          clerk.users.getUser(clientId),
        ]);

        // Upsert users in Stream
        await streamClient.upsertUsers([
          {
            id: coachId,
            name: `${coachUser.firstName || ''} ${coachUser.lastName || ''}`.trim() || 'Coach',
            image: coachUser.imageUrl,
          },
          {
            id: clientId,
            name: `${clientUser.firstName || ''} ${clientUser.lastName || ''}`.trim() || 'Client',
            image: clientUser.imageUrl,
          },
        ]);

        // Create coaching channel ID
        const orgSuffix = organizationId.replace('org_', '').slice(0, 10);
        const clientSuffix = clientId.replace('user_', '').slice(0, 10);
        const channelId = `coaching-${orgSuffix}-${clientSuffix}`;

        const channel = streamClient.channel('messaging', channelId, {
          members: [coachId, clientId],
          created_by_id: coachId,
          isCoachingChat: true,
          organizationId,
          coachId,
          clientId,
        } as Record<string, unknown>);

        await channel.create();
        console.log(`[CHAT_DM] Created coaching channel ${channelId}`);

        // Update clientCoachingData
        const now = new Date().toISOString();
        const coachingDocRef = adminDb.collection('clientCoachingData').doc(coachingDocId);
        
        if (coachingDoc.exists) {
          await coachingDocRef.update({
            chatChannelId: channelId,
            coachId,
            updatedAt: now,
          });
        } else {
          await coachingDocRef.set({
            userId: clientId,
            organizationId,
            coachId,
            chatChannelId: channelId,
            coachingPlan: 'monthly',
            startDate: now.split('T')[0],
            focusAreas: [],
            actionItems: [],
            nextCall: {
              datetime: null,
              timezone: 'America/New_York',
              location: 'Chat',
            },
            sessionHistory: [],
            resources: [],
            privateNotes: [],
            createdAt: now,
            updatedAt: now,
          });
        }

        return NextResponse.json({
          channelId,
          channelType: 'messaging',
          cid: `messaging:${channelId}`,
          isCoachingChannel: true,
        });
      }
    }

    // Regular DM flow (non-coaching)
    const streamClient = await getStreamServerClient();
    const clerk = await clerkClient();
    
    const [currentClerkUser, otherClerkUser] = await Promise.all([
      clerk.users.getUser(currentUserId),
      clerk.users.getUser(otherUserId),
    ]);

    // Upsert both users in Stream Chat
    await streamClient.upsertUsers([
      {
        id: currentUserId,
        name: `${currentClerkUser.firstName || ''} ${currentClerkUser.lastName || ''}`.trim() || 'User',
        image: currentClerkUser.imageUrl,
      },
      {
        id: otherUserId,
        name: `${otherClerkUser.firstName || ''} ${otherClerkUser.lastName || ''}`.trim() || 'User',
        image: otherClerkUser.imageUrl,
      },
    ]);

    // Create a unique channel ID for this DM pair
    const memberIds = [currentUserId, otherUserId].sort();
    const shortId1 = memberIds[0].slice(-16);
    const shortId2 = memberIds[1].slice(-16);
    const channelId = `dm-${shortId1}-${shortId2}`;

    const channel = streamClient.channel('messaging', channelId, {
      members: memberIds,
      created_by_id: currentUserId,
      isDirectMessage: true,
    } as Record<string, unknown>);

    await channel.create();

    return NextResponse.json({
      channelId: channel.id,
      channelType: channel.type,
      cid: channel.cid,
    });

  } catch (error) {
    console.error('[CHAT_DM_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

