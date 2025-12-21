/**
 * Program Lifecycle Cron
 * 
 * GET/POST /api/notifications/cron/program-lifecycle
 * 
 * Handles:
 * 1. Sending grace period notifications when cohorts end
 * 2. Closing squads after the 7-day grace period
 * 3. Updating enrollment statuses
 * 
 * Should run daily (e.g., "0 6 * * *" - 6 AM UTC)
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getStreamServerClient, ensureSystemBotUser, SYSTEM_BOT_USER_ID } from '@/lib/stream-server';
import type { ProgramCohort, Squad, ProgramEnrollment, Program } from '@/types';

const GRACE_PERIOD_DAYS = 7;

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
      cohortsChecked: 0,
      graceNotificationsSent: 0,
      squadsClosed: 0,
      enrollmentsCompleted: 0,
      errors: 0,
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Calculate the date 7 days ago (for checking grace period expiry)
    const gracePeriodExpiry = new Date(today);
    gracePeriodExpiry.setDate(gracePeriodExpiry.getDate() - GRACE_PERIOD_DAYS);
    const gracePeriodExpiryStr = gracePeriodExpiry.toISOString().split('T')[0];

    // 1. Find cohorts that just ended (endDate = yesterday or today)
    // These need grace period notifications
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const justEndedCohortsSnapshot = await adminDb
      .collection('program_cohorts')
      .where('endDate', 'in', [todayStr, yesterdayStr])
      .where('status', '==', 'active')
      .get();

    for (const cohortDoc of justEndedCohortsSnapshot.docs) {
      stats.cohortsChecked++;
      const cohort = { id: cohortDoc.id, ...cohortDoc.data() } as ProgramCohort;

      try {
        // Get linked squads
        const squadsSnapshot = await adminDb
          .collection('squads')
          .where('cohortId', '==', cohort.id)
          .where('isClosed', '!=', true)
          .get();

        for (const squadDoc of squadsSnapshot.docs) {
          const squad = squadDoc.data() as Squad;
          
          // Check if we already sent the grace period message
          if (squad.gracePeriodMessageSent) continue;

          // Send message in squad chat
          await sendGracePeriodMessage(squad.chatChannelId ?? undefined, cohort, GRACE_PERIOD_DAYS);

          // Mark that we sent the message
          await squadDoc.ref.update({
            gracePeriodMessageSent: true,
            gracePeriodStartDate: todayStr,
            updatedAt: new Date().toISOString(),
          });

          stats.graceNotificationsSent++;
          console.log(`[PROGRAM_LIFECYCLE] Sent grace period message to squad ${squadDoc.id}`);
        }

        // Update cohort status to 'completed'
        await cohortDoc.ref.update({
          status: 'completed',
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`[PROGRAM_LIFECYCLE] Error processing cohort ${cohort.id}:`, error);
        stats.errors++;
      }
    }

    // 2. Find squads where grace period has expired
    // These need to be closed
    const squadsToCloseSnapshot = await adminDb
      .collection('squads')
      .where('gracePeriodStartDate', '<=', gracePeriodExpiryStr)
      .where('isClosed', '!=', true)
      .get();

    for (const squadDoc of squadsToCloseSnapshot.docs) {
      try {
        const squad = squadDoc.data() as Squad;

        // Send final closing message
        await sendSquadClosingMessage(squad.chatChannelId);

        // Close the squad
        await squadDoc.ref.update({
          isClosed: true,
          closedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Archive the Stream chat channel
        if (squad.chatChannelId) {
          try {
            const streamClient = await getStreamServerClient();
            const channel = streamClient.channel('messaging', squad.chatChannelId);
            await channel.updatePartial({
              set: {
                frozen: true,
                disabled: true,
              },
            });
          } catch (chatError) {
            console.error(`[PROGRAM_LIFECYCLE] Error archiving chat for squad ${squadDoc.id}:`, chatError);
          }
        }

        stats.squadsClosed++;
        console.log(`[PROGRAM_LIFECYCLE] Closed squad ${squadDoc.id}`);
      } catch (error) {
        console.error(`[PROGRAM_LIFECYCLE] Error closing squad ${squadDoc.id}:`, error);
        stats.errors++;
      }
    }

    // 3. Complete enrollments for individual programs that have finished
    const individualEnrollmentsSnapshot = await adminDb
      .collection('program_enrollments')
      .where('status', '==', 'active')
      .where('cohortId', '==', null) // Individual programs have no cohort
      .get();

    for (const enrollmentDoc of individualEnrollmentsSnapshot.docs) {
      const enrollment = enrollmentDoc.data() as ProgramEnrollment;

      try {
        // Get program to check length
        const programDoc = await adminDb.collection('programs').doc(enrollment.programId).get();
        if (!programDoc.exists) continue;

        const program = programDoc.data() as Program;
        if (program.type !== 'individual') continue;

        // Calculate expected end date
        const startDate = new Date(enrollment.startedAt);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + program.lengthDays);

        if (endDate <= today) {
          // Program has ended, mark as completed
          await enrollmentDoc.ref.update({
            status: 'completed',
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          stats.enrollmentsCompleted++;
          console.log(`[PROGRAM_LIFECYCLE] Completed enrollment ${enrollmentDoc.id}`);
        }
      } catch (error) {
        console.error(`[PROGRAM_LIFECYCLE] Error processing enrollment ${enrollmentDoc.id}:`, error);
        stats.errors++;
      }
    }

    // 4. Mark group program enrollments as completed when cohort completes
    const activeGroupEnrollmentsSnapshot = await adminDb
      .collection('program_enrollments')
      .where('status', '==', 'active')
      .get();

    for (const enrollmentDoc of activeGroupEnrollmentsSnapshot.docs) {
      const enrollment = enrollmentDoc.data() as ProgramEnrollment;
      if (!enrollment.cohortId) continue;

      try {
        // Check if cohort is completed
        const cohortDoc = await adminDb.collection('program_cohorts').doc(enrollment.cohortId).get();
        if (!cohortDoc.exists) continue;

        const cohort = cohortDoc.data() as ProgramCohort;
        if (cohort.status === 'completed') {
          // Cohort ended, mark enrollment as completed
          await enrollmentDoc.ref.update({
            status: 'completed',
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          stats.enrollmentsCompleted++;
          console.log(`[PROGRAM_LIFECYCLE] Completed group enrollment ${enrollmentDoc.id}`);
        }
      } catch (error) {
        console.error(`[PROGRAM_LIFECYCLE] Error processing group enrollment ${enrollmentDoc.id}:`, error);
        stats.errors++;
      }
    }

    // 5. Activate upcoming enrollments whose start date has arrived
    const upcomingEnrollmentsSnapshot = await adminDb
      .collection('program_enrollments')
      .where('status', '==', 'upcoming')
      .where('startedAt', '<=', todayStr)
      .get();

    for (const enrollmentDoc of upcomingEnrollmentsSnapshot.docs) {
      try {
        await enrollmentDoc.ref.update({
          status: 'active',
          updatedAt: new Date().toISOString(),
        });
        console.log(`[PROGRAM_LIFECYCLE] Activated enrollment ${enrollmentDoc.id}`);
      } catch (error) {
        console.error(`[PROGRAM_LIFECYCLE] Error activating enrollment ${enrollmentDoc.id}:`, error);
        stats.errors++;
      }
    }

    console.log('[PROGRAM_LIFECYCLE] Completed:', stats);

    return NextResponse.json({
      success: true,
      message: 'Program lifecycle cron completed',
      stats,
    });
  } catch (error) {
    console.error('[PROGRAM_LIFECYCLE] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process program lifecycle';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Send grace period notification message to squad chat
 */
async function sendGracePeriodMessage(
  chatChannelId: string | undefined,
  cohort: ProgramCohort,
  graceDays: number
): Promise<void> {
  if (!chatChannelId) return;

  try {
    const streamClient = await getStreamServerClient();
    await ensureSystemBotUser(streamClient);
    
    const channel = streamClient.channel('messaging', chatChannelId);

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + graceDays);
    const endDateStr = endDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });

    await channel.sendMessage({
      text: `🎉 **Congratulations!** The ${cohort.name} program has officially ended!\n\n` +
        `This squad chat will remain open for **${graceDays} more days** until ${endDateStr} ` +
        `so you can wrap up conversations and exchange contact info with your squadmates.\n\n` +
        `Thank you for being part of this journey together! 🙏`,
      user_id: SYSTEM_BOT_USER_ID,
      program_notification: true,
      notification_type: 'program_ended',
    } as Parameters<typeof channel.sendMessage>[0]);

    console.log(`[PROGRAM_LIFECYCLE] Sent grace period message to channel ${chatChannelId}`);
  } catch (error) {
    console.error(`[PROGRAM_LIFECYCLE] Error sending grace period message:`, error);
    throw error;
  }
}

/**
 * Send final closing message to squad chat
 */
async function sendSquadClosingMessage(chatChannelId: string | undefined): Promise<void> {
  if (!chatChannelId) return;

  try {
    const streamClient = await getStreamServerClient();
    await ensureSystemBotUser(streamClient);
    
    const channel = streamClient.channel('messaging', chatChannelId);

    await channel.sendMessage({
      text: `📚 **This squad chat is now closed.**\n\n` +
        `The grace period has ended and this chat is being archived. ` +
        `We hope you made great connections! See you in future programs. 👋`,
      user_id: SYSTEM_BOT_USER_ID,
      program_notification: true,
      notification_type: 'squad_closed',
    } as Parameters<typeof channel.sendMessage>[0]);

    console.log(`[PROGRAM_LIFECYCLE] Sent closing message to channel ${chatChannelId}`);
  } catch (error) {
    console.error(`[PROGRAM_LIFECYCLE] Error sending closing message:`, error);
    // Don't throw - we still want to close the squad
  }
}

