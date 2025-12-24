'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import type { SquadMember } from '@/types';

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
}

interface UseFeedStoriesReturn {
  storyUsers: FeedStoryUser[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook to fetch community members with their story status for the Feed page.
 * 
 * Takes squad members as input and returns them formatted for the StoriesRow
 * with story availability status.
 */
export function useFeedStories(squadMembers: SquadMember[]): UseFeedStoriesReturn {
  const { user } = useUser();
  const [storyStatus, setStoryStatus] = useState<Map<string, boolean>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  // Get member IDs excluding current user
  const memberIds = useMemo(() => {
    return squadMembers
      .filter(m => m.clerkUserId !== user?.id)
      .map(m => m.clerkUserId);
  }, [squadMembers, user?.id]);

  // Fetch story status for all members
  const fetchStoryStatus = useCallback(async () => {
    if (memberIds.length === 0) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const results = new Map<string, boolean>();

    try {
      // Batch fetch in groups of 5 to avoid overwhelming the API
      const batches: string[][] = [];
      for (let i = 0; i < memberIds.length; i += 5) {
        batches.push(memberIds.slice(i, i + 5));
      }

      for (const batch of batches) {
        await Promise.all(
          batch.map(async (userId) => {
            try {
              const response = await fetch(`/api/stories?userId=${userId}`);
              if (response.ok) {
                const data = await response.json();
                // User has story if they have user-posted stories or if they have any story data
                results.set(userId, (data.stories?.length || 0) > 0);
              } else {
                results.set(userId, false);
              }
            } catch {
              results.set(userId, false);
            }
          })
        );
      }

      setStoryStatus(results);
    } catch (err) {
      console.error('[useFeedStories] Error fetching story status:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch stories');
    } finally {
      setIsLoading(false);
    }
  }, [memberIds]);

  // Fetch on mount and when members change
  useEffect(() => {
    fetchStoryStatus();
  }, [fetchStoryStatus, fetchTrigger]);

  // Convert squad members to FeedStoryUser format
  const storyUsers = useMemo((): FeedStoryUser[] => {
    return squadMembers
      .filter(m => m.clerkUserId !== user?.id)
      .map(member => ({
        id: member.clerkUserId,
        firstName: member.firstName || '',
        lastName: member.lastName || '',
        imageUrl: member.avatarUrl || member.imageUrl,
        hasStory: storyStatus.get(member.clerkUserId) || false,
        // For now, all stories are "unseen" - we can add viewed tracking later
        hasUnseenStory: storyStatus.get(member.clerkUserId) || false,
      }))
      // Sort: users with stories first
      .sort((a, b) => {
        if (a.hasStory && !b.hasStory) return -1;
        if (!a.hasStory && b.hasStory) return 1;
        return 0;
      });
  }, [squadMembers, storyStatus, user?.id]);

  const refetch = useCallback(() => {
    setFetchTrigger(prev => prev + 1);
  }, []);

  return {
    storyUsers,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Lightweight hook to just check if current user has any stories
 */
export function useCurrentUserHasStory(): { hasStory: boolean; isLoading: boolean } {
  const { user } = useUser();
  const [hasStory, setHasStory] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkStory = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/stories?userId=${user.id}`);
        if (response.ok) {
          const data = await response.json();
          setHasStory((data.stories?.length || 0) > 0);
        }
      } catch {
        setHasStory(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkStory();
  }, [user?.id]);

  return { hasStory, isLoading };
}

