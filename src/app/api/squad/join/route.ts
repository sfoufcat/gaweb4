import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getStreamServerClient } from '@/lib/stream-server';
import { MAX_SQUAD_MEMBERS } from '@/lib/squad-constants';
import { addUserToOrganization } from '@/lib/clerk-organizations';
import type { Squad } from '@/types';

/**
 * POST /api/squad/join
 * Join a public squad by ID.
 * 
 * MULTI-SQUAD SUPPORT:
 * - Users can be in multiple squads (e.g., program squad + standalone squad)
 * - No tier-based restrictions - access controlled by squad/program pricing
 * 
 * Body:
 * - squadId: string (required)
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { squadId } = body as { squadId: string };

    if (!squadId) {
      return NextResponse.json({ error: 'Squad ID is required' }, { status: 400 });
    }

    // Get the squad
    const squadRef = adminDb.collection('squads').doc(squadId);
    const squadDoc = await squadRef.get();

    if (!squadDoc.exists) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    const squad = squadDoc.data() as Squad;
    const squadHasCoach = !!squad.coachId;

    // Verify squad is public
    if (squad.visibility !== 'public') {
      return NextResponse.json({ 
        error: 'This squad is private. Use an invite code to join.' 
      }, { status: 403 });
    }

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
    if (currentSquadIds.includes(squadId)) {
      return NextResponse.json({ error: 'You are already a member of this squad' }, { status: 400 });
    }

    // Check if squad is at capacity
    const memberIds = squad.memberIds || [];
    if (memberIds.length >= MAX_SQUAD_MEMBERS) {
      return NextResponse.json({ 
        error: 'This squad is full and cannot accept new members.' 
      }, { status: 400 });
    }

    // Check if already a member in memberIds array
    if (memberIds.includes(userId)) {
      return NextResponse.json({ error: 'You are already a member of this squad' }, { status: 400 });
    }

    // Add user to squad
    const now = new Date().toISOString();

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
    const updatedSquadIds = [...currentSquadIds, squadId];
    const userUpdate: Record<string, unknown> = { 
      squadIds: updatedSquadIds,
      updatedAt: now,
      // Keep legacy field in sync for backward compatibility
      squadId: squadId,
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
        await channel.sendMessage({
          text: `${clerkUser.firstName || 'Someone'} has joined the squad!`,
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
        console.log(`[SQUAD_JOIN] Added user ${userId} to organization ${squad.organizationId}`);
      } catch (orgError) {
        console.error('[SQUAD_JOIN_ORG_ERROR]', orgError);
        // Don't fail the join if org assignment fails
      }
    }

    return NextResponse.json({ 
      success: true,
      hasCoach: squadHasCoach,
    });
  } catch (error) {
    console.error('[SQUAD_JOIN_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
