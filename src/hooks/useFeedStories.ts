'use client';

import { useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { useUser } from '@clerk/nextjs';
import type { SquadMember } from '@/types';
import { generateStoryContentHash } from './useStoryViewTracking';

// =============================================================================
// TYPES
// =============================================================================

export interface FeedStoryUser {
  id: string;
  firstName: string;
  lastName: string;
  imageUrl?: string;
  hasUnseenStory: boolean;
  hasStory: boolean;
  // Story state for ring colors (matches StoryAvatar)
  hasDayClosed: boolean;
  hasWeekClosed: boolean;
  hasTasks: boolean;
  hasGoal: boolean;
}

/** Story status data from batch API */
interface StoryStatusData {
  hasStory: boolean;
  hasDayClosed: boolean;
  hasWeekClosed: boolean;
  hasTasks: boolean;
  hasGoal: boolean;
  taskCount: number;
  user: {
    firstName: string;
    lastName: string;
    imageUrl: string;
  } | null;
}

interface BatchStoriesResponse {
  statuses: Record<string, StoryStatusData>;
}

interface CommunityMember {
  userId: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
}

interface CommunityResponse {
  members: CommunityMember[];
}

interface UseFeedStoriesReturn {
  storyUsers: FeedStoryUser[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// =============================================================================
// FETCHERS
// =============================================================================

const communityFetcher = async (url: string): Promise<CommunityResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch community');
  return res.json();
};

const batchStoriesFetcher = async (userIds: string[]): Promise<BatchStoriesResponse> => {
  if (userIds.length === 0) {
    return { statuses: {} };
  }
  
  const res = await fetch('/api/stories/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userIds }),
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch story statuses');
  }
  
  return res.json();
};

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook to fetch community members with their story status for the Feed page.
 * 
 * Uses the optimized /api/stories/batch endpoint to fetch all story statuses
 * in a single request instead of N individual requests.
 * 
 * Features:
 * - Single batch API call for all users
 * - SWR caching with 30s stale time for instant re-renders
 * - Background revalidation without loading states
 */
export function useFeedStories(squadMembers: SquadMember[]): UseFeedStoriesReturn {
  const { user } = useUser();

  // Combine squad members into a stable list
  const allMembers = useMemo(() => {
    if (squadMembers.length > 0) {
      return squadMembers
        .filter(m => m.userId !== user?.id)
        .map(m => ({
          id: m.userId,
          firstName: m.firstName || '',
          lastName: m.lastName || '',
          imageUrl: m.imageUrl || '',
        }));
    }
    return [];
  }, [squadMembers, user?.id]);

  // Get member IDs for batch fetch
  const memberIds = useMemo(() => allMembers.map(m => m.id), [allMembers]);
  
  // Stable cache key based on member IDs
  const cacheKey = useMemo(() => {
    if (memberIds.length === 0) return null;
    // Sort IDs for consistent cache key regardless of order
    return ['stories-batch', ...memberIds.sort()].join(',');
  }, [memberIds]);

  // Fetch community members only if no squad members
  const shouldFetchCommunity = squadMembers.length === 0;
  const { data: communityData } = useSWR<CommunityResponse>(
    shouldFetchCommunity ? '/api/feed/community' : null,
    communityFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60 * 1000, // 1 minute
    }
  );

  // Merge community members with squad members
  const finalMemberIds = useMemo(() => {
    if (squadMembers.length > 0) {
      return memberIds;
    }
    // Use community members
    return (communityData?.members || [])
      .filter(m => m.userId !== user?.id)
      .map(m => m.userId);
  }, [squadMembers.length, memberIds, communityData?.members, user?.id]);

  const finalMembers = useMemo(() => {
    if (squadMembers.length > 0) {
      return allMembers;
    }
    return (communityData?.members || [])
      .filter(m => m.userId !== user?.id)
      .map(m => ({
        id: m.userId,
        firstName: m.firstName,
        lastName: m.lastName,
        imageUrl: m.imageUrl,
      }));
  }, [squadMembers.length, allMembers, communityData?.members, user?.id]);

  // Final cache key for batch stories
  const finalCacheKey = useMemo(() => {
    if (finalMemberIds.length === 0) return null;
    return ['stories-batch', ...finalMemberIds.sort()].join(',');
  }, [finalMemberIds]);

  // Batch fetch story statuses with SWR caching
  const { 
    data: batchData, 
    error: batchError, 
    isLoading: isBatchLoading,
    mutate: mutateBatch,
  } = useSWR<BatchStoriesResponse>(
    finalCacheKey,
    () => batchStoriesFetcher(finalMemberIds),
    {
      revalidateOnFocus: false,
      dedupingInterval: 30 * 1000, // 30 seconds - stories don't change that often
      revalidateOnReconnect: true,
      // Keep stale data while revalidating for instant renders
      keepPreviousData: true,
    }
  );

  // Convert to FeedStoryUser format
  const storyUsers = useMemo((): FeedStoryUser[] => {
    const statuses = batchData?.statuses || {};
    const defaultStatus: StoryStatusData = {
      hasStory: false,
      hasDayClosed: false,
      hasWeekClosed: false,
      hasTasks: false,
      hasGoal: false,
      taskCount: 0,
      user: null,
    };
    
    return finalMembers
      .map(member => {
        const status = statuses[member.id] || defaultStatus;
        return {
          id: member.id,
          firstName: status.user?.firstName || member.firstName,
          lastName: status.user?.lastName || member.lastName,
          imageUrl: status.user?.imageUrl || member.imageUrl,
          hasStory: status.hasStory,
          hasUnseenStory: status.hasStory, // All stories unseen by default
          hasDayClosed: status.hasDayClosed,
          hasWeekClosed: status.hasWeekClosed,
          hasTasks: status.hasTasks,
          hasGoal: status.hasGoal,
        };
      })
      // Sort: users with stories first
      .sort((a, b) => {
        if (a.hasStory && !b.hasStory) return -1;
        if (!a.hasStory && b.hasStory) return 1;
        return 0;
      });
  }, [finalMembers, batchData?.statuses]);

  const refetch = useCallback(() => {
    mutateBatch();
  }, [mutateBatch]);

  // Determine loading state - only true on initial load without cached data
  const isLoading = finalMemberIds.length > 0 && isBatchLoading && !batchData;

  return {
    storyUsers,
    isLoading,
    error: batchError?.message || null,
    refetch,
  };
}

// =============================================================================
// CURRENT USER STORY STATUS
// =============================================================================

/** Current user's story status including ring state data */
export interface CurrentUserStoryStatus {
  hasStory: boolean;
  hasDayClosed: boolean;
  hasWeekClosed: boolean;
  hasTasks: boolean;
  hasGoal: boolean;
  taskCount: number;
  contentHash: string;
  isLoading: boolean;
}

interface CurrentUserStoriesResponse {
  hasStory: boolean;
  autoGeneratedData: {
    hasDayClosed?: boolean;
    hasWeekClosed?: boolean;
    tasks?: Array<{ id: string }>;
    goal?: { title: string } | null;
  };
}

/**
 * Hook to check current user's story status including ring state.
 * Returns data needed for StoryAvatar rendering.
 * 
 * Uses SWR for caching with 30s stale time for instant re-renders.
 */
export function useCurrentUserHasStory(): CurrentUserStoryStatus {
  const { user } = useUser();

  const { data, isLoading } = useSWR<CurrentUserStoriesResponse>(
    user?.id ? `/api/stories?userId=${user.id}` : null,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch story status');
      return res.json();
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 30 * 1000, // 30 seconds
      keepPreviousData: true,
    }
  );

  const status = useMemo(() => {
    if (!data) {
      return {
        hasStory: false,
        hasDayClosed: false,
        hasWeekClosed: false,
        hasTasks: false,
        hasGoal: false,
        taskCount: 0,
      };
    }

    const autoData = data.autoGeneratedData || {};
    const taskCount = autoData.tasks?.length || 0;
    
    return {
      hasStory: data.hasStory === true,
      hasDayClosed: autoData.hasDayClosed === true,
      hasWeekClosed: autoData.hasWeekClosed === true,
      hasTasks: taskCount > 0,
      hasGoal: !!autoData.goal,
      taskCount,
    };
  }, [data]);

  // Generate content hash for view tracking
  const contentHash = useMemo(
    () => generateStoryContentHash(status.hasTasks, status.hasDayClosed, status.taskCount, status.hasWeekClosed),
    [status.hasTasks, status.hasDayClosed, status.taskCount, status.hasWeekClosed]
  );

  return { ...status, contentHash, isLoading: isLoading && !data };
}
