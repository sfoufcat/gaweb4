import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { IntakeCallConfig, IntakeBookingToken, CoachAvailability, UnifiedEvent } from '@/types';
import { getCalendarBusyTimes } from '@/lib/calendar-busy-times';

interface RouteParams {
  params: Promise<{ tokenId: string }>;
}

interface AvailableSlot {
  start: string;
  end: string;
  duration: number;
}

/**
 * GET /api/public/intake/token/[tokenId]/slots
 * Get available time slots for rescheduling using token auth
 *
 * Query params:
 * - startDate: ISO date string (required)
 * - endDate: ISO date string (required)
 *
 * This is a public endpoint - no authentication required
 */
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { tokenId } = await params;
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!tokenId) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    if (!startDate || !endDate) {
      return NextResponse.json({
        error: 'startDate and endDate are required'
      }, { status: 400 });
    }

    // Get token
    const tokenDoc = await adminDb.collection('intake_booking_tokens').doc(tokenId).get();

    if (!tokenDoc.exists) {
      return NextResponse.json({
        error: 'Invalid token',
        code: 'TOKEN_INVALID',
      }, { status: 404 });
    }

    const token = { id: tokenDoc.id, ...tokenDoc.data() } as IntakeBookingToken;

    // Check if token is expired
    if (new Date(token.expiresAt) < new Date()) {
      return NextResponse.json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
      }, { status: 410 });
    }

    // Get event to find organization ID
    const eventDoc = await adminDb.collection('events').doc(token.eventId).get();

    if (!eventDoc.exists) {
      return NextResponse.json({
        error: 'Event not found',
        code: 'EVENT_NOT_FOUND',
      }, { status: 404 });
    }

    const event = eventDoc.data() as UnifiedEvent;
    const organizationId = event.organizationId;

    if (!organizationId) {
      return NextResponse.json({
        error: 'Organization not found',
      }, { status: 404 });
    }

    // Get intake config
    const configDoc = await adminDb.collection('intake_call_configs').doc(token.intakeCallConfigId).get();

    if (!configDoc.exists) {
      return NextResponse.json({
        error: 'Config not found',
        code: 'CONFIG_NOT_FOUND',
      }, { status: 404 });
    }

    const config = { id: configDoc.id, ...configDoc.data() } as IntakeCallConfig;

    // Get availability settings
    const availabilityDoc = await adminDb
      .collection('coach_availability')
      .doc(organizationId)
      .get();

    if (!availabilityDoc.exists) {
      return NextResponse.json({
        slots: [],
        message: 'No availability configured'
      });
    }

    const availability = availabilityDoc.data() as CoachAvailability;

    // Use custom availability if configured, otherwise use org availability
    const effectiveAvailability = config.useOrgAvailability === false && config.customAvailability
      ? {
          ...availability,
          weeklySchedule: config.customAvailability.weeklySchedule || availability.weeklySchedule,
          bufferBetweenCalls: config.customAvailability.bufferBetweenCalls ?? availability.bufferBetweenCalls,
          minNoticeHours: config.customAvailability.minNoticeHours ?? availability.minNoticeHours,
          advanceBookingDays: config.customAvailability.advanceBookingDays ?? availability.advanceBookingDays,
        }
      : availability;

    // Parse date range
    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);

    // Limit range to advanceBookingDays
    const maxEnd = new Date();
    maxEnd.setDate(maxEnd.getDate() + (effectiveAvailability.advanceBookingDays || 30));
    if (rangeEnd > maxEnd) {
      rangeEnd.setTime(maxEnd.getTime());
    }

    // Get existing events for this coach (excluding the current event being rescheduled)
    const eventsSnapshot = await adminDb
      .collection('events')
      .where('organizationId', '==', organizationId)
      .where('startDateTime', '>=', rangeStart.toISOString())
      .where('startDateTime', '<=', rangeEnd.toISOString())
      .where('status', 'in', ['confirmed', 'pending_response', 'proposed'])
      .get();

    const existingEvents = eventsSnapshot.docs
      .filter(doc => doc.id !== token.eventId) // Exclude current event
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as UnifiedEvent[];

    // Get external calendar busy times if sync is enabled
    let externalBusyTimes: Array<{ start: string; end: string }> = [];
    if (effectiveAvailability.syncExternalBusy) {
      try {
        const busyResult = await getCalendarBusyTimes(
          organizationId,
          rangeStart.toISOString(),
          rangeEnd.toISOString()
        );
        externalBusyTimes = busyResult.busyTimes.map(b => ({ start: b.start, end: b.end }));
      } catch (err) {
        console.warn('Failed to fetch external busy times:', err);
        // Continue without external busy times
      }
    }

    // Calculate available slots
    const slots = calculateAvailableSlots(
      rangeStart,
      rangeEnd,
      effectiveAvailability,
      existingEvents,
      config.duration,
      effectiveAvailability.bufferBetweenCalls || 15,
      externalBusyTimes
    );

    return NextResponse.json({
      slots,
      timezone: effectiveAvailability.timezone || 'America/New_York',
    });
  } catch (error) {
    console.error('[PUBLIC_INTAKE_TOKEN_SLOTS_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * Calculate available time slots based on availability, existing events, and busy times
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
  const minNoticeMs = (availability.minNoticeHours || 24) * 60 * 60 * 1000;

  // Iterate through each day in the range
  const currentDate = new Date(rangeStart);
  currentDate.setHours(0, 0, 0, 0);

  while (currentDate <= rangeEnd) {
    const dayOfWeek = currentDate.getDay();
    const daySchedule = availability.weeklySchedule?.[dayOfWeek] || [];

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
          const isBlocked = (availability.blockedSlots || []).some(blocked => {
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
