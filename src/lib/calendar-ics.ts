/**
 * Calendar ICS Generation
 *
 * Generates iCalendar (.ics) files for email attachments
 */

export interface ICSEventParams {
  eventId: string;
  title: string;
  description?: string;
  startDateTime: string;  // ISO string
  endDateTime: string;    // ISO string
  meetingLink?: string;
  location?: string;
  hostName?: string;
  hostEmail?: string;
  attendeeName?: string;
  attendeeEmail?: string;
  organizerName?: string;
  organizerEmail?: string;
}

/**
 * Generate ICS content for an event
 */
export function generateICS(params: ICSEventParams): string {
  const {
    eventId,
    title,
    description,
    startDateTime,
    endDateTime,
    meetingLink,
    location,
    hostName,
    hostEmail,
    attendeeName,
    attendeeEmail,
    organizerName,
    organizerEmail,
  } = params;

  const startDate = new Date(startDateTime);
  const endDate = new Date(endDateTime);

  const uid = `${eventId}@coachful.co`;
  const dtstamp = formatICSDate(new Date());
  const dtstart = formatICSDate(startDate);
  const dtend = formatICSDate(endDate);

  // Build description with meeting link
  let fullDescription = description || '';
  if (meetingLink) {
    fullDescription += fullDescription ? '\\n\\n' : '';
    fullDescription += `Join: ${meetingLink}`;
  }

  // Determine location
  const eventLocation = location || meetingLink || 'Online';

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Coachful//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    'SEQUENCE:0',
    'STATUS:CONFIRMED',
    `SUMMARY:${escapeICSText(title)}`,
  ];

  if (fullDescription) {
    icsLines.push(`DESCRIPTION:${escapeICSText(fullDescription)}`);
  }

  icsLines.push(`LOCATION:${escapeICSText(eventLocation)}`);

  // Add organizer
  const orgName = organizerName || hostName || 'Coach';
  const orgEmail = organizerEmail || hostEmail || 'noreply@coachful.co';
  icsLines.push(`ORGANIZER;CN=${escapeICSText(orgName)}:mailto:${orgEmail}`);

  // Add attendee if provided
  if (attendeeEmail) {
    const attName = attendeeName || attendeeEmail.split('@')[0];
    icsLines.push(`ATTENDEE;CN=${escapeICSText(attName)};RSVP=TRUE;PARTSTAT=ACCEPTED:mailto:${attendeeEmail}`);
  }

  // Add alarm (reminder 15 minutes before)
  icsLines.push(
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeICSText(title)} starting in 15 minutes`,
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
 * Generate a safe filename for the ICS file
 */
export function generateICSFilename(title: string): string {
  const safeName = title
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50) || 'event';
  return `${safeName}.ics`;
}
