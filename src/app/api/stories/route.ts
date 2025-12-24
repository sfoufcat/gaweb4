import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { createStory, getUserStories, setupStreamUser } from '@/lib/stream-feeds';
import { adminDb } from '@/lib/firebase-admin';

/**
 * GET /api/stories
 * Get stories for a user (or current user if no userId specified)
 * Returns both user-posted stories AND auto-generated story data (tasks, goals, check-ins)
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
    const isOwnProfile = currentUserId === targetUserId;

    // Get user-posted stories from Stream
    let stories: Array<{
      id: string;
      type: 'user_post';
      authorId: string;
      imageUrl?: string;
      videoUrl?: string;
      caption?: string;
      expiresAt: string;
      createdAt: string;
    }> = [];
    
    try {
      const streamStories = await getUserStories(targetUserId);
      stories = streamStories.map((activity) => {
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
    } catch (streamError) {
      // Stream might not be configured, continue with auto-generated stories
      console.warn('[STORIES_GET] Stream error (continuing):', streamError);
    }

    // ===== FETCH AUTO-GENERATED STORY DATA FROM FIREBASE =====
    const today = new Date().toISOString().split('T')[0];
    
    // Fetch user data
    const userDoc = await adminDb.collection('users').doc(targetUserId).get();
    const userData = userDoc.exists ? userDoc.data() : null;

    // Check if user has an active goal
    const hasActiveGoal = !!(userData?.goal && !userData?.goalCompleted);
    
    // Fetch today's focus tasks
    const tasksQuery = adminDb
      .collection('tasks')
      .where('userId', '==', targetUserId)
      .where('date', '==', today)
      .where('listType', '==', 'focus');

    const tasksSnapshot = await tasksQuery.get();
    const tasks = tasksSnapshot.docs.map(doc => {
      const data = doc.data();
      const isPrivate = data.isPrivate || false;
      return {
        id: doc.id,
        title: (!isOwnProfile && isPrivate) ? 'Private task' : (data.title || ''),
        status: data.status || 'pending',
        isPrivate,
      };
    });

    // Check if evening check-in is completed for today
    const eveningCheckInRef = adminDb
      .collection('users')
      .doc(targetUserId)
      .collection('eveningCheckins')
      .doc(today);
    const eveningCheckInDoc = await eveningCheckInRef.get();
    const eveningCheckInData = eveningCheckInDoc.exists ? eveningCheckInDoc.data() : null;
    const hasDayClosed = !!(eveningCheckInData?.completedAt);

    // Check if weekly reflection is completed for current week
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    const weekId = monday.toISOString().split('T')[0];

    const weeklyReflectionRef = adminDb
      .collection('users')
      .doc(targetUserId)
      .collection('weeklyReflections')
      .doc(weekId);
    const weeklyReflectionDoc = await weeklyReflectionRef.get();
    const weeklyReflectionData = weeklyReflectionDoc.exists ? weeklyReflectionDoc.data() : null;
    const hasWeekClosed = !!(weeklyReflectionData?.completedAt);

    // Get completed tasks from snapshot or current data
    interface TaskSnapshot {
      id: string;
      title?: string;
      status?: string;
      isPrivate?: boolean;
    }
    let completedTasks: TaskSnapshot[] = [];
    
    if (hasDayClosed && eveningCheckInData?.completedTasksSnapshot?.length > 0) {
      completedTasks = eveningCheckInData.completedTasksSnapshot.map((task: TaskSnapshot) => {
        const isPrivate = task.isPrivate || false;
        return {
          id: task.id,
          title: (!isOwnProfile && isPrivate) ? 'Private task' : (task.title || ''),
          status: 'completed',
          isPrivate,
        };
      });
    } else {
      completedTasks = tasks.filter(t => t.status === 'completed');
    }

    // Build auto-generated story data
    const autoGeneratedData = {
      tasks,
      goal: hasActiveGoal ? {
        title: userData?.goal || '',
        targetDate: userData?.goalTargetDate || '',
        progress: userData?.goalProgress || 0,
      } : null,
      hasDayClosed,
      completedTasks,
      eveningCheckIn: hasDayClosed ? {
        emotionalState: eveningCheckInData?.emotionalState || 'steady',
        tasksCompleted: eveningCheckInData?.tasksCompleted || 0,
        tasksTotal: eveningCheckInData?.tasksTotal || 0,
      } : null,
      hasWeekClosed,
      weeklyReflection: hasWeekClosed ? {
        progressChange: (weeklyReflectionData?.progress || 0) - (weeklyReflectionData?.previousProgress || 0),
        publicFocus: weeklyReflectionData?.publicFocus || undefined,
      } : null,
    };

    // Determine if user has any story content
    const hasStory = stories.length > 0 || 
                     tasks.length > 0 || 
                     hasActiveGoal || 
                     hasDayClosed || 
                     hasWeekClosed;

    return NextResponse.json({ 
      stories, 
      autoGeneratedData,
      hasStory,
      user: userData ? {
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        imageUrl: userData.avatarUrl || userData.imageUrl || '',
      } : null,
    });
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

