'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { StoryPlayer } from '@/components/stories/StoryPlayer';
import { useStoryPrefetch, type PrefetchedStoryData } from '@/hooks/useStoryPrefetch';
import { useStoryViewTracking } from '@/hooks/useStoryViewTracking';
import type { FeedStoryUser } from '@/hooks/useFeedStories';

// =============================================================================
// TYPES
// =============================================================================

interface StoryPlayerWrapperProps {
  /** All users in the story queue (in order) */
  storyUsers: FeedStoryUser[];
  /** Initial user index to start viewing from */
  startIndex: number;
  /** Called when the viewer should close */
  onClose: () => void;
  /** Current user info (for viewing own story) */
  currentUser?: {
    id: string;
    firstName: string;
    lastName: string;
    imageUrl: string;
  } | null;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const PREFETCH_WINDOW = 5; // Number of stories to prefetch ahead

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * StoryPlayerWrapper - Manages story queue, prefetching, and auto-advance
 * 
 * Features:
 * - Shows story player shell instantly with user info
 * - Loads content for current story
 * - Prefetches next N stories in background
 * - Auto-advances to next user when story completes
 * - Handles both own story and other users' stories
 */
export function StoryPlayerWrapper({
  storyUsers,
  startIndex,
  onClose,
  currentUser,
}: StoryPlayerWrapperProps) {
  const { user: clerkUser } = useUser();
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [currentStoryData, setCurrentStoryData] = useState<PrefetchedStoryData | null>(null);
  const [isLoadingCurrent, setIsLoadingCurrent] = useState(true);
  const { markStoryAsViewed } = useStoryViewTracking();
  
  const {
    prefetchStories,
    fetchStoryData,
    getCachedStoryData,
  } = useStoryPrefetch();

  // Track if we've started prefetching to avoid duplicate calls
  const hasPrefetchedRef = useRef(false);

  // Get all user IDs for the story queue
  const userIds = useMemo(() => storyUsers.map(u => u.id), [storyUsers]);

  // Get current user in the queue
  const currentStoryUser = storyUsers[currentIndex];
  const isViewingOwnStory = currentStoryUser?.id === clerkUser?.id;

  // Build user object for StoryPlayer
  const storyPlayerUser = useMemo(() => {
    if (!currentStoryUser) return null;
    
    // If viewing own story and we have currentUser prop, use that
    if (isViewingOwnStory && currentUser) {
      return {
        id: currentUser.id,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        imageUrl: currentUser.imageUrl,
      };
    }
    
    // Otherwise use the story user data from the queue
    return {
      id: currentStoryUser.id,
      firstName: currentStoryUser.firstName,
      lastName: currentStoryUser.lastName,
      imageUrl: currentStoryUser.imageUrl || '',
    };
  }, [currentStoryUser, isViewingOwnStory, currentUser]);

  // Fetch story data for current user and prefetch upcoming
  const loadCurrentStory = useCallback(async () => {
    if (!currentStoryUser) return;

    setIsLoadingCurrent(true);

    // Check cache first for instant loading
    const cached = getCachedStoryData(currentStoryUser.id);
    if (cached) {
      setCurrentStoryData(cached);
      setIsLoadingCurrent(false);
    }

    // Fetch (or re-validate) current story
    const data = await fetchStoryData(currentStoryUser.id);
    if (data) {
      setCurrentStoryData(data);
    }
    setIsLoadingCurrent(false);

    // Prefetch next stories in background
    if (currentIndex < userIds.length - 1) {
      prefetchStories(userIds, currentIndex + 1, PREFETCH_WINDOW);
    }
  }, [currentStoryUser, currentIndex, userIds, getCachedStoryData, fetchStoryData, prefetchStories]);

  // Load current story when index changes
  useEffect(() => {
    loadCurrentStory();
  }, [currentIndex, loadCurrentStory]);

  // Initial prefetch on mount (prefetch from start)
  useEffect(() => {
    if (!hasPrefetchedRef.current && userIds.length > 0) {
      hasPrefetchedRef.current = true;
      // Prefetch stories starting from current index
      prefetchStories(userIds, startIndex, PREFETCH_WINDOW);
    }
  }, [userIds, startIndex, prefetchStories]);

  // Handle story complete - advance to next user
  const handleStoryComplete = useCallback(() => {
    // Mark current story as viewed
    if (currentStoryUser) {
      markStoryAsViewed(currentStoryUser.id, currentStoryUser.contentHash);
    }

    // Check if there are more users
    if (currentIndex < storyUsers.length - 1) {
      // Try to get next story from cache for instant transition
      const nextUser = storyUsers[currentIndex + 1];
      if (nextUser) {
        const cached = getCachedStoryData(nextUser.id);
        if (cached) {
          // Pre-set data for instant transition
          setCurrentStoryData(cached);
          setIsLoadingCurrent(false);
        } else {
          // Will need to fetch - show loading
          setIsLoadingCurrent(true);
        }
      }
      setCurrentIndex(prev => prev + 1);
    } else {
      // No more users - close the viewer
      onClose();
    }
  }, [currentIndex, storyUsers, currentStoryUser, getCachedStoryData, markStoryAsViewed, onClose]);

  // Handle close - mark story as viewed and close
  const handleClose = useCallback(() => {
    // Mark current story as viewed
    if (currentStoryUser) {
      markStoryAsViewed(currentStoryUser.id, currentStoryUser.contentHash);
    }
    onClose();
  }, [currentStoryUser, markStoryAsViewed, onClose]);

  // Don't render if no user
  if (!storyPlayerUser) {
    return null;
  }

  return (
    <StoryPlayer
      isOpen={true}
      onClose={handleClose}
      slides={currentStoryData?.slides || []}
      user={storyPlayerUser}
      isLoading={isLoadingCurrent}
      onStoryComplete={handleStoryComplete}
    />
  );
}

