import { adminDb } from '@/lib/firebase-admin';
import { sendTenantEmail, getAppTitleForEmail, getLogoUrlForEmail, APP_BASE_URL } from '@/lib/email-sender';
import type { UnifiedEvent, SchedulingNotificationType, FirebaseUser } from '@/types';

interface NotificationPayload {
  userId: string;
  type: SchedulingNotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  actionUrl?: string;
}

/**
 * Create a notification in the user's notification feed
 */
async function createNotification(payload: NotificationPayload) {
  const notificationRef = adminDb.collection('notifications').doc();
  
  await notificationRef.set({
    id: notificationRef.id,
    userId: payload.userId,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
    actionUrl: payload.actionUrl,
    read: false,
    createdAt: new Date().toISOString(),
  });

  return notificationRef.id;
}

/**
 * Get user info for notifications
 */
async function getUserInfo(userId: string): Promise<{ name: string; firstName: string; email: string | null; organizationId: string | null }> {
  const userDoc = await adminDb.collection('users').doc(userId).get();
  if (!userDoc.exists) return { name: 'Someone', firstName: 'there', email: null, organizationId: null };

  const userData = userDoc.data() as FirebaseUser | undefined;
  const name = userData?.firstName && userData?.lastName
    ? `${userData.firstName} ${userData.lastName}`
    : userData?.name || userData?.firstName || 'Someone';

  return {
    name,
    firstName: userData?.firstName || 'there',
    email: userData?.email || null,
    organizationId: userData?.primaryOrganizationId || null,
  };
}

/**
 * Get user's name for notifications (wrapper for backward compatibility)
 */
async function getUserName(userId: string): Promise<string> {
  const { name } = await getUserInfo(userId);
  return name;
}

/**
 * Generate scheduling email HTML template
 */
function generateSchedulingEmailHtml(options: {
  logoUrl: string;
  teamName: string;
  firstName: string;
  headline: string;
  body: string;
  ctaUrl?: string;
  ctaLabel?: string;
  eventDetails?: {
    title: string;
    date: string;
    meetingLink?: string;
  };
}): string {
  const { logoUrl, teamName, firstName, headline, body, ctaUrl, ctaLabel, eventDetails } = options;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #2c2520; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <img src="${logoUrl}" alt="${teamName}" style="width: 60px; height: 60px; border-radius: 12px;">
  </div>

  <p style="font-size: 18px; margin-bottom: 20px;">Hi ${firstName},</p>

  <p style="font-size: 16px; font-weight: 600; margin-bottom: 15px;">${headline}</p>

  <p style="margin-bottom: 20px;">${body}</p>

  ${eventDetails ? `
  <div style="background-color: #f9f8f7; border: 1px solid #e1ddd8; border-radius: 12px; padding: 20px; margin: 20px 0;">
    <p style="margin: 0 0 8px 0; font-weight: 600; color: #1a1a1a;">${eventDetails.title}</p>
    <p style="margin: 0; color: #5f5a55;">📅 ${eventDetails.date}</p>
    ${eventDetails.meetingLink ? `<p style="margin: 8px 0 0 0;"><a href="${eventDetails.meetingLink}" style="color: #2563eb;">Join meeting</a></p>` : ''}
  </div>
  ` : ''}

  ${ctaUrl && ctaLabel ? `
  <div style="text-align: center; margin: 30px 0;">
    <a href="${ctaUrl}" style="display: inline-block; background: linear-gradient(135deg, #2c2520 0%, #3d342d 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 32px; font-weight: bold; font-size: 16px;">
      ${ctaLabel}
    </a>
  </div>
  ` : ''}

  <p style="margin-bottom: 10px;">Best,</p>
  <p style="color: #666;">The ${teamName} Team</p>

  <hr style="border: none; border-top: 1px solid #e1ddd8; margin: 30px 0;">

  <p style="font-size: 12px; color: #999; text-align: center;">
    © ${year} ${teamName}. All rights reserved.
  </p>
</body>
</html>`;
}

/**
 * Send scheduling email to a user
 */
async function sendSchedulingEmail(options: {
  recipientId: string;
  subject: string;
  headline: string;
  body: string;
  ctaUrl?: string;
  ctaLabel?: string;
  eventDetails?: {
    title: string;
    date: string;
    meetingLink?: string;
  };
}) {
  const { recipientId, subject, headline, body, ctaUrl, ctaLabel, eventDetails } = options;

  const recipientInfo = await getUserInfo(recipientId);
  if (!recipientInfo.email) {
    console.warn('[SCHEDULING_NOTIFICATIONS] No email for user:', recipientId);
    return;
  }

  const organizationId = recipientInfo.organizationId;
  const teamName = await getAppTitleForEmail(organizationId);
  const logoUrl = await getLogoUrlForEmail(organizationId);

  const html = generateSchedulingEmailHtml({
    logoUrl,
    teamName,
    firstName: recipientInfo.firstName,
    headline,
    body,
    ctaUrl,
    ctaLabel,
    eventDetails,
  });

  try {
    await sendTenantEmail({
      to: recipientInfo.email,
      subject,
      html,
      organizationId,
    });
    console.log('[SCHEDULING_NOTIFICATIONS] Email sent to:', recipientInfo.email);
  } catch (error) {
    console.error('[SCHEDULING_NOTIFICATIONS] Failed to send email:', error);
  }
}

/**
 * Format date for notification display
 */
function formatEventDate(dateString: string, timezone?: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone || 'America/New_York',
  });
}

/**
 * Send notification when a coach proposes a call
 * Sends email only (no notification panel) - event appears in My Calendar
 */
export async function notifyCallProposed(
  event: UnifiedEvent,
  clientId: string
) {
  const coachName = event.hostName || await getUserName(event.hostUserId);
  const eventDate = formatEventDate(event.startDateTime, event.timezone);

  // Send email notification
  await sendSchedulingEmail({
    recipientId: clientId,
    subject: `New Call Proposal from ${coachName}`,
    headline: 'New Call Proposal',
    body: `${coachName} has proposed a call with you. Please review the proposed times and accept or suggest alternatives.`,
    ctaUrl: `${APP_BASE_URL}/my-coach`,
    ctaLabel: 'View Proposal',
    eventDetails: {
      title: event.title,
      date: eventDate,
    },
  });
}

/**
 * Send notification when a client requests a call
 * Sends email only (no notification panel) - event appears in My Calendar
 */
export async function notifyCallRequested(
  event: UnifiedEvent,
  coachId: string
) {
  const clientId = event.attendeeIds.find(id => id !== coachId);
  const clientName = clientId ? await getUserName(clientId) : 'A client';
  const eventDate = formatEventDate(event.startDateTime, event.timezone);

  // Send email notification to coach
  await sendSchedulingEmail({
    recipientId: coachId,
    subject: `New Call Request from ${clientName}`,
    headline: 'New Call Request',
    body: `${clientName} has requested a call with you. Please review the proposed times and accept or suggest alternatives.`,
    ctaUrl: `${APP_BASE_URL}/my-coach`,
    ctaLabel: 'View Request',
    eventDetails: {
      title: event.title,
      date: eventDate,
    },
  });
}

/**
 * Send notification when a call proposal is accepted
 */
export async function notifyCallAccepted(
  event: UnifiedEvent,
  acceptedBy: string
) {
  const accepterName = await getUserName(acceptedBy);
  const eventDate = formatEventDate(event.startDateTime, event.timezone);

  // Notify the other party (the one who proposed)
  const recipientId = event.proposedBy === acceptedBy 
    ? event.attendeeIds.find(id => id !== acceptedBy)
    : event.proposedBy;

  if (recipientId) {
    await createNotification({
      userId: recipientId,
      type: 'call_accepted',
      title: 'Call Confirmed!',
      body: `${accepterName} accepted the call for ${eventDate}`,
      data: {
        eventId: event.id,
        eventType: event.eventType,
      },
      actionUrl: '/my-coach',
    });
  }
}

/**
 * Send notification when a call proposal is declined
 */
export async function notifyCallDeclined(
  event: UnifiedEvent,
  declinedBy: string
) {
  const declinerName = await getUserName(declinedBy);

  // Notify the other party (the one who proposed)
  const recipientId = event.proposedBy === declinedBy 
    ? event.attendeeIds.find(id => id !== declinedBy)
    : event.proposedBy;

  if (recipientId) {
    await createNotification({
      userId: recipientId,
      type: 'call_declined',
      title: 'Call Declined',
      body: `${declinerName} declined the proposed call`,
      data: {
        eventId: event.id,
        eventType: event.eventType,
      },
      actionUrl: '/my-coach',
    });
  }
}

/**
 * Send notification when a counter-proposal is made
 */
export async function notifyCallCounterProposed(
  event: UnifiedEvent,
  counterProposedBy: string
) {
  const proposerName = await getUserName(counterProposedBy);
  const eventDate = formatEventDate(event.startDateTime, event.timezone);

  // Notify the other party
  const recipientId = event.attendeeIds.find(id => id !== counterProposedBy);

  if (recipientId) {
    await createNotification({
      userId: recipientId,
      type: 'call_counter_proposed',
      title: 'New Time Proposed',
      body: `${proposerName} suggested a different time: ${eventDate}`,
      data: {
        eventId: event.id,
        eventType: event.eventType,
      },
      actionUrl: '/my-coach',
    });
  }
}

/**
 * Send notification when a call is cancelled
 * Sends both notification panel entry AND email
 */
export async function notifyCallCancelled(
  event: UnifiedEvent,
  cancelledBy: string,
  reason?: string
) {
  const cancellerName = await getUserName(cancelledBy);
  const eventDate = formatEventDate(event.startDateTime, event.timezone);

  // Notify all other participants
  for (const attendeeId of event.attendeeIds) {
    if (attendeeId !== cancelledBy) {
      // Create notification in panel
      await createNotification({
        userId: attendeeId,
        type: 'call_cancelled',
        title: 'Call Cancelled',
        body: `${cancellerName} cancelled the call scheduled for ${eventDate}${reason ? `: ${reason}` : ''}`,
        data: {
          eventId: event.id,
          eventType: event.eventType,
        },
        actionUrl: '/my-coach',
      });

      // Send email notification
      await sendSchedulingEmail({
        recipientId: attendeeId,
        subject: 'Call Cancelled',
        headline: 'Your Call Has Been Cancelled',
        body: `${cancellerName} has cancelled your scheduled call.${reason ? ` Reason: ${reason}` : ''}`,
        ctaUrl: `${APP_BASE_URL}/my-coach`,
        ctaLabel: 'View Calendar',
        eventDetails: {
          title: event.title,
          date: eventDate,
        },
      });
    }
  }
}

/**
 * Send reminder notification before a call
 */
export async function notifyCallReminder(
  event: UnifiedEvent,
  hoursBeforeLabel: string
) {
  const eventDate = formatEventDate(event.startDateTime, event.timezone);

  // Notify all participants
  for (const attendeeId of event.attendeeIds) {
    await createNotification({
      userId: attendeeId,
      type: hoursBeforeLabel === '24h' ? 'call_reminder_24h' : 'call_reminder_1h',
      title: `Call ${hoursBeforeLabel === '24h' ? 'Tomorrow' : 'Soon'}`,
      body: `Reminder: ${event.title} on ${eventDate}`,
      data: {
        eventId: event.id,
        eventType: event.eventType,
        meetingLink: event.meetingLink || '',
      },
      actionUrl: event.meetingLink || '/my-coach',
    });
  }
}

/**
 * Send notification about approaching response deadline
 */
export async function notifyResponseDeadlineApproaching(
  event: UnifiedEvent,
  recipientId: string
) {
  const eventDate = formatEventDate(event.startDateTime, event.timezone);

  await createNotification({
    userId: recipientId,
    type: 'response_deadline_approaching',
    title: 'Response Needed Soon',
    body: `Please respond to the call proposal for ${eventDate}`,
    data: {
      eventId: event.id,
      eventType: event.eventType,
    },
    actionUrl: '/my-coach',
  });
}

/**
 * Send notification when a call is rescheduled
 * Sends email only (no notification panel) - event appears in My Calendar as pending proposal
 */
export async function notifyCallRescheduled(
  event: UnifiedEvent,
  rescheduledBy: string,
  reason?: string
) {
  const reschedulerName = await getUserName(rescheduledBy);
  const eventDate = formatEventDate(event.startDateTime, event.timezone);

  // Send email to all other participants (no notification panel - shows in calendar)
  for (const attendeeId of event.attendeeIds) {
    if (attendeeId !== rescheduledBy) {
      await sendSchedulingEmail({
        recipientId: attendeeId,
        subject: `Call Reschedule Request from ${reschedulerName}`,
        headline: 'Call Reschedule Request',
        body: `${reschedulerName} has requested to reschedule your call.${reason ? ` Reason: ${reason}` : ''} Please review the new proposed times.`,
        ctaUrl: `${APP_BASE_URL}/my-coach`,
        ctaLabel: 'View New Times',
        eventDetails: {
          title: event.title,
          date: eventDate,
        },
      });
    }
  }
}

