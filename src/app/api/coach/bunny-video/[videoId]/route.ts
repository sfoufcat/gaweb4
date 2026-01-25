/**
 * Coach API: Delete Orphaned Bunny Video
 *
 * DELETE /api/coach/bunny-video/[videoId] - Delete a Bunny video by ID
 *
 * Used when a user discards an upload before saving.
 * No Firestore document is required - this directly deletes from Bunny Stream.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { deleteVideo } from '@/lib/bunny-stream';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    // Require coach access
    await requireCoachWithOrg();

    const { videoId } = await params;

    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    // Delete video from Bunny Stream
    try {
      await deleteVideo(videoId);
      console.log(`[BUNNY_VIDEO_DELETE] Deleted orphaned video ${videoId}`);
    } catch (err) {
      // Log but don't fail if Bunny delete fails (video might already be gone)
      console.warn(`[BUNNY_VIDEO_DELETE] Failed to delete Bunny video ${videoId}:`, err);
    }

    return NextResponse.json({
      success: true,
      message: 'Video deleted successfully',
    });
  } catch (error) {
    console.error('[BUNNY_VIDEO_DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to delete video' }, { status: 500 });
  }
}
