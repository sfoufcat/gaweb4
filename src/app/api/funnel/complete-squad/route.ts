import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { syncAccessStatus } from '@/lib/user-access';
import { getStreamServerClient } from '@/lib/stream-server';
import { addUserToOrganization } from '@/lib/clerk-organizations';
import type { Squad } from '@/types';

/**
 * POST /api/funnel/complete-squad
 * Complete a squad funnel and add user to the squad
 * 
 * Body:
 * - sessionId: string - Flow session ID
 * - funnelId: string - Funnel ID
 * - squadId: string - Target squad ID
 * - organizationId: string - Organization ID
 * - inviteCode?: string - Optional invite code used
 * - data?: object - Funnel session data (goal, identity, etc.)
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, funnelId, squadId, organizationId, inviteCode, data } = body;

    // Validate required fields
    if (!funnelId || !squadId || !organizationId) {
      return NextResponse.json(
        { error: 'Missing required fields: funnelId, squadId, organizationId' },
        { status: 400 }
      );
    }

    // Verify squad exists and belongs to the org
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();
    if (!squadDoc.exists) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    const squad = squadDoc.data() as Squad;
    if (squad?.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Squad does not belong to this organization' },
        { status: 403 }
      );
    }

    // Verify funnel exists and targets this squad
    const funnelDoc = await adminDb.collection('funnels').doc(funnelId).get();
    if (!funnelDoc.exists) {
      return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });
    }

    const funnel = funnelDoc.data();
    if (funnel?.squadId !== squadId) {
      return NextResponse.json(
        { error: 'Funnel does not target this squad' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    
    // Get user info from Clerk
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);

    // Check for existing org membership
    const membershipQuery = await adminDb
      .collection('org_memberships')
      .where('userId', '==', userId)
      .where('organizationId', '==', organizationId)
      .limit(1)
      .get();

    if (membershipQuery.empty) {
      // Create new membership with squad assignment
      await adminDb.collection('org_memberships').add({
        userId,
        organizationId,
        orgRole: 'member',
        tier: 'standard',
        track: null,
        squadId,
        premiumSquadId: null,
        accessSource: inviteCode ? 'invite_code' : 'coach_billing',
        accessExpiresAt: null,
        inviteCodeUsed: inviteCode || null,
        isActive: true,
        hasActiveAccess: true,
        accessReason: 'squad',
        joinedAt: now,
        createdAt: now,
        updatedAt: now,
        // Store funnel data if provided
        ...(data?.goal && { goal: data.goal }),
        ...(data?.goalTargetDate && { goalTargetDate: data.goalTargetDate }),
        ...(data?.identity && { identity: data.identity }),
      });

      console.log(`[COMPLETE_SQUAD] Created membership for user ${userId} in org ${organizationId} with squad ${squadId}`);
    } else {
      // Update existing membership with squad assignment
      const membershipDoc = membershipQuery.docs[0];
      const existingData = membershipDoc.data();

      await membershipDoc.ref.update({
        squadId,
        hasActiveAccess: true,
        accessReason: 'squad',
        updatedAt: now,
        // Update funnel data if provided (don't overwrite if not provided)
        ...(data?.goal && { goal: data.goal }),
        ...(data?.goalTargetDate && { goalTargetDate: data.goalTargetDate }),
        ...(data?.identity && { identity: data.identity }),
      });

      console.log(`[COMPLETE_SQUAD] Updated membership ${membershipDoc.id} for user ${userId} with squad ${squadId}`);
    }

    // ============================================
    // ADD USER TO SQUAD (memberIds, squadMembers, etc.)
    // ============================================
    
    // Get user's existing squad memberships
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

    // Check if user is already a member of this squad
    const memberIds = squad.memberIds || [];
    const alreadyMember = memberIds.includes(userId) || currentSquadIds.includes(squadId);

    if (!alreadyMember) {
      // Update squad memberIds
      await adminDb.collection('squads').doc(squadId).update({
        memberIds: [...memberIds, userId],
        updatedAt: now,
      });
      console.log(`[COMPLETE_SQUAD] Added user ${userId} to squad ${squadId} memberIds`);

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
      console.log(`[COMPLETE_SQUAD] Created squadMember document for user ${userId} in squad ${squadId}`);

      // Update user's squadIds array
      const updatedSquadIds = [...currentSquadIds, squadId];
      await adminDb.collection('users').doc(userId).set({
        squadIds: updatedSquadIds,
        // Keep legacy field in sync for backward compatibility
        squadId,
        updatedAt: now,
      }, { merge: true });
      console.log(`[COMPLETE_SQUAD] Updated user ${userId} squadIds array`);

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
          console.log(`[COMPLETE_SQUAD] Added user ${userId} to Stream Chat channel ${squad.chatChannelId}`);
        } catch (streamError) {
          console.error('[COMPLETE_SQUAD] Stream Chat error (non-fatal):', streamError);
          // Don't fail the request for this
        }
      }

      // Add user to Clerk organization
      if (squad.organizationId) {
        try {
          await addUserToOrganization(userId, squad.organizationId, 'org:member');
          console.log(`[COMPLETE_SQUAD] Added user ${userId} to Clerk organization ${squad.organizationId}`);
        } catch (orgError) {
          console.error('[COMPLETE_SQUAD] Clerk organization error (non-fatal):', orgError);
          // Don't fail the request for this
        }
      }
    } else {
      console.log(`[COMPLETE_SQUAD] User ${userId} is already a member of squad ${squadId}, skipping squad membership creation`);
    }

    // Mark flow session as completed
    if (sessionId) {
      try {
        await adminDb.collection('flow_sessions').doc(sessionId).update({
          completedAt: now,
          status: 'completed',
          updatedAt: now,
        });
        console.log(`[COMPLETE_SQUAD] Marked session ${sessionId} as completed`);
      } catch (err) {
        // Session might not exist, that's okay
        console.log(`[COMPLETE_SQUAD] Could not update session ${sessionId}:`, err);
      }
    }

    // Sync access status to ensure consistency
    try {
      await syncAccessStatus(userId, organizationId);
    } catch (err) {
      console.error(`[COMPLETE_SQUAD] Failed to sync access status:`, err);
      // Don't fail the request for this
    }

    // Update invite code usage if applicable
    if (inviteCode) {
      try {
        const inviteRef = adminDb.collection('squad_invites').doc(inviteCode.toUpperCase());
        const inviteDoc = await inviteRef.get();
        
        if (inviteDoc.exists) {
          const currentCount = inviteDoc.data()?.useCount || 0;
          await inviteRef.update({
            useCount: currentCount + 1,
            lastUsedAt: now,
          });
          console.log(`[COMPLETE_SQUAD] Updated invite code ${inviteCode} usage count to ${currentCount + 1}`);
        }
      } catch (err) {
        console.error(`[COMPLETE_SQUAD] Failed to update invite code:`, err);
        // Don't fail the request for this
      }
    }

    // Update funnel statistics
    try {
      const funnelRef = adminDb.collection('funnels').doc(funnelId);
      await adminDb.runTransaction(async (transaction) => {
        const funnelSnap = await transaction.get(funnelRef);
        if (funnelSnap.exists) {
          const completions = (funnelSnap.data()?.completions || 0) + 1;
          transaction.update(funnelRef, { 
            completions,
            lastCompletionAt: now,
          });
        }
      });
    } catch (err) {
      console.error(`[COMPLETE_SQUAD] Failed to update funnel stats:`, err);
      // Don't fail the request for this
    }

    console.log(`[COMPLETE_SQUAD] Successfully completed squad funnel for user ${userId}, squad ${squadId}`);

    return NextResponse.json({ 
      success: true,
      squadId,
      organizationId,
    });
  } catch (error) {
    console.error('[COMPLETE_SQUAD] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

