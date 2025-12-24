'use client';

import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { StoryAvatar } from '@/components/stories/StoryAvatar';
import { useCurrentUserHasStory, type FeedStoryUser } from '@/hooks/useFeedStories';

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
  const { user } = useUser();
  const currentUserStatus = useCurrentUserHasStory();
  
  // Determine ring color based on status (matches StoryAvatar logic)
  const getCurrentUserRingColor = () => {
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
        {/* Other users skeletons */}
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-earth-200 dark:bg-[#262b35] animate-pulse" />
            <div className="w-10 h-3 bg-earth-200 dark:bg-[#262b35] rounded animate-pulse" />
          </div>
        ))}
      </>
    );
  }

  return (
    <>
      {/* Your Story - Custom button with add (+) icon */}
      <button
        onClick={() => currentUserStatus.hasStory && user?.id ? onViewStory?.(user.id) : onCreateStory?.()}
        className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
      >
        <div className="relative">
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
            // No stories - show dashed border with add hint
            <div className="w-14 h-14 rounded-full overflow-hidden bg-earth-200 border-2 border-dashed border-earth-300 dark:border-[#3a3f4a] group-hover:border-solid transition-all">
              {user?.imageUrl ? (
                <Image
                  src={user.imageUrl}
                  alt="Your story"
                  width={56}
                  height={56}
                  className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm font-bold text-earth-700">
                  {(user?.firstName?.[0] || '')}{(user?.lastName?.[0] || '')}
                </div>
              )}
            </div>
          )}
          {/* Plus icon for adding story - always visible */}
          <div 
            className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm z-20"
            style={{ backgroundColor: RING_COLORS.green }}
          >
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
        </div>
        <span className="text-xs text-text-secondary font-medium">Your Story</span>
      </button>

      {/* Other users' stories - using StoryAvatar for visual consistency */}
      {usersWithStories.map((storyUser) => (
        <div key={storyUser.id} className="flex flex-col items-center gap-1.5 flex-shrink-0">
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
            // Override click to use feed's story viewer
            onClick={() => onViewStory?.(storyUser.id)}
            size="md"
          />
          <span className="text-xs text-text-secondary font-medium truncate max-w-[56px]">
            {storyUser.firstName}
          </span>
        </div>
      ))}
    </>
  );
}

