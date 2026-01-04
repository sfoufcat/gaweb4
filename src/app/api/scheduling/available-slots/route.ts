import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { CoachAvailability, UnifiedEvent } from '@/types';

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
    const { userId, orgId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 400 }
      );
    }

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
      .doc(orgId)
      .get();

    let availability: CoachAvailability;
    if (!availabilityDoc.exists) {
      // Use defaults
      availability = {
        odId: orgId,
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

    const duration = durationParam ? parseInt(durationParam) : availability.defaultDuration;
    const buffer = availability.bufferBetweenCalls;

    // Get existing events in the date range
    const eventsSnapshot = await adminDb
      .collection('events')
      .where('organizationId', '==', orgId)
      .where('startDateTime', '>=', rangeStart.toISOString())
      .where('startDateTime', '<=', rangeEnd.toISOString())
      .where('status', 'in', ['confirmed', 'pending_response', 'proposed'])
      .get();

    const existingEvents = eventsSnapshot.docs.map(doc => doc.data() as UnifiedEvent);

    // Get external calendar busy times if enabled
    let externalBusyTimes: Array<{ start: string; end: string }> = [];
    if (availability.syncExternalBusy && availability.nylasGrantId) {
      try {
        const busyResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/nylas/busy-times?startDate=${rangeStart.toISOString()}&endDate=${rangeEnd.toISOString()}`,
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
        if (busyResponse.ok) {
          const busyData = await busyResponse.json();
          externalBusyTimes = busyData.busyTimes || [];
        }
      } catch (err) {
        console.warn('[AVAILABLE_SLOTS] Failed to fetch external busy times:', err);
      }
    }

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
  // Create a datetime string in the target timezone
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
  const localDateTimeStr = `${dateStr}T${timeStr}`;

  // Parse as if it's in the target timezone by using the timezone-aware formatter
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Create a date object treating the time as UTC first
  const tempDate = new Date(`${localDateTimeStr}Z`);

  // Get the formatted parts in the target timezone
  const parts = formatter.formatToParts(tempDate);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';

  // Calculate the offset between UTC and the target timezone
  const utcHour = tempDate.getUTCHours();
  const tzHour = parseInt(getPart('hour'));
  let offset = tzHour - utcHour;

  // Handle day boundary crossings
  if (offset > 12) offset -= 24;
  if (offset < -12) offset += 24;

  // Create the final date by subtracting the offset
  // If timezone is UTC+2, and we want 09:00 in that timezone, we need 07:00 UTC
  const result = new Date(`${localDateTimeStr}Z`);
  result.setUTCHours(result.getUTCHours() - offset);

  return result;
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
  existingEvents: UnifiedEvent[],
  duration: number,
  buffer: number,
  externalBusyTimes: Array<{ start: string; end: string }> = []
): AvailableSlot[] {
  const slots: AvailableSlot[] = [];
  const now = new Date();
  const minNoticeMs = availability.minNoticeHours * 60 * 60 * 1000;
  const timezone = availability.timezone || 'America/New_York';

  // Work with date strings (YYYY-MM-DD) to avoid timezone confusion
  // The client sends dates like "2026-01-04" which represent the date they see
  const startDateStr = rangeStart.toISOString().split('T')[0];
  const endDateStr = rangeEnd.toISOString().split('T')[0];

  let currentDateStr = startDateStr;

  while (compareDateStrings(currentDateStr, endDateStr) <= 0) {
    // Get day of week directly from the date string (avoids timezone confusion)
    const dayOfWeek = getDayOfWeekFromDateString(currentDateStr);
    const daySchedule = availability.weeklySchedule[dayOfWeek] || [];

    for (const timeSlot of daySchedule) {
      const [startHour, startMin] = timeSlot.start.split(':').map(Number);
      const [endHour, endMin] = timeSlot.end.split(':').map(Number);

      // Create slot times in the coach's timezone using the date string
      const slotStart = createDateInTimezone(currentDateStr, startHour, startMin, timezone);
      const slotEnd = createDateInTimezone(currentDateStr, endHour, endMin, timezone);

      let currentSlotStart = new Date(slotStart);

      while (currentSlotStart.getTime() + duration * 60 * 1000 <= slotEnd.getTime()) {
        const currentSlotEnd = new Date(currentSlotStart.getTime() + duration * 60 * 1000);

        if (currentSlotStart.getTime() > now.getTime() + minNoticeMs) {
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
