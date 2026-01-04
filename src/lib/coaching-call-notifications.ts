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
 * Coaching Call Notifications and Emails
 * 
 * This module handles scheduling and sending notifications/emails for 1:1 coaching calls.
 * 
 * We send:
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
import type { FirebaseUser, CoachingCallJobType, CoachingCallScheduledJob, ClientCoachingData } from '@/types';

const APP_URL = APP_BASE_URL;

// ============================================================================
// Scheduling Functions
// ============================================================================

/**
 * Schedule all notification and email jobs for a coaching call.
 */
export async function scheduleCoachingCallJobs({
  userId,
  coachId,
  clientName,
  coachName,
  callDateTime,
  callTimezone,
  callLocation,
  callTitle,
  chatChannelId,
}: {
  userId: string;
  coachId: string;
  clientName: string;
  coachName: string;
  callDateTime: string;
  callTimezone: string;
  callLocation: string;
  callTitle?: string;
  chatChannelId?: string;
}): Promise<void> {
  const callDate = new Date(callDateTime);
  const now = new Date();

  // Calculate job times
  const time24hBefore = new Date(callDate.getTime() - 24 * 60 * 60 * 1000);
  const time1hBefore = new Date(callDate.getTime() - 60 * 60 * 1000);
  const timeAtStart = callDate;

  // Job types to schedule
  const jobConfigs: { type: CoachingCallJobType; time: Date }[] = [
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

    const jobId = `coaching_${userId}_${type}`;

    const jobData: CoachingCallScheduledJob = {
      id: jobId,
      userId,
      coachId,
      clientName,
      coachName,
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

    await adminDb.collection('coachingCallScheduledJobs').doc(jobId).set(jobData, { merge: false });
  }

  console.log(`[COACHING_CALL_JOBS] Scheduled jobs for client ${userId}`);
}

/**
 * Cancel all scheduled jobs for a coaching call.
 * Used when a call is updated or canceled.
 */
export async function cancelCoachingCallJobs({
  userId,
}: {
  userId: string;
}): Promise<void> {
  const jobTypes: CoachingCallJobType[] = [
    'notification_24h',
    'email_24h',
    'notification_1h',
    'email_1h',
    'notification_live',
  ];

  for (const type of jobTypes) {
    const jobId = `coaching_${userId}_${type}`;
    await adminDb.collection('coachingCallScheduledJobs').doc(jobId).delete().catch(() => {});
  }

  console.log(`[COACHING_CALL_JOBS] Canceled jobs for client ${userId}`);
}

// ============================================================================
// Job Execution Functions
// ============================================================================

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
 * Send notification to a user for a coaching call
 */
async function sendCoachingCallNotification({
  userId,
  jobType,
  coachName,
  callDateTime,
  callTimezone,
}: {
  userId: string;
  jobType: CoachingCallJobType;
  coachName: string;
  callDateTime: string;
  callTimezone: string;
}): Promise<void> {
  const user = await getUserById(userId);
  if (!user) return;

  const userTimezone = user.timezone || 'UTC';
  // Fallback to organizationId for users enrolled via funnel (which sets organizationId, not primaryOrganizationId)
  const organizationId = user.primaryOrganizationId || user.organizationId;
  const callTime = formatCallTimeForDisplay(callDateTime, callTimezone);
  const userTime = formatCallTimeInUserTimezone(callDateTime, userTimezone);

  let title: string;
  let body: string;
  let notificationType: 'squad_call_24h' | 'squad_call_1h' | 'squad_call_live';

  switch (jobType) {
    case 'notification_24h':
      title = 'Coaching call tomorrow';
      body = `Your 1:1 coaching call with ${coachName} is tomorrow at ${callTime} (${userTime} your time).`;
      notificationType = 'squad_call_24h';
      break;
    case 'notification_1h':
      title = 'Coaching call in 1 hour';
      body = `Your 1:1 coaching call with ${coachName} starts in 1 hour.`;
      notificationType = 'squad_call_1h';
      break;
    case 'notification_live':
      title = 'Your coaching call is starting';
      body = `Your 1:1 coaching call with ${coachName} is happening now. Join via My Coach.`;
      notificationType = 'squad_call_live';
      break;
    default:
      return;
  }

  await notifyUser({
    userId,
    type: notificationType,
    title,
    body,
    actionRoute: '/my-coach',
    organizationId,
  });
}

/**
 * Send email to a user for a coaching call
 */
async function sendCoachingCallEmail({
  userId,
  jobType,
  coachName,
  callDateTime,
  callTimezone,
}: {
  userId: string;
  jobType: CoachingCallJobType;
  coachName: string;
  callDateTime: string;
  callTimezone: string;
}): Promise<void> {
  const user = await getUserById(userId);
  if (!user || !user.email) return;

  // Check user's email preferences
  const emailPrefs = user.emailPreferences;
  if (emailPrefs) {
    if (jobType === 'email_24h' && emailPrefs.squadCall24h === false) {
      return;
    }
    if (jobType === 'email_1h' && emailPrefs.squadCall1h === false) {
      return;
    }
  }

  // Get tenant branding
  const organizationId = user.primaryOrganizationId || null;
  const appTitle = await getAppTitleForEmail(organizationId);
  const teamName = appTitle === 'Coachful' ? 'Coachful' : appTitle;

  const userTimezone = user.timezone || 'UTC';
  const firstName = user.firstName || 'there';
  const callTime = formatCallTimeForDisplay(callDateTime, callTimezone);
  const userTime = formatCallTimeInUserTimezone(callDateTime, userTimezone);
  
  const callDate = new Date(callDateTime);
  const dateStr = new Intl.DateTimeFormat('en-US', {
    timeZone: callTimezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(callDate);

  const coachingUrl = `${APP_URL}/my-coach`;

  let subject: string;
  let textBody: string;

  switch (jobType) {
    case 'email_24h':
      subject = `Your coaching call with ${coachName} is tomorrow`;
      textBody = `Hi ${firstName},

This is a reminder that your 1:1 coaching call with ${coachName} is scheduled for ${dateStr} at ${callTime} (that's ${userTime} your time).

You can access your coaching dashboard and call here:
${coachingUrl}

– ${teamName}`.trim();
      break;

    case 'email_1h':
      subject = `Your coaching call with ${coachName} starts in 1 hour`;
      textBody = `Hi ${firstName},

Your 1:1 coaching call with ${coachName} starts in 1 hour: ${dateStr} at ${callTime} (${userTime} your time).

Join your call here:
${coachingUrl}

See you soon! 👊

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
      'X-Entity-Ref-ID': `coaching-call-${userId}-${jobType}`,
    },
  });

  if (result.success) {
    console.log(`[COACHING_CALL_EMAIL] Sent ${jobType} email to ${userId} (whitelabel: ${result.sender.isWhitelabel})`);
  } else {
    console.error(`[COACHING_CALL_EMAIL] Failed to send ${jobType} email to ${userId}:`, result.error);
  }
}

/**
 * Execute a single scheduled coaching call job.
 */
export async function executeCoachingCallJob(job: CoachingCallScheduledJob): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const isNotification = job.jobType.startsWith('notification_');
    const isEmail = job.jobType.startsWith('email_');

    if (isNotification) {
      await sendCoachingCallNotification({
        userId: job.userId,
        jobType: job.jobType,
        coachName: job.coachName,
        callDateTime: job.callDateTime,
        callTimezone: job.callTimezone,
      });
    } else if (isEmail) {
      await sendCoachingCallEmail({
        userId: job.userId,
        jobType: job.jobType,
        coachName: job.coachName,
        callDateTime: job.callDateTime,
        callTimezone: job.callTimezone,
      });
    }

    console.log(`[COACHING_CALL_JOBS] Executed ${job.jobType} for client ${job.userId}`);
    return { success: true };
  } catch (error) {
    console.error(`[COACHING_CALL_JOBS] Error executing job ${job.id}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Process all pending coaching call scheduled jobs that are due.
 * Called by the cron job.
 */
export async function processCoachingCallScheduledJobs(): Promise<{
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
      .collection('coachingCallScheduledJobs')
      .where('executed', '==', false)
      .where('scheduledTime', '<=', now)
      .limit(100)
      .get();

    if (jobsSnapshot.empty) {
      return stats;
    }

    for (const doc of jobsSnapshot.docs) {
      stats.processed++;
      const job = { id: doc.id, ...doc.data() } as CoachingCallScheduledJob;

      try {
        // Validate the call still exists and matches
        const coachingDoc = await adminDb.collection('clientCoachingData').doc(job.userId).get();
        if (!coachingDoc.exists) {
          // Job is stale, delete it
          await adminDb.collection('coachingCallScheduledJobs').doc(doc.id).delete();
          stats.skipped++;
          continue;
        }

        const coachingData = coachingDoc.data() as ClientCoachingData;
        if (coachingData.nextCall?.datetime !== job.callDateTime) {
          // Call was rescheduled, delete stale job
          await adminDb.collection('coachingCallScheduledJobs').doc(doc.id).delete();
          stats.skipped++;
          continue;
        }

        // Execute the job
        const result = await executeCoachingCallJob(job);

        // Mark as executed
        await adminDb.collection('coachingCallScheduledJobs').doc(doc.id).update({
          executed: true,
          executedAt: now,
          updatedAt: now,
          ...(result.error && { error: result.error }),
        });

        if (result.success) {
          stats.executed++;
        } else {
          stats.errors++;
        }

      } catch (error) {
        console.error(`[COACHING_CALL_JOBS] Error processing job ${job.id}:`, error);
        stats.errors++;

        await adminDb.collection('coachingCallScheduledJobs').doc(doc.id).update({
          error: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: now,
        }).catch(() => {});
      }
    }

    console.log('[COACHING_CALL_JOBS] Process completed:', stats);
  } catch (error) {
    console.error('[COACHING_CALL_JOBS] Error processing jobs:', error);
    stats.errors++;
  }

  return stats;
}









