import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { getCalendarBusyTimes } from '@/lib/calendar-busy-times';
import type { CoachAvailability, UnifiedEvent } from '@/types';

interface AvailableSlot {
  start: string;  // ISO datetime
  end: string;    // ISO datetime
  duration: number; // minutes
}

/**
 * GET /api/coach/availability/slots
 * Get available time slots for scheduling
 * 
 * Query params:
 * - startDate: ISO date (required) - start of date range
 * - endDate: ISO date (required) - end of date range
 * - duration: number (optional) - call duration in minutes, defaults to coach's default
 * - clientTimezone: string (optional) - client's timezone for display
 */
export async function GET(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const durationParam = searchParams.get('duration');
    const clientTimezone = searchParams.get('clientTimezone');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    // Parse dates
    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);

    if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use ISO 8601 format.' },
        { status: 400 }
      );
    }

    // Limit date range to prevent excessive queries
    const maxRangeDays = 60;
    const daysDiff = (rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > maxRangeDays) {
      return NextResponse.json(
        { error: `Date range cannot exceed ${maxRangeDays} days` },
        { status: 400 }
      );
    }

    // Get coach availability settings
    const availabilityDoc = await adminDb
      .collection('coach_availability')
      .doc(organizationId)
      .get();

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

    const existingEvents = eventsSnapshot.docs.map(doc => doc.data() as UnifiedEvent);

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
        console.warn('[AVAILABILITY_SLOTS] Failed to fetch external busy times:', err);
        // Continue without external busy times
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
    console.error('[AVAILABILITY_SLOTS_GET] Error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Calculate available time slots based on:
 * - Weekly schedule
 * - Blocked slots
 * - Existing events
 * - External calendar busy times
 * - Duration and buffer requirements
 */
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

  // Iterate through each day in the range
  const currentDate = new Date(rangeStart);
  currentDate.setHours(0, 0, 0, 0);

  while (currentDate <= rangeEnd) {
    const dayOfWeek = currentDate.getDay();
    const daySchedule = availability.weeklySchedule[dayOfWeek] || [];

    for (const timeSlot of daySchedule) {
      // Parse start and end times for this day
      const [startHour, startMin] = timeSlot.start.split(':').map(Number);
      const [endHour, endMin] = timeSlot.end.split(':').map(Number);

      const slotStart = new Date(currentDate);
      slotStart.setHours(startHour, startMin, 0, 0);

      const slotEnd = new Date(currentDate);
      slotEnd.setHours(endHour, endMin, 0, 0);

      // Generate slots within this time window
      let currentSlotStart = new Date(slotStart);

      while (currentSlotStart.getTime() + duration * 60 * 1000 <= slotEnd.getTime()) {
        const currentSlotEnd = new Date(currentSlotStart.getTime() + duration * 60 * 1000);

        // Check if slot is in the future with minimum notice
        if (currentSlotStart.getTime() > now.getTime() + minNoticeMs) {
          // Check if slot conflicts with blocked slots
          const isBlocked = availability.blockedSlots.some(blocked => {
            const blockedStart = new Date(blocked.start);
            const blockedEnd = new Date(blocked.end);
            return (
              (currentSlotStart >= blockedStart && currentSlotStart < blockedEnd) ||
              (currentSlotEnd > blockedStart && currentSlotEnd <= blockedEnd) ||
              (currentSlotStart <= blockedStart && currentSlotEnd >= blockedEnd)
            );
          });

          // Check if slot conflicts with existing events (including buffer)
          const conflictsWithEvent = existingEvents.some(event => {
            const eventStart = new Date(event.startDateTime);
            const eventEnd = event.endDateTime 
              ? new Date(event.endDateTime)
              : new Date(eventStart.getTime() + (event.durationMinutes || 60) * 60 * 1000);
            
            // Add buffer around the event
            const bufferedStart = new Date(eventStart.getTime() - buffer * 60 * 1000);
            const bufferedEnd = new Date(eventEnd.getTime() + buffer * 60 * 1000);

            return (
              (currentSlotStart >= bufferedStart && currentSlotStart < bufferedEnd) ||
              (currentSlotEnd > bufferedStart && currentSlotEnd <= bufferedEnd) ||
              (currentSlotStart <= bufferedStart && currentSlotEnd >= bufferedEnd)
            );
          });

          // Check if slot conflicts with external calendar busy times
          const conflictsWithExternal = externalBusyTimes.some(busy => {
            const busyStart = new Date(busy.start);
            const busyEnd = new Date(busy.end);
            
            // Add buffer around busy time
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

        // Move to next potential slot (duration + buffer)
        currentSlotStart = new Date(currentSlotStart.getTime() + (duration + buffer) * 60 * 1000);
      }
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return slots;
}

