import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { findMeetRecording, findMeetRecordingByEventId } from '@/lib/integrations/google-drive';

/**
 * GET /api/coach/integrations/google-drive/recordings
 *
 * Search for Google Meet recordings in Google Drive.
 *
 * Query params:
 * - eventId: Google Calendar event ID (preferred - will look up event details)
 * - query: Direct search query (meeting title, date, etc.)
 *
 * Returns:
 * - recordingUrl: The Google Drive web view URL for the recording
 * - files: Array of matching files (if using query param)
 * - error: Error message if no recordings found
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!orgId) {
      return NextResponse.json({ error: 'Organization required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const query = searchParams.get('query');

    if (!eventId && !query) {
      return NextResponse.json(
        { error: 'Either eventId or query parameter required' },
        { status: 400 }
      );
    }

    let result;

    if (eventId) {
      // Search by calendar event ID (preferred method)
      result = await findMeetRecordingByEventId(orgId, eventId);
    } else if (query) {
      // Direct search query
      result = await findMeetRecording(orgId, query);
    }

    if (!result) {
      return NextResponse.json({ error: 'Failed to search for recordings' }, { status: 500 });
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      recordingUrl: result.recordingUrl,
      files: 'files' in result ? result.files : undefined,
      error: result.error, // May contain info message like "No recordings found"
    });
  } catch (error) {
    console.error('[API] Error fetching Google Drive recordings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch recordings' },
      { status: 500 }
    );
  }
}
