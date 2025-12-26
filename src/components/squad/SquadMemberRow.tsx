'use client';

import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import type { SquadMember } from '@/types';
import { useUserStoryAvailability } from '@/hooks/useUserStoryAvailability';
import { useStoryViewTracking, useStoryViewStatus, generateStoryContentData } from '@/hooks/useStoryViewTracking';
import { StoryAvatar } from '@/components/stories/StoryAvatar';
import { getProfileUrl } from '@/lib/utils';

/**
 * SquadMemberRow Component
 * 
 * Displays a single squad member with:
 * - Avatar with story ring/check (opens story player)
 * - Name (clickable, links to profile)
 * - Status label (for coach or alignment score)
 * - Progress bar (colored based on alignment percentage)
 * - Personal streak indicator
 * 
 * Alignment colors:
 * - 0% = red (#F44336)
 * - 25% = orange (#FF9800)
 * - 50% = yellow (#FFC107)
 * - 75% = yellow-green (#8BC34A)
 * - 100% = green (#4CAF50)
 */

interface SquadMemberRowProps {
  member: SquadMember;
}

/**
 * Get alignment bar color based on score
 */
function getAlignmentColor(score: number): string {
  if (score === 0) return '#F44336'; // Red
  if (score <= 25) return '#FF9800'; // Orange
  if (score <= 50) return '#FFC107'; // Yellow
  if (score <= 75) return '#8BC34A'; // Yellow-green
  return '#4CAF50'; // Green
}

export function SquadMemberRow({ member }: SquadMemberRowProps) {
  const { user: clerkUser } = useUser();
  const isCoach = member.roleInSquad === 'coach';

  // Fetch story availability for this member
  const storyAvailability = useUserStoryAvailability(member.userId);
  
  // Generate full content data for smart view tracking
  // This ensures content removal (story expiry) doesn't turn the ring green
  const contentData = generateStoryContentData(
    storyAvailability.data.hasTasksToday,
    storyAvailability.data.hasDayClosed,
    storyAvailability.data.tasks?.length || 0,
    storyAvailability.data.hasWeekClosed,
    storyAvailability.data.userPostedStories?.length || 0
  );
  
  // Story view tracking - use reactive hook for cross-component sync
  const { markStoryAsViewed } = useStoryViewTracking();
  const hasViewedFromHook = useStoryViewStatus(
    isCoach ? undefined : member.userId,
    isCoach ? undefined : contentData
  );
  const hasViewed = !isCoach && storyAvailability.hasStory && storyAvailability.contentHash
    ? hasViewedFromHook
    : false;
  
  const handleStoryViewed = () => {
    markStoryAsViewed(member.userId, contentData);
  };

  // Generate profile URL for this member
  const profileUrl = getProfileUrl(member.userId, clerkUser?.id || '');

  // Check if alignment data is loading (null = loading, number = loaded)
  const isAlignmentLoading = member.alignmentScore === null || member.alignmentScore === undefined;
  const alignmentScore = member.alignmentScore ?? 0;
  const streak = member.streak ?? 0;
  const alignmentColor = getAlignmentColor(alignmentScore);

  return (
    <div className="border-b border-[#e1ddd8] dark:border-[#262b35] last:border-b-0 py-4">
      <div className="flex items-center gap-4">
        {/* Avatar - Coach has plain avatar, members have story ring */}
        <StoryAvatar
          user={{
            firstName: member.firstName || '',
            lastName: member.lastName || '',
            imageUrl: member.imageUrl || '',
          }}
          userId={member.userId}
          hasStory={isCoach ? false : storyAvailability.hasStory}
          showRing={isCoach ? false : storyAvailability.showRing}
          showCheck={isCoach ? false : storyAvailability.showCheck}
          userPostedStories={isCoach ? undefined : storyAvailability.data.userPostedStories}
          goal={isCoach ? undefined : storyAvailability.data.goal}
          tasks={isCoach ? undefined : storyAvailability.data.tasks}
          hasDayClosed={isCoach ? false : storyAvailability.data.hasDayClosed}
          completedTasks={isCoach ? undefined : storyAvailability.data.completedTasks}
          eveningCheckIn={isCoach ? undefined : storyAvailability.data.eveningCheckIn}
          hasViewed={hasViewed}
          contentHash={isCoach ? undefined : storyAvailability.contentHash}
          onStoryViewed={isCoach ? undefined : handleStoryViewed}
          size="lg"
        />

        {/* Name + Status/Progress - Name links to profile */}
        <div className="flex-1 min-w-0">
          <Link 
            href={profileUrl}
            className="font-albert text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] leading-[1.3] tracking-[-1px] truncate block hover:opacity-80 transition-opacity"
          >
            {member.firstName} {member.lastName}
            {isCoach && <span className="ml-1.5">🛡️</span>}
          </Link>

          {isCoach ? (
            <p className="font-sans text-[12px] text-text-secondary dark:text-[#b2b6c2] leading-[1.2] mt-1">
              Squad coach
            </p>
          ) : isAlignmentLoading ? (
            // Skeleton UI while alignment data is loading
            <div className="flex items-center gap-3 mt-1">
              {/* Skeleton Progress Bar */}
              <div className="flex items-center gap-1">
                <div className="w-[100px] h-[6px] bg-[#e1ddd8] dark:bg-[#262b35] rounded-[10px] overflow-hidden">
                  <div className="h-full w-full bg-gradient-to-r from-[#e1ddd8] via-[#d4d0cb] to-[#e1ddd8] dark:from-[#262b35] dark:via-[#313746] dark:to-[#262b35] animate-pulse rounded-[12px]" />
                </div>
                <div className="w-[60px] h-[12px] bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse" />
              </div>

              {/* Skeleton Streak */}
              <div className="flex items-center gap-1">
                <span className="text-[12px] opacity-30">🔥</span>
                <div className="w-[16px] h-[12px] bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 mt-1">
              {/* Alignment Progress Bar */}
              <div className="flex items-center gap-1">
                <div className="w-[100px] h-[6px] bg-[#e1ddd8] dark:bg-[#262b35] rounded-[10px] overflow-hidden">
                  <div 
                    className="h-full rounded-[12px] transition-all duration-300"
                    style={{ 
                      width: `${alignmentScore}%`,
                      backgroundColor: alignmentColor,
                      minWidth: alignmentScore > 0 ? '4px' : '0px', // Show tiny bar even at low %
                    }}
                  />
                </div>
                <span className="font-sans text-[12px] text-text-secondary dark:text-[#b2b6c2] leading-[1.2]">
                  {alignmentScore}% aligned
                </span>
              </div>

              {/* Personal Streak */}
              <div className="flex items-center gap-1">
                <span className="text-[12px]">🔥</span>
                <span className="font-sans text-[12px] text-text-secondary dark:text-[#b2b6c2] leading-[1.2]">
                  {streak}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
