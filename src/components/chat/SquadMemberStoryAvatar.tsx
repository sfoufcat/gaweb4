'use client';

import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { StoryAvatar } from '@/components/stories/StoryAvatar';
import { useUserStoryAvailability } from '@/hooks/useUserStoryAvailability';
import { useStoryViewTracking, useStoryViewStatus } from '@/hooks/useStoryViewTracking';
import { getProfileUrl } from '@/lib/utils';

interface SquadMemberStoryAvatarProps {
  userId: string;
  // Fallback user info from Stream (used while loading story data)
  streamUser: {
    name?: string;
    image?: string;
  };
  size?: 'sm' | 'md' | 'lg';
  // Whether to show the name below the avatar (default: true)
  showName?: boolean;
}

/**
 * SquadMemberStoryAvatar - Wrapper component for squad member avatars with story support
 * 
 * Fetches story data for the given userId and renders a StoryAvatar.
 * - If user has a story: clicking opens the story player
 * - If user has no story: clicking navigates to their profile
 * - Name below avatar is always clickable to navigate to profile
 */
export function SquadMemberStoryAvatar({ 
  userId, 
  streamUser,
  size = 'md',
  showName = true,
}: SquadMemberStoryAvatarProps) {
  const router = useRouter();
  const { user: currentUser } = useUser();
  const { hasStory, showRing, showCheck, contentHash, data, isLoading } = useUserStoryAvailability(userId);
  const { markStoryAsViewed } = useStoryViewTracking();
  
  // Use reactive hook for cross-component sync
  const hasViewedFromHook = useStoryViewStatus(userId, contentHash);
  const hasViewed = hasStory && contentHash ? hasViewedFromHook : false;

  // Handler to mark story as viewed when opened
  const handleStoryViewed = (hash: string) => {
    markStoryAsViewed(userId, hash);
  };

  // Parse name from Stream user data
  const fullName = streamUser.name || 'User';
  const nameParts = fullName.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  const displayName = firstName.length > 8 ? `${firstName.substring(0, 7)}...` : firstName;

  // Merge story data user info with Stream data fallback
  // Prioritize non-empty values from data.user, fall back to Stream data
  const userInfo = {
    firstName: data.user?.firstName || firstName,
    lastName: data.user?.lastName || lastName,
    imageUrl: data.user?.imageUrl || streamUser.image || '',
  };

  const handleProfileClick = () => {
    if (currentUser?.id) {
      router.push(getProfileUrl(userId, currentUser.id));
    }
  };

  // If no story, clicking the avatar should navigate to profile
  const handleAvatarClick = !hasStory ? handleProfileClick : undefined;

  return (
    <div className="flex flex-col items-center flex-shrink-0">
      {/* Story Avatar */}
      <StoryAvatar
        user={userInfo}
        userId={userId}
        hasStory={hasStory}
        showRing={showRing}
        showCheck={showCheck}
        goal={data.goal}
        tasks={data.tasks}
        hasDayClosed={data.hasDayClosed}
        completedTasks={data.completedTasks}
        eveningCheckIn={data.eveningCheckIn}
        hasViewed={hasViewed}
        contentHash={contentHash}
        onStoryViewed={handleStoryViewed}
        size={size}
        onClick={handleAvatarClick}
      />
      
      {/* Name - Always clickable to profile (conditionally rendered) */}
      {showName && (
      <button
        onClick={handleProfileClick}
        className="font-albert text-[11px] text-[#5f5a55] mt-1 text-center hover:text-[#1a1a1a] transition-colors"
        aria-label={`View ${fullName}'s profile`}
      >
        {displayName}
      </button>
      )}
    </div>
  );
}

export default SquadMemberStoryAvatar;

