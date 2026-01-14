/**
 * Get Signed Upload URL API
 *
 * Returns a signed URL for direct upload to Firebase Storage.
 * This bypasses Vercel's 4.5MB body size limit for serverless functions.
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { adminStorage } from '@/lib/firebase-admin';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { UserRole, OrgRole, ClerkPublicMetadata } from '@/types';

// Accepted file extensions
const VALID_EXTENSIONS = ['.mp3', '.m4a', '.wav', '.webm', '.ogg', '.mp4', '.mov', '.pdf'];

// Max file size: 500MB
const MAX_FILE_SIZE = 500 * 1024 * 1024;

/**
 * POST /api/coach/recordings/get-upload-url
 *
 * Get a signed URL for direct upload to Firebase Storage.
 *
 * Request body:
 * - fileName: Original file name
 * - fileType: MIME type
 * - fileSize: File size in bytes
 *
 * Returns:
 * - uploadUrl: Signed URL for PUT upload
 * - storagePath: Path in Firebase Storage (needed for processing step)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata & { role?: UserRole; orgRole?: OrgRole };
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

    // Generate unique file path
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `organizations/${organizationId}/recordings/${timestamp}_${sanitizedFileName}`;

    // Get signed URL for upload
    const bucket = adminStorage.bucket();
    const fileRef = bucket.file(storagePath);

    // Generate signed URL for PUT upload (expires in 15 minutes)
    const [uploadUrl] = await fileRef.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType: fileType,
    });

    console.log(`[RECORDING_UPLOAD] Generated signed URL for: ${fileName}, path: ${storagePath}`);

    return NextResponse.json({
      uploadUrl,
      storagePath,
      bucketName: bucket.name,
    });
  } catch (error) {
    console.error('[RECORDING_UPLOAD] Error generating signed URL:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}
