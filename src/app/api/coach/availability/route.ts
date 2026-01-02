import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { CoachAvailability, WeeklySchedule, BlockedSlot, TimeSlot } from '@/types';

/**
 * GET /api/coach/availability
 * Get the coach's availability settings for their organization
 */
export async function GET() {
  try {
    const { userId, organizationId } = await requireCoachWithOrg();

    // Get availability document for this org
    const docRef = adminDb.collection('coach_availability').doc(organizationId);
    const doc = await docRef.get();

    if (!doc.exists) {
      // Return default availability settings
      const defaultAvailability: Omit<CoachAvailability, 'createdAt' | 'updatedAt'> = {
        odId: organizationId,
        coachUserId: userId,
        weeklySchedule: {
          0: [], // Sunday - no availability by default
          1: [{ start: '09:00', end: '17:00' }], // Monday
          2: [{ start: '09:00', end: '17:00' }], // Tuesday
          3: [{ start: '09:00', end: '17:00' }], // Wednesday
          4: [{ start: '09:00', end: '17:00' }], // Thursday
          5: [{ start: '09:00', end: '17:00' }], // Friday
          6: [], // Saturday - no availability by default
        },
        blockedSlots: [],
        defaultDuration: 60,
        bufferBetweenCalls: 15,
        timezone: 'America/New_York',
        advanceBookingDays: 30,
        minNoticeHours: 24,
        syncExternalBusy: true,
        pushEventsToCalendar: true,
      };

      return NextResponse.json({ availability: defaultAvailability, isDefault: true });
    }

    const data = doc.data() as CoachAvailability;
    return NextResponse.json({ availability: data, isDefault: false });
  } catch (error) {
    console.error('[COACH_AVAILABILITY_GET] Error:', error);
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
 * PUT /api/coach/availability
 * Update the coach's availability settings
 */
export async function PUT(request: NextRequest) {
  try {
    const { userId, organizationId } = await requireCoachWithOrg();
    const body = await request.json();

    // Validate and extract fields
    const {
      weeklySchedule,
      blockedSlots,
      defaultDuration,
      bufferBetweenCalls,
      timezone,
      advanceBookingDays,
      minNoticeHours,
      syncExternalBusy,
      pushEventsToCalendar,
    } = body;

    // Validate weeklySchedule if provided
    if (weeklySchedule) {
      for (const day of Object.keys(weeklySchedule)) {
        const dayNum = parseInt(day);
        if (dayNum < 0 || dayNum > 6) {
          return NextResponse.json(
            { error: `Invalid day number: ${day}. Must be 0-6.` },
            { status: 400 }
          );
        }
        const slots = weeklySchedule[day] as TimeSlot[];
        if (!Array.isArray(slots)) {
          return NextResponse.json(
            { error: `Invalid slots for day ${day}. Must be an array.` },
            { status: 400 }
          );
        }
        for (const slot of slots) {
          if (!slot.start || !slot.end) {
            return NextResponse.json(
              { error: `Invalid slot format. Each slot must have start and end times.` },
              { status: 400 }
            );
          }
          // Validate time format (HH:mm)
          const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
          if (!timeRegex.test(slot.start) || !timeRegex.test(slot.end)) {
            return NextResponse.json(
              { error: `Invalid time format. Use HH:mm format.` },
              { status: 400 }
            );
          }
        }
      }
    }

    // Validate defaultDuration
    if (defaultDuration !== undefined) {
      const validDurations = [15, 30, 45, 60, 90, 120];
      if (!validDurations.includes(defaultDuration)) {
        return NextResponse.json(
          { error: `Invalid duration. Must be one of: ${validDurations.join(', ')}` },
          { status: 400 }
        );
      }
    }

    const now = new Date().toISOString();
    const docRef = adminDb.collection('coach_availability').doc(organizationId);
    const existingDoc = await docRef.get();

    const updateData: Partial<CoachAvailability> = {
      updatedAt: now,
    };

    // Only update provided fields
    if (weeklySchedule !== undefined) updateData.weeklySchedule = weeklySchedule;
    if (blockedSlots !== undefined) updateData.blockedSlots = blockedSlots;
    if (defaultDuration !== undefined) updateData.defaultDuration = defaultDuration;
    if (bufferBetweenCalls !== undefined) updateData.bufferBetweenCalls = bufferBetweenCalls;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (advanceBookingDays !== undefined) updateData.advanceBookingDays = advanceBookingDays;
    if (minNoticeHours !== undefined) updateData.minNoticeHours = minNoticeHours;
    if (syncExternalBusy !== undefined) updateData.syncExternalBusy = syncExternalBusy;
    if (pushEventsToCalendar !== undefined) updateData.pushEventsToCalendar = pushEventsToCalendar;

    if (existingDoc.exists) {
      await docRef.update(updateData);
    } else {
      // Create new document with defaults
      const newDoc: CoachAvailability = {
        odId: organizationId,
        coachUserId: userId,
        weeklySchedule: weeklySchedule || {
          0: [],
          1: [{ start: '09:00', end: '17:00' }],
          2: [{ start: '09:00', end: '17:00' }],
          3: [{ start: '09:00', end: '17:00' }],
          4: [{ start: '09:00', end: '17:00' }],
          5: [{ start: '09:00', end: '17:00' }],
          6: [],
        },
        blockedSlots: blockedSlots || [],
        defaultDuration: defaultDuration || 60,
        bufferBetweenCalls: bufferBetweenCalls || 15,
        timezone: timezone || 'America/New_York',
        advanceBookingDays: advanceBookingDays || 30,
        minNoticeHours: minNoticeHours || 24,
        syncExternalBusy: syncExternalBusy ?? true,
        pushEventsToCalendar: pushEventsToCalendar ?? true,
        createdAt: now,
        updatedAt: now,
      };
      await docRef.set(newDoc);
    }

    // Fetch and return updated document
    const updatedDoc = await docRef.get();
    return NextResponse.json({ 
      availability: updatedDoc.data() as CoachAvailability,
      success: true 
    });
  } catch (error) {
    console.error('[COACH_AVAILABILITY_PUT] Error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

