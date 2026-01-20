import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * POST /api/users/batch
 * Fetches multiple user profiles by their IDs
 * Returns basic public profile information (name, avatar)
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const { userIds } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'userIds array is required' }, { status: 400 });
    }

    // Limit to 50 users per request to prevent abuse
    const limitedUserIds = userIds.slice(0, 50);

    // Fetch users from Firebase
    const userPromises = limitedUserIds.map(async (uid: string) => {
      try {
        const userDoc = await adminDb.collection('users').doc(uid).get();

        if (!userDoc.exists) {
          return {
            id: uid,
            firstName: 'Unknown',
            lastName: 'User',
            imageUrl: null,
          };
        }

        const userData = userDoc.data();

        // Try to get Clerk image if Firebase doesn't have one
        let imageUrl = userData?.avatarUrl || userData?.imageUrl || null;

        if (!imageUrl) {
          try {
            const clerk = await clerkClient();
            const clerkUser = await clerk.users.getUser(uid);
            imageUrl = clerkUser.imageUrl || null;
          } catch {
            // Clerk user might not exist, that's okay
          }
        }

        return {
          id: uid,
          firstName: userData?.firstName || '',
          lastName: userData?.lastName || '',
          name: userData?.name || `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim(),
          imageUrl,
        };
      } catch (error) {
        console.error(`Failed to fetch user ${uid}:`, error);
        return {
          id: uid,
          firstName: 'Unknown',
          lastName: 'User',
          imageUrl: null,
        };
      }
    });

    const users = await Promise.all(userPromises);

    return NextResponse.json({ users });
  } catch (error) {
    console.error('[USERS_BATCH_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
