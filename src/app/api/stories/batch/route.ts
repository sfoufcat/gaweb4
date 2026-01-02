import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { adminDb } from '@/lib/firebase-admin';
import { isDemoRequest, demoResponse } from '@/lib/demo-api';
import { generateAvatarUrl } from '@/lib/demo-data';

// Demo story users configuration
const DEMO_STORY_MEMBERS = [
  { id: 'demo-coach-user', firstName: 'Adam', lastName: 'Coach', hasGoal: true, hasTasks: true, hasDayClosed: true, userPostCount: 1 },
  { id: 'demo-member-1', firstName: 'Sarah', lastName: 'Miller', hasGoal: true, hasTasks: true, hasDayClosed: true, userPostCount: 1 },
  { id: 'demo-member-2', firstName: 'Michael', lastName: 'Chen', hasGoal: true, hasTasks: true, hasDayClosed: false, userPostCount: 0 },
  { id: 'demo-member-3', firstName: 'Emma', lastName: 'Thompson', hasGoal: true, hasTasks: true, hasDayClosed: true, userPostCount: 1 },
  { id: 'demo-member-4', firstName: 'James', lastName: 'Wilson', hasGoal: true, hasTasks: false, hasDayClosed: false, userPostCount: 0 },
  { id: 'demo-member-5', firstName: 'Lisa', lastName: 'Park', hasGoal: true, hasTasks: true, hasDayClosed: true, userPostCount: 0 },
];

function generateDemoStoryStatuses() {
  const statuses: Record<string, StoryStatus> = {};
  const memberIds: string[] = [];
  
  for (const member of DEMO_STORY_MEMBERS) {
    const fullName = `${member.firstName} ${member.lastName}`;
    memberIds.push(member.id);
    
    statuses[member.id] = {
      hasStory: member.hasGoal || member.hasTasks || member.hasDayClosed || member.userPostCount > 0,
      hasDayClosed: member.hasDayClosed,
      hasWeekClosed: false,
      hasTasks: member.hasTasks,
      hasGoal: member.hasGoal,
      taskCount: member.hasTasks ? 3 : 0,
      userStoryCount: member.userPostCount,
      hasUserStory: member.userPostCount > 0,
      user: {
        firstName: member.firstName,
        lastName: member.lastName,
        imageUrl: generateAvatarUrl(fullName),
      },
    };
  }
  
  return { statuses, memberIds };
}

/**
 * POST /api/stories/batch
 * 
 * Batch fetch story status for multiple users in a single request.
 * Optimized to reduce N+1 queries to 1 API call with parallel Firestore reads.
 * 
 * Request body (one of):
 * { userIds: string[] } - Array of user IDs (max 20)
 * { squadId: string }   - Squad ID to fetch all member stories (eliminates waterfall)
 * 
 * Response:
 * { 
 *   statuses: { 
 *     [userId]: { 
 *       hasStory, hasDayClosed, hasWeekClosed, hasTasks, hasGoal,
 *       user: { firstName, lastName, imageUrl }
 *     } 
 *   },
 *   memberIds?: string[]  // Returned when using squadId mode
 * }
 */

interface StoryStatus {
  hasStory: boolean;
  hasDayClosed: boolean;
  hasWeekClosed: boolean;
  hasTasks: boolean;
  hasGoal: boolean;
  taskCount: number;
  userStoryCount: number;
  hasUserStory: boolean;
  user: {
    firstName: string;
    lastName: string;
    imageUrl: string;
  } | null;
}

export async function POST(request: NextRequest) {
  try {
    // Demo mode: return mock story statuses
    const isDemo = await isDemoRequest();
    if (isDemo) {
      return demoResponse(generateDemoStoryStatuses());
    }
    
    const { userId: currentUserId } = await auth();

    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get org context
    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    // Parse request body
    const body = await request.json();
    const { userIds, squadId } = body as { userIds?: string[]; squadId?: string };

    // Determine user IDs to fetch
    let targetUserIds: string[] = [];
    let returnMemberIds = false;

    if (squadId) {
      // Squad mode: fetch member IDs from the squad
      const memberIds = await fetchSquadMemberIds(squadId, currentUserId, organizationId);
      targetUserIds = memberIds;
      returnMemberIds = true;
    } else if (Array.isArray(userIds) && userIds.length > 0) {
      // Explicit user IDs mode
      targetUserIds = userIds;
    } else {
      return NextResponse.json({ error: 'userIds array or squadId required' }, { status: 400 });
    }

    // Handle empty member list
    if (targetUserIds.length === 0) {
      return NextResponse.json({ 
        statuses: {},
        ...(returnMemberIds && { memberIds: [] })
      });
    }

    // Limit to 20 users per batch for performance
    const limitedUserIds = targetUserIds.slice(0, 20);

    // Get current date info
    const today = new Date().toISOString().split('T')[0];
    const nowDate = new Date();
    const day = nowDate.getDay();
    const diff = nowDate.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(nowDate);
    monday.setDate(diff);
    const weekId = monday.toISOString().split('T')[0];

    // =========================================================================
    // BATCH FETCH ALL DATA IN PARALLEL
    // =========================================================================

    // 1. Batch fetch user documents
    const userRefs = limitedUserIds.map(uid => adminDb.collection('users').doc(uid));
    const userDocsPromise = adminDb.getAll(...userRefs);

    // 2. Batch fetch evening check-ins for today
    const eveningRefs = limitedUserIds.map(uid => 
      adminDb.collection('users').doc(uid).collection('eveningCheckins').doc(today)
    );
    const eveningDocsPromise = adminDb.getAll(...eveningRefs);

    // 3. Batch fetch weekly reflections
    const weeklyRefs = limitedUserIds.map(uid => 
      adminDb.collection('users').doc(uid).collection('weeklyReflections').doc(weekId)
    );
    const weeklyDocsPromise = adminDb.getAll(...weeklyRefs);

    // 4. Fetch tasks for all users (single query with 'in' operator, limited to 10 users per query)
    const taskCountsPromise = fetchTaskCountsForUsers(limitedUserIds, today, organizationId);

    // 5. Check for user-posted stories (24hr) for all users
    const userStoryCountsPromise = fetchUserStoryCounts(limitedUserIds, organizationId);

    // Execute all queries in parallel
    const [userDocs, eveningDocs, weeklyDocs, taskCounts, userStoryCounts] = await Promise.all([
      userDocsPromise,
      eveningDocsPromise,
      weeklyDocsPromise,
      taskCountsPromise,
      userStoryCountsPromise,
    ]);

    // =========================================================================
    // BUILD RESPONSE MAP
    // =========================================================================

    const statuses: Record<string, StoryStatus> = {};

    for (let i = 0; i < limitedUserIds.length; i++) {
      const userId = limitedUserIds[i];
      const userDoc = userDocs[i];
      const eveningDoc = eveningDocs[i];
      const weeklyDoc = weeklyDocs[i];
      const taskCount = taskCounts.get(userId) || 0;
      const userStoryCount = userStoryCounts.get(userId) || 0;
      const hasUserStory = userStoryCount > 0;

      const userData = userDoc.exists ? userDoc.data() : null;
      const eveningData = eveningDoc.exists ? eveningDoc.data() : null;
      const weeklyData = weeklyDoc.exists ? weeklyDoc.data() : null;

      const hasActiveGoal = !!(userData?.goal && !userData?.goalCompleted);
      const hasDayClosed = !!(eveningData?.completedAt);
      const hasWeekClosed = !!(weeklyData?.completedAt);
      const hasTasks = taskCount > 0;

      // User has story if: has user-posted story, has tasks, has goal, or day/week closed
      const hasStory = hasUserStory || hasTasks || hasActiveGoal || hasDayClosed || hasWeekClosed;

      statuses[userId] = {
        hasStory,
        hasDayClosed,
        hasWeekClosed,
        hasTasks,
        hasGoal: hasActiveGoal,
        taskCount,
        userStoryCount,
        hasUserStory,
        user: userData ? {
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          imageUrl: userData.avatarUrl || userData.imageUrl || '',
        } : null,
      };
    }

    return NextResponse.json({ 
      statuses,
      ...(returnMemberIds && { memberIds: limitedUserIds })
    });
  } catch (error) {
    console.error('[STORIES_BATCH] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch story statuses' },
      { status: 500 }
    );
  }
}

/**
 * Fetch squad member IDs from a squad, excluding the current user
 */
async function fetchSquadMemberIds(
  squadId: string,
  currentUserId: string,
  organizationId: string
): Promise<string[]> {
  try {
    // Verify squad exists and belongs to this org
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();
    if (!squadDoc.exists) {
      return [];
    }
    
    const squadData = squadDoc.data();
    if (squadData?.organizationId !== organizationId) {
      return [];
    }

    // Fetch squad members
    const membersSnapshot = await adminDb
      .collection('squads')
      .doc(squadId)
      .collection('members')
      .select('userId') // Only need userId for efficiency
      .get();

    // Extract user IDs, excluding current user
    const memberIds = membersSnapshot.docs
      .map(doc => doc.data().userId as string)
      .filter(uid => uid && uid !== currentUserId);

    return memberIds;
  } catch (err) {
    console.error('[STORIES_BATCH] Error fetching squad members:', err);
    return [];
  }
}

/**
 * Fetch task counts for multiple users efficiently
 * Uses 'in' queries which are limited to 10 items, so we batch
 */
async function fetchTaskCountsForUsers(
  userIds: string[],
  today: string,
  organizationId: string
): Promise<Map<string, number>> {
  const taskCounts = new Map<string, number>();
  
  // Initialize all users with 0 count
  userIds.forEach(uid => taskCounts.set(uid, 0));

  // Firestore 'in' query limit is 10, so batch the queries
  const batches: string[][] = [];
  for (let i = 0; i < userIds.length; i += 10) {
    batches.push(userIds.slice(i, i + 10));
  }

  await Promise.all(
    batches.map(async (batch) => {
      try {
        const snapshot = await adminDb
          .collection('tasks')
          .where('userId', 'in', batch)
          .where('date', '==', today)
          .where('listType', '==', 'focus')
          .where('organizationId', '==', organizationId)
          .select('userId') // Only fetch userId field for efficiency
          .get();

        // Count tasks per user
        snapshot.docs.forEach(doc => {
          const userId = doc.data().userId;
          taskCounts.set(userId, (taskCounts.get(userId) || 0) + 1);
        });
      } catch (err) {
        console.error('[STORIES_BATCH] Task query error:', err);
      }
    })
  );

  return taskCounts;
}

/**
 * Check which users have user-posted stories in the last 24 hours
 * Returns a map of userId -> story count
 */
async function fetchUserStoryCounts(
  userIds: string[],
  organizationId: string
): Promise<Map<string, number>> {
  const userStoryCounts = new Map<string, number>();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Initialize all with 0
  userIds.forEach(uid => userStoryCounts.set(uid, 0));

  // Firestore 'in' query limit is 10, so batch the queries
  const batches: string[][] = [];
  for (let i = 0; i < userIds.length; i += 10) {
    batches.push(userIds.slice(i, i + 10));
  }

  await Promise.all(
    batches.map(async (batch) => {
      try {
        const snapshot = await adminDb
          .collection('feed_stories')
          .where('authorId', 'in', batch)
          .where('organizationId', '==', organizationId)
          .where('createdAt', '>=', twentyFourHoursAgo)
          .select('authorId') // Only fetch authorId for efficiency
          .limit(100) // Reasonable limit per batch
          .get();

        snapshot.docs.forEach(doc => {
          const authorId = doc.data().authorId;
          userStoryCounts.set(authorId, (userStoryCounts.get(authorId) || 0) + 1);
        });
      } catch (err) {
        // This query might fail if index doesn't exist, that's okay
        // User-posted stories are optional
        console.error('[STORIES_BATCH] Stories query error:', err);
      }
    })
  );

  return userStoryCounts;
}
