/**
 * Last Activity Tracker
 * 
 * Updates lastActivityAt on org_memberships for denormalized activity tracking.
 * This enables fast queries without recomputing activity every time.
 */

import { adminDb } from '../firebase-admin';

export type ActivityType = 'task' | 'habit' | 'checkin' | 'weekly';

/**
 * Update lastActivityAt on the user's org_membership
 * 
 * @param userId - The user's ID
 * @param organizationId - The organization ID
 * @param activityType - Type of activity that triggered the update
 */
export async function updateLastActivity(
  userId: string,
  organizationId: string,
  activityType: ActivityType
): Promise<void> {
  if (!userId || !organizationId) {
    console.warn('[LAST_ACTIVITY] Missing userId or organizationId, skipping update');
    return;
  }

  try {
    const now = new Date().toISOString();
    
    // Find the user's active membership in this org
    const membershipsSnapshot = await adminDb
      .collection('org_memberships')
      .where('userId', '==', userId)
      .where('organizationId', '==', organizationId)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (membershipsSnapshot.empty) {
      // User may not have a membership doc yet (legacy users)
      // Try to update user doc directly as fallback
      await adminDb.collection('users').doc(userId).update({
        lastActivityAt: now,
        lastActivityType: activityType,
      }).catch(() => {
        // Ignore if user doc doesn't exist or update fails
      });
      return;
    }

    // Update the membership doc
    const membershipDoc = membershipsSnapshot.docs[0];
    await membershipDoc.ref.update({
      lastActivityAt: now,
      lastActivityType: activityType,
      updatedAt: now,
    });
  } catch (error) {
    // Log but don't throw - this should never break the main operation
    console.error('[LAST_ACTIVITY] Failed to update lastActivityAt:', error);
  }
}

/**
 * Batch update lastActivityAt for multiple users
 * Used by cron jobs or admin operations
 */
export async function batchUpdateLastActivity(
  updates: Array<{
    userId: string;
    organizationId: string;
    activityType: ActivityType;
    timestamp: string;
  }>
): Promise<number> {
  if (updates.length === 0) return 0;

  const batch = adminDb.batch();
  let updateCount = 0;

  // Group updates by org for efficient querying
  const updatesByOrg = new Map<string, typeof updates>();
  for (const update of updates) {
    const key = update.organizationId;
    if (!updatesByOrg.has(key)) {
      updatesByOrg.set(key, []);
    }
    updatesByOrg.get(key)!.push(update);
  }

  for (const [orgId, orgUpdates] of updatesByOrg) {
    const userIds = orgUpdates.map(u => u.userId);
    
    // Get all memberships for these users in this org
    const membershipsSnapshot = await adminDb
      .collection('org_memberships')
      .where('organizationId', '==', orgId)
      .where('userId', 'in', userIds.slice(0, 30)) // Firestore limit
      .where('isActive', '==', true)
      .get();

    // Create a map of userId -> membership doc
    const membershipMap = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    for (const doc of membershipsSnapshot.docs) {
      membershipMap.set(doc.data().userId, doc);
    }

    // Queue updates
    for (const update of orgUpdates) {
      const membershipDoc = membershipMap.get(update.userId);
      if (membershipDoc) {
        batch.update(membershipDoc.ref, {
          lastActivityAt: update.timestamp,
          lastActivityType: update.activityType,
          updatedAt: update.timestamp,
        });
        updateCount++;
      }
    }
  }

  if (updateCount > 0) {
    await batch.commit();
  }

  return updateCount;
}




