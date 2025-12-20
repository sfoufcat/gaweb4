import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { getStreamServerClient } from '@/lib/stream-server';
import type { SquadVisibility, UserTrack } from '@/types';

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
 * PATCH /api/coach/org-squads/[squadId]
 * Updates a squad within the coach's organization
 * 
 * For multi-tenancy: Only allows updating squads with matching organizationId
 */
export async function PATCH(
  req: Request,
  context: { params: Promise<{ squadId: string }> }
) {
  try {
    // Check authorization and get organizationId
    const { organizationId } = await requireCoachWithOrg();

    const { squadId } = await context.params;

    console.log(`[COACH_ORG_SQUADS] Updating squad ${squadId} for organization: ${organizationId}`);

    // Check if squad exists and belongs to this organization
    const squadRef = adminDb.collection('squads').doc(squadId);
    const squadDoc = await squadRef.get();
    
    if (!squadDoc.exists) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    const existingData = squadDoc.data();
    
    // Verify squad belongs to this organization
    if (existingData?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Squad does not belong to your organization' }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, avatarUrl, visibility, timezone, isPremium, coachId, trackId } = body;

    // Validate premium squad requirements
    if (isPremium && !coachId) {
      return NextResponse.json({ error: 'Premium squads require a coach' }, { status: 400 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    if (visibility !== undefined) {
      updateData.visibility = visibility as SquadVisibility;
      // Generate invite code if switching to private and no code exists
      if (visibility === 'private' && !existingData?.inviteCode) {
        let isUnique = false;
        let newCode = '';
        while (!isUnique) {
          newCode = generateInviteCode();
          const existing = await adminDb.collection('squads')
            .where('inviteCode', '==', newCode)
            .limit(1)
            .get();
          isUnique = existing.empty;
        }
        updateData.inviteCode = newCode;
      }
    }
    if (timezone !== undefined) updateData.timezone = timezone;
    if (isPremium !== undefined) updateData.isPremium = isPremium;
    if (coachId !== undefined) updateData.coachId = coachId || null;
    if (trackId !== undefined) updateData.trackId = (trackId || null) as UserTrack | null;

    // Update squad
    await squadRef.update(updateData);

    // If a coach is set, ensure they're in squadMembers and Stream Chat channel
    if (coachId) {
      const existingMembership = await adminDb.collection('squadMembers')
        .where('squadId', '==', squadId)
        .where('userId', '==', coachId)
        .limit(1)
        .get();

      if (existingMembership.empty) {
        // Coach is not a member yet, add them to squadMembers
        await adminDb.collection('squadMembers').add({
          squadId,
          userId: coachId,
          roleInSquad: 'coach',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Also update the user's squadId field
        const userRef = adminDb.collection('users').doc(coachId);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
          await userRef.update({
            squadId,
            updatedAt: new Date().toISOString(),
          });
        }
      } else {
        // Coach is already a member, update their roleInSquad to 'coach'
        const memberDoc = existingMembership.docs[0];
        await memberDoc.ref.update({
          roleInSquad: 'coach',
          updatedAt: new Date().toISOString(),
        });
      }

      // ALWAYS ensure coach is in the Stream Chat channel (addMembers is idempotent)
      if (existingData?.chatChannelId) {
        try {
          const streamClient = await getStreamServerClient();
          const clerk = await clerkClient();
          
          // Upsert coach in Stream Chat
          const coachUser = await clerk.users.getUser(coachId);
          await streamClient.upsertUser({
            id: coachId,
            name: `${coachUser.firstName || ''} ${coachUser.lastName || ''}`.trim() || 'Coach',
            image: coachUser.imageUrl,
          });
          
          // Add to channel (idempotent - no-op if already member)
          const channel = streamClient.channel('messaging', existingData.chatChannelId);
          await channel.addMembers([coachId]);
        } catch (streamError) {
          console.error('[STREAM_ADD_COACH_ERROR]', streamError);
        }
      }
    }

    // Sync name/image changes with Stream Chat channel
    if (existingData?.chatChannelId && (name !== undefined || avatarUrl !== undefined)) {
      try {
        const streamClient = await getStreamServerClient();
        const channel = streamClient.channel('messaging', existingData.chatChannelId);
        const channelUpdate: Record<string, unknown> = {};
        if (name !== undefined) channelUpdate.name = name.trim();
        if (avatarUrl !== undefined) channelUpdate.image = avatarUrl || undefined;
        await channel.update(channelUpdate);
      } catch (streamError) {
        console.error('[STREAM_UPDATE_CHANNEL_ERROR]', streamError);
      }
    }

    console.log(`[COACH_ORG_SQUADS] Updated squad ${squadId} in organization ${organizationId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[COACH_ORG_SQUAD_UPDATE_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    if (message.includes('Organization not found')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/coach/org-squads/[squadId]
 * Deletes a squad within the coach's organization
 * 
 * For multi-tenancy: Only allows deleting squads with matching organizationId
 */
export async function DELETE(
  req: Request,
  context: { params: Promise<{ squadId: string }> }
) {
  try {
    // Check authorization and get organizationId
    const { organizationId } = await requireCoachWithOrg();

    const { squadId } = await context.params;

    console.log(`[COACH_ORG_SQUADS] Deleting squad ${squadId} for organization: ${organizationId}`);

    // Check if squad exists and belongs to this organization
    const squadRef = adminDb.collection('squads').doc(squadId);
    const squadDoc = await squadRef.get();
    
    if (!squadDoc.exists) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    const squadData = squadDoc.data();
    
    // Verify squad belongs to this organization
    if (squadData?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Squad does not belong to your organization' }, { status: 403 });
    }

    // Delete Stream Chat channel if it exists
    if (squadData?.chatChannelId) {
      try {
        const streamClient = await getStreamServerClient();
        const channel = streamClient.channel('messaging', squadData.chatChannelId);
        await channel.delete();
      } catch (streamError) {
        console.error('[STREAM_DELETE_CHANNEL_ERROR]', streamError);
        // Continue with squad deletion even if Stream fails
      }
    }

    // Delete squad
    await squadRef.delete();

    // Remove squad reference from all users
    const usersSnapshot = await adminDb.collection('users')
      .where('squadId', '==', squadId)
      .get();

    const batch = adminDb.batch();
    usersSnapshot.forEach((doc) => {
      batch.update(doc.ref, { 
        squadId: null,
        updatedAt: new Date().toISOString(),
      });
    });
    await batch.commit();

    // Delete all squad members
    const membersSnapshot = await adminDb.collection('squadMembers')
      .where('squadId', '==', squadId)
      .get();

    const membersBatch = adminDb.batch();
    membersSnapshot.forEach((doc) => {
      membersBatch.delete(doc.ref);
    });
    await membersBatch.commit();

    console.log(`[COACH_ORG_SQUADS] Deleted squad ${squadId} from organization ${organizationId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[COACH_ORG_SQUAD_DELETE_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    if (message.includes('Organization not found')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
