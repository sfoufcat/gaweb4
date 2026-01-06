/**
 * Client Analytics Cron
 * 
 * GET/POST /api/analytics/cron/client-analytics
 * 
 * Computes daily analytics for all clients per organization:
 * - Individual client activity status
 * - Org-level health summary (thriving/active/inactive counts)
 * - Updates lastActivityAt on user membership docs
 * 
 * Runs daily at 02:15 UTC via Vercel cron
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { batchResolveActivity, type ActivityResult } from '@/lib/analytics/activity';
import { ANALYTICS_COLLECTIONS } from '@/lib/analytics/constants';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max

export async function GET(request: NextRequest) {
  return handleCronRequest(request);
}

export async function POST(request: NextRequest) {
  return handleCronRequest(request);
}

async function handleCronRequest(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Validate cron secret
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET;
    
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = {
      orgsProcessed: 0,
      clientsProcessed: 0,
      membershipUpdates: 0,
      snapshotsCreated: 0,
      errors: 0,
    };

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const now = today.toISOString();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get all organizations to process
    const orgsSnapshot = await adminDb.collection('organizations').get();
    
    console.log(`[CLIENT_ANALYTICS] Processing ${orgsSnapshot.size} organizations`);

    for (const orgDoc of orgsSnapshot.docs) {
      try {
        const orgId = orgDoc.id;
        stats.orgsProcessed++;

        // Get all active memberships for this org
        const membershipsSnapshot = await adminDb
          .collection('org_memberships')
          .where('organizationId', '==', orgId)
          .where('isActive', '==', true)
          .get();

        if (membershipsSnapshot.empty) {
          // Save empty org snapshot
          await saveOrgClientSnapshot(orgId, todayStr, {
            totalClients: 0,
            thrivingCount: 0,
            activeCount: 0,
            inactiveCount: 0,
            atRiskCount: 0,
            activeRate: 0,
          });
          stats.snapshotsCreated++;
          continue;
        }

        const userIds = membershipsSnapshot.docs.map(d => d.data().userId);
        const uniqueUserIds = [...new Set(userIds)];
        
        console.log(`[CLIENT_ANALYTICS] Org ${orgId}: Processing ${uniqueUserIds.length} clients`);

        // Batch resolve activity for all users
        const activityResults = await batchResolveActivity(orgId, uniqueUserIds, sevenDaysAgo);

        // Build membership update map
        const membershipUpdateMap = new Map<string, ActivityResult>();
        for (const doc of membershipsSnapshot.docs) {
          const userId = doc.data().userId;
          const result = activityResults.get(userId);
          if (result) {
            membershipUpdateMap.set(doc.id, result);
          }
        }

        // Update memberships with lastActivityAt in batches
        const batch = adminDb.batch();
        let batchCount = 0;
        
        for (const [docId, result] of membershipUpdateMap) {
          const updateData: Record<string, unknown> = {
            activityStatus: result.status,
            atRisk: result.atRisk,
            updatedAt: now,
          };
          
          if (result.activitySignals.lastActivityAt) {
            updateData.lastActivityAt = result.activitySignals.lastActivityAt.toISOString();
          }
          if (result.activitySignals.primarySignal) {
            updateData.primaryActivityType = result.activitySignals.primarySignal;
          }
          updateData.daysActiveInPeriod = result.activitySignals.daysActiveInPeriod;

          batch.update(adminDb.collection('org_memberships').doc(docId), updateData);
          batchCount++;
          stats.clientsProcessed++;

          // Firestore batch limit is 500
          if (batchCount >= 450) {
            await batch.commit();
            stats.membershipUpdates += batchCount;
            batchCount = 0;
          }
        }

        if (batchCount > 0) {
          await batch.commit();
          stats.membershipUpdates += batchCount;
        }

        // Compute org summary
        let thrivingCount = 0;
        let activeCount = 0;
        let inactiveCount = 0;
        let atRiskCount = 0;

        for (const result of activityResults.values()) {
          if (result.status === 'thriving') thrivingCount++;
          else if (result.status === 'active') activeCount++;
          else inactiveCount++;
          
          if (result.atRisk) atRiskCount++;
        }

        const totalClients = uniqueUserIds.length;
        const activeRate = totalClients > 0 
          ? Math.round(((thrivingCount + activeCount) / totalClients) * 100) 
          : 0;

        await saveOrgClientSnapshot(orgId, todayStr, {
          totalClients,
          thrivingCount,
          activeCount,
          inactiveCount,
          atRiskCount,
          activeRate,
        });

        stats.snapshotsCreated++;
        console.log(`[CLIENT_ANALYTICS] Org ${orgId}: ${thrivingCount} thriving, ${activeCount} active, ${inactiveCount} inactive, ${atRiskCount} at-risk`);
      } catch (error) {
        console.error(`[CLIENT_ANALYTICS] Error processing org ${orgDoc.id}:`, error);
        stats.errors++;
      }
    }

    // Sync denormalized data to clientCoachingData collection
    // This runs after all org_memberships are updated so cached data is fresh
    try {
      const syncStartTime = Date.now();
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      const syncResponse = await fetch(`${baseUrl}/api/coaching/clients/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        },
      });

      if (syncResponse.ok) {
        const syncResult = await syncResponse.json();
        console.log(`[CLIENT_ANALYTICS] Coaching data sync completed in ${Date.now() - syncStartTime}ms:`, syncResult.stats);
      } else {
        console.warn(`[CLIENT_ANALYTICS] Coaching data sync failed:`, await syncResponse.text());
      }
    } catch (syncError) {
      console.warn('[CLIENT_ANALYTICS] Failed to sync coaching data:', syncError);
      // Don't fail the whole cron job if sync fails
    }

    const duration = Date.now() - startTime;
    console.log(`[CLIENT_ANALYTICS] Completed in ${duration}ms:`, stats);

    return NextResponse.json({
      success: true,
      message: 'Client analytics cron completed',
      stats,
      duration,
    });
  } catch (error) {
    console.error('[CLIENT_ANALYTICS] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to compute client analytics';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface OrgClientMetrics {
  totalClients: number;
  thrivingCount: number;
  activeCount: number;
  inactiveCount: number;
  atRiskCount: number;
  activeRate: number;
}

async function saveOrgClientSnapshot(
  orgId: string,
  date: string,
  metrics: OrgClientMetrics
): Promise<void> {
  const now = new Date().toISOString();
  
  await adminDb.collection(ANALYTICS_COLLECTIONS.orgSnapshots)
    .doc(`${orgId}_clients_${date}`)
    .set({
      organizationId: orgId,
      type: 'clients',
      date,
      ...metrics,
      computedAt: now,
    }, { merge: true });
}









