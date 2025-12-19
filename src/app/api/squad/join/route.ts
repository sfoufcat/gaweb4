import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getStreamServerClient } from '@/lib/stream-server';
import { MAX_SQUAD_MEMBERS } from '@/lib/squad-constants';
import type { Squad } from '@/types';

/**
 * POST /api/squad/join
 * Join a public squad by ID.
 * 
 * DUAL SQUAD SUPPORT:
 * - Premium users can join BOTH a standard squad AND a premium squad
 * - Standard users can only join standard squads
 * - Users can only have one squad of each type
 * 
 * Body:
 * - squadId: string (required)
 */
export async function POST(req: Request) {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { squadId } = body as { squadId: string };

    if (!squadId) {
      return NextResponse.json({ error: 'Squad ID is required' }, { status: 400 });
    }

    // Get user tier from Clerk session (SINGLE SOURCE OF TRUTH)
    const publicMetadata = sessionClaims?.publicMetadata as { tier?: string } | undefined;
    const userTier = publicMetadata?.tier || 'standard';
    const isPremiumUser = userTier === 'premium';

    // Get the squad first to determine its type
    const squadRef = adminDb.collection('squads').doc(squadId);
    const squadDoc = await squadRef.get();

    if (!squadDoc.exists) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    const squad = squadDoc.data() as Squad;
    const isTargetSquadPremium = squad.isPremium;

    // Verify squad is public
    if (squad.visibility !== 'public') {
      return NextResponse.json({ 
        error: 'This squad is private. Use an invite code to join.' 
      }, { status: 403 });
    }

    // Check user's existing squad memberships
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    
    // Get current squad IDs (support both new fields and legacy)
    let currentStandardSquadId = userData?.standardSquadId || null;
    let currentPremiumSquadId = userData?.premiumSquadId || null;
    
    // Fallback for legacy squadId
    if (!currentStandardSquadId && !currentPremiumSquadId && userData?.squadId) {
      const legacySquadDoc = await adminDb.collection('squads').doc(userData.squadId).get();
      if (legacySquadDoc.exists) {
        const legacySquadData = legacySquadDoc.data();
        if (legacySquadData?.isPremium) {
          currentPremiumSquadId = userData.squadId;
        } else {
          currentStandardSquadId = userData.squadId;
        }
      }
    }

    // Validate based on target squad type
    if (isTargetSquadPremium) {
      // Joining a premium squad
      if (!isPremiumUser) {
        return NextResponse.json({ 
          error: 'This is a premium squad. Upgrade to premium to access premium squads.' 
        }, { status: 403 });
      }
      if (currentPremiumSquadId) {
        return NextResponse.json({ 
          error: 'You are already in a premium squad. Leave your current premium squad first.' 
        }, { status: 400 });
      }
    } else {
      // Joining a standard squad
      if (currentStandardSquadId) {
        return NextResponse.json({ 
          error: 'You are already in a standard squad. Leave your current standard squad first.' 
        }, { status: 400 });
      }
    }

    // Check if squad is at capacity
    const memberIds = squad.memberIds || [];
    if (memberIds.length >= MAX_SQUAD_MEMBERS) {
      return NextResponse.json({ 
        error: 'This squad is full and cannot accept new members.' 
      }, { status: 400 });
    }

    // Check if already a member
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

    // Update user's squad field based on squad type
    const userUpdate: Record<string, unknown> = { updatedAt: now };
    if (isTargetSquadPremium) {
      userUpdate.premiumSquadId = squadId;
    } else {
      userUpdate.standardSquadId = squadId;
    }
    // Also update legacy squadId for backward compatibility if user has no squads yet
    if (!currentStandardSquadId && !currentPremiumSquadId) {
      userUpdate.squadId = squadId;
    }
    
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

    return NextResponse.json({ 
      success: true,
      squadType: isTargetSquadPremium ? 'premium' : 'standard',
    });
  } catch (error) {
    console.error('[SQUAD_JOIN_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
