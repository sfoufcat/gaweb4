import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Task } from '@/types';
import { generateStoryContentHash } from './useStoryViewTracking';

/**
 * Check if we're currently in the weekly reflection window (Fri, Sat, Sun)
 * The Week Closed story should only be visible during this period
 */
function isInReflectionWindow(): boolean {
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
 * 1. Tasks - "What I'm focusing on today" (if tasks today)
 * 2. Goal - "My goal" (if active goal)
 * 3. Day Closed - Shows completed tasks (if evening check-in done, resets next day)
 */

export interface UserStoryData {
  hasActiveGoal: boolean;
  hasTasksToday: boolean;
  hasDayClosed: boolean;
  hasWeekClosed: boolean;
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

/**
 * Hook to compute story availability for the current user
 */
export function useCurrentUserStoryAvailability(): StoryAvailability {
  const [data, setData] = useState<UserStoryData>({
    hasActiveGoal: false,
    hasTasksToday: false,
    hasDayClosed: false,
    hasWeekClosed: false,
    goal: null,
    tasks: [],
    completedTasks: [],
    eveningCheckIn: null,
    weeklyReflection: null,
    user: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const today = new Date().toISOString().split('T')[0];

      // Fetch user data, tasks, evening check-in, and weekly reflection in parallel
      const [userResponse, tasksResponse, eveningResponse, weeklyResponse] = await Promise.all([
        fetch('/api/user/me', { cache: 'no-store' }),
        fetch(`/api/tasks?date=${today}`, { cache: 'no-store' }),
        fetch(`/api/checkin/evening?date=${today}`, { cache: 'no-store' }),
        fetch('/api/checkin/weekly', { cache: 'no-store' }),
      ]);

      if (!userResponse.ok || !tasksResponse.ok) {
        throw new Error('Failed to fetch story data');
      }

      const userData = await userResponse.json();
      const tasksData = await tasksResponse.json();
      const eveningData = eveningResponse.ok ? await eveningResponse.json() : { checkIn: null };
      const weeklyData = weeklyResponse.ok ? await weeklyResponse.json() : { checkIn: null };

      // Get focus tasks for today
      const focusTasks = (tasksData.tasks || []).filter(
        (task: Task) => task.listType === 'focus'
      );

      // Check if evening check-in is complete
      const hasDayClosed = !!(eveningData.checkIn?.completedAt);
      
      // For completed tasks, PRIORITIZE the snapshot from the evening check-in
      // This is the source of truth for what was completed when they closed their day
      let completedTasks: Task[] = [];
      
      if (hasDayClosed && eveningData.checkIn?.completedTasksSnapshot?.length > 0) {
        // Use the snapshot - this was captured at check-in time before tasks moved to backlog
        completedTasks = eveningData.checkIn.completedTasksSnapshot;
      } else {
        // Fallback to current API data (for backward compatibility or if snapshot missing)
        completedTasks = focusTasks.filter(
          (task: Task) => task.status === 'completed'
        );
      }

      // Determine if user has an active goal
      const hasActiveGoal = !!(userData.goal?.goal);
      const hasTasksToday = focusTasks.length > 0;

      // Check if weekly reflection is complete AND we're in the reflection window (Fri-Sun)
      // The Week Closed story should only be visible during the reflection window
      const hasWeekClosed = isInReflectionWindow() && !!(weeklyData.checkIn?.completedAt);

      setData({
        hasActiveGoal,
        hasTasksToday,
        hasDayClosed,
        hasWeekClosed,
        goal: hasActiveGoal
          ? {
              title: userData.goal.goal,
              targetDate: userData.goal.targetDate,
              progress: userData.user?.goalProgress || userData.goal.progress?.percentage || 0,
            }
          : null,
        tasks: focusTasks,
        completedTasks,
        eveningCheckIn: hasDayClosed ? {
          emotionalState: eveningData.checkIn.emotionalState || 'steady',
          tasksCompleted: eveningData.checkIn.tasksCompleted || 0,
          tasksTotal: eveningData.checkIn.tasksTotal || 0,
        } : null,
        weeklyReflection: hasWeekClosed ? {
          progressChange: (weeklyData.checkIn.progress || 0) - (weeklyData.checkIn.previousProgress || 0),
          publicFocus: weeklyData.checkIn.publicFocus || undefined,
        } : null,
        user: userData.user
          ? {
              firstName: userData.user.firstName || '',
              lastName: userData.user.lastName || '',
              imageUrl: userData.user.avatarUrl || userData.user.imageUrl || '',
            }
          : null,
      });
    } catch (err) {
      console.error('Error fetching story availability:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch story data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate story availability - user has story if they have goal OR day/week is closed
  const hasStory = data.hasActiveGoal || data.hasDayClosed || data.hasWeekClosed;
  const showRing = data.hasActiveGoal || data.hasDayClosed || data.hasWeekClosed;
  
  // Weekly check-in completion only shows checkmark on weekends
  // On weekdays, only morning check-in (via hasTasksToday) or evening check-in (hasDayClosed) shows checkmark
  const isWeekend = (() => {
    const day = new Date().getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  })();
  const showCheck = (data.hasActiveGoal && data.hasTasksToday) || data.hasDayClosed || (isWeekend && data.hasWeekClosed);

  // Generate content hash for view tracking
  // This changes when story content changes (morning/evening/weekly check-in, new day)
  const contentHash = useMemo(() => 
    generateStoryContentHash(data.hasTasksToday, data.hasDayClosed, data.tasks.length, data.hasWeekClosed),
    [data.hasTasksToday, data.hasDayClosed, data.tasks.length, data.hasWeekClosed]
  );

  return {
    hasStory,
    showRing,
    showCheck,
    contentHash,
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}

/**
 * Hook to compute story availability for any user by ID
 * Used for squad members
 */
export function useUserStoryAvailability(userId: string): StoryAvailability {
  const [data, setData] = useState<UserStoryData>({
    hasActiveGoal: false,
    hasTasksToday: false,
    hasDayClosed: false,
    hasWeekClosed: false,
    goal: null,
    tasks: [],
    completedTasks: [],
    eveningCheckIn: null,
    weeklyReflection: null,
    user: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const today = new Date().toISOString().split('T')[0];

      // Fetch user story data from API (using userId path parameter)
      const response = await fetch(`/api/user/${userId}/story?date=${today}`, { cache: 'no-store' });

      if (!response.ok) {
        throw new Error('Failed to fetch story data');
      }

      const storyData = await response.json();

      // Apply reflection window check - Week Closed story only visible Fri-Sun
      const hasWeekClosed = isInReflectionWindow() && (storyData.hasWeekClosed || false);

      setData({
        hasActiveGoal: storyData.hasActiveGoal,
        hasTasksToday: storyData.hasTasksToday,
        hasDayClosed: storyData.hasDayClosed || false,
        hasWeekClosed,
        goal: storyData.goal,
        tasks: storyData.tasks || [],
        completedTasks: storyData.completedTasks || [],
        eveningCheckIn: storyData.eveningCheckIn || null,
        weeklyReflection: storyData.weeklyReflection || null,
        user: storyData.user,
      });
    } catch (err) {
      console.error('Error fetching user story availability:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch story data');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate story availability - user has story if they have goal OR day/week is closed
  const hasStory = data.hasActiveGoal || data.hasDayClosed || data.hasWeekClosed;
  const showRing = data.hasActiveGoal || data.hasDayClosed || data.hasWeekClosed;
  
  // Weekly check-in completion only shows checkmark on weekends
  // On weekdays, only morning check-in (via hasTasksToday) or evening check-in (hasDayClosed) shows checkmark
  const isWeekend = (() => {
    const day = new Date().getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  })();
  const showCheck = (data.hasActiveGoal && data.hasTasksToday) || data.hasDayClosed || (isWeekend && data.hasWeekClosed);

  // Generate content hash for view tracking
  // This changes when story content changes (morning/evening/weekly check-in, new day)
  const contentHash = useMemo(() => 
    generateStoryContentHash(data.hasTasksToday, data.hasDayClosed, data.tasks.length, data.hasWeekClosed),
    [data.hasTasksToday, data.hasDayClosed, data.tasks.length, data.hasWeekClosed]
  );

  return {
    hasStory,
    showRing,
    showCheck,
    contentHash,
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}

