'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { StoryPlayer } from '@/components/stories/StoryPlayer';
import { useStoryPrefetch, type PrefetchedStoryData } from '@/hooks/useStoryPrefetch';
import { useStoryViewTracking } from '@/hooks/useStoryViewTracking';
import type { FeedStoryUser } from '@/hooks/useFeedStories';
import type { StorySlide } from '@/components/stories/StoryPlayer';

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
  const [initialSlideIndex, setInitialSlideIndex] = useState(0);
  const { markStoryAsViewed, markSlideAsViewed, getFirstUnviewedSlideIndex } = useStoryViewTracking();
  
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

  // Calculate resume slide index for a given user's slides
  const calculateResumeIndex = useCallback((userId: string, slides: StorySlide[]): number => {
    if (!userId || slides.length === 0) return 0;
    return getFirstUnviewedSlideIndex(userId, slides);
  }, [getFirstUnviewedSlideIndex]);

  // Fetch story data for current user and prefetch upcoming
  const loadCurrentStory = useCallback(async () => {
    if (!currentStoryUser) return;

    setIsLoadingCurrent(true);

    // Check cache first for instant loading
    const cached = getCachedStoryData(currentStoryUser.id);
    if (cached) {
      setCurrentStoryData(cached);
      // Calculate resume index based on what's been viewed
      setInitialSlideIndex(calculateResumeIndex(currentStoryUser.id, cached.slides));
      setIsLoadingCurrent(false);
    }

    // Fetch (or re-validate) current story
    const data = await fetchStoryData(currentStoryUser.id);
    if (data) {
      setCurrentStoryData(data);
      // Recalculate resume index with fresh data
      setInitialSlideIndex(calculateResumeIndex(currentStoryUser.id, data.slides));
    }
    setIsLoadingCurrent(false);

    // Prefetch next stories in background
    if (currentIndex < userIds.length - 1) {
      prefetchStories(userIds, currentIndex + 1, PREFETCH_WINDOW);
    }
  }, [currentStoryUser, currentIndex, userIds, getCachedStoryData, fetchStoryData, prefetchStories, calculateResumeIndex]);

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

  // Handle individual slide viewed - mark in localStorage
  const handleSlideViewed = useCallback((slideId: string) => {
    if (!currentStoryUser) return;
    markSlideAsViewed(currentStoryUser.id, slideId);
  }, [currentStoryUser, markSlideAsViewed]);

  // Handle story complete - advance to next user
  const handleStoryComplete = useCallback(() => {
    // Mark current story as viewed (for the ring color tracking)
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
          // Calculate resume index for next user
          setInitialSlideIndex(calculateResumeIndex(nextUser.id, cached.slides));
          setIsLoadingCurrent(false);
        } else {
          // Will need to fetch - show loading
          setIsLoadingCurrent(true);
          setInitialSlideIndex(0);
        }
      }
      setCurrentIndex(prev => prev + 1);
    } else {
      // No more users - close the viewer
      onClose();
    }
  }, [currentIndex, storyUsers, currentStoryUser, getCachedStoryData, markStoryAsViewed, calculateResumeIndex, onClose]);

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
      initialSlideIndex={initialSlideIndex}
      onSlideViewed={handleSlideViewed}
    />
  );
}

