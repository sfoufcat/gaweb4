import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getStreamServerClient } from '@/lib/stream-server';
import { MAX_SQUAD_MEMBERS } from '@/lib/squad-constants';
import { addUserToOrganization } from '@/lib/clerk-organizations';
import type { Squad } from '@/types';

/**
 * POST /api/squad/join-by-code
 * Join a squad using an invite code (for private squads).
 * 
 * Body:
 * - code: string (required) - The invite code (e.g., "GA-XY29Q8")
 */
export async function POST(req: Request) {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { code } = body as { code: string };

    if (!code?.trim()) {
      return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
    }

    // Normalize the code
    const normalizedCode = code.trim().toUpperCase();

    // Check if user is already in a squad (still need Firebase for squadId)
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (userDoc.exists && userDoc.data()?.squadId) {
      return NextResponse.json({ 
        error: 'You are already in a squad. Leave your current squad first.' 
      }, { status: 400 });
    }

    // Get user tier from Clerk session (SINGLE SOURCE OF TRUTH - no DB call needed for tier)
    // Note: Coaching is NOT a tier - it's a separate product. Only standard/premium/free are tiers.
    const publicMetadata = sessionClaims?.publicMetadata as { tier?: string } | undefined;
    const userTier = publicMetadata?.tier || 'standard';
    // Premium users can join premium squads - coaching status doesn't affect squad tier requirements
    const isPremiumUser = userTier === 'premium';

    // Find squad by invite code
    const squadsSnapshot = await adminDb.collection('squads')
      .where('inviteCode', '==', normalizedCode)
      .limit(1)
      .get();

    if (squadsSnapshot.empty) {
      return NextResponse.json({ error: 'No squad found with that invite code.' }, { status: 404 });
    }

    const squadDoc = squadsSnapshot.docs[0];
    const squadId = squadDoc.id;
    const squad = squadDoc.data() as Squad;
    const squadRef = adminDb.collection('squads').doc(squadId);

    // Validate tier compatibility for private squad joining
    // Premium users can only join premium squads, standard users can only join standard squads
    if (isPremiumUser && !squad.isPremium) {
      return NextResponse.json({ 
        error: 'Premium users can only join premium squads.' 
      }, { status: 403 });
    }
    if (!isPremiumUser && squad.isPremium) {
      return NextResponse.json({ 
        error: 'This is a premium squad. Upgrade to premium to access premium squads.' 
      }, { status: 403 });
    }

    // Check if squad is at capacity
    const memberIds = squad.memberIds || [];
    if (memberIds.length >= MAX_SQUAD_MEMBERS) {
      return NextResponse.json({ 
        error: 'This squad is full and cannot accept new members.' 
      }, { status: 400 });
    }

    // Add user to squad
    const now = new Date().toISOString();
    
    // Check if already a member
    if (memberIds.includes(userId)) {
      return NextResponse.json({ error: 'You are already a member of this squad' }, { status: 400 });
    }

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

    // Update user's squadId
    await adminDb.collection('users').doc(userId).update({
      squadId,
      updatedAt: now,
    });

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
        console.log(`[SQUAD_JOIN_BY_CODE] Added user ${userId} to organization ${squad.organizationId}`);
      } catch (orgError) {
        console.error('[SQUAD_JOIN_BY_CODE_ORG_ERROR]', orgError);
        // Don't fail the join if org assignment fails
      }
    }

    return NextResponse.json({ 
      success: true,
      squadName: squad.name,
    });
  } catch (error) {
    console.error('[SQUAD_JOIN_BY_CODE_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

