/**
 * Squad Coach Utilities
 *
 * Helper functions for managing coach assignments in squads.
 * Used when changing the primary program coach.
 */

import { adminDb } from '@/lib/firebase-admin';
import { getStreamServerClient } from '@/lib/stream-server';
import { clerkClient } from '@clerk/nextjs/server';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Add a coach to a squad
 * - Creates squadMembers record with roleInSquad: 'coach'
 * - Updates squads.coachId and memberIds
 * - Adds coach to Stream Chat channel
 */
export async function addCoachToSquad(squadId: string, coachId: string): Promise<void> {
  const now = new Date().toISOString();

  // Check if coach is already in squad
  const existingMembership = await adminDb
    .collection('squadMembers')
    .where('squadId', '==', squadId)
    .where('userId', '==', coachId)
    .limit(1)
    .get();

  if (!existingMembership.empty) {
    // Coach already in squad - just ensure they have coach role
    const existingDoc = existingMembership.docs[0];
    if (existingDoc.data().roleInSquad !== 'coach') {
      await existingDoc.ref.update({
        roleInSquad: 'coach',
        updatedAt: now,
      });
    }
    // Update squad.coachId if needed
    await adminDb.collection('squads').doc(squadId).update({
      coachId: coachId,
      updatedAt: now,
    });
    return;
  }

  // Create squadMember record
  await adminDb.collection('squadMembers').add({
    squadId,
    userId: coachId,
    roleInSquad: 'coach',
    createdAt: now,
    updatedAt: now,
  });

  // Update squad document
  await adminDb.collection('squads').doc(squadId).update({
    coachId: coachId,
    memberIds: FieldValue.arrayUnion(coachId),
    updatedAt: now,
  });

  // Update user's squadIds
  await adminDb.collection('users').doc(coachId).set({
    squadIds: FieldValue.arrayUnion(squadId),
    updatedAt: now,
  }, { merge: true });

  // Add coach to Stream Chat channel
  const squadDoc = await adminDb.collection('squads').doc(squadId).get();
  const squadData = squadDoc.data();

  if (squadData?.chatChannelId) {
    try {
      const streamClient = await getStreamServerClient();
      const clerk = await clerkClient();

      // Ensure coach exists in Stream
      const clerkUser = await clerk.users.getUser(coachId);
      await streamClient.upsertUser({
        id: coachId,
        name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'Coach',
        image: clerkUser.imageUrl,
      });

      // Add to channel
      const channel = streamClient.channel('messaging', squadData.chatChannelId);
      await channel.addMembers([coachId]);
    } catch (streamError) {
      console.error(`[SQUAD_COACH_UTILS] Failed to add coach ${coachId} to Stream channel:`, streamError);
      // Non-fatal - coach is still added to squad
    }
  }

  console.log(`[SQUAD_COACH_UTILS] Added coach ${coachId} to squad ${squadId}`);
}

/**
 * Remove a coach from a squad
 * - Deletes squadMembers record
 * - Clears squads.coachId
 * - Removes from memberIds
 * - Removes from Stream Chat channel
 */
export async function removeCoachFromSquad(squadId: string, coachId: string): Promise<void> {
  const now = new Date().toISOString();

  // Find the coach's membership
  const membershipSnapshot = await adminDb
    .collection('squadMembers')
    .where('squadId', '==', squadId)
    .where('userId', '==', coachId)
    .limit(1)
    .get();

  // Remove from Stream Chat first
  const squadDoc = await adminDb.collection('squads').doc(squadId).get();
  const squadData = squadDoc.data();

  if (squadData?.chatChannelId) {
    try {
      const streamClient = await getStreamServerClient();
      const channel = streamClient.channel('messaging', squadData.chatChannelId);
      await channel.removeMembers([coachId]);
    } catch (streamError) {
      console.error(`[SQUAD_COACH_UTILS] Failed to remove coach ${coachId} from Stream channel:`, streamError);
      // Non-fatal
    }
  }

  // Clear coach from squad
  await adminDb.collection('squads').doc(squadId).update({
    coachId: null,
    memberIds: FieldValue.arrayRemove(coachId),
    updatedAt: now,
  });

  // Delete membership if exists
  if (!membershipSnapshot.empty) {
    await membershipSnapshot.docs[0].ref.delete();
  }

  // Update user's squadIds
  await adminDb.collection('users').doc(coachId).set({
    squadIds: FieldValue.arrayRemove(squadId),
    updatedAt: now,
  }, { merge: true });

  console.log(`[SQUAD_COACH_UTILS] Removed coach ${coachId} from squad ${squadId}`);
}

/**
 * Replace coach in all squads for a program
 * Used when the primary program coach is changed.
 */
export async function replaceCoachInProgramSquads(
  programId: string,
  oldCoachId: string | null | undefined,
  newCoachId: string,
  organizationId: string
): Promise<{ updated: number; errors: string[] }> {
  const errors: string[] = [];
  let updated = 0;

  // Query all squads for this program
  const squadsSnapshot = await adminDb
    .collection('squads')
    .where('programId', '==', programId)
    .where('organizationId', '==', organizationId)
    .get();

  console.log(`[SQUAD_COACH_UTILS] Replacing coach in ${squadsSnapshot.size} squads for program ${programId}`);

  for (const squadDoc of squadsSnapshot.docs) {
    const squadId = squadDoc.id;

    try {
      // Remove old coach if exists and different from new coach
      if (oldCoachId && oldCoachId !== newCoachId) {
        const squadData = squadDoc.data();
        // Only remove if the old coach is actually the current coach
        if (squadData.coachId === oldCoachId) {
          await removeCoachFromSquad(squadId, oldCoachId);
        }
      }

      // Add new coach
      await addCoachToSquad(squadId, newCoachId);
      updated++;
    } catch (error) {
      const errorMsg = `Failed to update squad ${squadId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`[SQUAD_COACH_UTILS] ${errorMsg}`);
      errors.push(errorMsg);
    }
  }

  console.log(`[SQUAD_COACH_UTILS] Completed coach replacement: ${updated} updated, ${errors.length} errors`);

  return { updated, errors };
}
