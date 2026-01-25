/**
 * Get Upload URL for Discover Videos
 *
 * Returns upload configuration for direct upload to Bunny Stream.
 * Used by coaches to upload video content for the Discover section.
 *
 * POST /api/coach/discover-videos/get-upload-url
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { createBunnyVideo, getOrCreateCollection, generateTusUploadConfig } from '@/lib/bunny-stream';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { UserRole, OrgRole, ClerkPublicMetadata } from '@/types';

// Accepted video extensions
const VALID_EXTENSIONS = ['.mp4', '.mov', '.webm', '.mkv', '.avi'];

// Max file size: 2GB for premium video content
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

/**
 * POST /api/coach/discover-videos/get-upload-url
 *
 * Get upload configuration for direct video upload to Bunny Stream.
 *
 * Request body:
 * - fileName: Original file name
 * - fileSize: File size in bytes
 * - isPreview?: boolean - If true, this is a preview/trailer video
 *
 * Returns:
 * - videoId: Bunny video ID (store this to track encoding status)
 * - tusEndpoint: TUS upload endpoint
 * - tusHeaders: Headers for TUS upload
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata & {
      role?: UserRole;
      orgRole?: OrgRole;
    };
    const role = publicMetadata?.role;
    const orgRole = publicMetadata?.orgRole;

    if (!canAccessCoachDashboard(role, orgRole)) {
      return NextResponse.json({ error: 'Coach access required' }, { status: 403 });
    }

    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const body = await request.json();
    const { fileName, fileSize, isPreview = false } = body;

    if (!fileName || !fileSize) {
      return NextResponse.json({ error: 'fileName and fileSize are required' }, { status: 400 });
    }

    // Validate file extension
    const fileExtension = '.' + fileName.split('.').pop()?.toLowerCase();
    if (!VALID_EXTENSIONS.includes(fileExtension)) {
      return NextResponse.json(
        { error: `Invalid file type. Accepted formats: ${VALID_EXTENSIONS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 2GB.' }, { status: 400 });
    }

    // Create video in Bunny Stream with org collection for multi-tenancy
    // Use 'discover-videos' prefix to distinguish from recordings/courses
    const collectionId = await getOrCreateCollection(`${organizationId}-discover`);
    const timestamp = Date.now();
    const prefix = isPreview ? 'preview' : 'video';
    const videoTitle = `${prefix}_${timestamp}_${fileName}`;

    const { videoId } = await createBunnyVideo(videoTitle, collectionId);

    // Generate TUS upload configuration with proper SHA256 signature
    const tusConfig = await generateTusUploadConfig(videoId);

    // Create placeholder document in discover_videos so webhook can find it
    // This prevents race condition where webhook fires before user completes wizard
    let discoverVideoId: string | null = null;
    if (!isPreview) {
      const placeholderDoc = await adminDb.collection('discover_videos').add({
        bunnyVideoId: videoId,
        videoStatus: 'uploading',
        organizationId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      discoverVideoId = placeholderDoc.id;
      console.log(
        `[DISCOVER_VIDEO_UPLOAD] Created placeholder doc ${discoverVideoId} for Bunny video ${videoId}`
      );
    }

    console.log(
      `[DISCOVER_VIDEO_UPLOAD] Created Bunny video ${videoId} for: ${fileName}, org: ${organizationId}, isPreview: ${isPreview}`
    );

    return NextResponse.json({
      videoId,
      discoverVideoId,
      tusEndpoint: tusConfig.endpoint,
      tusHeaders: tusConfig.headers,
      isPreview,
    });
  } catch (error) {
    console.error('[DISCOVER_VIDEO_UPLOAD] Error generating upload URL:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}
