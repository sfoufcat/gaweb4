import { NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import sharp from 'sharp';

/**
 * POST /api/coach/org-upload-media
 * Server-side media upload for coach panel (articles, events, courses, quizzes)
 * Uses Firebase Admin SDK - no client-side Firebase auth required
 * 
 * This endpoint is accessible on tenant domains (subdomains)
 * Unlike /api/admin/upload-media which is platform-only
 * 
 * Images are automatically compressed using sharp:
 * - Max width: 1200px (maintains aspect ratio)
 * - Quality: 80%
 * - Format preserved (JPEG, PNG, WebP)
 * 
 * Expects: multipart/form-data with:
 *   - file: File
 *   - folder: 'events' | 'articles' | 'courses' | 'courses/lessons' | 'images'
 * 
 * Returns: { url: string, originalSize?: number, compressedSize?: number }
 */
export async function POST(req: Request) {
  // Wrap everything in try-catch to ensure JSON responses
  try {
    // Step 1: Authenticate user and verify coach access with organization
    const { userId, organizationId, role, orgRole } = await requireCoachWithOrg();
    
    console.log('[COACH_UPLOAD] User:', userId, 'Role:', role, 'OrgRole:', orgRole, 'OrgId:', organizationId);

    // Step 2: Parse FormData
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (formError) {
      console.error('[COACH_UPLOAD] FormData parse error:', formError);
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
    }
    
    const file = formData.get('file') as File | null;
    const folder = formData.get('folder') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!folder || !['events', 'articles', 'courses', 'courses/lessons', 'images', 'programs', 'squads'].includes(folder)) {
      return NextResponse.json({ error: 'Invalid folder specified' }, { status: 400 });
    }

    // Step 3: Validate file type
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
      return NextResponse.json({ error: 'File must be an image or video' }, { status: 400 });
    }

    // Step 4: Validate file size (10MB for images, 500MB for videos)
    const maxSize = isVideo ? 500 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      return NextResponse.json({ error: `File size must be less than ${maxSizeMB}MB` }, { status: 400 });
    }

    // Step 5: Check storage bucket config
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      console.error('[COACH_UPLOAD] Missing NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET env var');
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
    }

    // Step 6: Initialize Firebase Admin Storage (lazy import to catch init errors)
    let bucket;
    try {
      // Dynamic import to catch any initialization errors
      const { getStorage } = await import('firebase-admin/storage');
      // Ensure firebase-admin is initialized
      await import('@/lib/firebase-admin');
      bucket = getStorage().bucket(bucketName);
    } catch (initError) {
      console.error('[COACH_UPLOAD] Firebase init error:', initError);
      return NextResponse.json({ error: 'Storage service unavailable' }, { status: 500 });
    }

    // Step 7: Convert file to buffer
    let buffer: Buffer;
    let originalSize: number = 0;
    try {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      originalSize = buffer.length;
    } catch (bufferError) {
      console.error('[COACH_UPLOAD] Buffer conversion error:', bufferError);
      return NextResponse.json({ error: 'Failed to process file' }, { status: 500 });
    }

    // Step 8: Compress images with sharp
    let finalContentType = file.type;
    if (isImage && file.type !== 'image/svg+xml' && file.type !== 'image/gif') {
      try {
        const imageInfo = await sharp(buffer).metadata();
        const maxWidth = 1200;
        const quality = 80;

        let sharpInstance = sharp(buffer);
        
        // Resize if wider than maxWidth
        if (imageInfo.width && imageInfo.width > maxWidth) {
          sharpInstance = sharpInstance.resize(maxWidth, null, {
            withoutEnlargement: true,
            fit: 'inside',
          });
        }

        // Compress based on format
        if (file.type === 'image/png') {
          buffer = await sharpInstance.png({ quality, compressionLevel: 9 }).toBuffer();
        } else if (file.type === 'image/webp') {
          buffer = await sharpInstance.webp({ quality }).toBuffer();
        } else {
          // JPEG for everything else
          buffer = await sharpInstance.jpeg({ quality, mozjpeg: true }).toBuffer();
          finalContentType = 'image/jpeg';
        }

        const savings = originalSize - buffer.length;
        const savingsPercent = ((savings / originalSize) * 100).toFixed(1);
        console.log(`[COACH_UPLOAD] Compressed image: ${originalSize} → ${buffer.length} bytes (${savingsPercent}% smaller)`);
      } catch (compressError) {
        console.error('[COACH_UPLOAD] Image compression error (using original):', compressError);
        // Continue with original buffer if compression fails
      }
    }

    // Step 9: Create unique filename and upload
    // Scope uploads to organization folder for multi-tenancy
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `orgs/${organizationId}/discover/${folder}/${timestamp}-${sanitizedName}`;
    const fileRef = bucket.file(storagePath);

    try {
      await fileRef.save(buffer, {
        metadata: {
          contentType: finalContentType,
          cacheControl: 'public, max-age=31536000',
        },
      });

      // Make the file publicly accessible
      await fileRef.makePublic();
    } catch (uploadError) {
      console.error('[COACH_UPLOAD] File save error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload file to storage' }, { status: 500 });
    }

    // Step 10: Return success with URL
    const url = `https://storage.googleapis.com/${bucketName}/${storagePath}`;
    console.log('[COACH_UPLOAD] Success:', url);

    return NextResponse.json({ 
      success: true,
      url,
      originalSize: isImage ? originalSize : undefined,
      compressedSize: isImage ? buffer.length : undefined,
    });
  } catch (error) {
    // Catch-all for any unexpected errors
    console.error('[COACH_UPLOAD] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    // Handle specific auth errors
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    if (message.includes('Organization not found')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: message
    }, { status: 500 });
  }
}

