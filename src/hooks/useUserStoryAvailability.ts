import { useMemo, useCallback } from 'react';
import useSWR from 'swr';
import type { Task } from '@/types';
import { generateStoryContentHash } from './useStoryViewTracking';
import { useDemoMode } from '@/contexts/DemoModeContext';

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

// Helper to create a minimal Task object for demo
function createDemoTask(id: string, title: string, status: 'pending' | 'completed'): Task {
  return {
    id,
    userId: 'demo-user',
    organizationId: 'demo-org',
    title,
    status,
    listType: 'focus',
    order: 0,
    date: new Date().toISOString().split('T')[0],
    isPrivate: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Demo mode mock story data for various users
const DEMO_STORY_DATA: Record<string, UserStoryData> = {
  'demo-user': {
    hasActiveGoal: true,
    hasTasksToday: true,
    hasDayClosed: false,
    hasWeekClosed: false,
    hasUserPostedStories: false,
    userPostedStories: [],
    goal: {
      title: 'Build consistent habits and achieve my goals',
      targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      progress: 65,
    },
    tasks: [
      createDemoTask('t1', 'Complete morning workout', 'completed'),
      createDemoTask('t2', 'Review weekly goals', 'completed'),
      createDemoTask('t3', 'Read 20 pages of new book', 'pending'),
    ],
    completedTasks: [
      createDemoTask('t1', 'Complete morning workout', 'completed'),
      createDemoTask('t2', 'Review weekly goals', 'completed'),
    ],
    eveningCheckIn: null,
    weeklyReflection: null,
    user: { firstName: 'Demo', lastName: 'User', imageUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face' },
  },
  'demo-coach-user': {
    hasActiveGoal: true,
    hasTasksToday: true,
    hasDayClosed: true,
    hasWeekClosed: false,
    hasUserPostedStories: true,
    userPostedStories: [{
      id: 'story-selfie-coach',
      type: 'user_post',
      authorId: 'demo-coach-user',
      imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop',
      caption: 'Great workout this morning! 💪 Time to conquer the day.',
      expiresAt: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    }],
    goal: {
      title: 'Help 100 clients achieve their goals',
      targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      progress: 65,
    },
    tasks: [
      createDemoTask('t1', 'Review client progress reports', 'completed'),
      createDemoTask('t2', 'Prepare coaching session materials', 'completed'),
      createDemoTask('t3', 'Send weekly motivation emails', 'pending'),
    ],
    completedTasks: [
      createDemoTask('t1', 'Review client progress reports', 'completed'),
      createDemoTask('t2', 'Prepare coaching session materials', 'completed'),
    ],
    eveningCheckIn: { emotionalState: 'energized', tasksCompleted: 2, tasksTotal: 3 },
    weeklyReflection: null,
    user: { firstName: 'Adam', lastName: 'Coach', imageUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&crop=face' },
  },
  'demo-member-1': {
    hasActiveGoal: true,
    hasTasksToday: true,
    hasDayClosed: true,
    hasWeekClosed: false,
    hasUserPostedStories: true,
    userPostedStories: [{
      id: 'story-selfie-sarah',
      type: 'user_post',
      authorId: 'demo-member-1',
      imageUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=600&fit=crop',
      caption: 'Crushing my goals one day at a time! 🎯',
      expiresAt: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    }],
    goal: {
      title: 'Build a successful coaching business',
      targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      progress: 45,
    },
    tasks: [
      createDemoTask('t1', 'Morning meditation 10 min', 'completed'),
      createDemoTask('t2', 'Work on business plan', 'completed'),
      createDemoTask('t3', 'Network with 2 new contacts', 'pending'),
    ],
    completedTasks: [
      createDemoTask('t1', 'Morning meditation 10 min', 'completed'),
      createDemoTask('t2', 'Work on business plan', 'completed'),
    ],
    eveningCheckIn: { emotionalState: 'calm', tasksCompleted: 2, tasksTotal: 3 },
    weeklyReflection: null,
    user: { firstName: 'Sarah', lastName: 'Miller', imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face' },
  },
  'demo-member-2': {
    hasActiveGoal: true,
    hasTasksToday: true,
    hasDayClosed: false,
    hasWeekClosed: false,
    hasUserPostedStories: false,
    userPostedStories: [],
    goal: {
      title: 'Launch my SaaS product',
      targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      progress: 45,
    },
    tasks: [
      createDemoTask('t1', 'Code landing page', 'completed'),
      createDemoTask('t2', 'Set up payment integration', 'completed'),
      createDemoTask('t3', 'Write launch email', 'completed'),
      createDemoTask('t4', 'Test checkout flow', 'pending'),
    ],
    completedTasks: [],
    eveningCheckIn: null,
    weeklyReflection: null,
    user: { firstName: 'Michael', lastName: 'Chen', imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face' },
  },
  'demo-member-3': {
    hasActiveGoal: true,
    hasTasksToday: true,
    hasDayClosed: true,
    hasWeekClosed: false,
    hasUserPostedStories: true,
    userPostedStories: [{
      id: 'story-selfie-emma',
      type: 'user_post',
      authorId: 'demo-member-3',
      imageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=600&fit=crop',
      caption: 'Another productive day in the books! 📚',
      expiresAt: new Date(Date.now() + 16 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    }],
    goal: {
      title: 'Write my first book',
      targetDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      progress: 30,
    },
    tasks: [
      createDemoTask('t1', 'Write 1000 words', 'completed'),
      createDemoTask('t2', 'Research chapter 5', 'completed'),
      createDemoTask('t3', 'Outline next chapter', 'pending'),
    ],
    completedTasks: [
      createDemoTask('t1', 'Write 1000 words', 'completed'),
      createDemoTask('t2', 'Research chapter 5', 'completed'),
    ],
    eveningCheckIn: { emotionalState: 'reflective', tasksCompleted: 2, tasksTotal: 3 },
    weeklyReflection: null,
    user: { firstName: 'Emma', lastName: 'Thompson', imageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face' },
  },
  'demo-member-4': {
    hasActiveGoal: true,
    hasTasksToday: false,
    hasDayClosed: false,
    hasWeekClosed: false,
    hasUserPostedStories: false,
    userPostedStories: [],
    goal: {
      title: 'Run a marathon',
      targetDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(),
      progress: 25,
    },
    tasks: [],
    completedTasks: [],
    eveningCheckIn: null,
    weeklyReflection: null,
    user: { firstName: 'James', lastName: 'Wilson', imageUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face' },
  },
  'demo-member-5': {
    hasActiveGoal: true,
    hasTasksToday: true,
    hasDayClosed: true,
    hasWeekClosed: false,
    hasUserPostedStories: false,
    userPostedStories: [],
    goal: {
      title: 'Learn a new language',
      targetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      progress: 15,
    },
    tasks: [
      createDemoTask('t1', 'Duolingo lesson', 'completed'),
      createDemoTask('t2', 'Practice speaking 15 min', 'completed'),
      createDemoTask('t3', 'Watch foreign film', 'pending'),
    ],
    completedTasks: [
      createDemoTask('t1', 'Duolingo lesson', 'completed'),
      createDemoTask('t2', 'Practice speaking 15 min', 'completed'),
    ],
    eveningCheckIn: { emotionalState: 'motivated', tasksCompleted: 2, tasksTotal: 3 },
    weeklyReflection: null,
    user: { firstName: 'Lisa', lastName: 'Park', imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face' },
  },
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
 * 
 * In Demo Mode: Returns mock data without making network requests.
 */
export function useCurrentUserStoryAvailability(): StoryAvailability {
  const { isDemoMode } = useDemoMode();
  const today = new Date().toISOString().split('T')[0];
  const cacheKey = isDemoMode ? null : `current-user-story-${today}`;

  const { data: rawData, error, isLoading, mutate } = useSWR<StoryDataResponse>(
    cacheKey,
    fetchCurrentUserStoryData,
    SWR_CONFIG
  );

  // In demo mode, use mock data for demo-user (the current user)
  const demoData = useMemo(() => {
    if (!isDemoMode) return null;
    return DEMO_STORY_DATA['demo-user'] || DEFAULT_DATA;
  }, [isDemoMode]);

  // Transform the raw data into UserStoryData
  const data = useMemo(() => {
    if (isDemoMode && demoData) return demoData;
    if (!rawData) return DEFAULT_DATA;
    return transformStoryData(rawData);
  }, [isDemoMode, demoData, rawData]);

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
    if (isDemoMode) return; // No-op in demo mode
    await mutate();
  }, [isDemoMode, mutate]);

  return {
    hasStory,
    showRing,
    showCheck,
    contentHash,
    data,
    // In demo mode, never loading. Otherwise, only show loading on initial fetch
    isLoading: isDemoMode ? false : (isLoading && !rawData),
    error: isDemoMode ? null : (error?.message || null),
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
 * 
 * In Demo Mode: Returns mock data without making network requests.
 */
export function useUserStoryAvailability(userId: string): StoryAvailability {
  const { isDemoMode } = useDemoMode();
  const today = new Date().toISOString().split('T')[0];
  // In demo mode, don't fetch (return null key)
  const cacheKey = (userId && !isDemoMode) ? `user-story-${userId}-${today}` : null;

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

  // In demo mode, use mock data for the user ID
  const demoData = useMemo(() => {
    if (!isDemoMode || !userId) return null;
    return DEMO_STORY_DATA[userId] || DEFAULT_DATA;
  }, [isDemoMode, userId]);

  // Transform response to UserStoryData
  const data = useMemo((): UserStoryData => {
    // Demo mode: use mock data
    if (isDemoMode && demoData) return demoData;
    
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
  }, [isDemoMode, demoData, storyData]);

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
    if (isDemoMode) return; // No-op in demo mode
    await mutate();
  }, [isDemoMode, mutate]);

  return {
    hasStory,
    showRing,
    showCheck,
    contentHash,
    data,
    // In demo mode, never loading. Otherwise, only show loading on initial fetch
    isLoading: isDemoMode ? false : (isLoading && !storyData),
    error: isDemoMode ? null : (error?.message || null),
    refetch,
  };
}
