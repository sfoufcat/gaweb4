import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { headers } from 'next/headers';
import { adminDb } from '@/lib/firebase-admin';
import { getCalendarBusyTimes } from '@/lib/calendar-busy-times';
import type { CoachAvailability, UnifiedEvent, Squad, StandardSquadCall } from '@/types';
import type { ClerkPublicMetadata } from '@/lib/admin-utils-clerk';

// Minimal event structure needed for conflict checking
interface BlockingEvent {
  startDateTime: string;
  endDateTime?: string;
  durationMinutes?: number;
}

interface AvailableSlot {
  start: string;
  end: string;
  duration: number;
}

/**
 * GET /api/scheduling/available-slots
 * Get available time slots for clients to request calls
 * This is the client-facing endpoint (doesn't require coach role)
 *
 * Query params:
 * - startDate: ISO date (required) - start of date range
 * - endDate: ISO date (required) - end of date range
 * - duration: number (optional) - call duration in minutes
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, orgId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get organization ID from multiple sources (priority order):
    // 1. Tenant context from headers (set by middleware for custom domains/subdomains)
    // 2. Clerk's native org session
    // 3. User's publicMetadata (primaryOrganizationId or organizationId)
    const headersList = await headers();
    const tenantOrgId = headersList.get('x-tenant-org-id');

    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const primaryOrgId = typeof publicMetadata?.primaryOrganizationId === 'string' ? publicMetadata.primaryOrganizationId : undefined;
    const legacyOrgId = typeof publicMetadata?.organizationId === 'string' ? publicMetadata.organizationId : undefined;

    const resolvedOrgId = tenantOrgId || orgId || primaryOrgId || legacyOrgId;

    if (!resolvedOrgId) {
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 400 }
      );
    }

    // Use resolvedOrgId from here on (guaranteed to be string after the check above)
    const organizationId: string = resolvedOrgId;

    console.log('[AVAILABLE_SLOTS] Org ID sources - tenant:', tenantOrgId, 'clerk:', orgId, 'primary:', primaryOrgId, 'legacy:', legacyOrgId);
    console.log('[AVAILABLE_SLOTS] Using organizationId:', organizationId);

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const durationParam = searchParams.get('duration');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);

    if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use ISO 8601 format.' },
        { status: 400 }
      );
    }

    const maxRangeDays = 60;
    const daysDiff = (rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > maxRangeDays) {
      return NextResponse.json(
        { error: `Date range cannot exceed ${maxRangeDays} days` },
        { status: 400 }
      );
    }

    // Get coach availability settings for this organization
    const availabilityDoc = await adminDb
      .collection('coach_availability')
      .doc(organizationId)
      .get();

    console.log('[AVAILABLE_SLOTS] organizationId:', organizationId);
    console.log('[AVAILABLE_SLOTS] Document exists:', availabilityDoc.exists);
    if (availabilityDoc.exists) {
      console.log('[AVAILABLE_SLOTS] Document data:', JSON.stringify(availabilityDoc.data(), null, 2));
    }

    let availability: CoachAvailability;
    if (!availabilityDoc.exists) {
      // Use defaults
      availability = {
        odId: organizationId,
        coachUserId: '',
        weeklySchedule: {
          0: [],
          1: [{ start: '09:00', end: '17:00' }],
          2: [{ start: '09:00', end: '17:00' }],
          3: [{ start: '09:00', end: '17:00' }],
          4: [{ start: '09:00', end: '17:00' }],
          5: [{ start: '09:00', end: '17:00' }],
          6: [],
        },
        blockedSlots: [],
        defaultDuration: 60,
        bufferBetweenCalls: 15,
        timezone: 'America/New_York',
        advanceBookingDays: 30,
        minNoticeHours: 24,
        syncExternalBusy: true,
        pushEventsToCalendar: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } else {
      availability = availabilityDoc.data() as CoachAvailability;
    }

    // Ensure weeklySchedule is valid, use defaults if not
    if (!availability.weeklySchedule || typeof availability.weeklySchedule !== 'object' ||
        Object.keys(availability.weeklySchedule).length === 0) {
      availability.weeklySchedule = {
        0: [],
        1: [{ start: '09:00', end: '17:00' }],
        2: [{ start: '09:00', end: '17:00' }],
        3: [{ start: '09:00', end: '17:00' }],
        4: [{ start: '09:00', end: '17:00' }],
        5: [{ start: '09:00', end: '17:00' }],
        6: [],
      };
    }

    const duration = durationParam ? parseInt(durationParam) : availability.defaultDuration;
    const buffer = availability.bufferBetweenCalls;

    // Get existing events in the date range
    const eventsSnapshot = await adminDb
      .collection('events')
      .where('organizationId', '==', organizationId)
      .where('startDateTime', '>=', rangeStart.toISOString())
      .where('startDateTime', '<=', rangeEnd.toISOString())
      .where('status', 'in', ['confirmed', 'pending_response', 'proposed'])
      .get();

    const existingEvents: BlockingEvent[] = eventsSnapshot.docs.map(doc => doc.data() as UnifiedEvent);

    // Also fetch legacy squad calls that should block availability
    // These are stored outside the events collection but still need to block 1-on-1 booking
    const squadBlockingEvents = await fetchSquadBlockingEvents(organizationId, rangeStart, rangeEnd);
    existingEvents.push(...squadBlockingEvents);

    console.log('[AVAILABLE_SLOTS] Squad blocking events count:', squadBlockingEvents.length);

    // Get external calendar busy times if enabled
    let externalBusyTimes: Array<{ start: string; end: string }> = [];
    if (availability.syncExternalBusy) {
      try {
        // Call the shared function directly (no HTTP overhead, no auth issues)
        const busyData = await getCalendarBusyTimes(
          organizationId,
          rangeStart.toISOString(),
          rangeEnd.toISOString()
        );
        externalBusyTimes = busyData.busyTimes || [];
      } catch (err) {
        console.warn('[AVAILABLE_SLOTS] Failed to fetch external busy times:', err);
      }
    }

    console.log('[AVAILABLE_SLOTS] weeklySchedule:', JSON.stringify(availability.weeklySchedule, null, 2));
    console.log('[AVAILABLE_SLOTS] timezone:', availability.timezone);
    console.log('[AVAILABLE_SLOTS] minNoticeHours:', availability.minNoticeHours);
    console.log('[AVAILABLE_SLOTS] blockedSlots count:', availability.blockedSlots?.length || 0);
    console.log('[AVAILABLE_SLOTS] existingEvents count:', existingEvents.length);
    console.log('[AVAILABLE_SLOTS] Date range:', startDate, 'to', endDate);

    // Calculate available slots
    const availableSlots = calculateAvailableSlots(
      rangeStart,
      rangeEnd,
      availability,
      existingEvents,
      duration,
      buffer,
      externalBusyTimes
    );

    console.log('[AVAILABLE_SLOTS] Generated slots count:', availableSlots.length);
    if (availableSlots.length > 0) {
      console.log('[AVAILABLE_SLOTS] First slot:', availableSlots[0]);
    }

    return NextResponse.json({
      slots: availableSlots,
      timezone: availability.timezone,
      duration,
      buffer,
    });
  } catch (error) {
    console.error('[AVAILABLE_SLOTS_GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Convert a date string (YYYY-MM-DD) + time in a specific timezone to a UTC Date object
 */
function createDateInTimezone(dateStr: string, hours: number, minutes: number, timezone: string): Date {
  // Parse the date string components
  const [year, month, day] = dateStr.split('-').map(Number);

  // Create a reference point in UTC (same date/time but interpreted as UTC)
  const utcReference = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));

  // Use Intl.DateTimeFormat to see what this UTC time looks like in the target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    day: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(utcReference);
  const tzHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const tzMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  const tzDay = parseInt(parts.find(p => p.type === 'day')?.value || '0');

  // Calculate the timezone offset in minutes
  // Example: if utcReference is 09:00 UTC and tzHour shows 04:00 (New York),
  // the offset is -5 hours (-300 minutes)
  let offsetMinutes = (tzHour * 60 + tzMinute) - (hours * 60 + minutes);

  // Handle day boundary (e.g., if UTC time is on different day than target timezone)
  if (tzDay > day) offsetMinutes += 24 * 60;
  if (tzDay < day) offsetMinutes -= 24 * 60;

  // Adjust to get the correct UTC time
  // To show hours:minutes in the target timezone, we shift by -offset
  return new Date(utcReference.getTime() - offsetMinutes * 60 * 1000);
}

/**
 * Get day of week from a date string (YYYY-MM-DD)
 * Returns 0 = Sunday, 1 = Monday, ..., 6 = Saturday
 */
function getDayOfWeekFromDateString(dateStr: string): number {
  // Parse the date string components directly to avoid timezone issues
  const [year, month, day] = dateStr.split('-').map(Number);
  // Create date at noon UTC to avoid any timezone edge cases
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return date.getUTCDay();
}

/**
 * Add days to a date string (YYYY-MM-DD) and return the new date string
 */
function addDaysToDateString(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return date.toISOString().split('T')[0];
}

/**
 * Compare two date strings (YYYY-MM-DD)
 * Returns negative if a < b, 0 if equal, positive if a > b
 */
function compareDateStrings(a: string, b: string): number {
  return a.localeCompare(b);
}

function calculateAvailableSlots(
  rangeStart: Date,
  rangeEnd: Date,
  availability: CoachAvailability,
  existingEvents: BlockingEvent[],
  duration: number,
  buffer: number,
  externalBusyTimes: Array<{ start: string; end: string }> = []
): AvailableSlot[] {
  const slots: AvailableSlot[] = [];
  const now = new Date();
  const minNoticeMs = availability.minNoticeHours * 60 * 60 * 1000;
  const timezone = availability.timezone || 'America/New_York';

  console.log('[CALC_SLOTS] now:', now.toISOString());
  console.log('[CALC_SLOTS] minNoticeMs:', minNoticeMs, '(', availability.minNoticeHours, 'hours)');
  console.log('[CALC_SLOTS] Earliest allowed slot:', new Date(now.getTime() + minNoticeMs).toISOString());

  // Work with date strings (YYYY-MM-DD) to avoid timezone confusion
  // The client sends dates like "2026-01-04" which represent the date they see
  const startDateStr = rangeStart.toISOString().split('T')[0];
  const endDateStr = rangeEnd.toISOString().split('T')[0];

  console.log('[CALC_SLOTS] Date range strings:', startDateStr, 'to', endDateStr);

  let currentDateStr = startDateStr;
  let daysProcessed = 0;

  while (compareDateStrings(currentDateStr, endDateStr) <= 0) {
    // Get day of week directly from the date string (avoids timezone confusion)
    const dayOfWeek = getDayOfWeekFromDateString(currentDateStr);
    const daySchedule = availability.weeklySchedule[dayOfWeek] || [];

    if (daysProcessed < 3) {
      console.log(`[CALC_SLOTS] Day ${currentDateStr} (dayOfWeek=${dayOfWeek}):`, daySchedule.length, 'time slots');
    }
    daysProcessed++;

    for (const timeSlot of daySchedule) {
      const [startHour, startMin] = timeSlot.start.split(':').map(Number);
      const [endHour, endMin] = timeSlot.end.split(':').map(Number);

      // Create slot times in the coach's timezone using the date string
      const slotStart = createDateInTimezone(currentDateStr, startHour, startMin, timezone);
      const slotEnd = createDateInTimezone(currentDateStr, endHour, endMin, timezone);

      if (daysProcessed <= 3) {
        console.log(`[CALC_SLOTS] TimeSlot ${timeSlot.start}-${timeSlot.end} -> UTC: ${slotStart.toISOString()} to ${slotEnd.toISOString()}`);
      }

      let currentSlotStart = new Date(slotStart);
      let slotAttempts = 0;

      while (currentSlotStart.getTime() + duration * 60 * 1000 <= slotEnd.getTime()) {
        const currentSlotEnd = new Date(currentSlotStart.getTime() + duration * 60 * 1000);
        slotAttempts++;

        const passesMinNotice = currentSlotStart.getTime() > now.getTime() + minNoticeMs;
        if (daysProcessed <= 3 && slotAttempts <= 2) {
          console.log(`[CALC_SLOTS] Slot attempt: ${currentSlotStart.toISOString()}, passesMinNotice: ${passesMinNotice}`);
        }

        if (passesMinNotice) {
          const isBlocked = availability.blockedSlots.some(blocked => {
            const blockedStart = new Date(blocked.start);
            const blockedEnd = new Date(blocked.end);
            return (
              (currentSlotStart >= blockedStart && currentSlotStart < blockedEnd) ||
              (currentSlotEnd > blockedStart && currentSlotEnd <= blockedEnd) ||
              (currentSlotStart <= blockedStart && currentSlotEnd >= blockedEnd)
            );
          });

          const conflictsWithEvent = existingEvents.some(event => {
            const eventStart = new Date(event.startDateTime);
            const eventEnd = event.endDateTime
              ? new Date(event.endDateTime)
              : new Date(eventStart.getTime() + (event.durationMinutes || 60) * 60 * 1000);

            const bufferedStart = new Date(eventStart.getTime() - buffer * 60 * 1000);
            const bufferedEnd = new Date(eventEnd.getTime() + buffer * 60 * 1000);

            return (
              (currentSlotStart >= bufferedStart && currentSlotStart < bufferedEnd) ||
              (currentSlotEnd > bufferedStart && currentSlotEnd <= bufferedEnd) ||
              (currentSlotStart <= bufferedStart && currentSlotEnd >= bufferedEnd)
            );
          });

          const conflictsWithExternal = externalBusyTimes.some(busy => {
            const busyStart = new Date(busy.start);
            const busyEnd = new Date(busy.end);

            const bufferedStart = new Date(busyStart.getTime() - buffer * 60 * 1000);
            const bufferedEnd = new Date(busyEnd.getTime() + buffer * 60 * 1000);

            return (
              (currentSlotStart >= bufferedStart && currentSlotStart < bufferedEnd) ||
              (currentSlotEnd > bufferedStart && currentSlotEnd <= bufferedEnd) ||
              (currentSlotStart <= bufferedStart && currentSlotEnd >= bufferedEnd)
            );
          });

          if (!isBlocked && !conflictsWithEvent && !conflictsWithExternal) {
            slots.push({
              start: currentSlotStart.toISOString(),
              end: currentSlotEnd.toISOString(),
              duration,
            });
          }
        }

        currentSlotStart = new Date(currentSlotStart.getTime() + (duration + buffer) * 60 * 1000);
      }
    }

    // Move to next day using date string arithmetic
    currentDateStr = addDaysToDateString(currentDateStr, 1);
  }

  return slots;
}

/**
 * Fetch squad-related events that should block availability
 * This includes:
 * 1. Legacy coach-scheduled squad calls (stored on squad document as nextCallDateTime)
 * 2. Confirmed peer-led squad calls (stored in standardSquadCalls collection)
 */
async function fetchSquadBlockingEvents(
  organizationId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<BlockingEvent[]> {
  const blockingEvents: BlockingEvent[] = [];

  try {
    // 1. Find all squads belonging to this organization
    const squadsSnapshot = await adminDb
      .collection('squads')
      .where('organizationId', '==', organizationId)
      .get();

    if (squadsSnapshot.empty) {
      return blockingEvents;
    }

    const squadIds: string[] = [];

    // 2. Check each squad for legacy nextCallDateTime field
    for (const squadDoc of squadsSnapshot.docs) {
      const squad = squadDoc.data() as Squad;
      squadIds.push(squadDoc.id);

      if (squad.nextCallDateTime) {
        const callDateTime = new Date(squad.nextCallDateTime);

        // Only include if within the date range
        if (callDateTime >= rangeStart && callDateTime <= rangeEnd) {
          blockingEvents.push({
            startDateTime: squad.nextCallDateTime,
            // Default to 60 minutes for squad calls
            durationMinutes: 60,
          });
          console.log('[SQUAD_BLOCKING] Found legacy squad call:', squad.nextCallDateTime, 'for squad:', squadDoc.id);
        }
      }
    }

    // 3. Query confirmed peer-led squad calls (standardSquadCalls collection)
    if (squadIds.length > 0) {
      // Firestore 'in' queries are limited to 30 items, so we may need to batch
      const batchSize = 30;
      for (let i = 0; i < squadIds.length; i += batchSize) {
        const batchSquadIds = squadIds.slice(i, i + batchSize);

        const standardCallsSnapshot = await adminDb
          .collection('standardSquadCalls')
          .where('squadId', 'in', batchSquadIds)
          .where('status', '==', 'confirmed')
          .get();

        for (const callDoc of standardCallsSnapshot.docs) {
          const call = callDoc.data() as StandardSquadCall;

          if (call.startDateTimeUtc) {
            const callDateTime = new Date(call.startDateTimeUtc);

            // Only include if within the date range
            if (callDateTime >= rangeStart && callDateTime <= rangeEnd) {
              blockingEvents.push({
                startDateTime: call.startDateTimeUtc,
                // Default to 60 minutes for squad calls
                durationMinutes: 60,
              });
              console.log('[SQUAD_BLOCKING] Found peer-led squad call:', call.startDateTimeUtc, 'for squad:', call.squadId);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('[SQUAD_BLOCKING] Error fetching squad blocking events:', error);
    // Don't fail the whole request, just return what we have
  }

  return blockingEvents;
}
