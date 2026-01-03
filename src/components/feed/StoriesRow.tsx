'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { StoryAvatar } from '@/components/stories/StoryAvatar';
import { useCurrentUserHasStory, type FeedStoryUser } from '@/hooks/useFeedStories';
import { useStoryViewStatus, useStoryViewTracking, generateStoryContentData } from '@/hooks/useStoryViewTracking';
import { prefetchStories } from '@/hooks/useStoryPrefetch';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { DEMO_USER } from '@/lib/demo-utils';

// Ring colors matching StoryAvatar
const RING_COLORS = {
  green: '#4CAF50',
  brown: '#8B7355',
  gray: '#9CA3AF',
};

interface StoriesRowProps {
  /** Users with active stories */
  storyUsers?: FeedStoryUser[];
  /** Loading state */
  isLoading?: boolean;
  /** Callback when user wants to create a story */
  onCreateStory?: () => void;
  /** Callback when user clicks on a story */
  onViewStory?: (userId: string) => void;
}

/**
 * Internal component for rendering a feed story user with view tracking
 * 
 * NOTE: We use a div wrapper (not button) because StoryAvatar renders a button internally.
 * Nested buttons are invalid HTML and cause click issues in browsers.
 */
function FeedStoryAvatar({ 
  storyUser, 
  onViewStory 
}: { 
  storyUser: FeedStoryUser; 
  onViewStory?: (userId: string) => void;
}) {
  // Track viewed status using full content data
  // This ensures content removal (story expiry) doesn't turn the ring green
  const contentData = generateStoryContentData(
    storyUser.hasTasks,
    storyUser.hasDayClosed,
    storyUser.taskCount,
    storyUser.hasWeekClosed,
    storyUser.userPostCount
  );
  const hasViewed = useStoryViewStatus(storyUser.id, contentData);

  // This callback is passed to StoryAvatar's onClick prop
  // StoryAvatar will call this instead of opening its internal player
  const handleClick = () => {
    onViewStory?.(storyUser.id);
  };

  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
      <StoryAvatar
        user={{
          firstName: storyUser.firstName,
          lastName: storyUser.lastName,
          imageUrl: storyUser.imageUrl || '',
        }}
        userId={storyUser.id}
        hasStory={storyUser.hasStory}
        showRing={storyUser.hasStory}
        showCheck={storyUser.hasTasks}
        hasDayClosed={storyUser.hasDayClosed}
        hasWeekClosed={storyUser.hasWeekClosed}
        hasViewed={hasViewed}
        contentHash={storyUser.contentHash}
        // Pass onClick to override StoryAvatar's internal behavior
        // When onClick is provided, StoryAvatar calls it instead of opening its player
        onClick={handleClick}
        size="lg" // 56px to match "Your Story"
      />
      <span className="text-xs text-text-secondary font-medium truncate max-w-[56px]">
        {storyUser.firstName}
      </span>
    </div>
  );
}

/**
 * StoriesRow - Horizontal scrollable row of story avatars
 * 
 * Shows "Your Story" first with a + icon, followed by other users' stories.
 * Uses the shared StoryAvatar component for visual consistency with Home tab.
 * 
 * Note: This component renders story items directly without a scroll container.
 * The parent component should provide the scrollable container.
 */
export function StoriesRow({ 
  storyUsers = [],
  isLoading = false,
  onCreateStory,
  onViewStory,
}: StoriesRowProps) {
  const { user: clerkUser } = useUser();
  const { isDemoMode, openSignupModal } = useDemoMode();
  
  // Use demo user data when in demo mode
  const user = useMemo(() => {
    if (isDemoMode) {
      return {
        id: DEMO_USER.id,
        firstName: DEMO_USER.firstName,
        lastName: DEMO_USER.lastName,
        imageUrl: DEMO_USER.imageUrl,
      };
    }
    return clerkUser;
  }, [isDemoMode, clerkUser]);
  
  const currentUserStatus = useCurrentUserHasStory();
  const { markStoryAsViewed } = useStoryViewTracking();
  const hasPrefetchedRef = useRef(false);

  // Pre-load stories in the background when Feed loads
  // This ensures stories are cached before user clicks on them
  useEffect(() => {
    // Only prefetch once and after stories are loaded
    if (hasPrefetchedRef.current || isLoading || storyUsers.length === 0) {
      return;
    }

    // Wait a short delay to not block initial page render
    const timeout = setTimeout(() => {
      // Get user IDs with stories
      const userIdsWithStories = storyUsers
        .filter(u => u.hasStory || u.hasUnseenStory)
        .map(u => u.id);

      // Also include current user if they have a story
      const allUserIds = user?.id && currentUserStatus.hasStory 
        ? [user.id, ...userIdsWithStories]
        : userIdsWithStories;

      if (allUserIds.length > 0) {
        // Prefetch first 5-10 stories (most likely to be viewed)
        prefetchStories(allUserIds, 0, 10);
        hasPrefetchedRef.current = true;
      }
    }, 1000); // 1 second delay to prioritize visible content

    return () => clearTimeout(timeout);
  }, [storyUsers, isLoading, user?.id, currentUserStatus.hasStory]);
  
  // Check if current user has viewed their own story (using full content data for accurate tracking)
  // This ensures content removal (story expiry) doesn't turn the ring green
  const ownContentData = generateStoryContentData(
    currentUserStatus.hasTasks,
    currentUserStatus.hasDayClosed,
    currentUserStatus.taskCount,
    currentUserStatus.hasWeekClosed,
    currentUserStatus.userStoryCount
  );
  const hasViewedOwnStory = useStoryViewStatus(user?.id || '', ownContentData);
  
  // Determine ring color based on status (matches StoryAvatar logic from Home)
  // Gray = viewed, Brown = day closed (not viewed), Green = default (not viewed)
  const getCurrentUserRingColor = () => {
    if (hasViewedOwnStory && currentUserStatus.hasStory) return RING_COLORS.gray;
    if (currentUserStatus.hasDayClosed) return RING_COLORS.brown;
    return RING_COLORS.green;
  };

  // Filter to only show users who have stories
  const usersWithStories = storyUsers.filter(u => u.hasStory || u.hasUnseenStory);

  if (isLoading) {
    return (
      <>
        {/* Your Story skeleton */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
          <div className="w-14 h-14 rounded-full bg-earth-200 dark:bg-[#262b35] animate-pulse" />
          <div className="w-12 h-3 bg-earth-200 dark:bg-[#262b35] rounded animate-pulse" />
        </div>
        {/* Other users skeletons - matching 56px size */}
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div className="w-14 h-14 rounded-full bg-earth-200 dark:bg-[#262b35] animate-pulse" />
            <div className="w-12 h-3 bg-earth-200 dark:bg-[#262b35] rounded animate-pulse" />
          </div>
        ))}
      </>
    );
  }

  // Handle clicking the avatar area (view story if exists)
  const handleAvatarClick = () => {
    if (currentUserStatus.hasStory && user?.id) {
      onViewStory?.(user.id);
    } else {
      // No story - clicking avatar also creates
      // In demo mode, show signup modal instead
      if (isDemoMode) {
        openSignupModal();
        return;
      }
      onCreateStory?.();
    }
  };

  // Handle clicking the plus icon (ALWAYS create story)
  const handlePlusClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent parent button click
    // In demo mode, show signup modal instead
    if (isDemoMode) {
      openSignupModal();
      return;
    }
    onCreateStory?.();
  };

  return (
    <>
      {/* Your Story - Container with clickable avatar and separate plus button */}
      <div className="flex flex-col items-center gap-1.5 flex-shrink-0 group">
        <div className="relative">
          {/* Clickable avatar area - opens story viewer if has story */}
          <button
            onClick={handleAvatarClick}
            className="block"
            aria-label={currentUserStatus.hasStory ? "View your story" : "Add to story"}
          >
            {/* Avatar with story ring (solid color like home) if has stories, dashed border otherwise */}
            {currentUserStatus.hasStory && !currentUserStatus.isLoading ? (
              // Has stories - show solid color ring matching home tab
              <div className="relative w-14 h-14">
                {/* Ring */}
                <div 
                  className="absolute -inset-0.5 rounded-full border-[2.5px]"
                  style={{ borderColor: getCurrentUserRingColor() }}
                />
                {/* Avatar */}
                <div className="w-14 h-14 rounded-full overflow-hidden bg-earth-200">
                  {user?.imageUrl ? (
                    <Image
                      src={user.imageUrl}
                      alt="Your story"
                      width={56}
                      height={56}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm font-bold text-earth-700">
                      {(user?.firstName?.[0] || '')}{(user?.lastName?.[0] || '')}
                    </div>
                  )}
                </div>
                {/* Check badge if has tasks */}
                {currentUserStatus.hasTasks && (
                  <div 
                    className="absolute w-5 h-5 -bottom-0.5 -right-0.5 rounded-full flex items-center justify-center border-2 border-white shadow-sm z-10"
                    style={{ backgroundColor: getCurrentUserRingColor() }}
                  >
                    <svg 
                      className="w-3 h-3 text-white"
                      fill="none" 
                      viewBox="0 0 24 24" 
                      strokeWidth={3} 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                )}
              </div>
            ) : (
              // No stories - clean avatar with subtle hover ring
              <div className="w-14 h-14 rounded-full overflow-hidden bg-earth-200 dark:bg-[#262b35] border-2 border-earth-200 dark:border-[#262b35] group-hover:border-earth-400 dark:group-hover:border-[#5a6070] transition-all">
                {user?.imageUrl ? (
                  <Image
                    src={user.imageUrl}
                    alt="Your story"
                    width={56}
                    height={56}
                    className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm font-bold text-earth-700">
                    {(user?.firstName?.[0] || '')}{(user?.lastName?.[0] || '')}
                  </div>
                )}
              </div>
            )}
          </button>
          {/* Plus icon for adding story - ALWAYS opens create modal */}
          <button
            onClick={handlePlusClick}
            className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm z-20 hover:scale-110 transition-transform"
            style={{ backgroundColor: RING_COLORS.green }}
            aria-label="Add to story"
          >
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        <span className="text-xs text-text-secondary font-medium">Your Story</span>
      </div>

      {/* Other users' stories - using FeedStoryAvatar for viewed tracking */}
      {usersWithStories.map((storyUser) => (
        <FeedStoryAvatar
          key={storyUser.id}
          storyUser={storyUser}
          onViewStory={onViewStory}
        />
      ))}

    </>
  );
}

