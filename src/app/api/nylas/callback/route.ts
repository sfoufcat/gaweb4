import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { exchangeCodeForToken, getCalendars, isNylasConfigured } from '@/lib/nylas';
import type { NylasGrant, CoachAvailability } from '@/types';

/**
 * GET /api/nylas/callback
 * Handle the OAuth callback from Nylas
 */
export async function GET(request: NextRequest) {
  try {
    if (!isNylasConfigured) {
      return NextResponse.redirect(new URL('/coach?tab=scheduling&error=not_configured', request.url));
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('[NYLAS_CALLBACK] OAuth error:', error);
      return NextResponse.redirect(new URL(`/coach?tab=scheduling&error=${error}`, request.url));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/coach?tab=scheduling&error=invalid_callback', request.url));
    }

    // Decode state
    let stateData: { userId: string; organizationId: string; timestamp: number };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch {
      return NextResponse.redirect(new URL('/coach?tab=scheduling&error=invalid_state', request.url));
    }

    const { userId, organizationId } = stateData;

    // Exchange code for token
    const { grantId, email, provider } = await exchangeCodeForToken(code);

    // Get calendars to select the primary one
    const calendars = await getCalendars(grantId);
    const primaryCalendar = calendars.find(c => c.isPrimary) || calendars[0];

    if (!primaryCalendar) {
      return NextResponse.redirect(new URL('/coach?tab=scheduling&error=no_calendars', request.url));
    }

    const now = new Date().toISOString();

    // Store the grant in Firestore
    const grantDoc: NylasGrant = {
      id: `${organizationId}_${userId}`,
      odId: organizationId,
      userId,
      grantId,
      email,
      provider: provider as 'google' | 'microsoft' | 'icloud',
      calendarId: primaryCalendar.id,
      calendarName: primaryCalendar.name,
      scopes: ['calendar'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await adminDb
      .collection('nylas_grants')
      .doc(grantDoc.id)
      .set(grantDoc);

    // Update coach availability with the connected calendar
    const availabilityRef = adminDb.collection('coach_availability').doc(organizationId);
    const availabilityDoc = await availabilityRef.get();

    if (availabilityDoc.exists) {
      await availabilityRef.update({
        nylasGrantId: grantId,
        connectedCalendarId: primaryCalendar.id,
        connectedCalendarName: primaryCalendar.name,
        updatedAt: now,
      });
    } else {
      // Create default availability with calendar connected
      const newAvailability: CoachAvailability = {
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
        blockedSlots: [],
        defaultDuration: 60,
        bufferBetweenCalls: 15,
        timezone: 'America/New_York',
        advanceBookingDays: 30,
        minNoticeHours: 24,
        nylasGrantId: grantId,
        connectedCalendarId: primaryCalendar.id,
        connectedCalendarName: primaryCalendar.name,
        syncExternalBusy: true,
        pushEventsToCalendar: true,
        createdAt: now,
        updatedAt: now,
      };
      await availabilityRef.set(newAvailability);
    }

    // Redirect back to scheduling settings with success
    return NextResponse.redirect(new URL('/coach?tab=scheduling&calendar_connected=true', request.url));
  } catch (error) {
    console.error('[NYLAS_CALLBACK] Error:', error);
    return NextResponse.redirect(new URL('/coach?tab=scheduling&error=connection_failed', request.url));
  }
}

