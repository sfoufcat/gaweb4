import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Squad, StandardSquadCall } from '@/types';

/**
 * GET /api/squad/[squadId]/next-call.ics
 * 
 * Generates and returns an ICS calendar file for the squad's next scheduled call.
 * Supports both premium squads (using squad document fields) and standard squads
 * (using the standardSquadCalls collection).
 * 
 * Query params:
 * - type=standard: Force fetching from standardSquadCalls (for standard squads)
 * 
 * Features:
 * - Premium: Uses squad's nextCallDateTime, nextCallTimezone, nextCallLocation, nextCallTitle
 * - Standard: Uses confirmed call from standardSquadCalls collection
 * - Converts call time to UTC for ICS format
 * - Returns ICS file with proper headers for download
 * - Default duration: 60 minutes
 */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ squadId: string }> }
) {
  try {
    const { squadId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const callType = searchParams.get('type');

    // Fetch the squad
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();

    if (!squadDoc.exists) {
      return new NextResponse('Squad not found', { status: 404 });
    }

    const squadData = squadDoc.data() as Squad;

    // Verify user is a member of this squad
    const membershipSnapshot = await adminDb
      .collection('squadMembers')
      .where('squadId', '==', squadId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (membershipSnapshot.empty) {
      return new NextResponse('You are not a member of this squad', { status: 403 });
    }

    let callDate: Date;
    let callTimezone: string;
    let callLocation: string;
    let callTitle: string;
    const durationMinutes = 60;

    // Determine call source based on squad type and query param
    const hasCoach = !!squadData.coachId;
    if (callType === 'standard' || !hasCoach) {
      // Standard squad - fetch from standardSquadCalls collection
      const callsSnapshot = await adminDb
        .collection('standardSquadCalls')
        .where('squadId', '==', squadId)
        .where('status', '==', 'confirmed')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (callsSnapshot.empty) {
        return new NextResponse('No confirmed call scheduled for this squad', { status: 404 });
      }

      const standardCall = callsSnapshot.docs[0].data() as StandardSquadCall;
      callDate = new Date(standardCall.startDateTimeUtc);
      callTimezone = standardCall.timezone || squadData.timezone || 'UTC';
      callLocation = standardCall.location || 'Squad chat';
      callTitle = standardCall.title || `${squadData.name} accountability call`;
    } else {
      // Premium squad - use squad document fields
      if (!squadData.nextCallDateTime) {
        return new NextResponse('No call scheduled for this squad', { status: 404 });
      }

      callDate = new Date(squadData.nextCallDateTime);
      callTimezone = squadData.nextCallTimezone || squadData.timezone || 'UTC';
      callLocation = squadData.nextCallLocation || 'Squad chat';
      callTitle = squadData.nextCallTitle || `${squadData.name} coaching call`;
    }

    // Calculate end time
    const endDate = new Date(callDate.getTime() + durationMinutes * 60 * 1000);

    // Format dates for ICS (YYYYMMDDTHHMMSSZ format in UTC)
    const formatICSDate = (date: Date): string => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };

    const dtStart = formatICSDate(callDate);
    const dtEnd = formatICSDate(endDate);
    const dtStamp = formatICSDate(new Date());
    const uid = `squad-call-${squadId}-${callDate.getTime()}@growthaddicts.com`;

    // Build ICS content
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Growth Addicts//Squad Calls//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${escapeICS(callTitle)}`,
      `DESCRIPTION:${escapeICS(`Squad call for ${squadData.name}.\n\nTimezone: ${callTimezone}\nLocation: ${callLocation}`)}`,
      `LOCATION:${escapeICS(callLocation)}`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Squad call starts in 15 minutes',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    // Return the ICS file
    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="squad-call-${squadId}.ics"`,
      },
    });
  } catch (error) {
    console.error('[SQUAD_ICS_ERROR]', error);
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

