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
 * This handles race conditions where:
 * 1. Clerk's setProfileImage() returns before imageUrl is ready
 * 2. Clerk's user.update() returns before firstName/lastName propagate
 * 3. Clerk webhook is delayed
 * 
 * By calling this AFTER user.reload(), we ensure Stream and Firebase get the correct data.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Parse body data - should include name and imageUrl from freshly reloaded Clerk user
    let bodyData: { name?: string; imageUrl?: string; firstName?: string; lastName?: string } = {};
    try {
      bodyData = await req.json();
    } catch {
      // Empty body is fine
    }

    // Get the latest Clerk user data as fallback
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);
    
    // Get Firebase user data
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const firebaseUser = userDoc.data();

    // Parse the display name into firstName/lastName
    // Prefer body data (from client's freshly updated Clerk user), then server Clerk data
    let firstName = bodyData.firstName || clerkUser.firstName || '';
    let lastName = bodyData.lastName || clerkUser.lastName || '';
    
    // If name was provided but not firstName/lastName, parse it
    if (bodyData.name && !bodyData.firstName) {
      const nameParts = bodyData.name.trim().split(/\s+/);
      firstName = nameParts[0] || firstName;
      lastName = nameParts.slice(1).join(' ') || lastName;
    }

    // Build display name
    const displayName = bodyData.name 
      || `${firstName} ${lastName}`.trim() 
      || firebaseUser?.name 
      || 'User';
    
    // CRITICAL: Use the imageUrl from body if provided (freshly reloaded from client)
    const imageUrl = bodyData.imageUrl || clerkUser.imageUrl || undefined;

    console.log('[SYNC_STREAM] Syncing user profile:', {
      userId,
      name: displayName,
      firstName,
      lastName,
      imageUrlFromBody: !!bodyData.imageUrl,
      imageUrl: imageUrl?.substring(0, 80),
    });

    // Update Firebase with ALL profile fields
    // This ensures the feed (which reads firstName/lastName from Firebase) shows correct data
    const firebaseUpdates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    
    // ALWAYS update name fields when provided from body (user just saved their profile)
    // Don't compare with firebaseUser since that data might be stale
    if (bodyData.name) {
      firebaseUpdates.name = displayName;
    }
    if (bodyData.firstName) {
      firebaseUpdates.firstName = firstName;
    }
    if (bodyData.lastName !== undefined) { // Allow empty string for lastName
      firebaseUpdates.lastName = lastName;
    }
    if (imageUrl) {
      firebaseUpdates.imageUrl = imageUrl;
    }
    
    // Always update when we have data from the client
    if (Object.keys(firebaseUpdates).length > 1) { // More than just updatedAt
      await userRef.set(firebaseUpdates, { merge: true });
      console.log('[SYNC_STREAM] Updated Firebase:', firebaseUpdates);
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
        firstName,
        lastName,
        hasImage: !!imageUrl,
      }
    });
  } catch (error) {
    console.error('[SYNC_STREAM_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

