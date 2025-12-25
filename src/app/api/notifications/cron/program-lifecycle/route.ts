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
      habitsArchived: 0,
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

        // Check if this cohort should auto-convert squads to community
        const shouldAutoConvert = cohort.convertSquadsToCommunity === true;

        for (const squadDoc of squadsSnapshot.docs) {
          const squad = squadDoc.data() as Squad;
          
          // Check if we already sent the grace period message
          if (squad.gracePeriodMessageSent) continue;

          if (shouldAutoConvert) {
            // Auto-convert to standalone community
            await sendCommunityConversionMessage(squad.chatChannelId ?? undefined, cohort);
            
            // Convert the squad - remove program/cohort link
            await squadDoc.ref.update({
              programId: null,
              cohortId: null,
              gracePeriodMessageSent: false,
              gracePeriodStartDate: null,
              updatedAt: new Date().toISOString(),
            });

            console.log(`[PROGRAM_LIFECYCLE] Auto-converted squad ${squadDoc.id} to community`);
          } else {
            // Standard grace period flow
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

        // Skip squads that have been converted to standalone community
        // (programId is null = already converted, don't close)
        if (!squad.programId) {
          console.log(`[PROGRAM_LIFECYCLE] Skipping squad ${squadDoc.id} - already converted to community`);
          continue;
        }

        // Send final closing message
        await sendSquadClosingMessage(squad.chatChannelId ?? undefined);

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
          const now = new Date().toISOString();
          
          // Program has ended, mark as completed
          await enrollmentDoc.ref.update({
            status: 'completed',
            completedAt: now,
            updatedAt: now,
          });

          // Archive program-created habits for this user
          const archivedCount = await archiveProgramHabits(enrollment.userId, enrollment.programId, now);
          stats.habitsArchived += archivedCount;

          stats.enrollmentsCompleted++;
          console.log(`[PROGRAM_LIFECYCLE] Completed enrollment ${enrollmentDoc.id}, archived ${archivedCount} habits`);
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
          const now = new Date().toISOString();
          
          // Cohort ended, mark enrollment as completed
          await enrollmentDoc.ref.update({
            status: 'completed',
            completedAt: now,
            updatedAt: now,
          });

          // Archive program-created habits for this user
          const archivedCount = await archiveProgramHabits(enrollment.userId, enrollment.programId, now);
          stats.habitsArchived += archivedCount;

          stats.enrollmentsCompleted++;
          console.log(`[PROGRAM_LIFECYCLE] Completed group enrollment ${enrollmentDoc.id}, archived ${archivedCount} habits`);
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

/**
 * Send message when squad is auto-converted to community
 */
async function sendCommunityConversionMessage(
  chatChannelId: string | undefined,
  cohort: ProgramCohort
): Promise<void> {
  if (!chatChannelId) return;

  try {
    const streamClient = await getStreamServerClient();
    await ensureSystemBotUser(streamClient);
    
    const channel = streamClient.channel('messaging', chatChannelId);

    await channel.sendMessage({
      text: `🎉 **Congratulations!** The ${cohort.name} program has officially ended!\n\n` +
        `Great news – this squad is now a **standalone community**! ` +
        `The chat will remain open so you can stay connected with your squadmates and coach.\n\n` +
        `Keep supporting each other on your journey! 🙏`,
      user_id: SYSTEM_BOT_USER_ID,
      program_notification: true,
      notification_type: 'squad_converted_to_community',
    } as Parameters<typeof channel.sendMessage>[0]);

    console.log(`[PROGRAM_LIFECYCLE] Sent community conversion message to channel ${chatChannelId}`);
  } catch (error) {
    console.error(`[PROGRAM_LIFECYCLE] Error sending community conversion message:`, error);
    // Don't throw - we still want to convert the squad
  }
}

/**
 * Archive program-created habits for a user when their program completes
 * Only archives habits that were created from program defaults (source: 'program_default')
 */
async function archiveProgramHabits(
  userId: string,
  programId: string,
  timestamp: string
): Promise<number> {
  try {
    const habitsSnapshot = await adminDb
      .collection('habits')
      .where('userId', '==', userId)
      .where('programId', '==', programId)
      .where('source', '==', 'program_default')
      .where('archived', '==', false)
      .get();

    if (habitsSnapshot.empty) {
      return 0;
    }

    const batch = adminDb.batch();
    for (const habitDoc of habitsSnapshot.docs) {
      batch.update(habitDoc.ref, {
        archived: true,
        archivedAt: timestamp,
        archivedReason: 'program_completed',
        updatedAt: timestamp,
      });
    }
    await batch.commit();

    console.log(`[PROGRAM_LIFECYCLE] Archived ${habitsSnapshot.size} habits for user ${userId} from program ${programId}`);
    return habitsSnapshot.size;
  } catch (error) {
    console.error(`[PROGRAM_LIFECYCLE] Error archiving habits for user ${userId}:`, error);
    // Don't throw - we still want to continue with other operations
    return 0;
  }
}

