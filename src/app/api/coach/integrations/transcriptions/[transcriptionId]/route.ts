/**
 * Single Transcription API
 * 
 * GET /api/coach/integrations/transcriptions/[transcriptionId] - Get transcription
 * DELETE /api/coach/integrations/transcriptions/[transcriptionId] - Delete transcription
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import {
  getTranscriptionById,
  deleteTranscription,
} from '@/lib/integrations';

interface RouteParams {
  params: Promise<{
    transcriptionId: string;
  }>;
}

/**
 * GET /api/coach/integrations/transcriptions/[transcriptionId]
 * 
 * Get a single transcription
 */
export async function GET(
  _req: NextRequest,
  context: RouteParams
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { transcriptionId } = await context.params;

    const transcription = await getTranscriptionById(organizationId, transcriptionId);

    if (!transcription) {
      return NextResponse.json(
        { error: 'Transcription not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      transcription,
    });
  } catch (error) {
    console.error('[TRANSCRIPTION_GET_ERROR]', error);
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
 * DELETE /api/coach/integrations/transcriptions/[transcriptionId]
 * 
 * Delete a transcription
 */
export async function DELETE(
  _req: NextRequest,
  context: RouteParams
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { transcriptionId } = await context.params;

    // Verify it exists
    const transcription = await getTranscriptionById(organizationId, transcriptionId);

    if (!transcription) {
      return NextResponse.json(
        { error: 'Transcription not found' },
        { status: 404 }
      );
    }

    await deleteTranscription(organizationId, transcriptionId);

    return NextResponse.json({
      success: true,
      message: 'Transcription deleted',
    });
  } catch (error) {
    console.error('[TRANSCRIPTION_DELETE_ERROR]', error);
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


