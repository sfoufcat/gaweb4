import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { ensureCoachHasOrganization } from '@/lib/clerk-organizations';
import sharp from 'sharp';
import type { UserRole } from '@/types';

/**
 * POST /api/org/branding/logo
 * Upload organization logo
 * 
 * Images are automatically:
 * - Resized to max 512x512 (maintains aspect ratio)
 * - Compressed to 80% quality
 * - Stored in Firebase Storage
 * 
 * Expects: multipart/form-data with:
 *   - file: File (image)
 * 
 * Returns: { url: string, originalSize?: number, compressedSize?: number }
 */
export async function POST(req: Request) {
  try {
    // Step 1: Authenticate user
    let userId: string | null = null;
    let sessionClaims: Record<string, unknown> | null = null;
    
    try {
      const authResult = await auth();
      userId = authResult.userId;
      sessionClaims = authResult.sessionClaims as Record<string, unknown> | null;
    } catch (authError) {
      console.error('[ORG_LOGO_UPLOAD] Auth error:', authError);
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized - not logged in' }, { status: 401 });
    }

    // Step 2: Check permissions (coach, admin, super_admin)
    const publicMetadata = sessionClaims?.publicMetadata as { role?: UserRole } | undefined;
    const role = publicMetadata?.role;
    
    if (!canAccessCoachDashboard(role)) {
      console.log('[ORG_LOGO_UPLOAD] Permission denied for role:', role);
      return NextResponse.json({ 
        error: 'Insufficient permissions',
        details: `Role '${role || 'undefined'}' cannot upload logo. Required: coach, admin, or super_admin`
      }, { status: 403 });
    }

    // Step 3: Ensure user has an organization
    const organizationId = await ensureCoachHasOrganization(userId);

    // Step 4: Parse FormData
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (formError) {
      console.error('[ORG_LOGO_UPLOAD] FormData parse error:', formError);
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
    }
    
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Step 5: Validate file type
    const isImage = file.type.startsWith('image/');
    
    if (!isImage) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Step 6: Validate file size (5MB max for logos)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 });
    }

    // Step 7: Check storage bucket config
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      console.error('[ORG_LOGO_UPLOAD] Missing NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET env var');
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
    }

    // Step 8: Initialize Firebase Admin Storage
    let bucket;
    try {
      const { getStorage } = await import('firebase-admin/storage');
      await import('@/lib/firebase-admin');
      bucket = getStorage().bucket(bucketName);
    } catch (initError) {
      console.error('[ORG_LOGO_UPLOAD] Firebase init error:', initError);
      return NextResponse.json({ error: 'Storage service unavailable' }, { status: 500 });
    }

    // Step 9: Convert file to buffer
    let buffer: Buffer;
    let originalSize: number = 0;
    try {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      originalSize = buffer.length;
    } catch (bufferError) {
      console.error('[ORG_LOGO_UPLOAD] Buffer conversion error:', bufferError);
      return NextResponse.json({ error: 'Failed to process file' }, { status: 500 });
    }

    // Step 10: Resize and compress logo
    let finalContentType = file.type;
    if (file.type !== 'image/svg+xml' && file.type !== 'image/gif') {
      try {
        const maxDimension = 512;
        const quality = 80;

        let sharpInstance = sharp(buffer);
        
        // Resize to max 512x512 (maintaining aspect ratio)
        sharpInstance = sharpInstance.resize(maxDimension, maxDimension, {
          withoutEnlargement: true,
          fit: 'inside',
        });

        // Compress based on format - prefer PNG for logos (transparency support)
        if (file.type === 'image/png' || file.type === 'image/webp') {
          buffer = await sharpInstance.png({ quality, compressionLevel: 9 }).toBuffer();
          finalContentType = 'image/png';
        } else {
          // JPEG for everything else
          buffer = await sharpInstance.jpeg({ quality, mozjpeg: true }).toBuffer();
          finalContentType = 'image/jpeg';
        }

        const savings = originalSize - buffer.length;
        const savingsPercent = ((savings / originalSize) * 100).toFixed(1);
        console.log(`[ORG_LOGO_UPLOAD] Compressed logo: ${originalSize} → ${buffer.length} bytes (${savingsPercent}% smaller)`);
      } catch (compressError) {
        console.error('[ORG_LOGO_UPLOAD] Image compression error (using original):', compressError);
        // Continue with original buffer if compression fails
      }
    }

    // Step 11: Create unique filename and upload
    const timestamp = Date.now();
    const extension = finalContentType === 'image/png' ? 'png' : 
                      finalContentType === 'image/jpeg' ? 'jpg' : 
                      finalContentType === 'image/webp' ? 'webp' : 
                      file.name.split('.').pop() || 'png';
    const storagePath = `org-branding/${organizationId}/logo-${timestamp}.${extension}`;
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
      console.error('[ORG_LOGO_UPLOAD] File save error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload file to storage' }, { status: 500 });
    }

    // Step 12: Return success with URL
    const url = `https://storage.googleapis.com/${bucketName}/${storagePath}`;
    console.log('[ORG_LOGO_UPLOAD] Success:', url);

    return NextResponse.json({ 
      success: true,
      url,
      organizationId,
      originalSize,
      compressedSize: buffer.length,
    });
  } catch (error) {
    console.error('[ORG_LOGO_UPLOAD] Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
