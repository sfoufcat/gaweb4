import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getStreamServerClient } from '@/lib/stream-server';

/**
 * PATCH /api/squad/update
 * Update squad name and/or avatar (for squad members).
 * 
 * Body:
 * - name?: string
 * - avatarUrl?: string
 */
export async function PATCH(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { name, avatarUrl } = body as {
      name?: string;
      avatarUrl?: string;
    };

    // Get user's current squad
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    const squadId = userData?.squadId;

    if (!squadId) {
      return NextResponse.json({ error: 'You are not in a squad' }, { status: 400 });
    }

    // Verify user is a member of this squad
    const membershipSnapshot = await adminDb.collection('squadMembers')
      .where('squadId', '==', squadId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (membershipSnapshot.empty) {
      return NextResponse.json({ error: 'You are not a member of this squad' }, { status: 403 });
    }

    // Get squad
    const squadRef = adminDb.collection('squads').doc(squadId);
    const squadDoc = await squadRef.get();

    if (!squadDoc.exists) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (name !== undefined && name.trim()) {
      updateData.name = name.trim();
    }

    if (avatarUrl !== undefined) {
      updateData.avatarUrl = avatarUrl;
    }

    // Update squad
    await squadRef.update(updateData);

    // Sync changes with Stream Chat channel
    const squadData = squadDoc.data();
    if (squadData?.chatChannelId) {
      try {
        const streamClient = await getStreamServerClient();
        const channel = streamClient.channel('messaging', squadData.chatChannelId);
        const channelUpdate: Record<string, unknown> = {};
        if (name !== undefined && name.trim()) {
          channelUpdate.name = name.trim();
        }
        if (avatarUrl !== undefined) {
          channelUpdate.image = avatarUrl || undefined;
        }
        if (Object.keys(channelUpdate).length > 0) {
          await channel.update(channelUpdate);
        }
      } catch (streamError) {
        console.error('[STREAM_UPDATE_CHANNEL_ERROR]', streamError);
        // Don't fail the update if Stream fails
      }
    }

    return NextResponse.json({ 
      success: true,
      squad: {
        id: squadId,
        name: updateData.name || squadData?.name,
        avatarUrl: updateData.avatarUrl ?? squadData?.avatarUrl,
      },
    });
  } catch (error) {
    console.error('[SQUAD_UPDATE_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}











