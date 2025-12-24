'use client';

import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { useBrandingValues } from '@/contexts/BrandingContext';
import { useCurrentUserHasStory } from '@/hooks/useFeedStories';

interface StoryUser {
  id: string;
  firstName: string;
  lastName: string;
  imageUrl?: string;
  hasUnseenStory: boolean;
  hasStory?: boolean;
}

interface StoriesRowProps {
  /** Users with active stories */
  storyUsers?: StoryUser[];
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
 * Similar to Instagram/Facebook stories UI.
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
  const { colors, isDefault } = useBrandingValues();
  const { hasStory: currentUserHasStory, isLoading: isCheckingCurrentUserStory } = useCurrentUserHasStory();
  
  const accentColor = isDefault ? '#a07855' : colors.accentLight;

  // Filter to only show users who have stories
  const usersWithStories = storyUsers.filter(u => u.hasStory || u.hasUnseenStory);

  if (isLoading) {
    return (
      <>
        {/* Your Story skeleton */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
          <div className="w-16 h-16 rounded-full bg-[#e1ddd8]/50 dark:bg-[#262b35] animate-pulse" />
          <div className="w-12 h-3 bg-[#e1ddd8]/50 dark:bg-[#262b35] rounded animate-pulse" />
        </div>
        {/* Other users skeletons */}
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-[#e1ddd8]/50 dark:bg-[#262b35] animate-pulse" />
            <div className="w-10 h-3 bg-[#e1ddd8]/50 dark:bg-[#262b35] rounded animate-pulse" />
          </div>
        ))}
      </>
    );
  }

  return (
    <>
      {/* Your Story */}
      <button
        onClick={() => currentUserHasStory && user?.id ? onViewStory?.(user.id) : onCreateStory?.()}
        className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
      >
        <div className="relative">
          {/* Avatar with story ring if has stories, dashed border otherwise */}
          {currentUserHasStory && !isCheckingCurrentUserStory ? (
            // Has stories - show gradient ring
            <div 
              className="w-16 h-16 rounded-full p-0.5"
              style={{
                background: `linear-gradient(135deg, ${accentColor}, #f59e0b)`,
              }}
            >
              <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-[#171b22] p-0.5">
                {user?.imageUrl ? (
                  <Image
                    src={user.imageUrl}
                    alt="Your story"
                    width={64}
                    height={64}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <div className="w-full h-full rounded-full flex items-center justify-center bg-[#f5f3f0] dark:bg-[#262b35] text-lg font-semibold text-text-secondary">
                    {(user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // No stories - show dashed border with add hint
            <div className="w-16 h-16 rounded-full overflow-hidden bg-[#f5f3f0] dark:bg-[#262b35] border-2 border-dashed border-[#d1ccc6] dark:border-[#3a3f4a] group-hover:border-solid transition-all">
              {user?.imageUrl ? (
                <Image
                  src={user.imageUrl}
                  alt="Your story"
                  width={64}
                  height={64}
                  className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-lg font-semibold text-text-secondary">
                  {(user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')}
                </div>
              )}
            </div>
          )}
          {/* Plus icon - always visible for adding more to story */}
          <div 
            className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full flex items-center justify-center border-2 border-white dark:border-[#171b22]"
            style={{ backgroundColor: accentColor }}
          >
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
        </div>
        <span className="text-xs text-text-secondary font-medium">Your Story</span>
      </button>

      {/* Other users' stories - only show users who have stories */}
      {usersWithStories.map((storyUser) => (
        <button
          key={storyUser.id}
          onClick={() => onViewStory?.(storyUser.id)}
          className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
        >
          <div className="relative">
            {/* Story ring - colored if unseen, gray if seen */}
            <div 
              className="w-16 h-16 rounded-full p-0.5"
              style={{
                background: storyUser.hasUnseenStory 
                  ? `linear-gradient(135deg, ${accentColor}, #f59e0b)` 
                  : '#d1d5db',
              }}
            >
              <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-[#171b22] p-0.5">
                {storyUser.imageUrl ? (
                  <Image
                    src={storyUser.imageUrl}
                    alt={`${storyUser.firstName}'s story`}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <div className="w-full h-full rounded-full flex items-center justify-center bg-[#f5f3f0] dark:bg-[#262b35] text-lg font-semibold text-text-secondary">
                    {storyUser.firstName?.[0]}{storyUser.lastName?.[0]}
                  </div>
                )}
              </div>
            </div>
          </div>
          <span className="text-xs text-text-secondary font-medium truncate max-w-[64px]">
            {storyUser.firstName}
          </span>
        </button>
      ))}
    </>
  );
}

