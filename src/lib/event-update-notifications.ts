import { adminDb } from '@/lib/firebase-admin';
import { notifyUser } from '@/lib/notifications';
import type { UnifiedEvent } from '@/types';

/**
 * Create an in-app notification only (no email)
 * Used for intake, cohort, and community events
 */
async function createInAppNotification(params: {
  userId: string;
  organizationId: string;
  title: string;
  body: string;
  actionRoute: string;
  eventId: string;
}) {
  const { userId, organizationId, title, body, actionRoute, eventId } = params;

  const notificationRef = adminDb.collection('notifications').doc();

  await notificationRef.set({
    id: notificationRef.id,
    userId,
    organizationId,
    type: 'meeting_link_changed',
    title,
    body,
    actionRoute,
    read: false,
    createdAt: new Date().toISOString(),
    metadata: { eventId },
  });

  return notificationRef.id;
}

/**
 * Format meeting location for display
 */
function formatMeetingLocation(event: UnifiedEvent): string {
  if (event.locationType === 'chat' || event.meetingProvider === 'stream') {
    return 'In-App Video Call';
  }
  if (event.meetingProvider === 'zoom') {
    return 'Zoom';
  }
  if (event.meetingProvider === 'google_meet') {
    return 'Google Meet';
  }
  if (event.meetingLink) {
    // Try to detect provider from URL
    if (event.meetingLink.includes('zoom.us')) return 'Zoom';
    if (event.meetingLink.includes('meet.google.com')) return 'Google Meet';
    if (event.meetingLink.includes('teams.microsoft.com')) return 'Microsoft Teams';
    return 'External Link';
  }
  return 'TBD';
}

/**
 * Notify attendees when a meeting link/location changes
 *
 * Notification strategy:
 * - 1:1 Coaching: Email + in-app notification to client
 * - Intake Call: In-app notification only
 * - Cohort Call: In-app notification only to cohort members
 * - Community Event: In-app notification only to RSVPd attendees
 */
export async function notifyMeetingLinkChanged(params: {
  event: UnifiedEvent;
  oldLink: string | undefined;
  newLink: string | undefined;
  oldLocationType?: string;
  newLocationType?: string;
}): Promise<void> {
  const { event, oldLink, newLink, oldLocationType, newLocationType } = params;

  // Skip if nothing actually changed
  const linkChanged = oldLink !== newLink;
  const locationTypeChanged = oldLocationType !== newLocationType;

  if (!linkChanged && !locationTypeChanged) {
    console.log('[MEETING_LINK_CHANGED] No actual change detected, skipping notifications');
    return;
  }

  const organizationId = event.organizationId;
  if (!organizationId) {
    console.warn('[MEETING_LINK_CHANGED] No organizationId on event, skipping notifications');
    return;
  }

  const eventTitle = event.title || 'your scheduled call';
  const newLocation = formatMeetingLocation(event);
  const title = 'Meeting Link Updated';
  const body = `The meeting location for "${eventTitle}" has been changed to ${newLocation}.`;
  const actionRoute = '/my-coach'; // Clients see their calls here

  // Collect all user IDs to notify (excluding the host)
  const userIdsToNotify = new Set<string>();

  // Add attendees
  if (event.attendeeIds && event.attendeeIds.length > 0) {
    event.attendeeIds.forEach(id => userIdsToNotify.add(id));
  }

  // Add client for 1:1 or intake calls
  if (event.clientUserId) {
    userIdsToNotify.add(event.clientUserId);
  }

  // Remove the host (they made the change, no need to notify them)
  if (event.hostUserId) {
    userIdsToNotify.delete(event.hostUserId);
  }

  if (userIdsToNotify.size === 0) {
    console.log('[MEETING_LINK_CHANGED] No attendees to notify');
    return;
  }

  console.log(`[MEETING_LINK_CHANGED] Notifying ${userIdsToNotify.size} attendees for event ${event.id} (${event.eventType})`);

  // Process notifications based on event type
  const notificationPromises: Promise<unknown>[] = [];

  for (const userId of userIdsToNotify) {
    if (event.eventType === 'coaching_1on1') {
      // 1:1 Coaching: Use notifyUser() which sends both email + in-app
      notificationPromises.push(
        notifyUser({
          userId,
          type: 'meeting_link_changed',
          title,
          body,
          actionRoute,
          organizationId,
          metadata: { eventId: event.id },
        }).catch(err => {
          console.error(`[MEETING_LINK_CHANGED] Failed to notify user ${userId}:`, err);
        })
      );
    } else {
      // Intake, Cohort, Community: In-app notification only (no email)
      notificationPromises.push(
        createInAppNotification({
          userId,
          organizationId,
          title,
          body,
          actionRoute,
          eventId: event.id,
        }).catch(err => {
          console.error(`[MEETING_LINK_CHANGED] Failed to create in-app notification for user ${userId}:`, err);
        })
      );
    }
  }

  await Promise.all(notificationPromises);

  console.log(`[MEETING_LINK_CHANGED] Successfully sent ${notificationPromises.length} notifications`);
}
