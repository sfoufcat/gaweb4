import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { CoachAvailability, BlockedSlot } from '@/types';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/coach/availability/blocked-slots
 * Add a new blocked time slot
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, organizationId } = await requireCoachWithOrg();
    const body = await request.json();

    const { start, end, reason, recurring } = body;

    // Validate required fields
    if (!start || !end) {
      return NextResponse.json(
        { error: 'Start and end times are required' },
        { status: 400 }
      );
    }

    // Validate dates
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use ISO 8601 format.' },
        { status: 400 }
      );
    }

    if (startDate >= endDate) {
      return NextResponse.json(
        { error: 'Start time must be before end time' },
        { status: 400 }
      );
    }

    // Generate unique ID for the blocked slot
    const slotId = `blocked_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newSlot: BlockedSlot = {
      id: slotId,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      reason: reason || undefined,
      recurring: recurring || false,
    };

    const now = new Date().toISOString();
    const docRef = adminDb.collection('coach_availability').doc(organizationId);
    const existingDoc = await docRef.get();

    if (existingDoc.exists) {
      // Add to existing blocked slots array
      await docRef.update({
        blockedSlots: FieldValue.arrayUnion(newSlot),
        updatedAt: now,
      });
    } else {
      // Create new availability document with this blocked slot
      const newDoc: CoachAvailability = {
        odId: organizationId,
        coachUserId: userId,
        weeklySchedule: {
          0: [],
          1: [{ start: '09:00', end: '17:00' }],
          2: [{ start: '09:00', end: '17:00' }],
          3: [{ start: '09:00', end: '17:00' }],
          4: [{ start: '09:00', end: '17:00' }],
          5: [{ start: '09:00', end: '17:00' }],
          6: [],
        },
        blockedSlots: [newSlot],
        defaultDuration: 60,
        bufferBetweenCalls: 15,
        timezone: 'America/New_York',
        advanceBookingDays: 30,
        minNoticeHours: 24,
        syncExternalBusy: true,
        pushEventsToCalendar: true,
        createdAt: now,
        updatedAt: now,
      };
      await docRef.set(newDoc);
    }

    return NextResponse.json({ 
      blockedSlot: newSlot,
      success: true 
    });
  } catch (error) {
    console.error('[BLOCKED_SLOTS_POST] Error:', error);
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
 * DELETE /api/coach/availability/blocked-slots
 * Remove a blocked time slot by ID (passed in request body)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const body = await request.json();
    const { slotId } = body;

    if (!slotId) {
      return NextResponse.json(
        { error: 'Slot ID is required' },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection('coach_availability').doc(organizationId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Availability settings not found' },
        { status: 404 }
      );
    }

    const data = doc.data() as CoachAvailability;
    const slotToRemove = data.blockedSlots.find(s => s.id === slotId);

    if (!slotToRemove) {
      return NextResponse.json(
        { error: 'Blocked slot not found' },
        { status: 404 }
      );
    }

    // Remove the slot from the array
    const updatedSlots = data.blockedSlots.filter(s => s.id !== slotId);

    await docRef.update({
      blockedSlots: updatedSlots,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[BLOCKED_SLOTS_DELETE] Error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

