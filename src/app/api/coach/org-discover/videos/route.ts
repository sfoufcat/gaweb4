/**
 * Coach API: Organization-scoped Videos Management
 *
 * GET /api/coach/org-discover/videos - List videos in coach's organization
 * POST /api/coach/org-discover/videos - Create or update video in coach's organization
 *   - If `id` provided: updates existing placeholder doc (from get-upload-url)
 *   - If no `id`: creates new doc (backwards compat)
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import { getThumbnailUrl } from '@/lib/bunny-stream';

export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();

    console.log(`[COACH_ORG_VIDEOS] Fetching videos for organization: ${organizationId}`);

    const videosSnapshot = await adminDb
      .collection('discover_videos')
      .where('organizationId', '==', organizationId)
      .orderBy('order', 'asc')
      .get();

    const videos = videosSnapshot.docs
      .filter(doc => doc.data().title) // Skip placeholder docs without title
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
      }));

    return NextResponse.json({
      videos,
      totalCount: videos.length,
      organizationId,
    });
  } catch (error) {
    console.error('[COACH_ORG_VIDEOS_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    if (message.includes('Organization not found')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body = await request.json();

    // Validate required fields
    if (!body.title) {
      return NextResponse.json({ error: 'Missing required field: title' }, { status: 400 });
    }

    if (!body.bunnyVideoId) {
      return NextResponse.json({ error: 'Missing required field: bunnyVideoId' }, { status: 400 });
    }

    // Generate thumbnail URL from Bunny if not custom
    const thumbnailUrl = body.customThumbnailUrl || getThumbnailUrl(body.bunnyVideoId);

    // If id provided, update existing placeholder doc; otherwise create new
    const existingId = body.id;

    const videoData = {
      title: body.title,
      description: body.description || '',
      bunnyVideoId: body.bunnyVideoId,
      playbackUrl: body.playbackUrl || null,
      thumbnailUrl,
      customThumbnailUrl: body.customThumbnailUrl || null,
      durationSeconds: body.durationSeconds || null,
      videoStatus: body.videoStatus || 'encoding',
      // Preview video
      previewBunnyVideoId: body.previewBunnyVideoId || null,
      previewPlaybackUrl: body.previewPlaybackUrl || null,
      // Program associations
      programIds: Array.isArray(body.programIds) ? body.programIds : [],
      order: body.order || 0,
      organizationId, // Scope to coach's organization
      // Pricing & Gating fields
      priceInCents: body.priceInCents ?? null,
      currency: body.currency || 'USD',
      purchaseType: body.purchaseType || 'popup',
      isPublic: body.isPublic !== false,
      keyOutcomes: body.keyOutcomes || [],
      features: body.features || [],
      testimonials: body.testimonials || [],
      faqs: body.faqs || [],
      updatedAt: FieldValue.serverTimestamp(),
    };

    let docId: string;

    if (existingId) {
      // Update existing placeholder doc (created during upload)
      const docRef = adminDb.collection('discover_videos').doc(existingId);
      const existingDoc = await docRef.get();

      if (!existingDoc.exists) {
        return NextResponse.json({ error: 'Video document not found' }, { status: 404 });
      }

      // Verify org ownership
      const existingData = existingDoc.data();
      if (existingData?.organizationId !== organizationId) {
        return NextResponse.json({ error: 'Forbidden: Video belongs to another organization' }, { status: 403 });
      }

      await docRef.update(videoData);
      docId = existingId;
      console.log(`[COACH_ORG_VIDEOS] Updated video ${docId} in organization ${organizationId}`);
    } else {
      // Create new doc (backwards compat for clients not using placeholder flow)
      const docRef = await adminDb.collection('discover_videos').add({
        ...videoData,
        createdAt: FieldValue.serverTimestamp(),
      });
      docId = docRef.id;
      console.log(`[COACH_ORG_VIDEOS] Created video ${docId} in organization ${organizationId}`);
    }

    return NextResponse.json(
      {
        success: true,
        id: docId,
        message: existingId ? 'Video updated successfully' : 'Video created successfully',
      },
      { status: existingId ? 200 : 201 }
    );
  } catch (error) {
    console.error('[COACH_ORG_VIDEOS_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to create video' }, { status: 500 });
  }
}
