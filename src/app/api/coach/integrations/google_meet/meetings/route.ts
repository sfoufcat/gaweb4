/**
 * Google Meet Meetings API
 *
 * POST /api/coach/integrations/google_meet/meetings - Create a new Google Meet meeting
 * DELETE /api/coach/integrations/google_meet/meetings - Delete a Google Meet event
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import {
  createGoogleMeetMeeting,
  deleteGoogleMeetEvent,
} from '@/lib/integrations/google-meet';

/**
 * POST /api/coach/integrations/google_meet/meetings
 *
 * Create a new Google Meet meeting
 *
 * Body:
 * - summary: string (required) - Meeting title
 * - startTime: string (ISO datetime, required)
 * - endTime: string (ISO datetime, required)
 * - timezone: string (required)
 * - description?: string
 */
export async function POST(req: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body = await req.json();
    const { summary, startTime, endTime, timezone, description } = body as {
      summary: string;
      startTime: string;
      endTime: string;
      timezone: string;
      description?: string;
    };

    // Validate required fields
    if (!summary || !startTime || !endTime || !timezone) {
      return NextResponse.json(
        { error: 'Missing required fields: summary, startTime, endTime, timezone' },
        { status: 400 }
      );
    }

    const result = await createGoogleMeetMeeting(organizationId, {
      summary,
      startTime,
      endTime,
      timezone,
      description,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create Google Meet' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      meetingUrl: result.meetingUrl,
      eventId: result.eventId,
    });
  } catch (error) {
    console.error('[GOOGLE_MEET_MEETINGS_POST_ERROR]', error);
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
 * DELETE /api/coach/integrations/google_meet/meetings
 *
 * Delete a Google Meet event (also removes the Meet link)
 *
 * Body:
 * - eventId: string (required)
 */
export async function DELETE(req: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body = await req.json();
    const { eventId } = body as { eventId: string };

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId is required' },
        { status: 400 }
      );
    }

    const result = await deleteGoogleMeetEvent(organizationId, eventId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to delete Google Meet event' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[GOOGLE_MEET_MEETINGS_DELETE_ERROR]', error);
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
