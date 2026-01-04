/**
 * Unified Event Notifications and Emails
 * 
 * This module handles scheduling and sending notifications/emails for all event types:
 * - Community events (workshops, webinars)
 * - Squad calls (coach-scheduled or peer-proposed)
 * - 1-on-1 coaching calls
 * 
 * Replaces:
 * - squad-call-notifications.ts
 * - coaching-call-notifications.ts
 * 
 * For all events, we send:
 * - Notification: 24 hours before
 * - Notification: 1 hour before
 * - Notification: When event starts (live)
 * - Email: 24 hours before
 * - Email: 1 hour before
 * - Chat reminder: 1 hour before (if chatChannelId set)
 * - Chat reminder: When event starts (if chatChannelId set)
 */

import { adminDb } from './firebase-admin';
import { notifyUser } from './notifications';
import { sendTenantEmail, APP_BASE_URL, getAppTitleForEmail } from './email-sender';
import { getStreamServerClient, ensureSystemBotUser, SYSTEM_BOT_USER_ID } from './stream-server';
import type { 
  FirebaseUser, 
  UnifiedEvent, 
  EventScheduledJob, 
  EventJobType,
  NotificationType 
} from '@/types';

const APP_URL = APP_BASE_URL;

// ============================================================================
// Scheduling Functions
// ============================================================================

/**
 * Schedule all notification, email, and chat reminder jobs for an event.
 */
export async function scheduleEventJobs(event: UnifiedEvent): Promise<void> {
  const eventDate = new Date(event.startDateTime);
  const now = new Date();

  // Calculate job times
  const time24hBefore = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
  const time1hBefore = new Date(eventDate.getTime() - 60 * 60 * 1000);
  const timeAtStart = eventDate;

  // Determine which job types to schedule
  const jobConfigs: { type: EventJobType; time: Date }[] = [
    { type: 'notification_24h', time: time24hBefore },
    { type: 'email_24h', time: time24hBefore },
    { type: 'notification_1h', time: time1hBefore },
    { type: 'email_1h', time: time1hBefore },
    { type: 'notification_live', time: timeAtStart },
  ];

  // Add chat reminders if event has a chat channel and reminders enabled
  if (event.chatChannelId && event.sendChatReminders) {
    jobConfigs.push(
      { type: 'chat_reminder_1h', time: time1hBefore },
      { type: 'chat_reminder_live', time: timeAtStart }
    );
  }

  const createdAt = now.toISOString();

  // Create job documents
  for (const { type, time } of jobConfigs) {
    // Only schedule if time is in the future
    if (time.getTime() <= now.getTime()) {
      continue;
    }

    const jobId = `${event.id}_${type}`;

    const jobData: EventScheduledJob = {
      id: jobId,
      eventId: event.id,
      jobType: type,
      scheduledTime: time.toISOString(),
      
      // Denormalized for execution
      eventTitle: event.title,
      eventDateTime: event.startDateTime,
      eventTimezone: event.timezone,
      eventLocation: event.locationLabel,
      eventType: event.eventType,
      scope: event.scope,
      ...(event.squadId && { squadId: event.squadId }),
      ...(event.programId && { programId: event.programId }),
      ...(event.organizationId && { organizationId: event.organizationId }),
      ...(event.chatChannelId && { chatChannelId: event.chatChannelId }),
      
      // For 1-on-1 coaching
      ...(event.eventType === 'coaching_1on1' && {
        hostUserId: event.hostUserId,
        hostName: event.hostName,
        hostAvatarUrl: event.hostAvatarUrl,
        clientUserId: event.clientUserId || event.attendeeIds[0],
        clientName: event.clientName,
        clientAvatarUrl: event.clientAvatarUrl,
      }),
      
      executed: false,
      createdAt,
      updatedAt: createdAt,
    };

    await adminDb.collection('eventScheduledJobs').doc(jobId).set(jobData, { merge: false });
  }

  console.log(`[EVENT_JOBS] Scheduled jobs for event ${event.id} (${event.eventType})`);
}

/**
 * Cancel all scheduled jobs for an event.
 * Used when an event is updated or canceled.
 */
export async function cancelEventJobs(eventId: string): Promise<void> {
  const jobTypes: EventJobType[] = [
    'notification_24h',
    'notification_1h',
    'notification_live',
    'email_24h',
    'email_1h',
    'chat_reminder_1h',
    'chat_reminder_live',
  ];

  for (const type of jobTypes) {
    const jobId = `${eventId}_${type}`;
    await adminDb.collection('eventScheduledJobs').doc(jobId).delete().catch(() => {});
  }

  console.log(`[EVENT_JOBS] Canceled jobs for event ${eventId}`);
}

/**
 * Reschedule jobs when an event is updated.
 * Cancels old jobs and schedules new ones.
 */
export async function rescheduleEventJobs(event: UnifiedEvent): Promise<void> {
  await cancelEventJobs(event.id);
  await scheduleEventJobs(event);
}

// ============================================================================
// Helper Functions
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
 * Get target user IDs for an event based on its participant model.
 */
async function getEventTargetUserIds(job: EventScheduledJob): Promise<string[]> {
  const event = await getEventById(job.eventId);
  if (!event) return [];

  switch (event.participantModel) {
    case 'squad_members':
      if (!event.squadId) return [];
      return getSquadMembers(event.squadId);
    
    case 'invite_only':
      // For 1-on-1 coaching, notify the client
      return event.attendeeIds || [];
    
    case 'rsvp':
      // For RSVP events, notify those who have RSVPed
      return event.attendeeIds || [];
    
    case 'program_enrollees':
      // TODO: Get all program enrollees
      return event.attendeeIds || [];
    
    default:
      return event.attendeeIds || [];
  }
}

/**
 * Get event by ID
 */
async function getEventById(eventId: string): Promise<UnifiedEvent | null> {
  const eventDoc = await adminDb.collection('events').doc(eventId).get();
  if (!eventDoc.exists) {
    return null;
  }
  return { id: eventDoc.id, ...eventDoc.data() } as UnifiedEvent;
}

/**
 * Format event time for display in notifications/emails
 */
function formatEventTimeForDisplay(eventDateTime: string, eventTimezone: string): string {
  try {
    const date = new Date(eventDateTime);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: eventTimezone,
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
    return new Date(eventDateTime).toLocaleString();
  }
}

/**
 * Format event time in user's local timezone
 */
function formatEventTimeInUserTimezone(eventDateTime: string, userTimezone: string): string {
  try {
    const date = new Date(eventDateTime);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: userTimezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    });
    return formatter.format(date);
  } catch {
    return new Date(eventDateTime).toLocaleTimeString();
  }
}

/**
 * Get notification type from job type
 */
function getNotificationType(jobType: EventJobType, eventType: string): NotificationType | null {
  // Map to appropriate notification types based on event type
  if (eventType === 'squad_call') {
    switch (jobType) {
      case 'notification_24h': return 'squad_call_24h';
      case 'notification_1h': return 'squad_call_1h';
      case 'notification_live': return 'squad_call_live';
      default: return null;
    }
  } else if (eventType === 'coaching_1on1') {
    switch (jobType) {
      case 'notification_24h': return 'coaching_call_24h';
      case 'notification_1h': return 'coaching_call_1h';
      case 'notification_live': return 'coaching_call_live';
      default: return null;
    }
  } else {
    // Community events
    switch (jobType) {
      case 'notification_24h': return 'event_reminder_24h' as NotificationType;
      case 'notification_1h': return 'event_reminder_1h' as NotificationType;
      case 'notification_live': return 'event_live' as NotificationType;
      default: return null;
    }
  }
}

/**
 * Get action route for notification based on event type
 */
function getActionRoute(job: EventScheduledJob): string {
  switch (job.eventType) {
    case 'squad_call':
      // Navigate to program page if squad belongs to a program, otherwise /squad
      return job.programId ? '/program' : '/squad';
    case 'coaching_1on1':
      // Navigate to the individual (1:1) program page
      return job.programId ? `/program?programId=${job.programId}` : '/program';
    default:
      return `/discover/events/${job.eventId}`;
  }
}

// ============================================================================
// Notification Functions
// ============================================================================

/**
 * Send notification to a single user for an event
 */
async function sendEventNotification({
  userId,
  job,
}: {
  userId: string;
  job: EventScheduledJob;
}): Promise<void> {
  const user = await getUserById(userId);
  if (!user) return;

  const userTimezone = user.timezone || 'UTC';
  // Fallback to organizationId for users enrolled via funnel (which sets organizationId, not primaryOrganizationId)
  const organizationId = user.primaryOrganizationId || user.organizationId;
  const eventTime = formatEventTimeForDisplay(job.eventDateTime, job.eventTimezone);
  const userTime = formatEventTimeInUserTimezone(job.eventDateTime, userTimezone);

  const notificationType = getNotificationType(job.jobType, job.eventType);
  if (!notificationType) return;

  let title: string;
  let body: string;

  // For 1:1 coaching calls, show the "other person's" name
  // Coach sees client name, client sees coach name
  let eventTitle = job.eventTitle;
  if (job.eventType === 'coaching_1on1') {
    const isUserTheHost = userId === job.hostUserId;
    const otherPersonName = isUserTheHost
      ? (job.clientName || 'Client')
      : (job.hostName || 'Coach');
    eventTitle = `1:1 Call with ${otherPersonName}`;
  }

  switch (job.jobType) {
    case 'notification_24h':
      title = 'Upcoming event tomorrow';
      body = `"${eventTitle}" is tomorrow at ${eventTime} (${userTime} your time).`;
      break;
    case 'notification_1h':
      title = 'Event starting in 1 hour';
      body = `"${eventTitle}" starts in 1 hour at ${eventTime} (${userTime} your time).`;
      break;
    case 'notification_live':
      title = 'Event is live now';
      body = `"${eventTitle}" is happening now!`;
      break;
    default:
      return;
  }

  await notifyUser({
    userId,
    type: notificationType,
    title,
    body,
    actionRoute: getActionRoute(job),
    organizationId,
  });
}

// ============================================================================
// Email Functions
// ============================================================================

/**
 * Send email to a single user for an event
 */
async function sendEventEmail({
  userId,
  job,
}: {
  userId: string;
  job: EventScheduledJob;
}): Promise<void> {
  const user = await getUserById(userId);
  if (!user || !user.email) return;

  // Check user's email preferences
  const emailPrefs = user.emailPreferences;
  if (emailPrefs) {
    // For community/squad calls
    if (job.eventType === 'squad_call') {
      if (job.jobType === 'email_24h' && emailPrefs.squadCall24h === false) {
        console.log(`[EVENT_EMAIL] Skipping ${job.jobType} - user ${userId} has disabled 24h community call emails`);
        return;
      }
      if (job.jobType === 'email_1h' && emailPrefs.squadCall1h === false) {
        console.log(`[EVENT_EMAIL] Skipping ${job.jobType} - user ${userId} has disabled 1h community call emails`);
        return;
      }
    }

    // For 1:1 coaching calls - use separate preferences
    if (job.eventType === 'coaching_1on1') {
      if (job.jobType === 'email_24h' && emailPrefs.coachingCall24h === false) {
        console.log(`[EVENT_EMAIL] Skipping ${job.jobType} - user ${userId} has disabled 24h 1:1 call emails`);
        return;
      }
      if (job.jobType === 'email_1h' && emailPrefs.coachingCall1h === false) {
        console.log(`[EVENT_EMAIL] Skipping ${job.jobType} - user ${userId} has disabled 1h 1:1 call emails`);
        return;
      }
    }
  }

  // Get tenant branding
  const organizationId = job.organizationId || user.primaryOrganizationId || null;
  const appTitle = await getAppTitleForEmail(organizationId);
  const teamName = appTitle === 'Coachful' ? 'Coachful' : appTitle;

  const userTimezone = user.timezone || 'UTC';
  const firstName = user.firstName || 'there';
  const eventTime = formatEventTimeForDisplay(job.eventDateTime, job.eventTimezone);
  const userTime = formatEventTimeInUserTimezone(job.eventDateTime, userTimezone);
  
  const eventDate = new Date(job.eventDateTime);
  const dateStr = new Intl.DateTimeFormat('en-US', {
    timeZone: job.eventTimezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(eventDate);

  const eventUrl = `${APP_URL}${getActionRoute(job)}`;

  let subject: string;
  let textBody: string;

  switch (job.jobType) {
    case 'email_24h':
      subject = `Reminder: ${job.eventTitle} is tomorrow`;
      textBody = `Hi ${firstName},

This is a reminder that "${job.eventTitle}" is scheduled for ${dateStr} at ${eventTime} (that's ${userTime} your time).

${eventUrl}

– ${teamName}`.trim();
      break;

    case 'email_1h':
      subject = `${job.eventTitle} starts in 1 hour`;
      textBody = `Hi ${firstName},

"${job.eventTitle}" starts in 1 hour: ${dateStr} at ${eventTime} (${userTime} your time).

See you there 👊

${eventUrl}

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
      'X-Entity-Ref-ID': `event-${job.eventId}-${userId}-${job.jobType}`,
    },
  });

  if (result.success) {
    console.log(`[EVENT_EMAIL] Sent ${job.jobType} email to ${userId}`);
  } else {
    console.error(`[EVENT_EMAIL] Failed to send ${job.jobType} email to ${userId}:`, result.error);
  }
}

// ============================================================================
// Chat Reminder Functions
// ============================================================================

/**
 * Send a chat reminder message to the event's chat channel
 */
async function sendChatReminder(job: EventScheduledJob): Promise<void> {
  if (!job.chatChannelId) return;

  try {
    const streamClient = await getStreamServerClient();
    await ensureSystemBotUser(streamClient);

    const channel = streamClient.channel('messaging', job.chatChannelId);
    
    const formattedTime = formatEventTimeForDisplay(job.eventDateTime, job.eventTimezone);

    let messageText: string;
    
    if (job.jobType === 'chat_reminder_1h') {
      messageText = `⏰ **Reminder:** "${job.eventTitle}" starts in 1 hour!\n\n**When:** ${formattedTime}\n**Location:** ${job.eventLocation}`;
    } else if (job.jobType === 'chat_reminder_live') {
      messageText = `🎯 **"${job.eventTitle}" is starting now!**\n\n**Location:** ${job.eventLocation}`;
    } else {
      return;
    }

    await channel.sendMessage({
      text: messageText,
      user_id: SYSTEM_BOT_USER_ID,
      event_reminder: true,
      event_id: job.eventId,
    } as Parameters<typeof channel.sendMessage>[0]);

    console.log(`[EVENT_CHAT] Sent ${job.jobType} to channel ${job.chatChannelId}`);
  } catch (error) {
    console.error(`[EVENT_CHAT] Failed to send ${job.jobType}:`, error);
    throw error;
  }
}

// ============================================================================
// Job Execution
// ============================================================================

/**
 * Execute a single scheduled job.
 * Sends notifications, emails, or chat reminders based on job type.
 */
export async function executeEventJob(job: EventScheduledJob): Promise<{
  success: boolean;
  usersNotified: number;
  errors: number;
}> {
  const stats = {
    success: true,
    usersNotified: 0,
    errors: 0,
  };

  try {
    // Handle chat reminders (sent once to channel, not per-user)
    if (job.jobType === 'chat_reminder_1h' || job.jobType === 'chat_reminder_live') {
      await sendChatReminder(job);
      stats.usersNotified = 1;
      return stats;
    }

    // Get target users
    const userIds = await getEventTargetUserIds(job);

    if (userIds.length === 0) {
      console.log(`[EVENT_JOBS] No target users found for event ${job.eventId}`);
      return stats;
    }

    // Determine job category
    const isNotification = job.jobType.startsWith('notification_');
    const isEmail = job.jobType.startsWith('email_');

    for (const userId of userIds) {
      try {
        if (isNotification) {
          await sendEventNotification({ userId, job });
        } else if (isEmail) {
          await sendEventEmail({ userId, job });
        }
        stats.usersNotified++;
      } catch (error) {
        console.error(`[EVENT_JOBS] Error processing user ${userId}:`, error);
        stats.errors++;
      }
    }

    console.log(`[EVENT_JOBS] Executed ${job.jobType} for event ${job.eventId}: ${stats.usersNotified} users notified`);
  } catch (error) {
    console.error(`[EVENT_JOBS] Error executing job ${job.id}:`, error);
    stats.success = false;
    stats.errors++;
  }

  return stats;
}

/**
 * Validate that a job is still valid (event hasn't been rescheduled or canceled)
 */
async function validateJobStillValid(job: EventScheduledJob): Promise<boolean> {
  const event = await getEventById(job.eventId);
  if (!event) return false;

  // Check if event is still in a valid state
  if (event.status === 'canceled' || event.status === 'completed') {
    return false;
  }

  // Check if event time still matches
  return event.startDateTime === job.eventDateTime;
}

/**
 * Process all pending scheduled jobs that are due.
 * Called by the cron job.
 */
export async function processEventScheduledJobs(): Promise<{
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
      .collection('eventScheduledJobs')
      .where('executed', '==', false)
      .where('scheduledTime', '<=', now)
      .limit(100) // Process in batches
      .get();

    if (jobsSnapshot.empty) {
      return stats;
    }

    for (const doc of jobsSnapshot.docs) {
      stats.processed++;
      const job = { id: doc.id, ...doc.data() } as EventScheduledJob;

      try {
        // Validate the event still exists and matches
        const isValid = await validateJobStillValid(job);
        if (!isValid) {
          // Job is stale, delete it
          await adminDb.collection('eventScheduledJobs').doc(doc.id).delete();
          stats.skipped++;
          continue;
        }

        // Execute the job
        const result = await executeEventJob(job);

        // Mark as executed
        await adminDb.collection('eventScheduledJobs').doc(doc.id).update({
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
        console.error(`[EVENT_JOBS] Error processing job ${job.id}:`, error);
        stats.errors++;

        // Mark with error
        await adminDb.collection('eventScheduledJobs').doc(doc.id).update({
          error: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: now,
        }).catch(() => {});
      }
    }

    console.log('[EVENT_JOBS] Process completed:', stats);
  } catch (error) {
    console.error('[EVENT_JOBS] Error processing jobs:', error);
    stats.errors++;
  }

  return stats;
}

