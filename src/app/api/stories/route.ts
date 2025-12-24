import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { createStory, getUserStories, setupStreamUser } from '@/lib/stream-feeds';
import { adminDb } from '@/lib/firebase-admin';

/**
 * GET /api/stories
 * Get stories for a user (or current user if no userId specified)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId: currentUserId } = await auth();

    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get org context
    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    // Check if feed is enabled (stories are part of the feed feature)
    const orgSettingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
    const orgSettings = orgSettingsDoc.data();
    
    if (!orgSettings?.feedEnabled) {
      return NextResponse.json({ error: 'Feed/Stories not enabled for this organization' }, { status: 403 });
    }

    // Get target user ID from query params (or current user)
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId') || currentUserId;

    // Get user-posted stories from Stream
    const streamStories = await getUserStories(targetUserId);

    // Transform to our format
    const stories = streamStories.map((activity) => {
      const activityData = activity as Record<string, unknown>;
      return {
        id: activityData.id as string,
        type: 'user_post' as const,
        authorId: activityData.actor as string,
        imageUrl: activityData.imageUrl as string | undefined,
        videoUrl: activityData.videoUrl as string | undefined,
        caption: activityData.caption as string | undefined,
        expiresAt: activityData.expiresAt as string,
        createdAt: activityData.time as string,
      };
    });

    return NextResponse.json({ stories });
  } catch (error) {
    console.error('[STORIES_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stories' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/stories
 * Create a new user-posted story (24hr ephemeral)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get org context
    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    // Check if feed is enabled
    const orgSettingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
    const orgSettings = orgSettingsDoc.data();
    
    if (!orgSettings?.feedEnabled) {
      return NextResponse.json({ error: 'Feed/Stories not enabled for this organization' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { imageUrl, videoUrl, caption } = body;

    // Validate - must have image or video
    if (!imageUrl && !videoUrl) {
      return NextResponse.json(
        { error: 'Story must have an image or video' },
        { status: 400 }
      );
    }

    // Get user data for Stream user setup
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (userData) {
      // Ensure user exists in Stream with profile data
      await setupStreamUser(userId, {
        name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'User',
        profileImage: userData.avatarUrl || userData.imageUrl,
      });
    }

    // Create the story
    const result = await createStory(userId, organizationId, {
      imageUrl,
      videoUrl,
      caption,
    });

    return NextResponse.json({
      success: true,
      story: {
        id: result.id,
        type: 'user_post',
        authorId: userId,
        imageUrl,
        videoUrl,
        caption,
        expiresAt: result.activity.expiresAt,
        createdAt: result.activity.time,
      },
    });
  } catch (error) {
    console.error('[STORIES_POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create story' },
      { status: 500 }
    );
  }
}

