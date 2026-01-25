/**
 * Bunny Stream Webhook Handler
 *
 * Receives encoding completion webhooks from Bunny Stream.
 * Updates event recordings and course videos when encoding finishes.
 *
 * Webhook URL to configure in Bunny dashboard:
 * https://app.coachful.co/api/webhooks/bunny
 *
 * Events handled:
 * - video.encoded: Video encoding completed successfully
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getPlaybackUrl, getDirectVideoUrl } from '@/lib/bunny-stream';

interface BunnyWebhookPayload {
  VideoGuid: string;
  VideoLibraryId: number;
  Status: number; // 4 = finished, 5 = error, 6 = failed
  // Additional fields from Bunny
  Title?: string;
  IsPublic?: boolean;
  Length?: number; // Duration in seconds
  DateUploaded?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Optional: Verify webhook signature if BUNNY_WEBHOOK_SECRET is set
    const webhookSecret = process.env.BUNNY_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = request.headers.get('X-Bunny-Signature');
      // Bunny uses a simple shared secret comparison
      if (signature !== webhookSecret) {
        console.error('[BUNNY_WEBHOOK] Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const payload: BunnyWebhookPayload = await request.json();
    const { VideoGuid: videoId, Status: status, Length: durationSeconds } = payload;

    console.log(`[BUNNY_WEBHOOK] Received webhook for video ${videoId}, status: ${status}`);

    // Only process finished (4), error (5), or failed (6) statuses
    if (status !== 4 && status !== 5 && status !== 6) {
      console.log(`[BUNNY_WEBHOOK] Ignoring status ${status} for video ${videoId}`);
      return NextResponse.json({ received: true, ignored: true });
    }

    const isSuccess = status === 4;

    // Find event with this bunnyVideoId
    const eventsQuery = await adminDb
      .collection('events')
      .where('bunnyVideoId', '==', videoId)
      .limit(1)
      .get();

    if (!eventsQuery.empty) {
      const eventDoc = eventsQuery.docs[0];
      const eventRef = eventDoc.ref;

      if (isSuccess) {
        // Get playback URL and direct URL for transcription
        const playbackUrl = getPlaybackUrl(videoId);
        const directUrl = await getDirectVideoUrl(videoId);

        await eventRef.update({
          recordingUrl: directUrl || playbackUrl, // Use direct URL for transcription compatibility
          bunnyPlaybackUrl: playbackUrl, // HLS for player
          recordingStatus: 'ready',
          hasCallRecording: true,
          recordingDurationSeconds: durationSeconds || null,
          updatedAt: FieldValue.serverTimestamp(),
        });

        console.log(`[BUNNY_WEBHOOK] Event ${eventDoc.id} recording ready: ${playbackUrl}`);
      } else {
        await eventRef.update({
          recordingStatus: 'failed',
          recordingError: `Bunny encoding failed with status ${status}`,
          updatedAt: FieldValue.serverTimestamp(),
        });

        console.error(`[BUNNY_WEBHOOK] Event ${eventDoc.id} encoding failed`);
      }

      return NextResponse.json({ received: true, eventId: eventDoc.id });
    }

    // Check for course lesson with this bunnyVideoId
    // Course lessons store video URLs in course.modules[].lessons[].videoUrl
    // We need to search for documents that have this videoId stored
    const coursesQuery = await adminDb
      .collection('courses')
      .where('bunnyVideoIds', 'array-contains', videoId)
      .limit(1)
      .get();

    if (!coursesQuery.empty) {
      const courseDoc = coursesQuery.docs[0];
      const courseRef = courseDoc.ref;
      const courseData = courseDoc.data();

      if (isSuccess) {
        const playbackUrl = getPlaybackUrl(videoId);

        // Update the lesson's videoUrl in the embedded modules array
        const modules = courseData.modules || [];
        let updated = false;

        for (const module of modules) {
          for (const lesson of module.lessons || []) {
            if (lesson.bunnyVideoId === videoId) {
              lesson.videoUrl = playbackUrl;
              lesson.videoDurationSeconds = durationSeconds;
              lesson.videoStatus = 'ready';
              updated = true;
            }
          }
        }

        if (updated) {
          await courseRef.update({
            modules,
            updatedAt: FieldValue.serverTimestamp(),
          });

          console.log(`[BUNNY_WEBHOOK] Course ${courseDoc.id} lesson video ready: ${playbackUrl}`);
        }
      }

      return NextResponse.json({ received: true, courseId: courseDoc.id });
    }

    // Check org-scoped courses (in orgs/{orgId}/courses collection)
    // This handles multi-tenant course videos
    const orgCoursesSnapshot = await adminDb
      .collectionGroup('courses')
      .where('bunnyVideoIds', 'array-contains', videoId)
      .limit(1)
      .get();

    if (!orgCoursesSnapshot.empty) {
      const courseDoc = orgCoursesSnapshot.docs[0];
      const courseRef = courseDoc.ref;
      const courseData = courseDoc.data();

      if (isSuccess) {
        const playbackUrl = getPlaybackUrl(videoId);

        const modules = courseData.modules || [];
        for (const module of modules) {
          for (const lesson of module.lessons || []) {
            if (lesson.bunnyVideoId === videoId) {
              lesson.videoUrl = playbackUrl;
              lesson.videoDurationSeconds = durationSeconds;
              lesson.videoStatus = 'ready';
            }
          }
        }

        await courseRef.update({
          modules,
          updatedAt: FieldValue.serverTimestamp(),
        });

        console.log(`[BUNNY_WEBHOOK] Org course ${courseDoc.id} lesson video ready`);
      }

      return NextResponse.json({ received: true, courseId: courseDoc.id });
    }

    // Check for discover video with this bunnyVideoId
    const discoverVideosQuery = await adminDb
      .collection('discover_videos')
      .where('bunnyVideoId', '==', videoId)
      .limit(1)
      .get();

    if (!discoverVideosQuery.empty) {
      const videoDoc = discoverVideosQuery.docs[0];

      if (isSuccess) {
        const playbackUrl = getPlaybackUrl(videoId);

        await videoDoc.ref.update({
          playbackUrl,
          durationSeconds: durationSeconds || null,
          videoStatus: 'ready',
          updatedAt: FieldValue.serverTimestamp(),
        });

        console.log(`[BUNNY_WEBHOOK] Discover video ${videoDoc.id} ready: ${playbackUrl}`);
      } else {
        await videoDoc.ref.update({
          videoStatus: 'failed',
          updatedAt: FieldValue.serverTimestamp(),
        });

        console.error(`[BUNNY_WEBHOOK] Discover video ${videoDoc.id} encoding failed`);
      }

      return NextResponse.json({ received: true, discoverVideoId: videoDoc.id });
    }

    // Check for discover video preview with this bunnyVideoId
    const previewVideosQuery = await adminDb
      .collection('discover_videos')
      .where('previewBunnyVideoId', '==', videoId)
      .limit(1)
      .get();

    if (!previewVideosQuery.empty) {
      const videoDoc = previewVideosQuery.docs[0];

      if (isSuccess) {
        const playbackUrl = getPlaybackUrl(videoId);

        await videoDoc.ref.update({
          previewPlaybackUrl: playbackUrl,
          updatedAt: FieldValue.serverTimestamp(),
        });

        console.log(`[BUNNY_WEBHOOK] Discover video ${videoDoc.id} preview ready: ${playbackUrl}`);
      }

      return NextResponse.json({ received: true, discoverVideoId: videoDoc.id, isPreview: true });
    }

    console.log(`[BUNNY_WEBHOOK] No matching event, course, or discover video found for video ${videoId}`);
    return NextResponse.json({ received: true, matched: false });
  } catch (error) {
    console.error('[BUNNY_WEBHOOK] Error processing webhook:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// Bunny may send GET requests to verify the endpoint
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'bunny-webhook' });
}
