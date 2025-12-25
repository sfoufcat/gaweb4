/**
 * Squad Analytics Cron
 * 
 * GET/POST /api/notifications/cron/squad-analytics
 * 
 * Computes daily analytics for all standalone squads:
 * - Active members (activity in last 7 days)
 * - Message counts
 * - Task completion rates
 * - Health status (thriving/active/inactive)
 * 
 * Should run daily (e.g., "0 5 * * *" - 5 AM UTC)
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Squad, SquadAnalytics, SquadHealthStatus } from '@/types';

export async function GET(request: NextRequest) {
  return handleCronRequest(request);
}

export async function POST(request: NextRequest) {
  return handleCronRequest(request);
}

async function handleCronRequest(request: NextRequest) {
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
      errors: 0,
    };

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString();

    // Get all standalone squads (programId is null)
    const squadsSnapshot = await adminDb
      .collection('squads')
      .where('programId', '==', null)
      .where('isClosed', '!=', true)
      .get();

    console.log(`[SQUAD_ANALYTICS] Processing ${squadsSnapshot.size} standalone squads`);

    for (const squadDoc of squadsSnapshot.docs) {
      try {
        const squad = { id: squadDoc.id, ...squadDoc.data() } as Squad;
        stats.squadsProcessed++;

        // Get member count
        const memberIds = squad.memberIds || [];
        const totalMembers = memberIds.length;

        if (totalMembers === 0) {
          // Skip empty squads but record them
          await saveAnalytics(squadDoc.id, squad.organizationId || '', todayStr, {
            totalMembers: 0,
            activeMembers: 0,
            activityRate: 0,
            messageCount: 0,
            taskCompletionRate: 0,
            checkInCount: 0,
            avgAlignmentScore: 0,
            healthStatus: 'inactive',
          });
          stats.analyticsCreated++;
          continue;
        }

        // Count active members (users with activity in last 7 days)
        // Check multiple activity sources
        const activeUserIds = new Set<string>();

        // Check habit completions
        const habitCompletionsSnapshot = await adminDb
          .collection('habit_completions')
          .where('userId', 'in', memberIds.slice(0, 30)) // Firestore limit
          .where('createdAt', '>=', sevenDaysAgoStr)
          .get();
        
        habitCompletionsSnapshot.docs.forEach(doc => {
          activeUserIds.add(doc.data().userId);
        });

        // Check task completions
        const taskCompletionsSnapshot = await adminDb
          .collection('task_completions')
          .where('userId', 'in', memberIds.slice(0, 30))
          .where('createdAt', '>=', sevenDaysAgoStr)
          .get();
        
        taskCompletionsSnapshot.docs.forEach(doc => {
          activeUserIds.add(doc.data().userId);
        });

        // Check reflections
        const reflectionsSnapshot = await adminDb
          .collection('weekly_reflections')
          .where('userId', 'in', memberIds.slice(0, 30))
          .where('createdAt', '>=', sevenDaysAgoStr)
          .get();
        
        reflectionsSnapshot.docs.forEach(doc => {
          activeUserIds.add(doc.data().userId);
        });

        // Check check-ins
        const checkInsSnapshot = await adminDb
          .collection('check_ins')
          .where('userId', 'in', memberIds.slice(0, 30))
          .where('createdAt', '>=', sevenDaysAgoStr)
          .get();

        checkInsSnapshot.docs.forEach(doc => {
          activeUserIds.add(doc.data().userId);
        });

        const activeMembers = activeUserIds.size;
        const activityRate = totalMembers > 0 ? Math.round((activeMembers / totalMembers) * 100) : 0;

        // Calculate task completion rate
        let taskCompletionRate = 0;
        if (taskCompletionsSnapshot.size > 0) {
          // Get pending tasks count for these users in the period
          const pendingTasksSnapshot = await adminDb
            .collection('tasks')
            .where('userId', 'in', memberIds.slice(0, 30))
            .where('status', '==', 'pending')
            .get();
          
          const completedCount = taskCompletionsSnapshot.size;
          const totalTasks = completedCount + pendingTasksSnapshot.size;
          taskCompletionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
        }

        // Determine health status
        let healthStatus: SquadHealthStatus;
        if (activityRate >= 70) {
          healthStatus = 'thriving';
        } else if (activityRate >= 40) {
          healthStatus = 'active';
        } else {
          healthStatus = 'inactive';
        }

        await saveAnalytics(squadDoc.id, squad.organizationId || '', todayStr, {
          totalMembers,
          activeMembers,
          activityRate,
          messageCount: 0, // Would need Stream API integration for accurate count
          taskCompletionRate,
          checkInCount: checkInsSnapshot.size,
          avgAlignmentScore: 0, // Would need alignment calculation
          healthStatus,
        });

        stats.analyticsCreated++;
        console.log(`[SQUAD_ANALYTICS] Processed squad ${squadDoc.id}: ${activeMembers}/${totalMembers} active (${healthStatus})`);
      } catch (error) {
        console.error(`[SQUAD_ANALYTICS] Error processing squad ${squadDoc.id}:`, error);
        stats.errors++;
      }
    }

    console.log('[SQUAD_ANALYTICS] Completed:', stats);

    return NextResponse.json({
      success: true,
      message: 'Squad analytics cron completed',
      stats,
    });
  } catch (error) {
    console.error('[SQUAD_ANALYTICS] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to compute squad analytics';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function saveAnalytics(
  squadId: string,
  organizationId: string,
  date: string,
  metrics: {
    totalMembers: number;
    activeMembers: number;
    activityRate: number;
    messageCount: number;
    taskCompletionRate: number;
    checkInCount: number;
    avgAlignmentScore: number;
    healthStatus: SquadHealthStatus;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const analyticsId = `${squadId}_${date}`;

  await adminDb.collection('squad_analytics').doc(analyticsId).set({
    id: analyticsId,
    squadId,
    organizationId,
    date,
    ...metrics,
    computedAt: now,
  }, { merge: true });
}

