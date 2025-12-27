/**
 * API Route: Event Calendar ICS Download
 * 
 * GET /api/events/[eventId]/calendar.ics - Download ICS file for the event
 * 
 * Generates an iCalendar file for adding the event to calendar apps.
 * Supports recurring events with RRULE.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { UnifiedEvent, RecurrencePattern } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { eventId } = await params;

    const eventDoc = await adminDb.collection('events').doc(eventId).get();

    if (!eventDoc.exists) {
      return new NextResponse('Event not found', { status: 404 });
    }

    const event = { id: eventDoc.id, ...eventDoc.data() } as UnifiedEvent;

    // Check if event is in a valid state
    if (event.status === 'canceled') {
      return new NextResponse('Event has been canceled', { status: 400 });
    }

    // Generate ICS content
    const icsContent = generateICS(event);

    // Return as downloadable file
    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${sanitizeFilename(event.title)}.ics"`,
      },
    });
  } catch (error) {
    console.error('[EVENT_ICS] Error:', error);
    return new NextResponse('Failed to generate calendar file', { status: 500 });
  }
}

/**
 * Generate ICS content for an event
 */
function generateICS(event: UnifiedEvent): string {
  const startDate = new Date(event.startDateTime);
  const durationMinutes = event.durationMinutes || 60;
  const endDate = event.endDateTime 
    ? new Date(event.endDateTime)
    : new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  const uid = `${event.id}@growthaddicts.io`;
  const dtstamp = formatICSDate(new Date());
  const dtstart = formatICSDate(startDate);
  const dtend = formatICSDate(endDate);

  // Build description
  let description = event.description || '';
  if (event.meetingLink) {
    description += `\\n\\nJoin: ${event.meetingLink}`;
  }
  if (event.locationLabel) {
    description += `\\n\\nLocation: ${event.locationLabel}`;
  }

  // Build location
  const location = event.meetingLink || event.locationLabel || 'Online';

  // Build RRULE for recurring events
  let rrule = '';
  if (event.isRecurring && event.recurrence) {
    rrule = generateRRule(event.recurrence);
  }

  // Escape special characters
  const escapedTitle = escapeICSText(event.title);
  const escapedDescription = escapeICSText(description);
  const escapedLocation = escapeICSText(location);

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GrowthAddicts//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${escapedTitle}`,
    `DESCRIPTION:${escapedDescription}`,
    `LOCATION:${escapedLocation}`,
  ];

  // Add RRULE if recurring
  if (rrule) {
    icsLines.push(rrule);
  }

  // Add organizer if available
  if (event.hostName) {
    icsLines.push(`ORGANIZER;CN=${escapeICSText(event.hostName)}:mailto:noreply@growthaddicts.io`);
  }

  // Add alarm (reminder 15 minutes before)
  icsLines.push(
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapedTitle} starting in 15 minutes`,
    'END:VALARM'
  );

  icsLines.push('END:VEVENT', 'END:VCALENDAR');

  return icsLines.join('\r\n');
}

/**
 * Format date to ICS format (UTC)
 */
function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Escape special characters for ICS text
 */
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Sanitize filename for download
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50) || 'event';
}

/**
 * Generate RRULE for recurring events
 */
function generateRRule(recurrence: RecurrencePattern): string {
  const parts: string[] = ['RRULE:'];

  switch (recurrence.frequency) {
    case 'daily':
      parts.push('FREQ=DAILY');
      break;
    case 'weekly':
      parts.push('FREQ=WEEKLY');
      if (recurrence.dayOfWeek !== undefined) {
        const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
        parts.push(`;BYDAY=${days[recurrence.dayOfWeek]}`);
      }
      break;
    case 'biweekly':
      parts.push('FREQ=WEEKLY;INTERVAL=2');
      if (recurrence.dayOfWeek !== undefined) {
        const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
        parts.push(`;BYDAY=${days[recurrence.dayOfWeek]}`);
      }
      break;
    case 'monthly':
      parts.push('FREQ=MONTHLY');
      if (recurrence.dayOfMonth !== undefined) {
        parts.push(`;BYMONTHDAY=${recurrence.dayOfMonth}`);
      }
      break;
  }

  // Add end date or count
  if (recurrence.endDate) {
    const endDate = new Date(recurrence.endDate);
    parts.push(`;UNTIL=${formatICSDate(endDate)}`);
  } else if (recurrence.count) {
    parts.push(`;COUNT=${recurrence.count}`);
  }

  return parts.join('');
}


