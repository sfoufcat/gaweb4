import { adminDb } from '@/lib/firebase-admin';
import type { UnifiedEvent, SchedulingNotificationType } from '@/types';

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
 * Get user's name for notifications
 */
async function getUserName(userId: string): Promise<string> {
  const userDoc = await adminDb.collection('users').doc(userId).get();
  if (!userDoc.exists) return 'Someone';
  
  const userData = userDoc.data();
  if (userData?.firstName && userData?.lastName) {
    return `${userData.firstName} ${userData.lastName}`;
  }
  return userData?.name || userData?.firstName || 'Someone';
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
 */
export async function notifyCallProposed(
  event: UnifiedEvent,
  clientId: string
) {
  const coachName = event.hostName || await getUserName(event.hostUserId);
  const eventDate = formatEventDate(event.startDateTime, event.timezone);

  await createNotification({
    userId: clientId,
    type: 'call_proposed',
    title: 'New Call Proposal',
    body: `${coachName} proposed a call on ${eventDate}`,
    data: {
      eventId: event.id,
      eventType: event.eventType,
      coachName,
    },
    actionUrl: '/my-coach', // Or wherever the user can respond
  });
}

/**
 * Send notification when a client requests a call
 */
export async function notifyCallRequested(
  event: UnifiedEvent,
  coachId: string
) {
  const clientId = event.attendeeIds.find(id => id !== coachId);
  const clientName = clientId ? await getUserName(clientId) : 'A client';
  const eventDate = formatEventDate(event.startDateTime, event.timezone);

  await createNotification({
    userId: coachId,
    type: 'call_requested',
    title: 'New Call Request',
    body: `${clientName} requested a call around ${eventDate}`,
    data: {
      eventId: event.id,
      eventType: event.eventType,
      clientName,
      clientId: clientId || '',
    },
    actionUrl: `/coach?tab=clients`, // Coach dashboard clients tab
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

