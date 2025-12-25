import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getStreamServerClient } from '@/lib/stream-server';
import type { Squad, SquadVisibility, UserTrack } from '@/types';

/**
 * Generate a unique invite code for private squads
 * Format: GA-XXXXXX (6 alphanumeric characters)
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded confusing chars: I, O, 0, 1
  let code = 'GA-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * POST /api/squad/create
 * Creates a new squad with the current user as the first member.
 * 
 * Body:
 * - name: string (required)
 * - description?: string
 * - timezone: string (required)
 * - visibility: 'public' | 'private' (required)
 * - trackId?: UserTrack | null (optional - null means visible to all tracks)
 * - hasCoach?: boolean (optional - whether squad has coach scheduling)
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { name, description, timezone, visibility, trackId, hasCoach = false } = body as {
      name: string;
      description?: string;
      timezone: string;
      visibility: SquadVisibility;
      trackId?: UserTrack | null;
      hasCoach?: boolean;
    };

    // Validation
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Squad name is required' }, { status: 400 });
    }

    if (!timezone) {
      return NextResponse.json({ error: 'Timezone is required' }, { status: 400 });
    }

    if (!visibility || !['public', 'private'].includes(visibility)) {
      return NextResponse.json({ error: 'Invalid visibility' }, { status: 400 });
    }

    // Generate invite code for private squads (also for public as optional)
    let inviteCode: string | undefined;
    if (visibility === 'private') {
      // Ensure unique invite code
      let isUnique = false;
      while (!isUnique) {
        inviteCode = generateInviteCode();
        const existing = await adminDb.collection('squads')
          .where('inviteCode', '==', inviteCode)
          .limit(1)
          .get();
        isUnique = existing.empty;
      }
    }

    // Create squad document
    const now = new Date().toISOString();
    const squadData: Omit<Squad, 'id'> = {
      name: name.trim(),
      description: description?.trim() || undefined,
      avatarUrl: '',
      visibility,
      timezone,
      memberIds: [userId],
      inviteCode,
      hasCoach: hasCoach, // Whether squad has coach-scheduled calls
      coachId: null,
      trackId: trackId || null, // null means visible to all tracks
      createdAt: now,
      updatedAt: now,
    };

    const squadRef = await adminDb.collection('squads').add(squadData);
    const squadId = squadRef.id;

    // Create Stream Chat channel for the squad
    const streamClient = await getStreamServerClient();
    const channelId = `squad-${squadId}`;

    // Upsert user in Stream
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);
    await streamClient.upsertUser({
      id: userId,
      name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'User',
      image: clerkUser.imageUrl,
    });

    // Create the squad group chat channel
    const channel = streamClient.channel('messaging', channelId, {
      members: [userId],
      created_by_id: userId,
      name: name.trim(),
      isSquadChannel: true,
    } as Record<string, unknown>);
    await channel.create();

    // Update squad with chatChannelId
    await squadRef.update({ chatChannelId: channelId });

    // Create squadMember document
    await adminDb.collection('squadMembers').add({
      squadId,
      userId,
      roleInSquad: 'member',
      firstName: clerkUser.firstName || '',
      lastName: clerkUser.lastName || '',
      imageUrl: clerkUser.imageUrl || '',
      createdAt: now,
      updatedAt: now,
    });

    // Update user's squad membership - add to squadIds array
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    const currentSquadIds: string[] = userData?.squadIds || [];
    
    await adminDb.collection('users').doc(userId).update({
      squadIds: [...currentSquadIds, squadId],
      squadId, // Keep legacy field in sync
      updatedAt: now,
    });

    // Send system message to squad chat
    await channel.sendMessage({
      text: `${clerkUser.firstName || 'Someone'} created the squad!`,
      user_id: userId,
      type: 'system',
    });

    return NextResponse.json({ 
      success: true, 
      squad: { id: squadId, ...squadData, chatChannelId: channelId },
      inviteCode: visibility === 'private' ? inviteCode : undefined,
    });
  } catch (error) {
    console.error('[SQUAD_CREATE_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

