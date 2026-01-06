/**
 * Sync Coaching Client Data
 *
 * POST /api/coaching/clients/sync
 *
 * Updates denormalized data (user info, activity scores) on clientCoachingData documents.
 * This enables fast list queries without joining multiple collections.
 *
 * Can be called:
 * - By the daily client-analytics cron job
 * - Manually by an admin
 * - On-demand when a user profile is updated
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import type { UserRole, FirebaseUser, ClientCoachingData } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max

interface SyncStats {
  totalProcessed: number;
  userDataUpdated: number;
  activityDataUpdated: number;
  errors: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Check authorization - either cron secret or admin user
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    let isAuthorized = false;

    // Check cron secret first
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      isAuthorized = true;
    } else {
      // Check if authenticated user is admin
      const { userId, sessionClaims } = await auth();
      if (userId) {
        const role = (sessionClaims?.publicMetadata as { role?: UserRole })?.role;
        if (canAccessCoachDashboard(role) && (role === 'admin' || role === 'super_admin')) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body for optional filters
    let body: { organizationId?: string; userId?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine
    }

    const stats: SyncStats = {
      totalProcessed: 0,
      userDataUpdated: 0,
      activityDataUpdated: 0,
      errors: 0,
    };

    // Build query for clientCoachingData documents to sync
    let query: FirebaseFirestore.Query = adminDb.collection('clientCoachingData');

    if (body.organizationId) {
      query = query.where('organizationId', '==', body.organizationId);
    }

    if (body.userId) {
      query = query.where('userId', '==', body.userId);
    }

    const clientsSnapshot = await query.get();
    console.log(`[COACHING_SYNC] Processing ${clientsSnapshot.size} client documents`);

    // Process in batches of 100 to avoid overwhelming Firestore
    const BATCH_SIZE = 100;
    const docs = clientsSnapshot.docs;

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = docs.slice(i, i + BATCH_SIZE);
      const writeBatch = adminDb.batch();
      let batchHasUpdates = false;

      // Collect userIds and orgIds for batch lookups
      const userIds = [...new Set(batch.map(doc => doc.data().userId))];
      const orgUserPairs = batch.map(doc => ({
        docId: doc.id,
        userId: doc.data().userId,
        orgId: doc.data().organizationId,
      }));

      // Batch fetch user data
      const userDocs = await Promise.all(
        userIds.map(id => adminDb.collection('users').doc(id).get())
      );
      const userMap = new Map<string, Partial<FirebaseUser>>();
      userDocs.forEach(doc => {
        if (doc.exists) {
          const userData = doc.data() as FirebaseUser;
          userMap.set(doc.id, {
            firstName: userData.firstName,
            lastName: userData.lastName,
            email: userData.email,
            imageUrl: userData.imageUrl,
            timezone: userData.timezone,
          });
        }
      });

      // Batch fetch membership data (for activity scores)
      // Group by organization for efficient queries
      const orgGroups = new Map<string, string[]>();
      for (const pair of orgUserPairs) {
        if (!orgGroups.has(pair.orgId)) {
          orgGroups.set(pair.orgId, []);
        }
        orgGroups.get(pair.orgId)!.push(pair.userId);
      }

      const activityMap = new Map<string, {
        activityStatus?: 'thriving' | 'active' | 'inactive';
        atRisk?: boolean;
        lastActivityAt?: string;
        daysActiveInPeriod?: number;
      }>();

      for (const [orgId, orgUserIds] of orgGroups) {
        // Firestore 'in' query limit is 30
        for (let j = 0; j < orgUserIds.length; j += 30) {
          const userBatch = orgUserIds.slice(j, j + 30);
          try {
            const membershipSnapshot = await adminDb.collection('org_memberships')
              .where('organizationId', '==', orgId)
              .where('userId', 'in', userBatch)
              .select('userId', 'activityStatus', 'atRisk', 'lastActivityAt', 'daysActiveInPeriod')
              .get();

            membershipSnapshot.docs.forEach(doc => {
              const data = doc.data();
              // Use composite key for unique lookup
              activityMap.set(`${orgId}_${data.userId}`, {
                activityStatus: data.activityStatus,
                atRisk: data.atRisk,
                lastActivityAt: data.lastActivityAt,
                daysActiveInPeriod: data.daysActiveInPeriod,
              });
            });
          } catch (err) {
            console.warn(`[COACHING_SYNC] Failed to fetch memberships for org ${orgId}:`, err);
          }
        }
      }

      // Update each document with denormalized data
      const now = new Date().toISOString();

      for (const doc of batch) {
        try {
          const data = doc.data() as ClientCoachingData;
          const updateData: Partial<ClientCoachingData> = {};
          let hasChanges = false;

          // Check and update user data
          const userData = userMap.get(data.userId);
          if (userData) {
            if (data.cachedUserFirstName !== userData.firstName) {
              updateData.cachedUserFirstName = userData.firstName || '';
              hasChanges = true;
            }
            if (data.cachedUserLastName !== userData.lastName) {
              updateData.cachedUserLastName = userData.lastName || '';
              hasChanges = true;
            }
            if (data.cachedUserEmail !== userData.email) {
              updateData.cachedUserEmail = userData.email || '';
              hasChanges = true;
            }
            if (data.cachedUserImageUrl !== userData.imageUrl) {
              updateData.cachedUserImageUrl = userData.imageUrl || '';
              hasChanges = true;
            }
            if (data.cachedUserTimezone !== userData.timezone) {
              updateData.cachedUserTimezone = userData.timezone;
              hasChanges = true;
            }

            if (hasChanges) {
              stats.userDataUpdated++;
            }
          }

          // Check and update activity data
          const activityKey = `${data.organizationId}_${data.userId}`;
          const activityData = activityMap.get(activityKey);
          if (activityData) {
            const activityChanged =
              data.cachedActivityStatus !== activityData.activityStatus ||
              data.cachedActivityAtRisk !== activityData.atRisk ||
              data.cachedActivityLastAt !== activityData.lastActivityAt ||
              data.cachedActivityDaysActive !== activityData.daysActiveInPeriod;

            if (activityChanged) {
              updateData.cachedActivityStatus = activityData.activityStatus;
              updateData.cachedActivityAtRisk = activityData.atRisk;
              updateData.cachedActivityLastAt = activityData.lastActivityAt;
              updateData.cachedActivityDaysActive = activityData.daysActiveInPeriod;
              stats.activityDataUpdated++;
              hasChanges = true;
            }
          }

          // Only write if there are changes
          if (hasChanges) {
            updateData.cachedDataUpdatedAt = now;
            writeBatch.update(doc.ref, updateData);
            batchHasUpdates = true;
          }

          stats.totalProcessed++;
        } catch (err) {
          console.error(`[COACHING_SYNC] Error processing doc ${doc.id}:`, err);
          stats.errors++;
        }
      }

      // Commit batch if there were updates
      if (batchHasUpdates) {
        await writeBatch.commit();
      }

      console.log(`[COACHING_SYNC] Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(docs.length / BATCH_SIZE)}`);
    }

    const duration = Date.now() - startTime;
    console.log(`[COACHING_SYNC] Completed in ${duration}ms:`, stats);

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      stats,
    });
  } catch (error) {
    console.error('[COACHING_SYNC_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
