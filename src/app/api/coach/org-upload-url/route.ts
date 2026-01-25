import { NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { createBunnyVideo, getOrCreateCollection, generateTusUploadConfig } from '@/lib/bunny-stream';
import { isBunnyStorageConfigured } from '@/lib/bunny-storage';

/**
 * POST /api/coach/org-upload-url
 * Generate upload configuration for direct uploads
 *
 * Routes video/audio to Bunny Stream (cheaper, auto-compression)
 * Routes other files to Firebase Storage (simple, no processing)
 *
 * Expects: JSON body with:
 *   - filename: string (original filename)
 *   - contentType: string (MIME type)
 *   - folder: 'events' | 'articles' | 'courses' | 'courses/lessons' | 'programs' | 'squads'
 *
 * Returns for videos (Bunny):
 *   - uploadType: 'bunny'
 *   - videoId: Bunny video ID
 *   - tusEndpoint: TUS upload endpoint
 *   - tusHeaders: Headers for TUS upload
 *
 * Returns for other files (Firebase):
 *   - uploadType: 'firebase'
 *   - uploadUrl: Signed URL for PUT
 *   - publicUrl: Public URL after upload
 *   - storagePath: Path in storage
 */
export async function POST(req: Request) {
  try {
    // Step 1: Authenticate user and verify coach access with organization
    const { userId, organizationId, role, orgRole } = await requireCoachWithOrg();

    console.log(
      '[ORG_UPLOAD_URL] User:',
      userId,
      'Role:',
      role,
      'OrgRole:',
      orgRole,
      'OrgId:',
      organizationId
    );

    // Step 2: Parse JSON body
    let body: { filename: string; contentType: string; folder: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { filename, contentType, folder } = body;

    if (!filename || !contentType || !folder) {
      return NextResponse.json(
        { error: 'Missing required fields: filename, contentType, folder' },
        { status: 400 }
      );
    }

    // Step 3: Validate folder
    const validFolders = [
      'events',
      'articles',
      'courses',
      'courses/lessons',
      'images',
      'programs',
      'squads',
      'websites',
    ];
    if (!validFolders.includes(folder)) {
      return NextResponse.json({ error: 'Invalid folder specified' }, { status: 400 });
    }

    // Step 4: Route based on content type
    const isVideo = contentType.startsWith('video/');
    const isAudio = contentType.startsWith('audio/');
    const isImage = contentType.startsWith('image/');

    if (isVideo || isAudio) {
      // Use Bunny Stream for video/audio
      try {
        const collectionId = await getOrCreateCollection(organizationId);
        const timestamp = Date.now();
        const videoTitle = `${folder}/${timestamp}_${filename}`;

        const { videoId } = await createBunnyVideo(videoTitle, collectionId);

        // Generate TUS upload configuration with proper SHA256 signature
        const tusConfig = await generateTusUploadConfig(videoId);

        console.log(
          `[ORG_UPLOAD_URL] Created Bunny video ${videoId} for: ${filename}, folder: ${folder}, org: ${organizationId}`
        );

        return NextResponse.json({
          success: true,
          uploadType: 'bunny',
          videoId,
          tusEndpoint: tusConfig.endpoint,
          tusHeaders: tusConfig.headers,
          // Note: URL will be available after Bunny encodes the video
        });
      } catch (bunnyError) {
        console.error('[ORG_UPLOAD_URL] Bunny error:', bunnyError);
        return NextResponse.json(
          { error: 'Failed to create video upload' },
          { status: 500 }
        );
      }
    } else if (isBunnyStorageConfigured()) {
      // Use Bunny Storage for images and documents (12x cheaper bandwidth than Firebase)
      // Return uploadType: 'bunny-storage' to signal client should use server upload
      const timestamp = Date.now();
      const sanitizedName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `orgs/${organizationId}/discover/${folder}/${timestamp}-${sanitizedName}`;

      console.log('[ORG_UPLOAD_URL] Bunny Storage path for file:', storagePath, 'type:', contentType);

      return NextResponse.json({
        success: true,
        uploadType: 'bunny-storage',
        storagePath,
        // Client should use /api/coach/org-upload-media for actual upload
      });
    } else {
      // Fallback to Firebase Storage when Bunny not configured
      const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      if (!bucketName) {
        console.error('[ORG_UPLOAD_URL] Missing NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET env var');
        return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
      }

      let bucket;
      try {
        const { getStorage } = await import('firebase-admin/storage');
        await import('@/lib/firebase-admin');
        bucket = getStorage().bucket(bucketName);
      } catch (initError) {
        console.error('[ORG_UPLOAD_URL] Firebase init error:', initError);
        return NextResponse.json({ error: 'Storage service unavailable' }, { status: 500 });
      }

      const timestamp = Date.now();
      const sanitizedName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `orgs/${organizationId}/discover/${folder}/${timestamp}-${sanitizedName}`;
      const fileRef = bucket.file(storagePath);

      try {
        const [uploadUrl] = await fileRef.getSignedUrl({
          action: 'write',
          version: 'v4',
          expires: Date.now() + 15 * 60 * 1000, // 15 minutes
          contentType,
        });

        const publicUrl = `https://storage.googleapis.com/${bucketName}/${storagePath}`;

        console.log('[ORG_UPLOAD_URL] Generated Firebase signed URL for:', storagePath);

        return NextResponse.json({
          success: true,
          uploadType: 'firebase',
          uploadUrl,
          publicUrl,
          storagePath,
        });
      } catch (signError) {
        console.error('[ORG_UPLOAD_URL] Failed to generate signed URL:', signError);
        return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
      }
    }
  } catch (error) {
    console.error('[ORG_UPLOAD_URL] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    if (message.includes('Organization not found')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: message,
      },
      { status: 500 }
    );
  }
}
