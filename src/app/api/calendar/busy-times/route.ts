import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { getCalendarBusyTimes } from '@/lib/calendar-busy-times';

/**
 * GET /api/calendar/busy-times
 * Get busy times from the connected external calendar (Google or Microsoft)
 *
 * Query params:
 * - startDate: ISO date (required)
 * - endDate: ISO date (required)
 */
export async function GET(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    // Use the shared function
    const result = await getCalendarBusyTimes(organizationId, startDate, endDate);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[CALENDAR_BUSY_TIMES] Error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Return empty array on error to not break availability calculation
    return NextResponse.json({ busyTimes: [], provider: null });
  }
}
