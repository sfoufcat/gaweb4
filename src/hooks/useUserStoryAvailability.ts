import { useMemo, useCallback } from 'react';
import useSWR from 'swr';
import type { Task } from '@/types';
import { generateStoryContentHash } from './useStoryViewTracking';

/**
 * Check if we're currently in the weekly reflection window (Fri, Sat, Sun)
 * The Week Closed story should only be visible during this period
 */
export function isInReflectionWindow(): boolean {
  const dayOfWeek = new Date().getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
  return dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
}

/**
 * Story availability states:
 * 1. No ring, no story: user has no active goal
 * 2. Green ring, no check: has active goal but no tasks today
 * 3. Green ring + check: has active goal AND has tasks today (morning check-in done)
 * 
 * Story slides (in order):
 * 1. User-posted stories (images/videos uploaded, 24hr TTL) - newest first
 * 2. Tasks - "What I'm focusing on today" (if tasks today)
 * 3. Day Closed - Shows completed tasks (if evening check-in done)
 * 4. Week Closed - Shows weekly reflection (Fri-Sun only)
 * 5. Goal - "My goal" (if active goal) - anchor slide
 */

export interface UserPostedStory {
  id: string;
  type: 'user_post';
  authorId: string;
  imageUrl?: string;
  videoUrl?: string;
  caption?: string;
  expiresAt: string;
  createdAt: string;
}

export interface UserStoryData {
  hasActiveGoal: boolean;
  hasTasksToday: boolean;
  hasDayClosed: boolean;
  hasWeekClosed: boolean;
  hasUserPostedStories: boolean;
  userPostedStories: UserPostedStory[];
  goal: {
    title: string;
    targetDate: string;
    progress: number;
  } | null;
  tasks: Task[];
  completedTasks: Task[];
  eveningCheckIn: {
    emotionalState: string;
    tasksCompleted: number;
    tasksTotal: number;
  } | null;
  weeklyReflection: {
    progressChange: number;
    publicFocus?: string;
  } | null;
  user: {
    firstName: string;
    lastName: string;
    imageUrl: string;
  } | null;
}

export interface StoryAvailability {
  hasStory: boolean;
  showRing: boolean;
  showCheck: boolean;
  contentHash: string;
  data: UserStoryData;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// =============================================================================
// SWR CONFIGURATION
// =============================================================================

const SWR_CONFIG = {
  revalidateOnFocus: false,
  dedupingInterval: 30 * 1000, // 30 seconds - story data is relatively stable
  keepPreviousData: true, // Keep showing old data while revalidating
  revalidateOnReconnect: true,
};

// Default empty data
const DEFAULT_DATA: UserStoryData = {
  hasActiveGoal: false,
  hasTasksToday: false,
  hasDayClosed: false,
  hasWeekClosed: false,
  hasUserPostedStories: false,
  userPostedStories: [],
  goal: null,
  tasks: [],
  completedTasks: [],
  eveningCheckIn: null,
  weeklyReflection: null,
  user: null,
};

// =============================================================================
// FETCHERS
// =============================================================================

interface StoryDataResponse {
  user: {
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
    imageUrl?: string;
    goalProgress?: number;
  } | null;
  goal?: {
    goal?: string;
    targetDate?: string;
    progress?: { percentage?: number };
  };
  tasks: Task[];
  checkIn?: {
    completedAt?: string;
    emotionalState?: string;
    tasksCompleted?: number;
    tasksTotal?: number;
    completedTasksSnapshot?: Task[];
  };
  weeklyCheckIn?: {
    completedAt?: string;
    progress?: number;
    previousProgress?: number;
    publicFocus?: string;
  };
  // User-posted stories (from /api/stories)
  userPostedStories?: UserPostedStory[];
}

/**
 * Fetcher that consolidates multiple API calls for current user story data
 */
async function fetchCurrentUserStoryData(): Promise<StoryDataResponse> {
  const today = new Date().toISOString().split('T')[0];

  // Fetch all data in parallel (including user-posted stories)
  const [userResponse, tasksResponse, eveningResponse, weeklyResponse, storiesResponse] = await Promise.all([
    fetch('/api/user/me'),
    fetch(`/api/tasks?date=${today}`),
    fetch(`/api/checkin/evening?date=${today}`),
    fetch('/api/checkin/weekly'),
    fetch('/api/stories'), // Fetch current user's posted stories
  ]);

  if (!userResponse.ok || !tasksResponse.ok) {
    throw new Error('Failed to fetch story data');
  }

  const userData = await userResponse.json();
  const tasksData = await tasksResponse.json();
  const eveningData = eveningResponse.ok ? await eveningResponse.json() : { checkIn: null };
  const weeklyData = weeklyResponse.ok ? await weeklyResponse.json() : { checkIn: null };
  const storiesData = storiesResponse.ok ? await storiesResponse.json() : { stories: [] };

  return {
    user: userData.user,
    goal: userData.goal,
    tasks: tasksData.tasks || [],
    checkIn: eveningData.checkIn,
    weeklyCheckIn: weeklyData.checkIn,
    userPostedStories: storiesData.stories || [],
  };
}

/**
 * Transform raw API response into UserStoryData
 */
function transformStoryData(response: StoryDataResponse): UserStoryData {
  // Get focus tasks for today
  const focusTasks = (response.tasks || []).filter(
    (task: Task) => task.listType === 'focus'
  );

  // Check if evening check-in is complete
  const hasDayClosed = !!(response.checkIn?.completedAt);
  
  // For completed tasks, PRIORITIZE the snapshot from the evening check-in
  let completedTasks: Task[] = [];
  
  if (hasDayClosed && response.checkIn?.completedTasksSnapshot?.length) {
    completedTasks = response.checkIn.completedTasksSnapshot;
  } else {
    completedTasks = focusTasks.filter((task: Task) => task.status === 'completed');
  }

  // Determine if user has an active goal
  const hasActiveGoal = !!(response.goal?.goal);
  const hasTasksToday = focusTasks.length > 0;

  // Check if weekly reflection is complete AND we're in the reflection window
  const hasWeekClosed = isInReflectionWindow() && !!(response.weeklyCheckIn?.completedAt);

  // User-posted stories
  const userPostedStories = response.userPostedStories || [];

  return {
    hasActiveGoal,
    hasTasksToday,
    hasDayClosed,
    hasWeekClosed,
    hasUserPostedStories: userPostedStories.length > 0,
    userPostedStories,
    goal: hasActiveGoal
      ? {
          title: response.goal!.goal!,
          targetDate: response.goal!.targetDate || '',
          progress: response.user?.goalProgress || response.goal!.progress?.percentage || 0,
        }
      : null,
    tasks: focusTasks,
    completedTasks,
    eveningCheckIn: hasDayClosed ? {
      emotionalState: response.checkIn!.emotionalState || 'steady',
      tasksCompleted: response.checkIn!.tasksCompleted || 0,
      tasksTotal: response.checkIn!.tasksTotal || 0,
    } : null,
    weeklyReflection: hasWeekClosed ? {
      progressChange: (response.weeklyCheckIn!.progress || 0) - (response.weeklyCheckIn!.previousProgress || 0),
      publicFocus: response.weeklyCheckIn!.publicFocus || undefined,
    } : null,
    user: response.user
      ? {
          firstName: response.user.firstName || '',
          lastName: response.user.lastName || '',
          imageUrl: response.user.avatarUrl || response.user.imageUrl || '',
        }
      : null,
  };
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Hook to compute story availability for the current user.
 * 
 * Uses SWR for:
 * - Instant loading from cache on return visits
 * - Background revalidation without showing loading states
 * - 30s stale time before refetching
 */
export function useCurrentUserStoryAvailability(): StoryAvailability {
  const today = new Date().toISOString().split('T')[0];
  const cacheKey = `current-user-story-${today}`;

  const { data: rawData, error, isLoading, mutate } = useSWR<StoryDataResponse>(
    cacheKey,
    fetchCurrentUserStoryData,
    SWR_CONFIG
  );

  // Transform the raw data into UserStoryData
  const data = useMemo(() => {
    if (!rawData) return DEFAULT_DATA;
    return transformStoryData(rawData);
  }, [rawData]);

  // Calculate story availability - include user-posted stories
  const hasStory = data.hasActiveGoal || data.hasDayClosed || data.hasWeekClosed || data.hasUserPostedStories;
  const showRing = data.hasActiveGoal || data.hasDayClosed || data.hasWeekClosed || data.hasUserPostedStories;
  
  // Weekly check-in completion only shows checkmark on weekends
  const isWeekend = (() => {
    const day = new Date().getDay();
    return day === 0 || day === 6;
  })();
  const showCheck = (data.hasActiveGoal && data.hasTasksToday) || data.hasDayClosed || (isWeekend && data.hasWeekClosed);

  // Generate content hash for view tracking (include user-posted stories count)
  const contentHash = useMemo(() => 
    generateStoryContentHash(data.hasTasksToday, data.hasDayClosed, data.tasks.length, data.hasWeekClosed, data.userPostedStories.length),
    [data.hasTasksToday, data.hasDayClosed, data.tasks.length, data.hasWeekClosed, data.userPostedStories.length]
  );

  const refetch = useCallback(async () => {
    await mutate();
  }, [mutate]);

  return {
    hasStory,
    showRing,
    showCheck,
    contentHash,
    data,
    // Only show loading on initial fetch without cached data
    isLoading: isLoading && !rawData,
    error: error?.message || null,
    refetch,
  };
}

// =============================================================================
// USER STORY AVAILABILITY (by userId)
// =============================================================================

interface UserStoryApiResponse {
  hasActiveGoal: boolean;
  hasTasksToday: boolean;
  hasDayClosed?: boolean;
  hasWeekClosed?: boolean;
  hasUserPostedStories?: boolean;
  userPostedStories?: UserPostedStory[];
  goal: {
    title: string;
    targetDate: string;
    progress: number;
  } | null;
  tasks: Task[];
  completedTasks: Task[];
  eveningCheckIn: {
    emotionalState: string;
    tasksCompleted: number;
    tasksTotal: number;
  } | null;
  weeklyReflection: {
    progressChange: number;
    publicFocus?: string;
  } | null;
  user: {
    firstName: string;
    lastName: string;
    imageUrl: string;
  } | null;
}

/**
 * Hook to compute story availability for any user by ID.
 * Used for squad members.
 * 
 * Uses SWR for caching with 30s stale time.
 */
export function useUserStoryAvailability(userId: string): StoryAvailability {
  const today = new Date().toISOString().split('T')[0];
  const cacheKey = userId ? `user-story-${userId}-${today}` : null;

  const { data: storyData, error, isLoading, mutate } = useSWR<UserStoryApiResponse>(
    cacheKey,
    async () => {
      const response = await fetch(`/api/user/${userId}/story?date=${today}`);
      if (!response.ok) {
        throw new Error('Failed to fetch story data');
      }
      return response.json();
    },
    SWR_CONFIG
  );

  // Transform response to UserStoryData
  const data = useMemo((): UserStoryData => {
    if (!storyData) return DEFAULT_DATA;

    // Apply reflection window check - Week Closed story only visible Fri-Sun
    const hasWeekClosed = isInReflectionWindow() && (storyData.hasWeekClosed || false);
    const userPostedStories = storyData.userPostedStories || [];

    return {
      hasActiveGoal: storyData.hasActiveGoal,
      hasTasksToday: storyData.hasTasksToday,
      hasDayClosed: storyData.hasDayClosed || false,
      hasWeekClosed,
      hasUserPostedStories: userPostedStories.length > 0,
      userPostedStories,
      goal: storyData.goal,
      tasks: storyData.tasks || [],
      completedTasks: storyData.completedTasks || [],
      eveningCheckIn: storyData.eveningCheckIn || null,
      weeklyReflection: storyData.weeklyReflection || null,
      user: storyData.user,
    };
  }, [storyData]);

  // Calculate story availability - include user-posted stories
  const hasStory = data.hasActiveGoal || data.hasDayClosed || data.hasWeekClosed || data.hasUserPostedStories;
  const showRing = data.hasActiveGoal || data.hasDayClosed || data.hasWeekClosed || data.hasUserPostedStories;
  
  // Weekly check-in completion only shows checkmark on weekends
  const isWeekend = (() => {
    const day = new Date().getDay();
    return day === 0 || day === 6;
  })();
  const showCheck = (data.hasActiveGoal && data.hasTasksToday) || data.hasDayClosed || (isWeekend && data.hasWeekClosed);

  // Generate content hash for view tracking (include user-posted stories count)
  const contentHash = useMemo(() => 
    generateStoryContentHash(data.hasTasksToday, data.hasDayClosed, data.tasks.length, data.hasWeekClosed, data.userPostedStories.length),
    [data.hasTasksToday, data.hasDayClosed, data.tasks.length, data.hasWeekClosed, data.userPostedStories.length]
  );

  const refetch = useCallback(async () => {
    await mutate();
  }, [mutate]);

  return {
    hasStory,
    showRing,
    showCheck,
    contentHash,
    data,
    // Only show loading on initial fetch without cached data
    isLoading: isLoading && !storyData,
    error: error?.message || null,
    refetch,
  };
}
