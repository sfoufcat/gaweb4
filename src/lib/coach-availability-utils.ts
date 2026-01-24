import { adminDb } from '@/lib/firebase-admin';
import type { CoachAvailability } from '@/types';

/**
 * Default availability settings for new coaches
 * Monday-Friday 9am-5pm, weekends off
 */
function getDefaultAvailability(
  organizationId: string,
  coachUserId: string,
  timezone: string = 'America/New_York'
): Omit<CoachAvailability, 'createdAt' | 'updatedAt'> {
  return {
    odId: organizationId,
    coachUserId,
    weeklySchedule: {
      0: [], // Sunday
      1: [{ start: '09:00', end: '17:00' }], // Monday
      2: [{ start: '09:00', end: '17:00' }], // Tuesday
      3: [{ start: '09:00', end: '17:00' }], // Wednesday
      4: [{ start: '09:00', end: '17:00' }], // Thursday
      5: [{ start: '09:00', end: '17:00' }], // Friday
      6: [], // Saturday
    },
    blockedSlots: [],
    defaultDuration: 60,
    bufferBetweenCalls: 15,
    timezone,
    advanceBookingDays: 30,
    minNoticeHours: 24,
    syncExternalBusy: true,
    pushEventsToCalendar: true,
  };
}

/**
 * Ensures a coach_availability document exists for the given organization.
 * If it doesn't exist, creates one with sensible defaults.
 *
 * @param organizationId - The Clerk organization ID
 * @param coachUserId - The Clerk user ID of the coach
 * @param timezone - Optional timezone (defaults to America/New_York)
 * @returns The existing or newly created CoachAvailability document
 */
export async function ensureCoachAvailability(
  organizationId: string,
  coachUserId: string,
  timezone?: string
): Promise<CoachAvailability> {
  const docRef = adminDb.collection('coach_availability').doc(organizationId);
  const doc = await docRef.get();

  if (doc.exists) {
    return doc.data() as CoachAvailability;
  }

  // Create new document with defaults
  const now = new Date().toISOString();
  const newDoc: CoachAvailability = {
    ...getDefaultAvailability(organizationId, coachUserId, timezone),
    createdAt: now,
    updatedAt: now,
  };

  await docRef.set(newDoc);
  console.log(`[COACH_AVAILABILITY] Auto-created availability for org ${organizationId}`);

  return newDoc;
}
