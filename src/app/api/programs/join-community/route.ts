/**
 * Join Community API
 * 
 * POST /api/programs/join-community
 * 
 * Allows an enrolled user to opt-in to the client community squad
 * for an individual program.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getStreamServerClient } from '@/lib/stream-server';
import type { Program, ProgramEnrollment } from '@/types';

/**
 * Add user to squad (reused from enroll route pattern)
 */
async function addUserToSquad(
  userId: string,
  squadId: string,
  clerkUser: { firstName?: string | null; lastName?: string | null; imageUrl?: string }
): Promise<void> {
  const now = new Date().toISOString();
  
  // Update squad memberIds (arrayUnion is idempotent - won't duplicate)
  await adminDb.collection('squads').doc(squadId).update({
    memberIds: FieldValue.arrayUnion(userId),
    updatedAt: now,
  });

  // Check if squadMember record already exists to prevent duplicates
  const existingMember = await adminDb
    .collection('squadMembers')
    .where('squadId', '==', squadId)
    .where('userId', '==', userId)
    .limit(1)
    .get();

  if (!existingMember.empty) {
    console.log(`[JOIN_COMMUNITY] SquadMember record already exists for user ${userId} in squad ${squadId}`);
    return;
  }

  // Create squad member record
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

  // Update user's squadIds
  const userDoc = await adminDb.collection('users').doc(userId).get();
  if (userDoc.exists) {
    await adminDb.collection('users').doc(userId).update({
      squadIds: FieldValue.arrayUnion(squadId),
      updatedAt: now,
    });
  } else {
    await adminDb.collection('users').doc(userId).set({
      squadIds: [squadId],
      createdAt: now,
      updatedAt: now,
    });
  }

  // Add user to squad chat
  try {
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();
    const chatChannelId = squadDoc.data()?.chatChannelId;
    
    if (chatChannelId) {
      const streamClient = await getStreamServerClient();
      
      // Upsert user in Stream
      await streamClient.upsertUser({
        id: userId,
        name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'User',
        image: clerkUser.imageUrl,
      });
      
      // Add to channel
      const channel = streamClient.channel('messaging', chatChannelId);
      await channel.addMembers([userId]);
      
      console.log(`[JOIN_COMMUNITY] Added user ${userId} to chat channel ${chatChannelId}`);
    }
  } catch (chatError) {
    console.error(`[JOIN_COMMUNITY] Failed to add user to chat:`, chatError);
    // Don't fail - user is added to squad
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { programId } = body;

    if (!programId) {
      return NextResponse.json({ error: 'Program ID is required' }, { status: 400 });
    }

    // Get the program
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const program = { id: programDoc.id, ...programDoc.data() } as Program;

    // Verify it's an individual program with community enabled
    if (program.type !== 'individual') {
      return NextResponse.json({ error: 'This is not an individual program' }, { status: 400 });
    }

    if (!program.clientCommunityEnabled || !program.clientCommunitySquadId) {
      return NextResponse.json({ error: 'Client community is not enabled for this program' }, { status: 400 });
    }

    // Verify user has an active enrollment
    const enrollmentSnapshot = await adminDb.collection('program_enrollments')
      .where('programId', '==', programId)
      .where('userId', '==', userId)
      .where('status', 'in', ['active', 'upcoming'])
      .limit(1)
      .get();

    if (enrollmentSnapshot.empty) {
      return NextResponse.json({ error: 'You are not enrolled in this program' }, { status: 403 });
    }

    const enrollmentDoc = enrollmentSnapshot.docs[0];
    const enrollment = { id: enrollmentDoc.id, ...enrollmentDoc.data() } as ProgramEnrollment;

    // Check if already joined
    if (enrollment.joinedCommunity) {
      return NextResponse.json({ error: 'You have already joined the community' }, { status: 400 });
    }

    // Get user from Clerk
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);

    // Add user to squad
    await addUserToSquad(userId, program.clientCommunitySquadId, {
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      imageUrl: clerkUser.imageUrl,
    });

    // Update enrollment with joinedCommunity flag
    const now = new Date().toISOString();
    await enrollmentDoc.ref.update({
      joinedCommunity: true,
      updatedAt: now,
    });

    console.log(`[JOIN_COMMUNITY] User ${userId} joined community for program ${programId}`);

    return NextResponse.json({
      success: true,
      message: 'Successfully joined the community',
      squadId: program.clientCommunitySquadId,
    });

  } catch (error) {
    console.error('[JOIN_COMMUNITY_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to join community' },
      { status: 500 }
    );
  }
}

