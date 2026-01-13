import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { getStreamServerClient } from '@/lib/stream-server';
import { adminDb } from '@/lib/firebase-admin';
import { isUserOrgAdmin } from '@/lib/clerk-organizations';
import { generateCoachingChannelId } from '@/lib/chat-server';
import type { ClientCoachingData } from '@/types';

/**
 * POST /api/chat/coaching
 * 
 * Creates or retrieves the consolidated coaching chat channel between a coach and client.
 * This is the SINGLE source of truth for coach-client messaging.
 * 
 * The channel ID format is: coaching-{orgSuffix}-{userSuffix}
 * 
 * Request body:
 * - clientId: The client's user ID (required)
 * 
 * Returns:
 * - channelId: The coaching channel ID
 * - channelType: 'messaging'
 * - cid: The full channel identifier
 * - created: Whether a new channel was created
 */
export async function POST(request: Request) {
  try {
    const { userId: currentUserId } = await auth();

    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({
        error: 'Organization context required',
        message: 'This endpoint only works on organization domains'
      }, { status: 400 });
    }

    const body = await request.json();
    const { clientId } = body;

    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId is required' },
        { status: 400 }
      );
    }

    if (clientId === currentUserId) {
      return NextResponse.json(
        { error: 'Cannot create coaching chat with yourself' },
        { status: 400 }
      );
    }

    // Determine who is the coach and who is the client
    // The coach is always the org:admin
    const currentUserIsCoach = await isUserOrgAdmin(currentUserId, organizationId);
    
    let coachId: string;
    let actualClientId: string;

    if (currentUserIsCoach) {
      // Current user is coach, clientId parameter is the client
      coachId = currentUserId;
      actualClientId = clientId;
    } else {
      // Current user is client, clientId parameter should be the coach
      // Verify the other user is actually a coach
      const otherUserIsCoach = await isUserOrgAdmin(clientId, organizationId);
      if (!otherUserIsCoach) {
        return NextResponse.json({
          error: 'Invalid coaching relationship',
          message: 'One participant must be an organization coach'
        }, { status: 400 });
      }
      coachId = clientId;
      actualClientId = currentUserId;
    }

    // Check for existing coaching channel in clientCoachingData
    const coachingDocId = `${organizationId}_${actualClientId}`;
    const coachingDocRef = adminDb.collection('clientCoachingData').doc(coachingDocId);
    const coachingDoc = await coachingDocRef.get();

    let existingChannelId: string | null = null;
    if (coachingDoc.exists) {
      const data = coachingDoc.data() as ClientCoachingData;
      existingChannelId = data.chatChannelId || null;
    }

    const streamClient = await getStreamServerClient();

    // If channel exists, verify it's valid in Stream Chat
    if (existingChannelId) {
      try {
        const channel = streamClient.channel('messaging', existingChannelId);
        await channel.watch();

        // Channel exists and is valid - return it
        return NextResponse.json({
          channelId: existingChannelId,
          channelType: 'messaging',
          cid: `messaging:${existingChannelId}`,
          created: false,
        });
      } catch {
        // Channel doesn't exist in Stream, need to recreate
        console.log(`[COACHING_CHAT] Channel ${existingChannelId} not found in Stream, will recreate`);
      }
    }

    // Get user info from Clerk
    const clerk = await clerkClient();
    const [coachUser, clientUser] = await Promise.all([
      clerk.users.getUser(coachId),
      clerk.users.getUser(actualClientId),
    ]);

    // Upsert both users in Stream Chat
    await streamClient.upsertUsers([
      {
        id: coachId,
        name: `${coachUser.firstName || ''} ${coachUser.lastName || ''}`.trim() || 'Coach',
        image: coachUser.imageUrl,
      },
      {
        id: actualClientId,
        name: `${clientUser.firstName || ''} ${clientUser.lastName || ''}`.trim() || 'Client',
        image: clientUser.imageUrl,
      },
    ]);

    // Create the coaching channel with a consistent ID format
    // Use hashed user IDs to ensure uniqueness while staying under 64 char limit
    const channelId = generateCoachingChannelId(actualClientId, coachId);

    // Create the channel with custom properties for filtering
    const channel = streamClient.channel('messaging', channelId, {
      members: [coachId, actualClientId],
      created_by_id: coachId, // Coach owns the channel
      // Custom data for identification and filtering
      isCoachingChat: true,
      organizationId,
      coachId,
      clientId: actualClientId,
      // NO static name - display name is derived dynamically based on viewer
    } as Record<string, unknown>);

    await channel.create();
    console.log(`[COACHING_CHAT] Created coaching channel ${channelId} for coach ${coachId} and client ${actualClientId}`);

    // Update or create the clientCoachingData document
    const now = new Date().toISOString();
    if (coachingDoc.exists) {
      await coachingDocRef.update({
        chatChannelId: channelId,
        coachId, // Ensure coachId is set
        updatedAt: now,
      });
    } else {
      // Create minimal coaching data doc with just the chat channel
      await coachingDocRef.set({
        userId: actualClientId,
        organizationId,
        coachId,
        chatChannelId: channelId,
        coachingPlan: 'monthly', // Default
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
      created: true,
    });

  } catch (error) {
    console.error('[COACHING_CHAT_ERROR]', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      error: 'Internal Error',
      message: errorMessage,
    }, { status: 500 });
  }
}

/**
 * GET /api/chat/coaching
 * 
 * Check if a coaching channel exists for the current user with a specific client/coach.
 * 
 * Query params:
 * - clientId: The other user's ID (client if you're coach, coach if you're client)
 * 
 * Returns:
 * - exists: Whether a coaching channel exists
 * - channelId: The channel ID if it exists
 */
export async function GET(request: Request) {
  try {
    const { userId: currentUserId } = await auth();

    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({
        exists: false,
        channelId: null,
        reason: 'No organization context'
      });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId query parameter is required' },
        { status: 400 }
      );
    }

    // Determine the actual client ID (the non-coach user)
    const currentUserIsCoach = await isUserOrgAdmin(currentUserId, organizationId);
    const actualClientId = currentUserIsCoach ? clientId : currentUserId;

    // Check for existing coaching channel
    const coachingDocId = `${organizationId}_${actualClientId}`;
    const coachingDoc = await adminDb.collection('clientCoachingData').doc(coachingDocId).get();

    if (!coachingDoc.exists) {
      return NextResponse.json({
        exists: false,
        channelId: null,
      });
    }

    const data = coachingDoc.data() as ClientCoachingData;
    const channelId = data.chatChannelId || null;

    // Verify channel exists in Stream
    if (channelId) {
      try {
        const streamClient = await getStreamServerClient();
        const channel = streamClient.channel('messaging', channelId);
        await channel.watch();

        return NextResponse.json({
          exists: true,
          channelId,
        });
      } catch {
        // Channel doesn't exist in Stream
        return NextResponse.json({
          exists: false,
          channelId: null,
          reason: 'Channel not found in Stream'
        });
      }
    }

    return NextResponse.json({
      exists: false,
      channelId: null,
    });

  } catch (error) {
    console.error('[COACHING_CHAT_GET_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
