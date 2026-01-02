import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { getCalendars, isNylasConfigured } from '@/lib/nylas';
import type { NylasGrant } from '@/types';

/**
 * GET /api/nylas/calendars
 * Get the list of calendars for the connected account
 */
export async function GET() {
  try {
    if (!isNylasConfigured) {
      return NextResponse.json(
        { error: 'Calendar integration is not configured' },
        { status: 503 }
      );
    }

    const { userId, organizationId } = await requireCoachWithOrg();

    // Get the Nylas grant for this user
    const grantDoc = await adminDb
      .collection('nylas_grants')
      .doc(`${organizationId}_${userId}`)
      .get();

    if (!grantDoc.exists) {
      return NextResponse.json(
        { error: 'No calendar connected. Please connect your calendar first.' },
        { status: 404 }
      );
    }

    const grant = grantDoc.data() as NylasGrant;

    if (!grant.isActive) {
      return NextResponse.json(
        { error: 'Calendar connection has expired. Please reconnect.' },
        { status: 403 }
      );
    }

    // Get calendars from Nylas
    const calendars = await getCalendars(grant.grantId);

    return NextResponse.json({
      calendars,
      selectedCalendarId: grant.calendarId,
      email: grant.email,
      provider: grant.provider,
    });
  } catch (error) {
    console.error('[NYLAS_CALENDARS] Error:', error);
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
 * PUT /api/nylas/calendars
 * Update the selected calendar
 */
export async function PUT(request: NextRequest) {
  try {
    if (!isNylasConfigured) {
      return NextResponse.json(
        { error: 'Calendar integration is not configured' },
        { status: 503 }
      );
    }

    const { userId, organizationId } = await requireCoachWithOrg();
    const body = await request.json();
    const { calendarId, calendarName } = body;

    if (!calendarId) {
      return NextResponse.json(
        { error: 'Calendar ID is required' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Update the Nylas grant
    await adminDb
      .collection('nylas_grants')
      .doc(`${organizationId}_${userId}`)
      .update({
        calendarId,
        calendarName,
        updatedAt: now,
      });

    // Update coach availability
    await adminDb
      .collection('coach_availability')
      .doc(organizationId)
      .update({
        connectedCalendarId: calendarId,
        connectedCalendarName: calendarName,
        updatedAt: now,
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[NYLAS_CALENDARS_PUT] Error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

