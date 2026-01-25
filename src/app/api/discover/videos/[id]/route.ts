/**
 * API Route: Get Single Video
 *
 * GET /api/discover/videos/[id] - Get video by ID with ownership status
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { auth } from '@clerk/nextjs/server';
import type { DiscoverVideo } from '@/types/discover';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId } = await auth();

    const videoDoc = await adminDb.collection('discover_videos').doc(id).get();

    if (!videoDoc.exists) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const videoData = videoDoc.data();

    // Check if video is ready
    if (videoData?.videoStatus !== 'ready') {
      return NextResponse.json(
        { error: 'Video is not available yet' },
        { status: 404 }
      );
    }

    // Get coach info if organizationId exists
    let coachName: string | undefined;
    let coachImageUrl: string | undefined;

    if (videoData?.organizationId) {
      const orgSettingsDoc = await adminDb
        .collection('org_settings')
        .doc(videoData.organizationId)
        .get();

      if (orgSettingsDoc.exists) {
        const orgSettings = orgSettingsDoc.data();
        coachName = orgSettings?.coachDisplayName;
        coachImageUrl = orgSettings?.coachAvatarUrl;
      }
    }

    const video: DiscoverVideo & { coachName?: string; coachImageUrl?: string } = {
      id: videoDoc.id,
      title: videoData?.title,
      description: videoData?.description,
      bunnyVideoId: videoData?.bunnyVideoId,
      playbackUrl: videoData?.playbackUrl,
      thumbnailUrl: videoData?.thumbnailUrl,
      customThumbnailUrl: videoData?.customThumbnailUrl,
      durationSeconds: videoData?.durationSeconds,
      videoStatus: videoData?.videoStatus,
      previewBunnyVideoId: videoData?.previewBunnyVideoId,
      previewPlaybackUrl: videoData?.previewPlaybackUrl,
      programIds: videoData?.programIds,
      organizationId: videoData?.organizationId,
      order: videoData?.order,
      // Pricing
      priceInCents: videoData?.priceInCents,
      currency: videoData?.currency,
      purchaseType: videoData?.purchaseType,
      isPublic: videoData?.isPublic,
      keyOutcomes: videoData?.keyOutcomes,
      features: videoData?.features,
      testimonials: videoData?.testimonials,
      faqs: videoData?.faqs,
      createdAt: videoData?.createdAt?.toDate?.()?.toISOString?.() || videoData?.createdAt,
      updatedAt: videoData?.updatedAt?.toDate?.()?.toISOString?.() || videoData?.updatedAt,
      // Coach info
      coachName,
      coachImageUrl,
    };

    // Check ownership if user is signed in
    let isOwned = false;
    let includedInProgramName: string | undefined;

    // Free videos are always accessible
    if (!video.priceInCents || video.priceInCents === 0) {
      isOwned = true;
    }

    if (userId && !isOwned) {
      // Check direct purchase
      const purchaseSnapshot = await adminDb
        .collection('user_content_purchases')
        .where('userId', '==', userId)
        .where('contentType', '==', 'video')
        .where('contentId', '==', id)
        .limit(1)
        .get();

      if (!purchaseSnapshot.empty) {
        isOwned = true;
        const purchase = purchaseSnapshot.docs[0].data();
        includedInProgramName = purchase.includedInProgramName;
      }

      // Check if included in an enrolled program
      if (!isOwned && video.programIds && video.programIds.length > 0) {
        const enrollmentSnapshot = await adminDb
          .collection('program_enrollments')
          .where('userId', '==', userId)
          .where('programId', 'in', video.programIds)
          .where('status', 'in', ['active', 'upcoming', 'completed'])
          .limit(1)
          .get();

        if (!enrollmentSnapshot.empty) {
          isOwned = true;
          const enrollment = enrollmentSnapshot.docs[0].data();

          // Get program name
          const programDoc = await adminDb.collection('programs').doc(enrollment.programId).get();
          if (programDoc.exists) {
            includedInProgramName = programDoc.data()?.name;
          }
        }
      }
    }

    // If not owned, don't return the playback URL (security)
    if (!isOwned) {
      video.playbackUrl = undefined;
    }

    return NextResponse.json({
      video,
      isOwned,
      includedInProgramName,
    });
  } catch (error) {
    console.error('[DISCOVER_VIDEO_GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch video' }, { status: 500 });
  }
}
