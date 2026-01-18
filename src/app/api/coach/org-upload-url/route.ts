import { NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';

/**
 * POST /api/coach/org-upload-url
 * Generate a signed URL for direct-to-Firebase-Storage uploads
 *
 * This bypasses Vercel's 4.5MB serverless function body limit by allowing
 * clients to upload directly to Firebase Storage.
 *
 * Expects: JSON body with:
 *   - filename: string (original filename)
 *   - contentType: string (MIME type)
 *   - folder: 'events' | 'articles' | 'courses' | 'courses/lessons' | 'programs' | 'squads'
 *
 * Returns: { uploadUrl: string, publicUrl: string, storagePath: string }
 */
export async function POST(req: Request) {
  try {
    // Step 1: Authenticate user and verify coach access with organization
    const { userId, organizationId, role, orgRole } = await requireCoachWithOrg();

    console.log('[ORG_UPLOAD_URL] User:', userId, 'Role:', role, 'OrgRole:', orgRole, 'OrgId:', organizationId);

    // Step 2: Parse JSON body
    let body: { filename: string; contentType: string; folder: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { filename, contentType, folder } = body;

    if (!filename || !contentType || !folder) {
      return NextResponse.json({ error: 'Missing required fields: filename, contentType, folder' }, { status: 400 });
    }

    // Step 3: Validate folder
    const validFolders = ['events', 'articles', 'courses', 'courses/lessons', 'images', 'programs', 'squads'];
    if (!validFolders.includes(folder)) {
      return NextResponse.json({ error: 'Invalid folder specified' }, { status: 400 });
    }

    // Step 4: Validate content type (only allow videos for direct upload)
    if (!contentType.startsWith('video/')) {
      return NextResponse.json({ error: 'Direct upload only supported for videos' }, { status: 400 });
    }

    // Step 5: Check storage bucket config
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      console.error('[ORG_UPLOAD_URL] Missing NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET env var');
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
    }

    // Step 6: Initialize Firebase Admin Storage
    let bucket;
    try {
      const { getStorage } = await import('firebase-admin/storage');
      await import('@/lib/firebase-admin');
      bucket = getStorage().bucket(bucketName);
    } catch (initError) {
      console.error('[ORG_UPLOAD_URL] Firebase init error:', initError);
      return NextResponse.json({ error: 'Storage service unavailable' }, { status: 500 });
    }

    // Step 7: Generate storage path and signed URL
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

      console.log('[ORG_UPLOAD_URL] Generated signed URL for:', storagePath);

      return NextResponse.json({
        success: true,
        uploadUrl,
        publicUrl,
        storagePath,
      });
    } catch (signError) {
      console.error('[ORG_UPLOAD_URL] Failed to generate signed URL:', signError);
      return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
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

    return NextResponse.json({
      error: 'Internal server error',
      details: message
    }, { status: 500 });
  }
}
