/**
 * Coach API: Single Video Management (Organization-scoped)
 *
 * GET /api/coach/org-discover/videos/[id] - Get video details
 * PATCH /api/coach/org-discover/videos/[id] - Update video
 * DELETE /api/coach/org-discover/videos/[id] - Delete video
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import { deleteVideo as deleteBunnyVideo, getThumbnailUrl } from '@/lib/bunny-stream';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const { id } = await params;
    const videoDoc = await adminDb.collection('discover_videos').doc(id).get();

    if (!videoDoc.exists) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const videoData = videoDoc.data();

    // Verify the video belongs to this organization
    if (videoData?.organizationId && videoData.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const video = {
      id: videoDoc.id,
      ...videoData,
      createdAt: videoData?.createdAt?.toDate?.()?.toISOString?.() || videoData?.createdAt,
      updatedAt: videoData?.updatedAt?.toDate?.()?.toISOString?.() || videoData?.updatedAt,
    };

    return NextResponse.json({ video });
  } catch (error) {
    console.error('[COACH_ORG_VIDEO_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch video' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const { id } = await params;
    const body = await request.json();

    // Check if video exists
    const videoDoc = await adminDb.collection('discover_videos').doc(id).get();
    if (!videoDoc.exists) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const videoData = videoDoc.data();

    // Verify the video belongs to this organization
    if (videoData?.organizationId && videoData.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Only update fields that are provided
    const allowedFields = [
      'title',
      'description',
      'bunnyVideoId',
      'playbackUrl',
      'customThumbnailUrl',
      'durationSeconds',
      'videoStatus',
      'previewBunnyVideoId',
      'previewPlaybackUrl',
      'programIds',
      'order',
      'priceInCents',
      'currency',
      'purchaseType',
      'isPublic',
      'keyOutcomes',
      'features',
      'testimonials',
      'faqs',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Update thumbnail URL if bunnyVideoId changed or customThumbnailUrl changed
    if (body.bunnyVideoId !== undefined || body.customThumbnailUrl !== undefined) {
      const bunnyVideoId = body.bunnyVideoId || videoData?.bunnyVideoId;
      updateData.thumbnailUrl = body.customThumbnailUrl || getThumbnailUrl(bunnyVideoId);
    }

    await adminDb.collection('discover_videos').doc(id).update(updateData);

    console.log(`[COACH_ORG_VIDEO] Updated video ${id} in organization ${organizationId}`);

    return NextResponse.json({
      success: true,
      message: 'Video updated successfully',
    });
  } catch (error) {
    console.error('[COACH_ORG_VIDEO_PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to update video' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const { id } = await params;

    // Check if video exists
    const videoDoc = await adminDb.collection('discover_videos').doc(id).get();
    if (!videoDoc.exists) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const videoData = videoDoc.data();

    // Verify the video belongs to this organization
    if (videoData?.organizationId && videoData.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Delete video from Bunny Stream
    if (videoData?.bunnyVideoId) {
      try {
        await deleteBunnyVideo(videoData.bunnyVideoId);
      } catch (err) {
        console.warn(`[COACH_ORG_VIDEO_DELETE] Failed to delete Bunny video ${videoData.bunnyVideoId}:`, err);
      }
    }

    // Delete preview video from Bunny Stream if exists
    if (videoData?.previewBunnyVideoId) {
      try {
        await deleteBunnyVideo(videoData.previewBunnyVideoId);
      } catch (err) {
        console.warn(
          `[COACH_ORG_VIDEO_DELETE] Failed to delete Bunny preview video ${videoData.previewBunnyVideoId}:`,
          err
        );
      }
    }

    await adminDb.collection('discover_videos').doc(id).delete();

    console.log(`[COACH_ORG_VIDEO] Deleted video ${id} from organization ${organizationId}`);

    return NextResponse.json({
      success: true,
      message: 'Video deleted successfully',
    });
  } catch (error) {
    console.error('[COACH_ORG_VIDEO_DELETE] Error:', error);
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
