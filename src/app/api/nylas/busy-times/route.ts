import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { getFreeBusy, isNylasConfigured } from '@/lib/nylas';
import type { NylasGrant, CoachAvailability } from '@/types';

/**
 * GET /api/nylas/busy-times
 * Get busy times from the connected external calendar
 * 
 * Query params:
 * - startDate: ISO date (required)
 * - endDate: ISO date (required)
 */
export async function GET(request: NextRequest) {
  try {
    if (!isNylasConfigured) {
      return NextResponse.json(
        { error: 'Calendar integration is not configured', busyTimes: [] },
        { status: 200 } // Return empty array instead of error
      );
    }

    const { userId, organizationId } = await requireCoachWithOrg();

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    // Get coach availability to check calendar settings
    const availabilityDoc = await adminDb
      .collection('coach_availability')
      .doc(organizationId)
      .get();

    if (!availabilityDoc.exists) {
      return NextResponse.json({ busyTimes: [] });
    }

    const availability = availabilityDoc.data() as CoachAvailability;

    // Check if external calendar sync is enabled
    if (!availability.syncExternalBusy || !availability.nylasGrantId) {
      return NextResponse.json({ busyTimes: [] });
    }

    // Get the Nylas grant
    const grantDoc = await adminDb
      .collection('nylas_grants')
      .doc(`${organizationId}_${userId}`)
      .get();

    if (!grantDoc.exists) {
      return NextResponse.json({ busyTimes: [] });
    }

    const grant = grantDoc.data() as NylasGrant;

    if (!grant.isActive || !grant.calendarId) {
      return NextResponse.json({ busyTimes: [] });
    }

    // Convert dates to Unix timestamps
    const startTime = Math.floor(new Date(startDate).getTime() / 1000);
    const endTime = Math.floor(new Date(endDate).getTime() / 1000);

    // Get free/busy times from Nylas
    const busyTimes = await getFreeBusy(
      grant.grantId,
      grant.calendarId,
      startTime,
      endTime
    );

    // Convert Unix timestamps back to ISO strings
    const formattedBusyTimes = busyTimes.map(slot => ({
      start: new Date(slot.start * 1000).toISOString(),
      end: new Date(slot.end * 1000).toISOString(),
      status: slot.status,
    }));

    return NextResponse.json({ busyTimes: formattedBusyTimes });
  } catch (error) {
    console.error('[NYLAS_BUSY_TIMES] Error:', error);
    // Return empty array on error to not break availability calculation
    return NextResponse.json({ busyTimes: [] });
  }
}

