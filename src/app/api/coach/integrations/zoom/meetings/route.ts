/**
 * Zoom Meetings API
 *
 * POST /api/coach/integrations/zoom/meetings - Create a new Zoom meeting
 * DELETE /api/coach/integrations/zoom/meetings - Delete a Zoom meeting
 * GET /api/coach/integrations/zoom/meetings?meetingId=xxx - Get meeting details
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import {
  createZoomMeeting,
  deleteZoomMeeting,
  getZoomMeeting,
} from '@/lib/integrations/zoom';

/**
 * POST /api/coach/integrations/zoom/meetings
 *
 * Create a new Zoom meeting
 *
 * Body:
 * - topic: string (required)
 * - startTime: string (ISO datetime, required)
 * - duration: number (minutes, required)
 * - timezone: string (required)
 * - agenda?: string
 */
export async function POST(req: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body = await req.json();
    const { topic, startTime, duration, timezone, agenda } = body as {
      topic: string;
      startTime: string;
      duration: number;
      timezone: string;
      agenda?: string;
    };

    // Validate required fields
    if (!topic || !startTime || !duration || !timezone) {
      return NextResponse.json(
        { error: 'Missing required fields: topic, startTime, duration, timezone' },
        { status: 400 }
      );
    }

    const result = await createZoomMeeting(organizationId, {
      topic,
      startTime,
      duration,
      timezone,
      agenda,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create Zoom meeting' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      meetingUrl: result.meetingUrl,
      meetingId: result.meetingId,
    });
  } catch (error) {
    console.error('[ZOOM_MEETINGS_POST_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/coach/integrations/zoom/meetings
 *
 * Delete a Zoom meeting
 *
 * Body:
 * - meetingId: string (required)
 */
export async function DELETE(req: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body = await req.json();
    const { meetingId } = body as { meetingId: string };

    if (!meetingId) {
      return NextResponse.json(
        { error: 'meetingId is required' },
        { status: 400 }
      );
    }

    const result = await deleteZoomMeeting(organizationId, meetingId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to delete Zoom meeting' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ZOOM_MEETINGS_DELETE_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * GET /api/coach/integrations/zoom/meetings?meetingId=xxx
 *
 * Get Zoom meeting details
 */
export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const meetingId = req.nextUrl.searchParams.get('meetingId');

    if (!meetingId) {
      return NextResponse.json(
        { error: 'meetingId query parameter is required' },
        { status: 400 }
      );
    }

    const result = await getZoomMeeting(organizationId, meetingId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to get Zoom meeting' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      meeting: result.meeting,
    });
  } catch (error) {
    console.error('[ZOOM_MEETINGS_GET_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
