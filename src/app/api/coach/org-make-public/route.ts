import { NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';

/**
 * POST /api/coach/org-make-public
 * Make a directly-uploaded file publicly accessible
 *
 * After a client uploads a file directly to Firebase Storage via signed URL,
 * this endpoint makes the file publicly readable.
 *
 * Expects: JSON body with:
 *   - storagePath: string (the storage path returned from /api/coach/org-upload-url)
 *
 * Returns: { success: true }
 */
export async function POST(req: Request) {
  try {
    // Step 1: Authenticate user and verify coach access with organization
    const { userId, organizationId, role, orgRole } = await requireCoachWithOrg();

    console.log('[ORG_MAKE_PUBLIC] User:', userId, 'Role:', role, 'OrgRole:', orgRole, 'OrgId:', organizationId);

    // Step 2: Parse JSON body
    let body: { storagePath: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { storagePath } = body;

    if (!storagePath) {
      return NextResponse.json({ error: 'Missing required field: storagePath' }, { status: 400 });
    }

    // Step 3: Validate that the path belongs to this organization
    const expectedPrefix = `orgs/${organizationId}/`;
    if (!storagePath.startsWith(expectedPrefix)) {
      console.warn('[ORG_MAKE_PUBLIC] Path mismatch:', storagePath, 'expected prefix:', expectedPrefix);
      return NextResponse.json({ error: 'Invalid storage path for this organization' }, { status: 403 });
    }

    // Step 4: Check storage bucket config
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      console.error('[ORG_MAKE_PUBLIC] Missing NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET env var');
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
    }

    // Step 5: Initialize Firebase Admin Storage
    let bucket;
    try {
      const { getStorage } = await import('firebase-admin/storage');
      await import('@/lib/firebase-admin');
      bucket = getStorage().bucket(bucketName);
    } catch (initError) {
      console.error('[ORG_MAKE_PUBLIC] Firebase init error:', initError);
      return NextResponse.json({ error: 'Storage service unavailable' }, { status: 500 });
    }

    // Step 6: Make the file public
    const fileRef = bucket.file(storagePath);

    try {
      // Check if file exists first
      const [exists] = await fileRef.exists();
      if (!exists) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }

      await fileRef.makePublic();
      console.log('[ORG_MAKE_PUBLIC] Made public:', storagePath);

      return NextResponse.json({ success: true });
    } catch (makePublicError) {
      console.error('[ORG_MAKE_PUBLIC] Failed to make file public:', makePublicError);
      return NextResponse.json({ error: 'Failed to make file public' }, { status: 500 });
    }
  } catch (error) {
    console.error('[ORG_MAKE_PUBLIC] Unexpected error:', error);
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
