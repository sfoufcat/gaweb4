/**
 * POST /api/user/sync-squad-ids
 *
 * One-time sync endpoint to backfill user's squadIds from squadMembers collection.
 * This fixes users who enrolled in programs before the squadIds update was added.
 *
 * Can be removed after all affected users have synced.
 */

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all squad memberships for this user
    const membershipsSnapshot = await adminDb.collection('squadMembers')
      .where('userId', '==', userId)
      .get();

    if (membershipsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'No squad memberships found',
        squadIds: [],
      });
    }

    const squadIds = membershipsSnapshot.docs.map(doc => doc.data().squadId);

    // Update user document with all squadIds
    await adminDb.collection('users').doc(userId).set({
      squadIds: FieldValue.arrayUnion(...squadIds),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    console.log(`[SYNC_SQUAD_IDS] Synced ${squadIds.length} squadIds for user ${userId}:`, squadIds);

    return NextResponse.json({
      success: true,
      message: `Synced ${squadIds.length} squad(s)`,
      squadIds,
    });
  } catch (error) {
    console.error('[SYNC_SQUAD_IDS_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
