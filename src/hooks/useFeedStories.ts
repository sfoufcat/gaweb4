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

interface CommunityMember {
  userId: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
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
 * Takes squad members as input and also fetches org community members.
 * Returns them formatted for the StoriesRow with story availability status.
 */
export function useFeedStories(squadMembers: SquadMember[]): UseFeedStoriesReturn {
  const { user } = useUser();
  const [communityMembers, setCommunityMembers] = useState<CommunityMember[]>([]);
  const [storyStatus, setStoryStatus] = useState<Map<string, boolean>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  // Fetch community members if no squad members
  useEffect(() => {
    const fetchCommunity = async () => {
      if (squadMembers.length > 0) {
        // Use squad members, no need to fetch community
        setCommunityMembers([]);
        return;
      }

      try {
        const response = await fetch('/api/feed/community');
        if (response.ok) {
          const data = await response.json();
          setCommunityMembers(data.members || []);
        }
      } catch (err) {
        console.error('[useFeedStories] Error fetching community:', err);
      }
    };

    fetchCommunity();
  }, [squadMembers.length]);

  // Combine squad members and community members
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
    return communityMembers
      .filter(m => m.userId !== user?.id)
      .map(m => ({
        id: m.userId,
        firstName: m.firstName,
        lastName: m.lastName,
        imageUrl: m.imageUrl,
      }));
  }, [squadMembers, communityMembers, user?.id]);

  // Get member IDs
  const memberIds = useMemo(() => allMembers.map(m => m.id), [allMembers]);

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
                // User has story if API says so (includes both user-posted AND auto-generated)
                results.set(userId, data.hasStory === true);
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

  // Convert members to FeedStoryUser format
  const storyUsers = useMemo((): FeedStoryUser[] => {
    return allMembers
      .map(member => ({
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        imageUrl: member.imageUrl,
        hasStory: storyStatus.get(member.id) || false,
        // For now, all stories are "unseen" - we can add viewed tracking later
        hasUnseenStory: storyStatus.get(member.id) || false,
      }))
      // Sort: users with stories first
      .sort((a, b) => {
        if (a.hasStory && !b.hasStory) return -1;
        if (!a.hasStory && b.hasStory) return 1;
        return 0;
      });
  }, [allMembers, storyStatus]);

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
          // hasStory includes both user-posted AND auto-generated stories
          setHasStory(data.hasStory === true);
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

