import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getStreamServerClient } from '@/lib/stream-server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * POST /api/user/sync-stream
 * 
 * Explicitly syncs the current user's profile to Stream Chat AND Firebase.
 * Called after profile updates to ensure chat/feed shows the latest data.
 * 
 * This handles the race condition where Clerk's setProfileImage()
 * returns before the imageUrl is fully updated on their backend.
 * By calling this AFTER user.reload(), we ensure Stream and Firebase get the correct URL.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Parse optional body data (may include pre-fetched imageUrl from client)
    let bodyData: { name?: string; imageUrl?: string } = {};
    try {
      bodyData = await req.json();
    } catch {
      // Empty body is fine
    }

    // Get the latest Clerk user data as fallback
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);
    
    // Get Firebase user data for the display name
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const firebaseUser = userDoc.data();

    // Build display name: prefer body name, then Firebase name, then Clerk name
    const displayName = bodyData.name 
      || firebaseUser?.name 
      || `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() 
      || 'User';
    
    // CRITICAL: Use the imageUrl from body if provided (freshly reloaded from client)
    // The client calls user.reload() AFTER setProfileImage, so it has the latest URL
    // Server-side clerkClient().users.getUser() might have stale data due to caching
    const imageUrl = bodyData.imageUrl || clerkUser.imageUrl || undefined;

    console.log('[SYNC_STREAM] Syncing user profile:', {
      userId,
      name: displayName,
      imageUrlFromBody: !!bodyData.imageUrl,
      imageUrl: imageUrl?.substring(0, 80),
    });

    // Update Firebase with the new imageUrl
    // This ensures the feed (which reads from Firebase) shows the correct image
    if (imageUrl && imageUrl !== firebaseUser?.imageUrl) {
      await userRef.set({
        imageUrl: imageUrl,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      console.log('[SYNC_STREAM] Updated Firebase imageUrl');
    }

    // Sync to Stream Chat
    const streamClient = await getStreamServerClient();
    await streamClient.upsertUser({
      id: userId,
      name: displayName,
      image: imageUrl,
    });

    console.log('[SYNC_STREAM] Successfully synced to Stream');

    return NextResponse.json({ 
      success: true,
      synced: {
        name: displayName,
        hasImage: !!imageUrl,
        firebaseUpdated: imageUrl !== firebaseUser?.imageUrl,
      }
    });
  } catch (error) {
    console.error('[SYNC_STREAM_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

