/**
 * Transcriptions API
 * 
 * GET /api/coach/integrations/transcriptions - List transcriptions
 * POST /api/coach/integrations/transcriptions - Start a new transcription
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import {
  transcribeCall,
  listTranscriptions,
} from '@/lib/integrations';

/**
 * GET /api/coach/integrations/transcriptions
 * 
 * List transcriptions for the organization
 */
export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const searchParams = req.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    const transcriptions = await listTranscriptions(organizationId, limit);

    return NextResponse.json({
      transcriptions,
      count: transcriptions.length,
    });
  } catch (error) {
    console.error('[TRANSCRIPTIONS_GET_ERROR]', error);
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
 * POST /api/coach/integrations/transcriptions
 * 
 * Start a new transcription
 * 
 * Body:
 * - callType: 'coaching' | 'squad' | 'video_message'
 * - callId: string
 * - recordingUrl: string
 */
export async function POST(req: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body = await req.json();
    const { callType, callId, recordingUrl } = body;

    if (!callType || !callId || !recordingUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: callType, callId, recordingUrl' },
        { status: 400 }
      );
    }

    if (!['coaching', 'squad', 'video_message'].includes(callType)) {
      return NextResponse.json(
        { error: 'Invalid callType. Must be: coaching, squad, or video_message' },
        { status: 400 }
      );
    }

    const result = await transcribeCall(
      organizationId,
      callType,
      callId,
      recordingUrl
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to start transcription' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      transcriptionId: result.transcriptionId,
      message: 'Transcription started. Check back in a few minutes for results.',
    });
  } catch (error) {
    console.error('[TRANSCRIPTIONS_POST_ERROR]', error);
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


