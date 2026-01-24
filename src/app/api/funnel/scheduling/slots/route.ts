import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { IntakeCallConfig, CoachAvailability, UnifiedEvent } from '@/types';
import { getCalendarBusyTimes } from '@/lib/calendar-busy-times';
import { ensureCoachAvailability } from '@/lib/coach-availability-utils';

interface AvailableSlot {
  start: string;
  end: string;
  duration: number;
}

/**
 * GET /api/funnel/scheduling/slots
 * Get available time slots for funnel scheduling step
 *
 * Query params:
 * - intakeConfigId: string (required)
 * - startDate: ISO date string (required)
 * - endDate: ISO date string (required)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const intakeConfigId = searchParams.get('intakeConfigId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!intakeConfigId) {
      return NextResponse.json({ error: 'intakeConfigId is required' }, { status: 400 });
    }

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    // Get intake config
    const configDoc = await adminDb.collection('intake_call_configs').doc(intakeConfigId).get();

    if (!configDoc.exists) {
      return NextResponse.json({ error: 'Intake config not found' }, { status: 404 });
    }

    const config = { id: configDoc.id, ...configDoc.data() } as IntakeCallConfig;

    if (!config.isActive) {
      return NextResponse.json({ error: 'Intake call is not active' }, { status: 400 });
    }

    const organizationId = config.organizationId;

    // Get availability settings
    const availabilityDoc = await adminDb
      .collection('coach_availability')
      .doc(organizationId)
      .get();

    let availability: CoachAvailability;

    if (!availabilityDoc.exists) {
      // Auto-create default availability for coaches who haven't configured it yet
      // This ensures the scheduling step works even if coach hasn't visited settings
      console.log(`[FUNNEL_SCHEDULING_SLOTS] Auto-creating availability for org ${organizationId}`);
      availability = await ensureCoachAvailability(organizationId, '');
    } else {
      availability = availabilityDoc.data() as CoachAvailability;
    }

    // Use custom availability if configured
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

    // Limit range
    const maxEnd = new Date();
    maxEnd.setDate(maxEnd.getDate() + (effectiveAvailability.advanceBookingDays || 30));
    if (rangeEnd > maxEnd) {
      rangeEnd.setTime(maxEnd.getTime());
    }

    // Get existing events
    const eventsSnapshot = await adminDb
      .collection('events')
      .where('organizationId', '==', organizationId)
      .where('startDateTime', '>=', rangeStart.toISOString())
      .where('startDateTime', '<=', rangeEnd.toISOString())
      .where('status', 'in', ['confirmed', 'pending_response', 'proposed'])
      .get();

    const existingEvents = eventsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as UnifiedEvent[];

    // Get external busy times
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
      }
    }

    // Calculate slots
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
    console.error('[FUNNEL_SCHEDULING_SLOTS_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
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
  const minNoticeMs = (availability.minNoticeHours || 24) * 60 * 60 * 1000;

  const currentDate = new Date(rangeStart);
  currentDate.setHours(0, 0, 0, 0);

  while (currentDate <= rangeEnd) {
    const dayOfWeek = currentDate.getDay();
    const daySchedule = availability.weeklySchedule?.[dayOfWeek] || [];

    for (const timeSlot of daySchedule) {
      const [startHour, startMin] = timeSlot.start.split(':').map(Number);
      const [endHour, endMin] = timeSlot.end.split(':').map(Number);

      const slotStart = new Date(currentDate);
      slotStart.setHours(startHour, startMin, 0, 0);

      const slotEnd = new Date(currentDate);
      slotEnd.setHours(endHour, endMin, 0, 0);

      let currentSlotStart = new Date(slotStart);

      while (currentSlotStart.getTime() + duration * 60 * 1000 <= slotEnd.getTime()) {
        const currentSlotEnd = new Date(currentSlotStart.getTime() + duration * 60 * 1000);

        if (currentSlotStart.getTime() > now.getTime() + minNoticeMs) {
          const isBlocked = (availability.blockedSlots || []).some(blocked => {
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
