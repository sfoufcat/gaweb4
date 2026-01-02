'use client';

import { useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { useUser } from '@clerk/nextjs';
import type { SquadMember } from '@/types';
import { generateStoryContentHash } from './useStoryViewTracking';
import { isInReflectionWindow, useCurrentUserStoryAvailability } from './useUserStoryAvailability';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { generateAvatarUrl } from '@/lib/demo-data';

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
  contentHash: string; // Used for view tracking
  // Counts for smart view tracking (content added vs removed)
  taskCount: number;
  userPostCount: number;
}

/** Story status data from batch API */
interface StoryStatusData {
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

interface BatchStoriesResponse {
  statuses: Record<string, StoryStatusData>;
  memberIds?: string[]; // Returned when using squadId mode
}

interface CommunityResponse {
  members: Array<{
    userId: string;
    firstName: string;
    lastName: string;
    imageUrl: string;
  }>;
}

interface UseFeedStoriesReturn {
  storyUsers: FeedStoryUser[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

interface UseFeedStoriesOptions {
  /** Squad ID for instant loading (no waterfall) */
  squadId?: string | null;
  /** Legacy: squad members array (causes waterfall if squadId not provided) */
  squadMembers?: SquadMember[];
}

// =============================================================================
// FETCHERS
// =============================================================================

const communityFetcher = async (url: string): Promise<CommunityResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch community');
  return res.json();
};

/**
 * Batch stories fetcher that supports two modes:
 * 1. squadId mode: API fetches member IDs internally (no waterfall)
 * 2. userIds mode: Client provides explicit user IDs
 */
const batchStoriesFetcher = async (
  params: { squadId: string } | { userIds: string[] }
): Promise<BatchStoriesResponse> => {
  const res = await fetch('/api/stories/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
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
 * OPTIMIZED: Supports two modes:
 * 1. squadId mode (recommended): Pass squadId for instant loading without waterfall
 * 2. Legacy mode: Pass squadMembers array (waits for squad data to load first)
 * 
 * Features:
 * - Single batch API call for all users
 * - SWR caching with 30s stale time for instant re-renders
 * - Background revalidation without loading states
 * - squadId mode eliminates dependency waterfall for instant feed stories
 */
export function useFeedStories(
  squadMembersOrOptions: SquadMember[] | UseFeedStoriesOptions
): UseFeedStoriesReturn {
  const { user } = useUser();
  const { isDemoMode } = useDemoMode();

  // Demo mode: return mock story users (excludes current user who appears as "Your Story")
  const demoStoryUsers: FeedStoryUser[] = useMemo(() => {
    if (!isDemoMode) return [];
    
    return [
      // Demo users with stories (matching API user IDs)
      {
        id: 'demo-member-1',
        firstName: 'Sarah',
        lastName: 'Miller',
        imageUrl: generateAvatarUrl('Sarah Miller'),
        hasUnseenStory: true,
        hasStory: true,
        hasDayClosed: true,
        hasWeekClosed: false,
        hasTasks: true,
        hasGoal: true,
        contentHash: 'demo-sarah-story-hash',
        taskCount: 3,
        userPostCount: 1,
      },
      {
        id: 'demo-member-2',
        firstName: 'Michael',
        lastName: 'Chen',
        imageUrl: generateAvatarUrl('Michael Chen'),
        hasUnseenStory: true,
        hasStory: true,
        hasDayClosed: false,
        hasWeekClosed: false,
        hasTasks: true,
        hasGoal: true,
        contentHash: 'demo-michael-story-hash',
        taskCount: 3,
        userPostCount: 0,
      },
      {
        id: 'demo-member-3',
        firstName: 'Emma',
        lastName: 'Thompson',
        imageUrl: generateAvatarUrl('Emma Thompson'),
        hasUnseenStory: true,
        hasStory: true,
        hasDayClosed: true,
        hasWeekClosed: false,
        hasTasks: true,
        hasGoal: true,
        contentHash: 'demo-emma-story-hash',
        taskCount: 3,
        userPostCount: 1,
      },
      {
        id: 'demo-member-5',
        firstName: 'Lisa',
        lastName: 'Park',
        imageUrl: generateAvatarUrl('Lisa Park'),
        hasUnseenStory: true,
        hasStory: true,
        hasDayClosed: true,
        hasWeekClosed: false,
        hasTasks: true,
        hasGoal: true,
        contentHash: 'demo-lisa-story-hash',
        taskCount: 3,
        userPostCount: 0,
      },
    ];
  }, [isDemoMode]);

  // Demo mode early return
  if (isDemoMode) {
    return {
      storyUsers: demoStoryUsers,
      isLoading: false,
      error: null,
      refetch: () => {},
    };
  }

  // Normalize input - support both legacy array and new options object
  const options: UseFeedStoriesOptions = Array.isArray(squadMembersOrOptions)
    ? { squadMembers: squadMembersOrOptions }
    : squadMembersOrOptions;

  const { squadId, squadMembers = [] } = options;

  // Determine which mode to use
  const useSquadIdMode = !!squadId;

  // Cache key for squadId mode (instant, no waterfall)
  const squadIdCacheKey = useMemo(() => {
    if (!useSquadIdMode || !squadId) return null;
    return `stories-squad-${squadId}`;
  }, [useSquadIdMode, squadId]);

  // Fetch stories using squadId mode (eliminates waterfall!)
  const { 
    data: squadIdData, 
    error: squadIdError, 
    isLoading: isSquadIdLoading,
    mutate: mutateSquadId,
  } = useSWR<BatchStoriesResponse>(
    squadIdCacheKey,
    () => batchStoriesFetcher({ squadId: squadId! }),
    {
      revalidateOnFocus: false,
      dedupingInterval: 30 * 1000,
      revalidateOnReconnect: true,
      keepPreviousData: true,
    }
  );

  // ==========================================================================
  // LEGACY MODE: Using squadMembers array (causes waterfall)
  // ==========================================================================

  // Extract member info from squadMembers (legacy mode)
  const legacyMembers = useMemo(() => {
    if (useSquadIdMode) return [];
    return squadMembers
      .filter(m => m.userId !== user?.id)
      .map(m => ({
        id: m.userId,
        firstName: m.firstName || '',
        lastName: m.lastName || '',
        imageUrl: m.imageUrl || '',
      }));
  }, [useSquadIdMode, squadMembers, user?.id]);

  const legacyMemberIds = useMemo(() => legacyMembers.map(m => m.id), [legacyMembers]);

  // Cache key for legacy mode
  const legacyCacheKey = useMemo(() => {
    if (useSquadIdMode) return null;
    if (legacyMemberIds.length === 0) return null;
    return ['stories-batch', ...legacyMemberIds.sort()].join(',');
  }, [useSquadIdMode, legacyMemberIds]);

  // Fetch community members only if no squad (legacy fallback)
  const shouldFetchCommunity = !useSquadIdMode && squadMembers.length === 0;
  const { data: communityData } = useSWR<CommunityResponse>(
    shouldFetchCommunity ? '/api/feed/community' : null,
    communityFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60 * 1000,
    }
  );

  // Final member IDs for legacy mode (includes community fallback)
  const finalLegacyMemberIds = useMemo(() => {
    if (useSquadIdMode) return [];
    if (squadMembers.length > 0) return legacyMemberIds;
    return (communityData?.members || [])
      .filter(m => m.userId !== user?.id)
      .map(m => m.userId);
  }, [useSquadIdMode, squadMembers.length, legacyMemberIds, communityData?.members, user?.id]);

  // Final cache key for legacy batch stories
  const finalLegacyCacheKey = useMemo(() => {
    if (useSquadIdMode) return null;
    if (finalLegacyMemberIds.length === 0) return null;
    return ['stories-batch', ...finalLegacyMemberIds.sort()].join(',');
  }, [useSquadIdMode, finalLegacyMemberIds]);

  // Batch fetch story statuses (legacy mode)
  const { 
    data: legacyBatchData, 
    error: legacyBatchError, 
    isLoading: isLegacyBatchLoading,
    mutate: mutateLegacyBatch,
  } = useSWR<BatchStoriesResponse>(
    finalLegacyCacheKey,
    () => batchStoriesFetcher({ userIds: finalLegacyMemberIds }),
    {
      revalidateOnFocus: false,
      dedupingInterval: 30 * 1000,
      revalidateOnReconnect: true,
      keepPreviousData: true,
    }
  );

  // ==========================================================================
  // MERGE RESULTS FROM EITHER MODE
  // ==========================================================================

  // Use squadId mode data if available, otherwise legacy
  const batchData = useSquadIdMode ? squadIdData : legacyBatchData;
  const batchError = useSquadIdMode ? squadIdError : legacyBatchError;
  const isBatchLoading = useSquadIdMode ? isSquadIdLoading : isLegacyBatchLoading;

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
      userStoryCount: 0,
      hasUserStory: false,
      user: null,
    };

    // Get member IDs - from API response (squadId mode) or local (legacy mode)
    const memberIds = useSquadIdMode 
      ? (batchData?.memberIds || [])
      : finalLegacyMemberIds;

    // For legacy mode, we have member info locally
    // For squadId mode, we get user info from the API response
    const legacyMemberMap = new Map(
      [...legacyMembers, ...(communityData?.members || []).map(m => ({
        id: m.userId,
        firstName: m.firstName,
        lastName: m.lastName,
        imageUrl: m.imageUrl,
      }))]
      .map(m => [m.id, m])
    );
    
    return memberIds
      .map(memberId => {
        const status = statuses[memberId] || defaultStatus;
        const legacyMember = legacyMemberMap.get(memberId);
        
        // Apply reflection window logic to match Home tab behavior
        const hasWeekClosed = isInReflectionWindow() && status.hasWeekClosed;

        const contentHash = generateStoryContentHash(
          status.hasTasks,
          status.hasDayClosed,
          status.taskCount,
          hasWeekClosed,
          status.userStoryCount
        );
        
        return {
          id: memberId,
          // Prefer API user data, fall back to local member data
          firstName: status.user?.firstName || legacyMember?.firstName || '',
          lastName: status.user?.lastName || legacyMember?.lastName || '',
          imageUrl: status.user?.imageUrl || legacyMember?.imageUrl || '',
          hasStory: status.hasStory,
          hasUnseenStory: status.hasStory,
          hasDayClosed: status.hasDayClosed,
          hasWeekClosed, // Use the window-filtered value
          hasTasks: status.hasTasks,
          hasGoal: status.hasGoal,
          contentHash,
          // Counts for smart view tracking
          taskCount: status.taskCount,
          userPostCount: status.userStoryCount,
        };
      })
      // Sort: users with stories first
      .sort((a, b) => {
        if (a.hasStory && !b.hasStory) return -1;
        if (!a.hasStory && b.hasStory) return 1;
        return 0;
      });
  }, [useSquadIdMode, batchData, finalLegacyMemberIds, legacyMembers, communityData?.members]);

  const refetch = useCallback(() => {
    if (useSquadIdMode) {
      mutateSquadId();
    } else {
      mutateLegacyBatch();
    }
  }, [useSquadIdMode, mutateSquadId, mutateLegacyBatch]);

  // Determine loading state - only true on initial load without cached data
  const isLoading = isBatchLoading && !batchData;

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
  userStoryCount: number;
  contentHash: string;
  isLoading: boolean;
}

/**
 * Hook to check current user's story status including ring state.
 * Returns data needed for StoryAvatar rendering.
 * 
 * IMPORTANT: This hook now uses the SAME underlying hook as the Home page
 * (useCurrentUserStoryAvailability) to ensure consistent contentHash generation.
 * This prevents the "green on one page, gray on another" sync issue.
 */
export function useCurrentUserHasStory(): CurrentUserStoryStatus {
  // Use the same hook as Home page to ensure cache sharing
  // and consistent content hash generation
  const availability = useCurrentUserStoryAvailability();
  
  return {
    hasStory: availability.hasStory,
    hasDayClosed: availability.data.hasDayClosed,
    hasWeekClosed: availability.data.hasWeekClosed,
    hasTasks: availability.data.hasTasksToday,
    hasGoal: availability.data.hasActiveGoal,
    taskCount: availability.data.tasks?.length || 0,
    userStoryCount: availability.data.userPostedStories?.length || 0,
    contentHash: availability.contentHash,
    isLoading: availability.isLoading,
  };
}
