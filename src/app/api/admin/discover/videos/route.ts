/**
 * Admin API: Discover Videos Management
 *
 * GET /api/admin/discover/videos - List all videos
 * POST /api/admin/discover/videos - Create new video
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { canManageDiscoverContent } from '@/lib/admin-utils-shared';
import { getCurrentUserRole } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import { getThumbnailUrl } from '@/lib/bunny-stream';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = await getCurrentUserRole();
    if (!canManageDiscoverContent(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const videosSnapshot = await adminDb
      .collection('discover_videos')
      .orderBy('order', 'asc')
      .get();

    const videos = videosSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
    }));

    return NextResponse.json({ videos });
  } catch (error) {
    console.error('[ADMIN_VIDEOS_GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = await getCurrentUserRole();
    if (!canManageDiscoverContent(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
      // Pricing fields
      priceInCents: body.priceInCents ?? null,
      currency: body.currency || 'USD',
      purchaseType: body.purchaseType || 'popup',
      isPublic: body.isPublic !== false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection('discover_videos').add(videoData);

    return NextResponse.json({
      success: true,
      id: docRef.id,
      message: 'Video created successfully',
    });
  } catch (error) {
    console.error('[ADMIN_VIDEOS_POST] Error:', error);
    return NextResponse.json({ error: 'Failed to create video' }, { status: 500 });
  }
}
