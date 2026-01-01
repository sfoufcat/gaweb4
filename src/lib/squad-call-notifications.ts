/**
 * @deprecated This module is deprecated and will be removed in a future version.
 * Use the unified event notification system instead:
 * - src/lib/event-notifications.ts
 * 
 * The unified system handles all event types (workshops, squad calls, coaching, etc.)
 * and uses the eventScheduledJobs collection.
 * 
 * This module is kept temporarily for backward compatibility during migration.
 * See: scripts/migrate-events.ts
 * 
 * ============================================================================
 * 
 * Squad Call Notifications and Emails
 * 
 * This module handles scheduling and sending notifications/emails for squad calls.
 * 
 * For both coached and non-coached squads, we send:
 * - Notification: 24 hours before the call
 * - Notification: 1 hour before the call
 * - Notification: When the call goes live (at start time)
 * - Email: 24 hours before the call
 * - Email: 1 hour before the call
 * - No email when the call goes live
 */

import { adminDb } from './firebase-admin';
import { notifyUser } from './notifications';
import { sendTenantEmail, APP_BASE_URL, getAppTitleForEmail } from './email-sender';
import type { FirebaseUser, SquadCallJobType, SquadCallScheduledJob, NotificationType } from '@/types';

const APP_URL = APP_BASE_URL;

// ============================================================================
// Scheduling Functions
// ============================================================================

/**
 * Schedule all notification and email jobs for a squad call.
 * 
 * This schedules:
 * - 24h before notification + email
 * - 1h before notification + email
 * - At-start notification (no email)
 * 
 * @param squadId - The squad ID
 * @param squadName - The squad name
 * @param hasCoach - Whether this squad has a coach (coach schedules calls)
 * @param callDateTime - ISO timestamp of the call
 * @param callTimezone - IANA timezone
 * @param callLocation - Location/link for the call
 * @param callTitle - Title of the call
 * @param chatChannelId - Optional chat channel ID
 * @param callId - Optional call document ID (for non-coached squads)
 */
export async function scheduleSquadCallJobs({
  squadId,
  squadName,
  hasCoach,
  callDateTime,
  callTimezone,
  callLocation,
  callTitle,
  chatChannelId,
  callId,
}: {
  squadId: string;
  squadName: string;
  hasCoach: boolean;
  callDateTime: string;
  callTimezone: string;
  callLocation: string;
  callTitle: string;
  chatChannelId?: string;
  callId?: string;
}): Promise<void> {
  const callDate = new Date(callDateTime);
  const now = new Date();

  // Calculate job times
  const time24hBefore = new Date(callDate.getTime() - 24 * 60 * 60 * 1000);
  const time1hBefore = new Date(callDate.getTime() - 60 * 60 * 1000);
  const timeAtStart = callDate;

  // Job types to schedule
  const jobConfigs: { type: SquadCallJobType; time: Date }[] = [
    { type: 'notification_24h', time: time24hBefore },
    { type: 'email_24h', time: time24hBefore },
    { type: 'notification_1h', time: time1hBefore },
    { type: 'email_1h', time: time1hBefore },
    { type: 'notification_live', time: timeAtStart },
    // No email at start time
  ];

  const createdAt = now.toISOString();

  // Create job documents
  for (const { type, time } of jobConfigs) {
    // Only schedule if time is in the future
    if (time.getTime() <= now.getTime()) {
      continue;
    }

    const jobId = hasCoach 
      ? `${squadId}_coach_${type}`
      : `${squadId}_${callId}_${type}`;

    const jobData: SquadCallScheduledJob = {
      id: jobId,
      squadId,
      squadName,
      hasCoach,
      isPremiumSquad: hasCoach, // Keep for backward compatibility
      ...(callId && { callId }),
      jobType: type,
      scheduledTime: time.toISOString(),
      callDateTime,
      callTimezone,
      callLocation,
      callTitle,
      ...(chatChannelId && { chatChannelId }),
      executed: false,
      createdAt,
      updatedAt: createdAt,
    };

    await adminDb.collection('squadCallScheduledJobs').doc(jobId).set(jobData, { merge: false });
  }

  console.log(`[SQUAD_CALL_JOBS] Scheduled jobs for squad ${squadId} (${hasCoach ? 'coach-scheduled' : 'member-proposed'})`);
}

/**
 * Cancel all scheduled jobs for a squad call.
 * Used when a call is updated or canceled.
 */
export async function cancelSquadCallJobs({
  squadId,
  hasCoach,
  callId,
}: {
  squadId: string;
  hasCoach: boolean;
  callId?: string;
}): Promise<void> {
  const jobTypes: SquadCallJobType[] = [
    'notification_24h',
    'email_24h',
    'notification_1h',
    'email_1h',
    'notification_live',
  ];

  for (const type of jobTypes) {
    const jobId = hasCoach 
      ? `${squadId}_coach_${type}`
      : `${squadId}_${callId}_${type}`;

    await adminDb.collection('squadCallScheduledJobs').doc(jobId).delete().catch(() => {});
  }

  console.log(`[SQUAD_CALL_JOBS] Canceled jobs for squad ${squadId} (${hasCoach ? 'coach-scheduled' : 'member-proposed'})`);
}

// ============================================================================
// Job Execution Functions
// ============================================================================

/**
 * Get all squad members for a squad.
 */
async function getSquadMembers(squadId: string): Promise<string[]> {
  const membersSnapshot = await adminDb
    .collection('squadMembers')
    .where('squadId', '==', squadId)
    .get();

  return membersSnapshot.docs.map(doc => doc.data().userId);
}

/**
 * Get user by ID
 */
async function getUserById(userId: string): Promise<FirebaseUser | null> {
  const userDoc = await adminDb.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    return null;
  }
  return { id: userDoc.id, ...userDoc.data() } as FirebaseUser;
}

/**
 * Format call time for display in notifications/emails
 */
function formatCallTimeForDisplay(callDateTime: string, callTimezone: string): string {
  try {
    const date = new Date(callDateTime);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: callTimezone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    });
    return formatter.format(date);
  } catch {
    return new Date(callDateTime).toLocaleString();
  }
}

/**
 * Format call time in user's local timezone
 */
function formatCallTimeInUserTimezone(callDateTime: string, userTimezone: string): string {
  try {
    const date = new Date(callDateTime);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: userTimezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    });
    return formatter.format(date);
  } catch {
    return new Date(callDateTime).toLocaleTimeString();
  }
}

/**
 * Get notification type from job type
 */
function getNotificationType(jobType: SquadCallJobType): NotificationType | null {
  switch (jobType) {
    case 'notification_24h': return 'squad_call_24h';
    case 'notification_1h': return 'squad_call_1h';
    case 'notification_live': return 'squad_call_live';
    default: return null;
  }
}

/**
 * Send notification to a single user for a squad call
 */
async function sendSquadCallNotification({
  userId,
  jobType,
  isPremium,
  callDateTime,
  callTimezone,
}: {
  userId: string;
  jobType: SquadCallJobType;
  isPremium: boolean;
  callDateTime: string;
  callTimezone: string;
}): Promise<void> {
  const user = await getUserById(userId);
  if (!user) return;

  const userTimezone = user.timezone || 'UTC';
  // Fallback to organizationId for users enrolled via funnel (which sets organizationId, not primaryOrganizationId)
  const organizationId = user.primaryOrganizationId || user.organizationId;
  const squadTime = formatCallTimeForDisplay(callDateTime, callTimezone);
  const userTime = formatCallTimeInUserTimezone(callDateTime, userTimezone);

  const notificationType = getNotificationType(jobType);
  if (!notificationType) return;

  const prefix = isPremium ? 'Your premium squad call' : 'Your squad call';

  let title: string;
  let body: string;

  switch (jobType) {
    case 'notification_24h':
      title = 'Upcoming squad call tomorrow';
      body = `${prefix} is tomorrow at ${squadTime} (${userTime} your time).`;
      break;
    case 'notification_1h':
      title = 'Squad call in 1 hour';
      body = `${prefix} starts in 1 hour at ${squadTime} (${userTime} your time).`;
      break;
    case 'notification_live':
      title = 'Your squad call is live';
      body = `${prefix} is happening now. Join the squad chat to participate.`;
      break;
    default:
      return;
  }

  await notifyUser({
    userId,
    type: notificationType,
    title,
    body,
    actionRoute: '/squad',
    organizationId,
  });
}

/**
 * Send email to a single user for a squad call
 */
async function sendSquadCallEmail({
  userId,
  jobType,
  isPremium,
  callDateTime,
  callTimezone,
}: {
  userId: string;
  jobType: SquadCallJobType;
  isPremium: boolean;
  callDateTime: string;
  callTimezone: string;
}): Promise<void> {
  const user = await getUserById(userId);
  if (!user || !user.email) return;

  // Check user's email preferences for squad calls
  const emailPrefs = user.emailPreferences;
  if (emailPrefs) {
    // Check if user has disabled this specific squad call email type
    if (jobType === 'email_24h' && emailPrefs.squadCall24h === false) {
      console.log(`[SQUAD_CALL_EMAIL] Skipping ${jobType} - user ${userId} has disabled 24h squad call emails`);
      return;
    }
    if (jobType === 'email_1h' && emailPrefs.squadCall1h === false) {
      console.log(`[SQUAD_CALL_EMAIL] Skipping ${jobType} - user ${userId} has disabled 1h squad call emails`);
      return;
    }
  }

  // Get tenant branding
  const organizationId = user.primaryOrganizationId || null;
  const appTitle = await getAppTitleForEmail(organizationId);
  const teamName = appTitle === 'GrowthAddicts' ? 'Growth Addicts' : appTitle;

  const userTimezone = user.timezone || 'UTC';
  const firstName = user.firstName || 'there';
  const squadTime = formatCallTimeForDisplay(callDateTime, callTimezone);
  const userTime = formatCallTimeInUserTimezone(callDateTime, userTimezone);
  
  const callDate = new Date(callDateTime);
  const dateStr = new Intl.DateTimeFormat('en-US', {
    timeZone: callTimezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(callDate);

  const prefix = isPremium ? 'premium squad call' : 'squad call';
  const squadUrl = `${APP_URL}/squad`;

  let subject: string;
  let textBody: string;

  switch (jobType) {
    case 'email_24h':
      subject = 'Your squad call is tomorrow';
      textBody = `Hi ${firstName},

This is a reminder that your ${prefix} is scheduled for ${dateStr} at ${squadTime} (that's ${userTime} your time).

Join your squad chat at the time of the call to participate.

${squadUrl}

– ${teamName}`.trim();
      break;

    case 'email_1h':
      subject = 'Your squad call starts in 1 hour';
      textBody = `Hi ${firstName},

Your ${prefix} starts in 1 hour: ${dateStr} at ${squadTime} (${userTime} your time).

See you there 👊

${squadUrl}

– ${teamName}`.trim();
      break;

    default:
      return;
  }

  const result = await sendTenantEmail({
    to: user.email,
    subject,
    html: `<pre style="font-family: system-ui, sans-serif; white-space: pre-wrap;">${textBody}</pre>`,
    text: textBody,
    organizationId,
    userId,
    headers: {
      'X-Entity-Ref-ID': `squad-call-${userId}-${jobType}`,
    },
  });

  if (result.success) {
    console.log(`[SQUAD_CALL_EMAIL] Sent ${jobType} email to ${userId} (whitelabel: ${result.sender.isWhitelabel})`);
  } else {
    console.error(`[SQUAD_CALL_EMAIL] Failed to send ${jobType} email to ${userId}:`, result.error);
  }
}

/**
 * Execute a single scheduled job.
 * Sends notifications or emails to all squad members.
 */
export async function executeSquadCallJob(job: SquadCallScheduledJob): Promise<{
  success: boolean;
  membersNotified: number;
  errors: number;
}> {
  const stats = {
    success: true,
    membersNotified: 0,
    errors: 0,
  };

  try {
    // Get all squad members
    const memberIds = await getSquadMembers(job.squadId);

    if (memberIds.length === 0) {
      console.log(`[SQUAD_CALL_JOBS] No members found for squad ${job.squadId}`);
      return stats;
    }

    // Determine if this is a notification or email job
    const isNotification = job.jobType.startsWith('notification_');
    const isEmail = job.jobType.startsWith('email_');

    for (const userId of memberIds) {
      try {
        if (isNotification) {
          await sendSquadCallNotification({
            userId,
            jobType: job.jobType,
            isPremium: job.hasCoach ?? false,
            callDateTime: job.callDateTime,
            callTimezone: job.callTimezone,
          });
        } else if (isEmail) {
          await sendSquadCallEmail({
            userId,
            jobType: job.jobType,
            isPremium: job.hasCoach ?? false,
            callDateTime: job.callDateTime,
            callTimezone: job.callTimezone,
          });
        }
        stats.membersNotified++;
      } catch (error) {
        console.error(`[SQUAD_CALL_JOBS] Error processing member ${userId}:`, error);
        stats.errors++;
      }
    }

    console.log(`[SQUAD_CALL_JOBS] Executed ${job.jobType} for squad ${job.squadId}: ${stats.membersNotified} members notified`);
  } catch (error) {
    console.error(`[SQUAD_CALL_JOBS] Error executing job ${job.id}:`, error);
    stats.success = false;
    stats.errors++;
  }

  return stats;
}

/**
 * Process all pending scheduled jobs that are due.
 * Called by the cron job.
 */
export async function processSquadCallScheduledJobs(): Promise<{
  processed: number;
  executed: number;
  skipped: number;
  errors: number;
}> {
  const stats = {
    processed: 0,
    executed: 0,
    skipped: 0,
    errors: 0,
  };

  const now = new Date().toISOString();

  try {
    // Query for pending jobs that should be executed
    const jobsSnapshot = await adminDb
      .collection('squadCallScheduledJobs')
      .where('executed', '==', false)
      .where('scheduledTime', '<=', now)
      .limit(100) // Process in batches
      .get();

    if (jobsSnapshot.empty) {
      return stats;
    }

    for (const doc of jobsSnapshot.docs) {
      stats.processed++;
      const job = { id: doc.id, ...doc.data() } as SquadCallScheduledJob;

      try {
        // Validate the call still exists and matches
        const isValid = await validateJobStillValid(job);
        if (!isValid) {
          // Job is stale, delete it
          await adminDb.collection('squadCallScheduledJobs').doc(doc.id).delete();
          stats.skipped++;
          continue;
        }

        // Execute the job
        const result = await executeSquadCallJob(job);

        // Mark as executed
        await adminDb.collection('squadCallScheduledJobs').doc(doc.id).update({
          executed: true,
          executedAt: now,
          updatedAt: now,
        });

        if (result.success) {
          stats.executed++;
        } else {
          stats.errors++;
        }

      } catch (error) {
        console.error(`[SQUAD_CALL_JOBS] Error processing job ${job.id}:`, error);
        stats.errors++;

        // Mark with error
        await adminDb.collection('squadCallScheduledJobs').doc(doc.id).update({
          error: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: now,
        }).catch(() => {});
      }
    }

    console.log('[SQUAD_CALL_JOBS] Process completed:', stats);
  } catch (error) {
    console.error('[SQUAD_CALL_JOBS] Error processing jobs:', error);
    stats.errors++;
  }

  return stats;
}

/**
 * Validate that a job is still valid (call hasn't been rescheduled or canceled)
 */
async function validateJobStillValid(job: SquadCallScheduledJob): Promise<boolean> {
  const hasCoach = job.hasCoach ?? false;
  if (hasCoach) {
    // For coach-scheduled calls, check the squad document
    const squadDoc = await adminDb.collection('squads').doc(job.squadId).get();
    if (!squadDoc.exists) return false;

    const squadData = squadDoc.data();
    // Check if call time still matches
    return squadData?.nextCallDateTime === job.callDateTime;
  } else {
    // For standard squads, check the standardSquadCalls document
    if (!job.callId) return false;

    const callDoc = await adminDb.collection('standardSquadCalls').doc(job.callId).get();
    if (!callDoc.exists) return false;

    const callData = callDoc.data();
    // Check if call is still confirmed and time matches
    return callData?.status === 'confirmed' && callData?.startDateTimeUtc === job.callDateTime;
  }
}

