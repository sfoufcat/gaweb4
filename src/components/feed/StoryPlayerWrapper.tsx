'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { StoryPlayer } from '@/components/stories/StoryPlayer';
import { useStoryData, prefetchStories, type StoryData } from '@/hooks/useStoryPrefetch';
import { useStoryViewTracking, generateStoryContentData } from '@/hooks/useStoryViewTracking';
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
 * - Uses SWR cache for instant loads on previously-viewed stories
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
  const [initialSlideIndex, setInitialSlideIndex] = useState(0);
  const { markStoryAsViewed, markSlideAsViewed, getFirstUnviewedSlideIndex } = useStoryViewTracking();

  // Track if we've triggered initial prefetch
  const hasPrefetchedRef = useRef(false);

  // Track if we've ever had a valid story user (to distinguish initial mount from data race)
  const hadValidUserRef = useRef(false);

  // Get all user IDs for the story queue
  const userIds = useMemo(() => storyUsers.map(u => u.id), [storyUsers]);

  // Get current user in the queue
  const currentStoryUser = storyUsers[currentIndex];
  const isViewingOwnStory = currentStoryUser?.id === clerkUser?.id;

  // Use SWR to fetch story data - this provides global caching
  const { 
    data: storyData, 
    slides, 
    isLoading 
  } = useStoryData(currentStoryUser?.id || null);

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

  // Calculate resume slide index when story data changes
  useEffect(() => {
    if (currentStoryUser?.id && slides.length > 0) {
      const resumeIndex = getFirstUnviewedSlideIndex(currentStoryUser.id, slides);
      setInitialSlideIndex(resumeIndex);
    } else {
      setInitialSlideIndex(0);
    }
  }, [currentStoryUser?.id, slides, getFirstUnviewedSlideIndex]);

  // Prefetch next stories when current index changes
  useEffect(() => {
    if (currentIndex < userIds.length - 1) {
      prefetchStories(userIds, currentIndex + 1, PREFETCH_WINDOW);
    }
  }, [currentIndex, userIds]);

  // Initial prefetch on mount
  useEffect(() => {
    if (!hasPrefetchedRef.current && userIds.length > 0) {
      hasPrefetchedRef.current = true;
      prefetchStories(userIds, startIndex, PREFETCH_WINDOW);
    }
  }, [userIds, startIndex]);

  // Handle individual slide viewed - mark in localStorage
  const handleSlideViewed = useCallback((slideId: string) => {
    if (!currentStoryUser) return;
    markSlideAsViewed(currentStoryUser.id, slideId);
  }, [currentStoryUser, markSlideAsViewed]);

  // Handle story complete - advance to next user
  const handleStoryComplete = useCallback(() => {
    // Mark current story as viewed (for the ring color tracking)
    // Use full content data so we can distinguish between content added vs removed
    if (currentStoryUser) {
      const contentData = generateStoryContentData(
        currentStoryUser.hasTasks,
        currentStoryUser.hasDayClosed,
        currentStoryUser.taskCount,
        currentStoryUser.hasWeekClosed,
        currentStoryUser.userPostCount
      );
      markStoryAsViewed(currentStoryUser.id, contentData);
    }

    // Check if there are more users
    if (currentIndex < storyUsers.length - 1) {
      // Reset initial slide index for next user
      setInitialSlideIndex(0);
      setCurrentIndex(prev => prev + 1);
    } else {
      // No more users - close the viewer
      onClose();
    }
  }, [currentIndex, storyUsers.length, currentStoryUser, markStoryAsViewed, onClose]);

  // Handle close - mark story as viewed and close
  const handleClose = useCallback(() => {
    // Mark current story as viewed with full content data
    if (currentStoryUser) {
      const contentData = generateStoryContentData(
        currentStoryUser.hasTasks,
        currentStoryUser.hasDayClosed,
        currentStoryUser.taskCount,
        currentStoryUser.hasWeekClosed,
        currentStoryUser.userPostCount
      );
      markStoryAsViewed(currentStoryUser.id, contentData);
    }
    onClose();
  }, [currentStoryUser, markStoryAsViewed, onClose]);

  // Track when we have a valid story user
  useEffect(() => {
    if (currentStoryUser) {
      hadValidUserRef.current = true;
    }
  }, [currentStoryUser]);

  // Handle case where current user disappears from queue AFTER we had one (data race/refetch)
  // This can happen when fullStoryQueue recalculates and the index becomes invalid
  // Without this, the parent stays in "story open" state but nothing renders
  // IMPORTANT: Only close if we HAD a valid user and lost it - not on initial render
  useEffect(() => {
    if (hadValidUserRef.current && !currentStoryUser && storyUsers.length > 0) {
      onClose();
    }
  }, [currentStoryUser, storyUsers.length, onClose]);

  // Don't render if no user
  if (!storyPlayerUser) {
    return null;
  }

  return (
    <StoryPlayer
      isOpen={true}
      onClose={handleClose}
      slides={slides}
      user={storyPlayerUser}
      isLoading={isLoading}
      onStoryComplete={handleStoryComplete}
      initialSlideIndex={initialSlideIndex}
      onSlideViewed={handleSlideViewed}
    />
  );
}
