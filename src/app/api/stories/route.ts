import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * GET /api/stories
 * Get stories for a user (or current user if no userId specified)
 * Returns both user-posted stories (from Firestore) AND auto-generated story data (tasks, goals, check-ins)
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

    // Get user-posted stories from Firestore (24hr TTL)
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
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
      // Query stories for this user and organization
      // Note: Firestore may require a composite index for this query
      // Created stories without timestamp comparison first, then filter in JS
      const storiesSnapshot = await adminDb
        .collection('feed_stories')
        .where('authorId', '==', targetUserId)
        .where('organizationId', '==', organizationId)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();
      
      // Filter to last 24 hours in JavaScript to avoid index issues
      stories = storiesSnapshot.docs
        .map(doc => {
          const data = doc.data();
          const createdAt = data.createdAt?.toDate?.() || (data.createdAt ? new Date(data.createdAt) : null);
          
          return {
            id: doc.id,
            type: 'user_post' as const,
            authorId: data.authorId,
            imageUrl: data.imageUrl,
            videoUrl: data.videoUrl,
            caption: data.caption,
            expiresAt: data.expiresAt?.toDate?.()?.toISOString() || data.expiresAt,
            createdAt: createdAt?.toISOString() || new Date().toISOString(),
            _createdAtDate: createdAt,
          };
        })
        .filter(story => {
          if (!story._createdAtDate) return false;
          return story._createdAtDate >= twentyFourHoursAgo;
        })
        .map(({ _createdAtDate, ...rest }) => rest)
        .slice(0, 20);
    } catch (firestoreError) {
      console.error('[STORIES_GET] Firestore error:', firestoreError);
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
    const nowDate = new Date();
    const day = nowDate.getDay();
    const diff = nowDate.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(nowDate);
    monday.setDate(diff);
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

    // Get task timestamps for proper ordering
    const taskTimestamps = tasksSnapshot.docs.map(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.() || (data.createdAt ? new Date(data.createdAt) : null);
      return createdAt?.toISOString() || null;
    }).filter(Boolean) as string[];
    const latestTaskTimestamp = taskTimestamps.length > 0 
      ? taskTimestamps.sort().reverse()[0] 
      : null;

    // Get goal timestamp (when it was last updated)
    const goalUpdatedAt = userData?.goalUpdatedAt?.toDate?.()?.toISOString() 
      || userData?.goalUpdatedAt 
      || null;

    // Get evening check-in completion timestamp
    const eveningCheckInCompletedAt = eveningCheckInData?.completedAt?.toDate?.()?.toISOString() 
      || eveningCheckInData?.completedAt 
      || null;

    // Get weekly reflection completion timestamp
    const weeklyReflectionCompletedAt = weeklyReflectionData?.completedAt?.toDate?.()?.toISOString() 
      || weeklyReflectionData?.completedAt 
      || null;

    // Build auto-generated story data with timestamps
    const autoGeneratedData = {
      tasks,
      goal: hasActiveGoal ? {
        title: userData?.goal || '',
        targetDate: userData?.goalTargetDate || '',
        progress: userData?.goalProgress || 0,
        updatedAt: goalUpdatedAt,
      } : null,
      hasDayClosed,
      completedTasks,
      eveningCheckIn: hasDayClosed ? {
        emotionalState: eveningCheckInData?.emotionalState || 'steady',
        tasksCompleted: eveningCheckInData?.tasksCompleted || 0,
        tasksTotal: eveningCheckInData?.tasksTotal || 0,
        completedAt: eveningCheckInCompletedAt,
      } : null,
      hasWeekClosed,
      weeklyReflection: hasWeekClosed ? {
        progressChange: (weeklyReflectionData?.progress || 0) - (weeklyReflectionData?.previousProgress || 0),
        publicFocus: weeklyReflectionData?.publicFocus || undefined,
        completedAt: weeklyReflectionCompletedAt,
      } : null,
      // Timestamps for slide ordering
      latestTaskTimestamp,
      weekStartDate: weekId, // Monday of current week
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
 * Stories are stored in Firestore with automatic expiration
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

    // Calculate expiry (24 hours from now)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Create story document in Firestore
    const storyData = {
      authorId: userId,
      organizationId,
      imageUrl: imageUrl || null,
      videoUrl: videoUrl || null,
      caption: caption || null,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
    };

    const storyRef = await adminDb.collection('feed_stories').add(storyData);

    return NextResponse.json({
      success: true,
      story: {
        id: storyRef.id,
        type: 'user_post',
        authorId: userId,
        imageUrl,
        videoUrl,
        caption,
        expiresAt: expiresAt.toISOString(),
        createdAt: now.toISOString(),
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
