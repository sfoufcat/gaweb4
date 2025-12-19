import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

/**
 * POST /api/user/update-avatar
 * Updates the user's profile image in Clerk
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { imageUrl } = await req.json();

    if (!imageUrl || typeof imageUrl !== 'string') {
      return new NextResponse('Invalid image URL', { status: 400 });
    }

    // Update Clerk user with new profile image
    const client = await clerkClient();
    await client.users.updateUser(userId, {
      profileImageID: imageUrl,
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Avatar updated successfully',
      imageUrl,
    });
  } catch (error) {
    console.error('[UPDATE_AVATAR_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

