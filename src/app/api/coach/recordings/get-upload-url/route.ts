/**
 * Get Upload URL API
 *
 * Returns upload configuration for direct upload to Bunny Stream (video/audio)
 * or Firebase Storage (PDFs and other documents).
 *
 * Video/audio files → Bunny Stream (cheaper, auto-compression)
 * PDFs/documents → Firebase Storage (simpler, no processing needed)
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { adminStorage } from '@/lib/firebase-admin';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { createBunnyVideo, getOrCreateCollection } from '@/lib/bunny-stream';
import type { UserRole, OrgRole, ClerkPublicMetadata } from '@/types';

// Accepted file extensions
const VALID_EXTENSIONS = ['.mp3', '.m4a', '.wav', '.webm', '.ogg', '.mp4', '.mov', '.pdf'];

// Video/audio extensions that go to Bunny
const BUNNY_EXTENSIONS = ['.mp3', '.m4a', '.wav', '.webm', '.ogg', '.mp4', '.mov'];

// Max file size: 500MB
const MAX_FILE_SIZE = 500 * 1024 * 1024;

/**
 * POST /api/coach/recordings/get-upload-url
 *
 * Get upload configuration for direct upload.
 *
 * Request body:
 * - fileName: Original file name
 * - fileType: MIME type
 * - fileSize: File size in bytes
 *
 * Returns for video/audio (Bunny):
 * - uploadType: 'bunny'
 * - tusEndpoint: TUS upload endpoint
 * - tusHeaders: Headers for TUS upload
 * - videoId: Bunny video ID (store this to track encoding status)
 *
 * Returns for PDF/documents (Firebase):
 * - uploadType: 'firebase'
 * - uploadUrl: Signed URL for PUT upload
 * - downloadUrl: Long-lived URL for viewing
 * - storagePath: Path in Firebase Storage
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
    const { fileName, fileType, fileSize } = body;

    if (!fileName || !fileType || !fileSize) {
      return NextResponse.json(
        { error: 'fileName, fileType, and fileSize are required' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: 'File too large. Maximum size is 500MB.' },
        { status: 400 }
      );
    }

    // Route to Bunny Stream for video/audio, Firebase for PDFs
    const useBunny = BUNNY_EXTENSIONS.includes(fileExtension);

    if (useBunny) {
      // Create video in Bunny Stream with org collection for multi-tenancy
      const collectionId = await getOrCreateCollection(organizationId);
      const timestamp = Date.now();
      const videoTitle = `${timestamp}_${fileName}`;

      const { videoId, libraryId } = await createBunnyVideo(videoTitle, collectionId);

      // Generate TUS upload configuration
      const expirationTime = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

      console.log(
        `[RECORDING_UPLOAD] Created Bunny video ${videoId} for: ${fileName}, org: ${organizationId}`
      );

      return NextResponse.json({
        uploadType: 'bunny',
        videoId,
        tusEndpoint: 'https://video.bunnycdn.com/tusupload',
        tusHeaders: {
          AuthorizationSignature: process.env.BUNNY_API_KEY,
          AuthorizationExpire: expirationTime.toString(),
          VideoId: videoId,
          LibraryId: libraryId,
        },
        // Recording URL will be set by webhook after encoding completes
      });
    } else {
      // Use Firebase Storage for PDFs and other documents
      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `organizations/${organizationId}/recordings/${timestamp}_${sanitizedFileName}`;

      const bucket = adminStorage.bucket();
      const fileRef = bucket.file(storagePath);

      // Generate signed URL for PUT upload (expires in 15 minutes)
      const [uploadUrl] = await fileRef.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000,
        contentType: fileType,
      });

      // Generate a long-lived read URL
      const [downloadUrl] = await fileRef.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      console.log(
        `[RECORDING_UPLOAD] Generated Firebase URLs for: ${fileName}, path: ${storagePath}`
      );

      return NextResponse.json({
        uploadType: 'firebase',
        uploadUrl,
        storagePath,
        bucketName: bucket.name,
        downloadUrl,
      });
    }
  } catch (error) {
    console.error('[RECORDING_UPLOAD] Error generating upload URL:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}
