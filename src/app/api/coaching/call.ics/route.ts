import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { ClientCoachingData, Coach, UserRole } from '@/types';
import { isSuperAdmin } from '@/lib/admin-utils-shared';

/**
 * @deprecated This route is deprecated and will be removed in a future version.
 * Use the unified events API instead:
 * - GET /api/events/[eventId]/calendar.ics
 * 
 * This route is kept temporarily for backward compatibility during migration.
 * See: scripts/migrate-events.ts
 * 
 * ============================================================================
 * 
 * GET /api/coaching/call.ics
 * 
 * Generates and returns an ICS calendar file for the user's next coaching call.
 * 
 * Features:
 * - Uses coaching data's nextCall fields
 * - Converts call time to UTC for ICS format
 * - Returns ICS file with proper headers for download
 * - Default duration: 60 minutes
 */

export async function GET(request: Request) {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Parse query params for admin access
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');

    // Check access
    const publicMetadata = sessionClaims?.publicMetadata as {
      coaching?: boolean; // Legacy flag
      coachingStatus?: 'none' | 'active' | 'canceled' | 'past_due'; // New field
      role?: UserRole;
    } | undefined;

    // Check both new coachingStatus and legacy coaching flag for backward compatibility
    const hasCoaching = publicMetadata?.coachingStatus === 'active' || publicMetadata?.coaching === true;
    const role = publicMetadata?.role;
    const isSuperAdminUser = isSuperAdmin(role);

    // Determine which user's data to fetch
    let fetchUserId = userId;
    if (targetUserId && isSuperAdminUser) {
      fetchUserId = targetUserId;
    } else if (!hasCoaching && !isSuperAdminUser) {
      return new NextResponse('Coaching subscription required', { status: 403 });
    }

    // Fetch coaching data
    const coachingDoc = await adminDb.collection('clientCoachingData').doc(fetchUserId).get();

    if (!coachingDoc.exists) {
      return new NextResponse('Coaching data not found', { status: 404 });
    }

    const coachingData = coachingDoc.data() as ClientCoachingData;

    if (!coachingData.nextCall?.datetime) {
      return new NextResponse('No call scheduled', { status: 404 });
    }

    // Get coach info for the event details
    let coachName = 'Your Coach';
    if (coachingData.coachId) {
      const coachDoc = await adminDb.collection('coaches').doc(coachingData.coachId).get();
      if (coachDoc.exists) {
        const coach = coachDoc.data() as Coach;
        coachName = coach.name || `${coach.firstName} ${coach.lastName}`.trim();
      }
    }

    const callDate = new Date(coachingData.nextCall.datetime);
    const callTimezone = coachingData.nextCall.timezone || 'UTC';
    const callLocation = coachingData.nextCall.location || 'Chat';
    const callTitle = coachingData.nextCall.title || `Coaching Call with ${coachName}`;
    const durationMinutes = 60;

    // Calculate end time
    const endDate = new Date(callDate.getTime() + durationMinutes * 60 * 1000);

    // Format dates for ICS (YYYYMMDDTHHMMSSZ format in UTC)
    const formatICSDate = (date: Date): string => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };

    const dtStart = formatICSDate(callDate);
    const dtEnd = formatICSDate(endDate);
    const dtStamp = formatICSDate(new Date());
    const uid = `coaching-call-${fetchUserId}-${callDate.getTime()}@coachful.co`;

    // Build ICS content
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Coachful//Coaching Calls//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${escapeICS(callTitle)}`,
      `DESCRIPTION:${escapeICS(`1:1 Coaching call with ${coachName}.\n\nTimezone: ${callTimezone}\nLocation: ${callLocation}`)}`,
      `LOCATION:${escapeICS(callLocation)}`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Coaching call starts in 15 minutes',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    // Return the ICS file
    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="coaching-call.ics"`,
      },
    });
  } catch (error) {
    console.error('[COACHING_ICS_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

/**
 * Escape special characters for ICS format
 */
function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n');
}


