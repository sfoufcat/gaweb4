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
 * Convert a date + time in a specific timezone to a UTC Date object
 */
function createDateInTimezone(date: Date, hours: number, minutes: number, timezone: string): Date {
  // Format the date as YYYY-MM-DD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  // Create a datetime string in the target timezone
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;

  // Use Intl.DateTimeFormat to get the UTC offset for this timezone at this date/time
  // Then create the correct UTC timestamp
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
 * Get the day of week for a date in a specific timezone
 */
function getDayOfWeekInTimezone(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  });
  const weekday = formatter.format(date);
  const dayMap: Record<string, number> = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  };
  return dayMap[weekday] ?? date.getDay();
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

  const currentDate = new Date(rangeStart);
  currentDate.setHours(0, 0, 0, 0);

  while (currentDate <= rangeEnd) {
    // Get day of week in the coach's timezone
    const dayOfWeek = getDayOfWeekInTimezone(currentDate, timezone);
    const daySchedule = availability.weeklySchedule[dayOfWeek] || [];

    for (const timeSlot of daySchedule) {
      const [startHour, startMin] = timeSlot.start.split(':').map(Number);
      const [endHour, endMin] = timeSlot.end.split(':').map(Number);

      // Create slot times in the coach's timezone
      const slotStart = createDateInTimezone(currentDate, startHour, startMin, timezone);
      const slotEnd = createDateInTimezone(currentDate, endHour, endMin, timezone);

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

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return slots;
}
