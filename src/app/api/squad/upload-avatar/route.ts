import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getStorage } from 'firebase-admin/storage';

/**
 * POST /api/squad/upload-avatar
 * Upload a squad avatar image to Firebase Storage
 * 
 * Expects: multipart/form-data with 'file' field
 * Returns: { avatarUrl: string }
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get user's current squad
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    const squadId = userData?.squadId;

    if (!squadId) {
      return NextResponse.json({ error: 'You are not in a squad' }, { status: 400 });
    }

    // Verify user is a member of this squad
    const membershipSnapshot = await adminDb.collection('squadMembers')
      .where('squadId', '==', squadId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (membershipSnapshot.empty) {
      return NextResponse.json({ error: 'You are not a member of this squad' }, { status: 403 });
    }

    // Parse FormData
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Get file extension
    const extension = file.type.split('/')[1] || 'jpg';
    const filename = `squad-avatars/${squadId}/${Date.now()}.${extension}`;

    // Upload to Firebase Storage
    let bucket;
    try {
      const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      if (!bucketName) {
        console.error('[SQUAD_UPLOAD_STORAGE] Missing NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET env var');
        return NextResponse.json({ error: 'Storage bucket not configured' }, { status: 500 });
      }
      bucket = getStorage().bucket(bucketName);
    } catch (storageError) {
      console.error('[SQUAD_UPLOAD_STORAGE_INIT_ERROR]', storageError);
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
    }

    const fileRef = bucket.file(filename);

    try {
      await fileRef.save(buffer, {
        metadata: {
          contentType: file.type,
          cacheControl: 'public, max-age=31536000',
        },
      });

      // Make the file publicly accessible
      await fileRef.makePublic();
    } catch (uploadError) {
      console.error('[SQUAD_UPLOAD_FILE_ERROR]', uploadError);
      return NextResponse.json({ error: 'Failed to upload file to storage' }, { status: 500 });
    }

    // Get the public URL
    const avatarUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

    return NextResponse.json({ 
      success: true,
      avatarUrl,
    });
  } catch (error) {
    console.error('[SQUAD_UPLOAD_AVATAR_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

