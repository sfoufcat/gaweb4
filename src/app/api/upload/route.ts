import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import sharp from 'sharp';
import { createBunnyVideo, uploadVideoBuffer, getPlaybackUrl } from '@/lib/bunny-stream';
import { uploadToBunnyStorage, isBunnyStorageConfigured } from '@/lib/bunny-storage';

/**
 * POST /api/upload
 * Generic media upload endpoint for authenticated users
 * Used by feed posts, stories, coach recordings, and other user-generated content
 *
 * ROUTING:
 * - Videos → Bunny Stream (auto-compression, CDN delivery)
 * - Images → Firebase Storage (sharp compression)
 * - Audio → Firebase Storage (no processing)
 *
 * Images are automatically compressed using sharp:
 * - Max width: 2000px (maintains aspect ratio)
 * - Quality: 80%
 * - Format preserved (JPEG, PNG, WebP)
 *
 * Videos are uploaded to Bunny Stream:
 * - Auto-compression and transcoding
 * - CDN delivery via Bunny CDN
 * - Returns immediately with bunnyVideoId (encoding happens async)
 *
 * Expects: multipart/form-data with:
 *   - file: File
 *
 * Returns:
 *   - For images/audio: { success: true, url: string }
 *   - For videos: { success: true, url: string, bunnyVideoId: string, status: 'encoding' }
 */
export async function POST(req: Request) {
  try {
    // Step 1: Authenticate user
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Parse FormData
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (formError) {
      console.error('[UPLOAD] FormData parse error:', formError);
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
    }
    
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Step 3: Validate file type
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');

    if (!isImage && !isVideo && !isAudio) {
      return NextResponse.json({ error: 'File must be an image, video, or audio' }, { status: 400 });
    }

    // Step 4: Validate file size (10MB for images, 100MB for videos, 500MB for audio)
    const maxSize = isAudio ? 500 * 1024 * 1024 : isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      return NextResponse.json({ error: `File size must be less than ${maxSizeMB}MB` }, { status: 400 });
    }

    // Step 5: Route videos to Bunny Stream
    if (isVideo) {
      try {
        // Get file as ArrayBuffer for Bunny upload
        const arrayBuffer = await file.arrayBuffer();

        // Create video in Bunny and upload
        const timestamp = Date.now();
        const videoTitle = `${userId}_${timestamp}_${file.name}`;
        const { videoId } = await createBunnyVideo(videoTitle);

        await uploadVideoBuffer(videoId, arrayBuffer);

        // Return immediately - Bunny will encode async and webhook will fire when ready
        const playbackUrl = getPlaybackUrl(videoId);

        console.log(`[UPLOAD] Video uploaded to Bunny: ${videoId}, user: ${userId}`);

        return NextResponse.json({
          success: true,
          url: playbackUrl, // HLS playback URL (will work after encoding)
          bunnyVideoId: videoId,
          status: 'encoding', // Video is being processed
        });
      } catch (bunnyError) {
        console.error('[UPLOAD] Bunny upload error:', bunnyError);
        // Fall back to Firebase if Bunny fails
        console.log('[UPLOAD] Falling back to Firebase for video');
      }
    }

    // Step 6: Check storage bucket config (for images, audio, and video fallback)
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      console.error('[UPLOAD] Missing NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET env var');
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
    }

    // Step 6: Initialize Firebase Admin Storage
    let bucket;
    try {
      const { getStorage } = await import('firebase-admin/storage');
      await import('@/lib/firebase-admin');
      bucket = getStorage().bucket(bucketName);
    } catch (initError) {
      console.error('[UPLOAD] Firebase init error:', initError);
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
      console.error('[UPLOAD] Buffer conversion error:', bufferError);
      return NextResponse.json({ error: 'Failed to process file' }, { status: 500 });
    }

    // Step 8: Compress images with sharp
    let finalContentType = file.type;
    if (isImage && file.type !== 'image/svg+xml' && file.type !== 'image/gif') {
      try {
        const imageInfo = await sharp(buffer).metadata();
        const maxWidth = 2000; // Increased to support 1600x800 cover images
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
        console.log(`[UPLOAD] Compressed image: ${originalSize} → ${buffer.length} bytes (${savingsPercent}% smaller)`);
      } catch (compressError) {
        console.error('[UPLOAD] Image compression error (using original):', compressError);
        // Continue with original buffer if compression fails
      }
    }

    // Step 9: Create unique filename and upload
    // Store under users/{userId}/uploads/ for images/videos, recordings/ for audio
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const folder = isAudio ? 'recordings' : 'uploads';
    const storagePath = `users/${userId}/${folder}/${timestamp}-${sanitizedName}`;

    let url: string;

    // Use Bunny Storage for images if configured, Firebase for audio/video fallback
    if (isImage && isBunnyStorageConfigured()) {
      try {
        url = await uploadToBunnyStorage(buffer, storagePath, finalContentType);
        console.log('[UPLOAD] Uploaded to Bunny Storage:', url);
      } catch (bunnyError) {
        console.error('[UPLOAD] Bunny Storage error:', bunnyError);
        return NextResponse.json({ error: 'Failed to upload file to storage' }, { status: 500 });
      }
    } else {
      // Firebase Storage for audio or when Bunny not configured
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
        url = `https://storage.googleapis.com/${bucketName}/${storagePath}`;
        console.log('[UPLOAD] Uploaded to Firebase:', url);
      } catch (uploadError) {
        console.error('[UPLOAD] Firebase save error:', uploadError);
        return NextResponse.json({ error: 'Failed to upload file to storage' }, { status: 500 });
      }
    }

    // Step 10: Return success with URL
    console.log('[UPLOAD] Success:', url);

    return NextResponse.json({ 
      success: true,
      url,
    });
  } catch (error) {
    console.error('[UPLOAD] Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

