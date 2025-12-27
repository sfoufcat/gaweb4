/**
 * Squad Analytics Cron
 * 
 * GET/POST /api/analytics/cron/squad-analytics
 * 
 * Computes daily analytics for all squads (standalone and program-based):
 * - Active members (activity in last 7 days)
 * - Health status (thriving/active/inactive)
 * 
 * Runs daily at 02:10 UTC via Vercel cron
 * 
 * FIXED: Now uses correct collections:
 * - habits (with progress.completionDates[])
 * - tasks (with status='completed')
 * - morning_checkins
 * - evening_checkins
 * - weekly_reflections
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { batchResolveActivity, getOrgActivitySummary } from '@/lib/analytics/activity';
import { getSquadHealthStatus, ANALYTICS_COLLECTIONS } from '@/lib/analytics/constants';
import type { Squad, SquadHealthStatus } from '@/types';

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
      squadsProcessed: 0,
      analyticsCreated: 0,
      orgsProcessed: 0,
      errors: 0,
    };

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get all organizations to process each one
    const orgsSnapshot = await adminDb.collection('organizations').get();
    
    console.log(`[SQUAD_ANALYTICS] Processing ${orgsSnapshot.size} organizations`);

    for (const orgDoc of orgsSnapshot.docs) {
      try {
        const orgId = orgDoc.id;
        stats.orgsProcessed++;

        // Get all open squads for this organization
        const squadsSnapshot = await adminDb
          .collection('squads')
          .where('organizationId', '==', orgId)
          .get();

        // Filter out closed squads in memory
        const openSquadDocs = squadsSnapshot.docs.filter(doc => {
          const data = doc.data();
          return data.isClosed !== true;
        });

        if (openSquadDocs.length === 0) {
          continue;
        }

        console.log(`[SQUAD_ANALYTICS] Org ${orgId}: Processing ${openSquadDocs.length} squads`);

        for (const squadDoc of openSquadDocs) {
          try {
            const squad = { id: squadDoc.id, ...squadDoc.data() } as Squad;
            stats.squadsProcessed++;

            // Get member count
            const memberIds = squad.memberIds || [];
            const totalMembers = memberIds.length;

            if (totalMembers === 0) {
              // Save empty squad analytics
              await saveSquadAnalytics(squadDoc.id, orgId, todayStr, {
                totalMembers: 0,
                activeMembers: 0,
                activityRate: 0,
                healthStatus: 'inactive',
                thrivingCount: 0,
                atRiskCount: 0,
              });
              stats.analyticsCreated++;
              continue;
            }

            // Use the Activity Resolver to compute active members
            const activityResults = await batchResolveActivity(orgId, memberIds, sevenDaysAgo);

            // Count statuses
            let activeMembers = 0;
            let thrivingCount = 0;
            let atRiskCount = 0;

            for (const [, result] of activityResults) {
              if (result.active) activeMembers++;
              if (result.status === 'thriving') thrivingCount++;
              if (result.atRisk) atRiskCount++;
            }

            const activityRate = totalMembers > 0 
              ? Math.round((activeMembers / totalMembers) * 100) 
              : 0;

            const healthStatus = getSquadHealthStatus(activityRate);

            await saveSquadAnalytics(squadDoc.id, orgId, todayStr, {
              totalMembers,
              activeMembers,
              activityRate,
              healthStatus,
              thrivingCount,
              atRiskCount,
            });

            stats.analyticsCreated++;
            console.log(`[SQUAD_ANALYTICS] Squad ${squadDoc.id}: ${activeMembers}/${totalMembers} active (${healthStatus})`);
          } catch (error) {
            console.error(`[SQUAD_ANALYTICS] Error processing squad ${squadDoc.id}:`, error);
            stats.errors++;
          }
        }

        // Also save org-level summary
        await saveOrgSummary(orgId, todayStr, openSquadDocs);
      } catch (error) {
        console.error(`[SQUAD_ANALYTICS] Error processing org ${orgDoc.id}:`, error);
        stats.errors++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[SQUAD_ANALYTICS] Completed in ${duration}ms:`, stats);

    return NextResponse.json({
      success: true,
      message: 'Squad analytics cron completed',
      stats,
      duration,
    });
  } catch (error) {
    console.error('[SQUAD_ANALYTICS] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to compute squad analytics';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface SquadMetrics {
  totalMembers: number;
  activeMembers: number;
  activityRate: number;
  healthStatus: SquadHealthStatus;
  thrivingCount: number;
  atRiskCount: number;
}

async function saveSquadAnalytics(
  squadId: string,
  organizationId: string,
  date: string,
  metrics: SquadMetrics
): Promise<void> {
  const now = new Date().toISOString();
  const analyticsId = `${squadId}_${date}`;

  await adminDb.collection(ANALYTICS_COLLECTIONS.squadSnapshots).doc(analyticsId).set({
    id: analyticsId,
    squadId,
    organizationId,
    date,
    ...metrics,
    computedAt: now,
  }, { merge: true });
}

async function saveOrgSummary(
  orgId: string,
  date: string,
  squadDocs: FirebaseFirestore.QueryDocumentSnapshot[]
): Promise<void> {
  const now = new Date().toISOString();
  
  // Get today's analytics for all squads
  const squadIds = squadDocs.map(d => d.id);
  const analyticsPromises = squadIds.map(id => 
    adminDb.collection(ANALYTICS_COLLECTIONS.squadSnapshots).doc(`${id}_${date}`).get()
  );
  
  const analyticsSnaps = await Promise.all(analyticsPromises);
  
  let totalSquads = 0;
  let thrivingSquads = 0;
  let activeSquads = 0;
  let inactiveSquads = 0;
  let totalMembers = 0;
  let totalActiveMembers = 0;

  for (const snap of analyticsSnaps) {
    if (!snap.exists) continue;
    const data = snap.data();
    
    totalSquads++;
    totalMembers += data?.totalMembers || 0;
    totalActiveMembers += data?.activeMembers || 0;
    
    if (data?.healthStatus === 'thriving') thrivingSquads++;
    else if (data?.healthStatus === 'active') activeSquads++;
    else inactiveSquads++;
  }

  const overallActivityRate = totalMembers > 0 
    ? Math.round((totalActiveMembers / totalMembers) * 100) 
    : 0;

  await adminDb.collection(ANALYTICS_COLLECTIONS.orgSnapshots)
    .doc(`${orgId}_squads_${date}`)
    .set({
      organizationId: orgId,
      type: 'squads',
      date,
      totalSquads,
      thrivingSquads,
      activeSquads,
      inactiveSquads,
      totalMembers,
      totalActiveMembers,
      overallActivityRate,
      computedAt: now,
    }, { merge: true });
}

