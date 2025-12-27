import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { getStreamServerClient } from '@/lib/stream-server';
import { FieldValue } from 'firebase-admin/firestore';
import type { SquadMember, SquadRoleInSquad } from '@/types';

/**
 * GET /api/coach/org-squads/[squadId]/members
 * Get all members of a squad (coach only - must belong to coach's org)
 */
export async function GET(
  req: Request,
  context: { params: Promise<{ squadId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { squadId } = await context.params;

    // Verify squad belongs to coach's organization
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();
    if (!squadDoc.exists) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }
    
    const squadData = squadDoc.data();
    if (squadData?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Squad does not belong to your organization' }, { status: 403 });
    }

    // Fetch all members of this squad
    const membersSnapshot = await adminDb.collection('squadMembers')
      .where('squadId', '==', squadId)
      .get();

    const members: SquadMember[] = [];
    const clerk = await clerkClient();
    
    for (const doc of membersSnapshot.docs) {
      const memberData = doc.data();
      
      // Fetch user details from Clerk (source of truth for user identity)
      let firstName = '';
      let lastName = '';
      let imageUrl = '';
      
      try {
        const clerkUser = await clerk.users.getUser(memberData.userId);
        firstName = clerkUser.firstName || '';
        lastName = clerkUser.lastName || '';
        imageUrl = clerkUser.imageUrl || '';
      } catch (err) {
        console.error(`Failed to fetch Clerk user ${memberData.userId}:`, err);
        // Fallback to Firebase data if Clerk fails
        const userDoc = await adminDb.collection('users').doc(memberData.userId).get();
        const userData = userDoc.exists ? userDoc.data() : null;
        firstName = userData?.firstName || '';
        lastName = userData?.lastName || '';
        imageUrl = userData?.avatarUrl || userData?.imageUrl || '';
      }

      members.push({
        id: doc.id,
        squadId: memberData.squadId,
        userId: memberData.userId,
        roleInSquad: memberData.roleInSquad || 'member',
        firstName,
        lastName,
        imageUrl,
        alignmentScore: memberData.alignmentScore || null,
        streak: memberData.streak || null,
        moodState: memberData.moodState || null,
        createdAt: memberData.createdAt || new Date().toISOString(),
        updatedAt: memberData.updatedAt || new Date().toISOString(),
      });
    }

    return NextResponse.json({ members });
  } catch (error) {
    console.error('[COACH_SQUAD_MEMBERS_GET_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    if (message.includes('Forbidden')) {
      return new NextResponse('Forbidden', { status: 403 });
    }
    
    return new NextResponse('Internal Error', { status: 500 });
  }
}

/**
 * POST /api/coach/org-squads/[squadId]/members
 * Add a user to a squad (coach only - must belong to coach's org)
 */
export async function POST(
  req: Request,
  context: { params: Promise<{ squadId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { squadId } = await context.params;
    const body = await req.json();
    const { userId, roleInSquad = 'member' } = body as { userId: string; roleInSquad?: SquadRoleInSquad };

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Verify squad belongs to coach's organization
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();
    if (!squadDoc.exists) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }
    
    const squadData = squadDoc.data();
    if (squadData?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Squad does not belong to your organization' }, { status: 403 });
    }

    // Check if user exists
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is already in this squad (duplicate check)
    const existingMembership = await adminDb.collection('squadMembers')
      .where('squadId', '==', squadId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (!existingMembership.empty) {
      return NextResponse.json({ error: 'User is already in this squad' }, { status: 400 });
    }

    // Create the membership
    const memberData = {
      squadId,
      userId,
      roleInSquad,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const memberRef = await adminDb.collection('squadMembers').add(memberData);
    
    // Also update squads.memberIds array to keep in sync
    await adminDb.collection('squads').doc(squadId).update({
      memberIds: FieldValue.arrayUnion(userId),
      updatedAt: new Date().toISOString(),
    });

    // If adding as coach, update the squad's coachId
    if (roleInSquad === 'coach') {
      await adminDb.collection('squads').doc(squadId).update({
        coachId: userId,
        updatedAt: new Date().toISOString(),
      });
    }

    // Add user to the squad's Stream Chat channel
    if (squadData?.chatChannelId) {
      try {
        const streamClient = await getStreamServerClient();
        const clerk = await clerkClient();
        
        // Upsert user in Stream Chat
        const clerkUser = await clerk.users.getUser(userId);
        await streamClient.upsertUser({
          id: userId,
          name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'User',
          image: clerkUser.imageUrl,
        });
        
        // Add to channel
        const channel = streamClient.channel('messaging', squadData.chatChannelId);
        await channel.addMembers([userId]);
      } catch (streamError) {
        console.error('[STREAM_ADD_MEMBER_ERROR]', streamError);
        // Don't fail the request if Stream fails - the user is still added to the squad
      }
    }

    return NextResponse.json({ 
      success: true, 
      member: { id: memberRef.id, ...memberData } 
    });
  } catch (error) {
    console.error('[COACH_SQUAD_MEMBERS_POST_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    if (message.includes('Forbidden')) {
      return new NextResponse('Forbidden', { status: 403 });
    }
    
    return new NextResponse('Internal Error', { status: 500 });
  }
}

/**
 * DELETE /api/coach/org-squads/[squadId]/members
 * Remove a user from a squad (coach only - must belong to coach's org)
 * Uses query param: ?userId=xxx
 */
export async function DELETE(
  req: Request,
  context: { params: Promise<{ squadId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { squadId } = await context.params;
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Verify squad belongs to coach's organization
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();
    if (!squadDoc.exists) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }
    
    const squadData = squadDoc.data();
    if (squadData?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Squad does not belong to your organization' }, { status: 403 });
    }

    // Find the membership
    const membershipSnapshot = await adminDb.collection('squadMembers')
      .where('squadId', '==', squadId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (membershipSnapshot.empty) {
      return NextResponse.json({ error: 'Member not found in this squad' }, { status: 404 });
    }

    const memberDoc = membershipSnapshot.docs[0];

    // Check if this user is the squad's coach
    if (squadData?.coachId === userId) {
      // Clear the coach from the squad
      await adminDb.collection('squads').doc(squadId).update({
        coachId: null,
        updatedAt: new Date().toISOString(),
      });
    }
    
    // Remove user from squads.memberIds array to keep in sync
    await adminDb.collection('squads').doc(squadId).update({
      memberIds: FieldValue.arrayRemove(userId),
      updatedAt: new Date().toISOString(),
    });

    // Remove user from the squad's Stream Chat channel
    if (squadData?.chatChannelId) {
      try {
        const streamClient = await getStreamServerClient();
        const channel = streamClient.channel('messaging', squadData.chatChannelId);
        await channel.removeMembers([userId]);
      } catch (streamError) {
        console.error('[STREAM_REMOVE_MEMBER_ERROR]', streamError);
        // Don't fail the request if Stream fails - the user is still removed from the squad
      }
    }

    // Delete the membership
    await memberDoc.ref.delete();

    // Update user document to remove squad references
    // This ensures /api/squad/me doesn't return stale squad data
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      const updateData: Record<string, unknown> = {
        squadIds: FieldValue.arrayRemove(squadId),
        updatedAt: new Date().toISOString(),
      };
      
      // Clear legacy fields if they match the removed squadId
      if (userData?.squadId === squadId) {
        updateData.squadId = null;
      }
      if (userData?.standardSquadId === squadId) {
        updateData.standardSquadId = null;
      }
      if (userData?.premiumSquadId === squadId) {
        updateData.premiumSquadId = null;
      }
      
      await adminDb.collection('users').doc(userId).update(updateData);
      console.log(`[COACH_SQUAD_MEMBERS] Updated user ${userId} document to remove squad ${squadId} references`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[COACH_SQUAD_MEMBERS_DELETE_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    if (message.includes('Forbidden')) {
      return new NextResponse('Forbidden', { status: 403 });
    }
    
    return new NextResponse('Internal Error', { status: 500 });
  }
}



