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
import { getPlaybackUrl, getDirectVideoUrl, deleteVideo, getThumbnailUrl, getVideoStatus } from '@/lib/bunny-stream';

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

    console.log(`[BUNNY_WEBHOOK] Received webhook for video ${videoId}, status: ${status}, duration: ${durationSeconds}s, title: ${payload.Title}`);
    console.log(`[BUNNY_WEBHOOK] Full payload:`, JSON.stringify(payload));

    // Only process finished (4), error (5), or failed (6) statuses
    if (status !== 4 && status !== 5 && status !== 6) {
      console.log(`[BUNNY_WEBHOOK] Ignoring status ${status} for video ${videoId}`);
      return NextResponse.json({ received: true, ignored: true });
    }

    const isSuccess = status === 4;

    // Find event with this bunnyVideoId
    let eventsQuery;
    try {
      eventsQuery = await adminDb
        .collection('events')
        .where('bunnyVideoId', '==', videoId)
        .limit(1)
        .get();
    } catch (queryError) {
      console.error(`[BUNNY_WEBHOOK] Failed to query events:`, queryError);
      eventsQuery = { empty: true, docs: [] };
    }

    if (!eventsQuery.empty) {
      const eventDoc = eventsQuery.docs[0];
      const eventRef = eventDoc.ref;

      try {
        // Verify doc still exists
        const currentDoc = await eventRef.get();
        if (!currentDoc.exists) {
          console.warn(`[BUNNY_WEBHOOK] Event ${eventDoc.id} no longer exists, skipping update`);
          return NextResponse.json({ received: true, eventId: eventDoc.id, deleted: true });
        }

        if (isSuccess) {
          // Get playback URL and direct URL for transcription
          const playbackUrl = getPlaybackUrl(videoId);
          const directUrl = await getDirectVideoUrl(videoId);

          // Get video metadata to detect audio-only
          const videoStatus = await getVideoStatus(videoId);

          await eventRef.set({
            recordingUrl: directUrl || playbackUrl, // Use direct URL for transcription compatibility
            bunnyPlaybackUrl: playbackUrl, // HLS for player
            recordingStatus: 'ready',
            hasCallRecording: true,
            recordingDurationSeconds: durationSeconds || null,
            isAudioOnly: videoStatus.isAudioOnly,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });

          console.log(`[BUNNY_WEBHOOK] Event ${eventDoc.id} recording ready: ${playbackUrl}, isAudioOnly: ${videoStatus.isAudioOnly}`);
        } else {
          await eventRef.set({
            recordingStatus: 'failed',
            recordingError: `Bunny encoding failed with status ${status}`,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });

          console.error(`[BUNNY_WEBHOOK] Event ${eventDoc.id} encoding failed`);
        }

        return NextResponse.json({ received: true, eventId: eventDoc.id });
      } catch (updateError) {
        console.warn(`[BUNNY_WEBHOOK] Failed to update event ${eventDoc.id}:`, updateError);
        return NextResponse.json({ received: true, eventId: eventDoc.id, updateFailed: true });
      }
    }

    // Check for course lesson with this bunnyVideoId
    // Course lessons store video URLs in course.modules[].lessons[].videoUrl
    // We need to search for documents that have this videoId stored
    let coursesQuery;
    try {
      coursesQuery = await adminDb
        .collection('courses')
        .where('bunnyVideoIds', 'array-contains', videoId)
        .limit(1)
        .get();
    } catch (queryError) {
      console.error(`[BUNNY_WEBHOOK] Failed to query courses:`, queryError);
      coursesQuery = { empty: true, docs: [] };
    }

    if (!coursesQuery.empty) {
      const courseDoc = coursesQuery.docs[0];
      const courseRef = courseDoc.ref;
      const courseData = courseDoc.data();

      try {
        // Verify doc still exists
        const currentDoc = await courseRef.get();
        if (!currentDoc.exists) {
          console.warn(`[BUNNY_WEBHOOK] Course ${courseDoc.id} no longer exists, skipping update`);
          return NextResponse.json({ received: true, courseId: courseDoc.id, deleted: true });
        }

        if (isSuccess) {
          const playbackUrl = getPlaybackUrl(videoId);
          const videoStatus = await getVideoStatus(videoId);

          // Update the lesson's videoUrl in the embedded modules array
          const modules = courseData.modules || [];
          let updated = false;

          for (const module of modules) {
            for (const lesson of module.lessons || []) {
              if (lesson.bunnyVideoId === videoId) {
                lesson.videoUrl = playbackUrl;
                lesson.videoDurationSeconds = durationSeconds;
                lesson.videoStatus = 'ready';
                lesson.isAudioOnly = videoStatus.isAudioOnly;
                updated = true;
              }
            }
          }

          if (updated) {
            await courseRef.set({
              modules,
              updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });

            console.log(`[BUNNY_WEBHOOK] Course ${courseDoc.id} lesson video ready: ${playbackUrl}, isAudioOnly: ${videoStatus.isAudioOnly}`);
          }
        }

        return NextResponse.json({ received: true, courseId: courseDoc.id });
      } catch (updateError) {
        console.warn(`[BUNNY_WEBHOOK] Failed to update course ${courseDoc.id}:`, updateError);
        return NextResponse.json({ received: true, courseId: courseDoc.id, updateFailed: true });
      }
    }

    // Check org-scoped courses (in orgs/{orgId}/courses collection)
    // This handles multi-tenant course videos
    // Requires COLLECTION_GROUP index on courses.bunnyVideoIds
    let orgCoursesSnapshot;
    try {
      orgCoursesSnapshot = await adminDb
        .collectionGroup('courses')
        .where('bunnyVideoIds', 'array-contains', videoId)
        .limit(1)
        .get();
    } catch (queryError) {
      // Index may not exist yet - log and continue
      console.warn(`[BUNNY_WEBHOOK] collectionGroup courses query failed (index may be missing):`, queryError);
      orgCoursesSnapshot = { empty: true, docs: [] };
    }

    if (!orgCoursesSnapshot.empty) {
      const courseDoc = orgCoursesSnapshot.docs[0];
      const courseRef = courseDoc.ref;
      const courseData = courseDoc.data();

      try {
        const currentDoc = await courseRef.get();
        if (!currentDoc.exists) {
          console.warn(`[BUNNY_WEBHOOK] Org course ${courseDoc.id} no longer exists, skipping update`);
          return NextResponse.json({ received: true, courseId: courseDoc.id, deleted: true });
        }

        if (isSuccess) {
          const playbackUrl = getPlaybackUrl(videoId);
          const videoStatus = await getVideoStatus(videoId);

          const modules = courseData.modules || [];
          for (const module of modules) {
            for (const lesson of module.lessons || []) {
              if (lesson.bunnyVideoId === videoId) {
                lesson.videoUrl = playbackUrl;
                lesson.videoDurationSeconds = durationSeconds;
                lesson.videoStatus = 'ready';
                lesson.isAudioOnly = videoStatus.isAudioOnly;
              }
            }
          }

          await courseRef.set({
            modules,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });

          console.log(`[BUNNY_WEBHOOK] Org course ${courseDoc.id} lesson video ready, isAudioOnly: ${videoStatus.isAudioOnly}`);
        }

        return NextResponse.json({ received: true, courseId: courseDoc.id });
      } catch (updateError) {
        console.warn(`[BUNNY_WEBHOOK] Failed to update org course ${courseDoc.id}:`, updateError);
        return NextResponse.json({ received: true, courseId: courseDoc.id, updateFailed: true });
      }
    }

    // Check for discover video with pending replacement video
    // When a replacement finishes encoding, swap it to be the main video
    let pendingVideosQuery;
    try {
      pendingVideosQuery = await adminDb
        .collection('discover_videos')
        .where('pendingBunnyVideoId', '==', videoId)
        .limit(1)
        .get();
    } catch (queryError) {
      console.error(`[BUNNY_WEBHOOK] Failed to query pendingBunnyVideoId:`, queryError);
      // Continue to next query - this field may not exist yet
      pendingVideosQuery = { empty: true, docs: [] };
    }

    if (!pendingVideosQuery.empty) {
      const videoDoc = pendingVideosQuery.docs[0];
      const videoData = videoDoc.data();

      try {
        const currentDoc = await videoDoc.ref.get();
        if (!currentDoc.exists) {
          console.warn(`[BUNNY_WEBHOOK] Discover video ${videoDoc.id} no longer exists, skipping pending update`);
          return NextResponse.json({ received: true, discoverVideoId: videoDoc.id, deleted: true });
        }

        if (isSuccess) {
          const playbackUrl = getPlaybackUrl(videoId);
          const oldBunnyVideoId = videoData.bunnyVideoId;
          const videoStatus = await getVideoStatus(videoId);

          // Swap: pending becomes main, clear pending field
          await videoDoc.ref.set({
            bunnyVideoId: videoId,
            playbackUrl,
            thumbnailUrl: getThumbnailUrl(videoId),
            durationSeconds: durationSeconds || null,
            videoStatus: 'ready',
            isAudioOnly: videoStatus.isAudioOnly,
            pendingBunnyVideoId: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });

          // Delete the old Bunny video
          if (oldBunnyVideoId && oldBunnyVideoId !== videoId) {
            try {
              await deleteVideo(oldBunnyVideoId);
              console.log(`[BUNNY_WEBHOOK] Deleted old video ${oldBunnyVideoId} after replacement`);
            } catch (deleteErr) {
              console.warn(`[BUNNY_WEBHOOK] Failed to delete old video ${oldBunnyVideoId}:`, deleteErr);
            }
          }

          console.log(`[BUNNY_WEBHOOK] Discover video ${videoDoc.id} replacement ready: ${playbackUrl}, isAudioOnly: ${videoStatus.isAudioOnly}`);
        } else {
          // Pending video failed - clear it but keep old video
          await videoDoc.ref.set({
            pendingBunnyVideoId: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });

          console.error(`[BUNNY_WEBHOOK] Discover video ${videoDoc.id} replacement encoding failed`);
        }

        return NextResponse.json({ received: true, discoverVideoId: videoDoc.id, isReplacement: true });
      } catch (updateError) {
        console.warn(`[BUNNY_WEBHOOK] Failed to update discover video replacement ${videoDoc.id}:`, updateError);
        return NextResponse.json({ received: true, discoverVideoId: videoDoc.id, updateFailed: true });
      }
    }

    // Check for discover video with this bunnyVideoId
    let discoverVideosQuery;
    try {
      discoverVideosQuery = await adminDb
        .collection('discover_videos')
        .where('bunnyVideoId', '==', videoId)
        .limit(1)
        .get();
    } catch (queryError) {
      console.error(`[BUNNY_WEBHOOK] Failed to query bunnyVideoId for discover_videos:`, queryError);
      throw queryError; // Re-throw as this is a critical query
    }

    if (!discoverVideosQuery.empty) {
      const videoDoc = discoverVideosQuery.docs[0];

      try {
        // Check if document still exists before updating
        const currentDoc = await videoDoc.ref.get();
        if (!currentDoc.exists) {
          console.warn(`[BUNNY_WEBHOOK] Discover video ${videoDoc.id} no longer exists, skipping update`);
          return NextResponse.json({ received: true, discoverVideoId: videoDoc.id, deleted: true });
        }

        if (isSuccess) {
          const playbackUrl = getPlaybackUrl(videoId);
          const videoStatus = await getVideoStatus(videoId);

          await videoDoc.ref.set({
            playbackUrl,
            durationSeconds: durationSeconds || null,
            videoStatus: 'ready',
            isAudioOnly: videoStatus.isAudioOnly,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });

          console.log(`[BUNNY_WEBHOOK] Discover video ${videoDoc.id} ready: ${playbackUrl}, isAudioOnly: ${videoStatus.isAudioOnly}`);
        } else {
          await videoDoc.ref.set({
            videoStatus: 'failed',
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });

          console.error(`[BUNNY_WEBHOOK] Discover video ${videoDoc.id} encoding failed`);
        }

        return NextResponse.json({ received: true, discoverVideoId: videoDoc.id });
      } catch (updateError) {
        // Log the error but don't fail the webhook - doc may have been deleted
        console.warn(`[BUNNY_WEBHOOK] Failed to update discover video ${videoDoc.id}:`, updateError);
        return NextResponse.json({ received: true, discoverVideoId: videoDoc.id, updateFailed: true });
      }
    }

    // Check for discover video preview with this bunnyVideoId
    let previewVideosQuery;
    try {
      previewVideosQuery = await adminDb
        .collection('discover_videos')
        .where('previewBunnyVideoId', '==', videoId)
        .limit(1)
        .get();
    } catch (queryError) {
      console.error(`[BUNNY_WEBHOOK] Failed to query previewBunnyVideoId:`, queryError);
      previewVideosQuery = { empty: true, docs: [] };
    }

    if (!previewVideosQuery.empty) {
      const videoDoc = previewVideosQuery.docs[0];

      try {
        // Check if document still exists before updating
        const currentDoc = await videoDoc.ref.get();
        if (!currentDoc.exists) {
          console.warn(`[BUNNY_WEBHOOK] Discover video ${videoDoc.id} no longer exists, skipping preview update`);
          return NextResponse.json({ received: true, discoverVideoId: videoDoc.id, isPreview: true, deleted: true });
        }

        if (isSuccess) {
          const playbackUrl = getPlaybackUrl(videoId);

          await videoDoc.ref.set({
            previewPlaybackUrl: playbackUrl,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });

          console.log(`[BUNNY_WEBHOOK] Discover video ${videoDoc.id} preview ready: ${playbackUrl}`);
        }

        return NextResponse.json({ received: true, discoverVideoId: videoDoc.id, isPreview: true });
      } catch (updateError) {
        console.warn(`[BUNNY_WEBHOOK] Failed to update discover video preview ${videoDoc.id}:`, updateError);
        return NextResponse.json({ received: true, discoverVideoId: videoDoc.id, isPreview: true, updateFailed: true });
      }
    }

    console.log(`[BUNNY_WEBHOOK] No matching event, course, or discover video found for video ${videoId}`);
    return NextResponse.json({ received: true, matched: false });
  } catch (error) {
    console.error('[BUNNY_WEBHOOK] Error processing webhook:', error);
    if (error instanceof Error) {
      console.error('[BUNNY_WEBHOOK] Error stack:', error.stack);
    }
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
