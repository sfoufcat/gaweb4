/**
 * Get Upload URL API
 *
 * Returns upload configuration for direct upload to Bunny Stream (video/audio)
 * or Bunny Storage (PDFs and other documents).
 *
 * Video/audio files → Bunny Stream (cheaper, auto-compression)
 * PDFs/documents → Bunny Storage (cheaper than Firebase, 12x bandwidth savings)
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { createBunnyVideo, getOrCreateCollection, generateTusUploadConfig } from '@/lib/bunny-stream';
import { isBunnyStorageConfigured, getBunnyStorageUrl } from '@/lib/bunny-storage';
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

      const { videoId } = await createBunnyVideo(videoTitle, collectionId);

      // Generate TUS upload configuration with proper SHA256 signature
      const tusConfig = await generateTusUploadConfig(videoId);

      console.log(
        `[RECORDING_UPLOAD] Created Bunny video ${videoId} for: ${fileName}, org: ${organizationId}`
      );

      return NextResponse.json({
        uploadType: 'bunny',
        videoId,
        tusEndpoint: tusConfig.endpoint,
        tusHeaders: tusConfig.headers,
        // Recording URL will be set by webhook after encoding completes
      });
    } else {
      // Use Bunny Storage for PDFs and other documents (12x cheaper bandwidth)
      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `orgs/${organizationId}/recordings/${timestamp}-${sanitizedFileName}`;

      if (!isBunnyStorageConfigured()) {
        return NextResponse.json(
          { error: 'Storage not configured. Please contact support.' },
          { status: 500 }
        );
      }

      // For Bunny Storage, we return the path and let the client upload via server endpoint
      // since Bunny Storage doesn't support signed URLs for direct PUT
      const downloadUrl = getBunnyStorageUrl(storagePath);

      console.log(
        `[RECORDING_UPLOAD] Generated Bunny Storage path for: ${fileName}, path: ${storagePath}`
      );

      return NextResponse.json({
        uploadType: 'bunny-storage',
        storagePath,
        downloadUrl,
        // Client should use /api/coach/recordings/upload endpoint for actual upload
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
