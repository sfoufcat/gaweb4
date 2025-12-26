'use client';

import { useRouter } from 'next/navigation';
import type { FirebaseUser } from '@/types';
import { StoryAvatar } from '@/components/stories/StoryAvatar';
import { useCurrentUserStoryAvailability, useUserStoryAvailability } from '@/hooks/useUserStoryAvailability';
import { useStoryViewTracking, useStoryViewStatus, generateStoryContentData } from '@/hooks/useStoryViewTracking';

interface ProfileHeaderProps {
  user: FirebaseUser;
  userId: string;
  clerkUser?: {
    imageUrl?: string;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  isOwnProfile?: boolean;
  onEditClick?: () => void;
  onSettingsClick?: () => void;
  onMessageClick?: () => void;
}

export function ProfileHeader({ 
  user, 
  userId,
  clerkUser,
  isOwnProfile = true, 
  onEditClick,
  onSettingsClick,
  onMessageClick 
}: ProfileHeaderProps) {
  const router = useRouter();
  
  // Story hooks - conditionally use current user hook for own profile, or user story hook for others
  const currentUserStory = useCurrentUserStoryAvailability();
  const otherUserStory = useUserStoryAvailability(isOwnProfile ? '' : userId);
  const { markStoryAsViewed } = useStoryViewTracking();
  
  // Select the appropriate story data based on profile type
  const storyData = isOwnProfile ? currentUserStory : otherUserStory;
  const { hasStory, showRing, showCheck, contentHash, data: storyDetails } = storyData;
  
  // Generate full content data for smart view tracking
  // This ensures content removal (story expiry) doesn't turn the ring green
  const contentData = generateStoryContentData(
    storyDetails.hasTasksToday,
    storyDetails.hasDayClosed,
    storyDetails.tasks?.length || 0,
    storyDetails.hasWeekClosed,
    storyDetails.userPostedStories?.length || 0
  );
  
  // Use reactive hook for cross-component sync
  const hasViewedFromHook = useStoryViewStatus(userId, contentData);
  const hasViewed = hasStory && contentHash ? hasViewedFromHook : false;
  
  // Handler to mark story as viewed when opened
  const handleStoryViewed = () => {
    markStoryAsViewed(userId, contentData);
  };
  
  const displayName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim();
  const profession = user.profession;
  const company = user.company;
  const location = user.location;
  // For own profile, Clerk is the source of truth for profile pictures.
  // For other profiles, use Firebase data since we don't have their Clerk user object.
  const avatarUrl = isOwnProfile 
    ? (clerkUser?.imageUrl || user.avatarUrl || user.imageUrl)
    : (user.avatarUrl || user.imageUrl);
  
  // User info for StoryAvatar
  const storyUserInfo = {
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    imageUrl: avatarUrl || '',
  };

  return (
    <div className="flex flex-col gap-6 py-5">
      {/* Mobile: Back/Actions Row */}
      <div className="flex lg:hidden items-center justify-between w-full">
        <button
          onClick={() => router.back()}
          className="w-6 h-6 flex items-center justify-center"
        >
          <svg className="w-full h-full text-text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          {isOwnProfile ? (
            <>
              {/* Pencil icon for Edit Profile */}
              <button
                onClick={onEditClick}
                className="w-9 h-9 flex items-center justify-center"
                aria-label="Edit profile"
              >
                <svg className="w-6 h-6 text-text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              </button>
              {/* Gear icon for Settings */}
              <button
                onClick={onSettingsClick}
                className="w-9 h-9 flex items-center justify-center"
                aria-label="Settings"
              >
                <svg className="w-6 h-6 text-text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </>
          ) : (
            <button
              onClick={onMessageClick}
              className="w-9 h-9 flex items-center justify-center"
            >
              <svg className="w-6 h-6 text-text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Mobile: Centered Avatar, Name, Info */}
      <div className="flex lg:hidden flex-col items-center gap-4 w-full">
        {/* Story Avatar */}
        <StoryAvatar
          user={storyUserInfo}
          userId={userId}
          hasStory={hasStory}
          showRing={showRing}
          showCheck={showCheck}
          userPostedStories={storyDetails.userPostedStories}
          goal={storyDetails.goal}
          tasks={storyDetails.tasks}
          hasDayClosed={storyDetails.hasDayClosed}
          completedTasks={storyDetails.completedTasks}
          eveningCheckIn={storyDetails.eveningCheckIn}
          hasViewed={hasViewed}
          contentHash={contentHash}
          onStoryViewed={handleStoryViewed}
          size="xl"
        />

        {/* Name and Info - Centered */}
        <div className="flex flex-col gap-2 items-center text-center">
          <h1 className="font-albert text-[36px] text-text-primary tracking-[-2px] leading-[1.2]">
            {displayName}
          </h1>

          {/* Profession & Location */}
          <div className="flex flex-col gap-1">
            {(profession || company) && (
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <p className="font-sans text-base text-text-secondary tracking-[-0.3px] leading-[1.2]">
                  {profession}{company && `, ${company}`}
                </p>
              </div>
            )}

            {location && (
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="font-sans text-base text-text-secondary tracking-[-0.3px] leading-[1.2]">
                  {location}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Desktop: Avatar + Name Side by Side with Settings Icon */}
      <div className="hidden lg:flex items-center justify-between w-full">
        {/* Left: Avatar and Name */}
        <div className="flex items-center gap-4">
          {/* Story Avatar */}
          <StoryAvatar
            user={storyUserInfo}
            userId={userId}
            hasStory={hasStory}
            showRing={showRing}
            showCheck={showCheck}
            userPostedStories={storyDetails.userPostedStories}
            goal={storyDetails.goal}
            tasks={storyDetails.tasks}
            hasDayClosed={storyDetails.hasDayClosed}
            completedTasks={storyDetails.completedTasks}
            eveningCheckIn={storyDetails.eveningCheckIn}
            hasViewed={hasViewed}
            contentHash={contentHash}
            onStoryViewed={handleStoryViewed}
            size="xl"
            className="flex-shrink-0"
          />

          {/* Name and Info */}
          <div className="flex flex-col gap-2">
            <h1 className="font-albert text-[36px] text-text-primary tracking-[-2px] leading-[1.2]">
              {displayName}
            </h1>

            {/* Profession & Location */}
            <div className="flex flex-col gap-1">
              {(profession || company) && (
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <p className="font-sans text-base text-text-secondary tracking-[-0.3px] leading-[1.2]">
                    {profession}{company && `, ${company}`}
                  </p>
                </div>
              )}

              {location && (
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="font-sans text-base text-text-secondary tracking-[-0.3px] leading-[1.2]">
                    {location}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Edit/Settings/Message Icons */}
        <div className="flex items-center gap-2">
          {isOwnProfile ? (
            <>
              {/* Pencil icon for Edit Profile */}
              <button
                onClick={onEditClick}
                className="w-10 h-10 flex items-center justify-center hover:bg-[#f3f1ef] dark:hover:bg-[#1e222a] rounded-full transition-colors"
                aria-label="Edit profile"
              >
                <svg className="w-6 h-6 text-text-primary dark:text-[#f5f5f8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              </button>
              {/* Gear icon for Settings */}
              <button
                onClick={onSettingsClick}
                className="w-10 h-10 flex items-center justify-center hover:bg-[#f3f1ef] dark:hover:bg-[#1e222a] rounded-full transition-colors"
                aria-label="Settings"
              >
                <svg className="w-6 h-6 text-text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </>
          ) : (
            <button
              onClick={onMessageClick}
              className="w-10 h-10 flex items-center justify-center hover:bg-[#f3f1ef] dark:hover:bg-[#1e222a] rounded-full transition-colors"
            >
              <svg className="w-7 h-7 text-text-primary dark:text-[#f5f5f8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

