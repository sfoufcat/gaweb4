import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { getZoomRecordings } from '@/lib/integrations/zoom';

/**
 * GET /api/coach/integrations/zoom/recordings
 *
 * Fetch cloud recordings for a Zoom meeting.
 *
 * Query params:
 * - meetingId: The Zoom meeting ID
 *
 * Returns:
 * - recordingUrl: The share URL for the recording
 * - recordings: Array of recording objects with type, playUrl, downloadUrl, shareUrl
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
    const meetingId = searchParams.get('meetingId');

    if (!meetingId) {
      return NextResponse.json({ error: 'meetingId parameter required' }, { status: 400 });
    }

    const result = await getZoomRecordings(orgId, meetingId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      recordingUrl: result.recordingUrl,
      recordings: result.recordings || [],
      error: result.error, // May contain info message like "No recordings found"
    });
  } catch (error) {
    console.error('[API] Error fetching Zoom recordings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch recordings' },
      { status: 500 }
    );
  }
}
