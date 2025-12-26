'use client';

import { useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { StoryPlayer, type StorySlide } from './StoryPlayer';
import { useStoryViewTracking, generateStoryContentData } from '@/hooks/useStoryViewTracking';
import type { Task } from '@/types';
import type { UserPostedStory } from '@/hooks/useUserStoryAvailability';

interface StoryAvatarProps {
  // User info
  user: {
    firstName: string;
    lastName: string;
    imageUrl: string;
  };
  // User ID for profile linking (optional - if not provided, defaults to current user)
  userId?: string;
  // Story availability
  hasStory: boolean;
  showRing: boolean;
  showCheck: boolean;
  // User-posted stories (images/videos, 24hr TTL)
  userPostedStories?: UserPostedStory[];
  // Story content
  goal?: {
    title: string;
    targetDate: string;
    progress: number;
  } | null;
  tasks?: Task[];
  // Day Closed story content (evening check-in completed)
  hasDayClosed?: boolean;
  completedTasks?: Task[];
  eveningCheckIn?: {
    emotionalState: string;
    tasksCompleted: number;
    tasksTotal: number;
  } | null;
  // Week Closed story content (weekly check-in completed)
  hasWeekClosed?: boolean;
  weeklyReflection?: {
    progressChange: number;
    publicFocus?: string;
  } | null;
  // View tracking
  hasViewed?: boolean;
  contentHash?: string;
  onStoryViewed?: (contentHash: string) => void;
  // Styling
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  // Disable story opening (e.g., for links that should navigate elsewhere)
  disableStory?: boolean;
  onClick?: () => void;
}

// Color constants
const COLORS = {
  green: '#4CAF50',
  brown: '#8B7355',
  gray: '#9CA3AF',
};

/**
 * StoryAvatar - Avatar wrapper with story ring/check states
 * 
 * States:
 * 1. No ring: user has no active goal (no story)
 * 2. Green ring only: has goal but no tasks today
 * 3. Green ring + check: has goal AND tasks today
 * 4. Gray ring/check: story has been viewed (resets when content changes)
 */
export function StoryAvatar({
  user,
  userId,
  hasStory,
  showRing,
  showCheck,
  userPostedStories = [],
  goal,
  tasks = [],
  hasDayClosed = false,
  completedTasks = [],
  eveningCheckIn,
  hasWeekClosed = false,
  weeklyReflection,
  hasViewed = false,
  contentHash,
  onStoryViewed,
  size = 'md',
  className = '',
  disableStory = false,
  onClick,
}: StoryAvatarProps) {
  const [showStoryPlayer, setShowStoryPlayer] = useState(false);
  
  // Story view tracking for resume functionality
  const { 
    markStoryAsViewed, 
    markSlideAsViewed, 
    getFirstUnviewedSlideIndex 
  } = useStoryViewTracking();

  // Size configurations
  const sizeConfig = {
    sm: {
      container: 'w-10 h-10',
      avatar: 'w-10 h-10',
      ring: '-inset-0.5 border-[2px]',
      check: 'w-4 h-4 -bottom-0.5 -right-0.5',
      checkIcon: 'w-2.5 h-2.5',
      initials: 'text-xs',
    },
    md: {
      container: 'w-12 h-12',
      avatar: 'w-12 h-12',
      ring: '-inset-0.5 border-[2.5px]',
      check: 'w-5 h-5 -bottom-0.5 -right-0.5',
      checkIcon: 'w-3 h-3',
      initials: 'text-sm',
    },
    lg: {
      container: 'w-14 h-14',
      avatar: 'w-14 h-14',
      ring: '-inset-1 border-[3px]',
      check: 'w-6 h-6 -bottom-0.5 -right-0.5',
      checkIcon: 'w-3.5 h-3.5',
      initials: 'text-base',
    },
    xl: {
      container: 'w-40 h-40',
      avatar: 'w-40 h-40',
      ring: '-inset-1.5 border-[4px]',
      check: 'w-8 h-8 -bottom-1 -right-1',
      checkIcon: 'w-5 h-5',
      initials: 'text-2xl',
    },
  };

  const config = sizeConfig[size];
  const userName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'User';

  // Helper to get week start (Monday) for goal timestamp
  const getWeekStart = (): string => {
    const nowDate = new Date();
    const day = nowDate.getDay();
    const diff = nowDate.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(nowDate);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString();
  };

  // Build story slides in CHRONOLOGICAL order (oldest first, newest last)
  // All slides have timestamps and are sorted together
  const buildSlides = (): StorySlide[] => {
    const allSlides: StorySlide[] = [];
    const now = new Date().toISOString();
    const weekStart = getWeekStart();

    // Goal slide - uses week start as base timestamp (shown early in the week)
    if (goal) {
      allSlides.push({
        id: 'goal',
        type: 'goal',
        timestamp: weekStart,
        data: {
          goalTitle: goal.title,
          targetDate: goal.targetDate,
          progress: goal.progress,
        },
      });
    }

    // Tasks slide - use current time since we don't have individual task timestamps here
    if (tasks.length > 0) {
      allSlides.push({
        id: 'tasks',
        type: 'tasks',
        timestamp: now,
        data: { tasks },
      });
    }

    // Day Closed slide
    if (hasDayClosed) {
      const actualCompletedTasks = completedTasks.length > 0 
        ? completedTasks 
        : tasks.filter(t => t.status === 'completed');
      
      allSlides.push({
        id: 'dayClosed',
        type: 'dayClosed',
        timestamp: now,
        data: {
          completedTasks: actualCompletedTasks,
          tasksCompleted: eveningCheckIn?.tasksCompleted || actualCompletedTasks.length,
          tasksTotal: eveningCheckIn?.tasksTotal || tasks.length,
        },
      });
    }

    // Week Closed slide
    if (hasWeekClosed && weeklyReflection) {
      allSlides.push({
        id: 'weekClosed',
        type: 'weekClosed',
        timestamp: now,
        data: {
          progressChange: weeklyReflection.progressChange,
          publicFocus: weeklyReflection.publicFocus,
        },
      });
    }

    // User-posted stories with their createdAt as timestamp
    userPostedStories.forEach((story) => {
      allSlides.push({
        id: story.id,
        type: 'user_post',
        timestamp: story.createdAt,
        data: {
          imageUrl: story.imageUrl,
          videoUrl: story.videoUrl,
          caption: story.caption,
          createdAt: story.createdAt,
          expiresAt: story.expiresAt,
        },
      });
    });

    // Sort all slides by timestamp (oldest first, newest last)
    allSlides.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return allSlides;
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }

    if (!disableStory && hasStory) {
      setShowStoryPlayer(true);
      // Mark story as viewed when opened
      if (onStoryViewed && contentHash) {
        onStoryViewed(contentHash);
      }
    }
  };

  // Determine ring/check color based on viewed state
  const getRingColor = () => {
    if (hasViewed) return COLORS.gray;
    return hasDayClosed ? COLORS.brown : COLORS.green;
  };

  const getCheckColor = () => {
    if (hasViewed) return COLORS.gray;
    return hasDayClosed ? COLORS.brown : COLORS.green;
  };

  // Memoize slides to prevent unnecessary recalculations
  const slides = useMemo(() => buildSlides(), [
    goal, tasks, hasDayClosed, completedTasks, eveningCheckIn, 
    hasWeekClosed, weeklyReflection, userPostedStories
  ]);

  // Calculate initial slide index (resume where user left off)
  const initialSlideIndex = useMemo(() => {
    if (!userId || slides.length === 0) return 0;
    return getFirstUnviewedSlideIndex(userId, slides);
  }, [userId, slides, getFirstUnviewedSlideIndex]);

  // Handle slide viewed - mark in localStorage
  const handleSlideViewed = useCallback((slideId: string) => {
    if (!userId) return;
    markSlideAsViewed(userId, slideId);
  }, [userId, markSlideAsViewed]);

  // Handle story complete - mark entire story as viewed
  const handleStoryComplete = useCallback(() => {
    if (userId) {
      // Use full content data for smart view tracking
      // This ensures content removal (story expiry) doesn't turn the ring green
      const contentData = generateStoryContentData(
        tasks.length > 0, // hasTasksToday
        hasDayClosed,
        tasks.length,
        hasWeekClosed,
        userPostedStories.length
      );
      markStoryAsViewed(userId, contentData);
    }
    setShowStoryPlayer(false);
  }, [userId, tasks.length, hasDayClosed, hasWeekClosed, userPostedStories.length, markStoryAsViewed]);

  return (
    <>
      <button
        onClick={handleClick}
        className={`relative ${config.container} ${className} ${
          // Always show pointer cursor when onClick is provided OR when has story
          (onClick || (hasStory && !disableStory)) ? 'cursor-pointer' : ''
        }`}
        type="button"
        aria-label={hasStory ? `View ${userName}'s story` : userName}
        // Ensure touch events work on mobile
        style={{ touchAction: 'manipulation' }}
      >
        {/* Avatar */}
        <div className={`${config.avatar} rounded-full overflow-hidden bg-earth-200`}>
          {user.imageUrl ? (
            <Image 
              src={user.imageUrl} 
              alt={userName} 
              width={64}
              height={64}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center text-earth-700 font-bold ${config.initials}`}>
              {user.firstName?.[0]}{user.lastName?.[0]}
            </div>
          )}
        </div>

        {/* Story Ring - Gray when viewed, brown when day closed, green otherwise */}
        {showRing && (
          <div 
            className={`absolute ${config.ring} rounded-full pointer-events-none`}
            style={{
              background: 'transparent',
              borderColor: getRingColor(),
            }}
          />
        )}

        {/* Check Badge - Gray when viewed, brown when day closed, green otherwise */}
        {showCheck && (
          <div 
            className={`absolute ${config.check} rounded-full flex items-center justify-center border-2 border-white shadow-sm z-10`}
            style={{
              backgroundColor: getCheckColor(),
            }}
          >
            <svg 
              className={`${config.checkIcon} text-white`}
              fill="none" 
              viewBox="0 0 24 24" 
              strokeWidth={3} 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
        )}
      </button>

      {/* Story Player with resume functionality */}
      {hasStory && slides.length > 0 && (
        <StoryPlayer
          isOpen={showStoryPlayer}
          onClose={() => setShowStoryPlayer(false)}
          slides={slides}
          user={{ ...user, id: userId }}
          initialSlideIndex={initialSlideIndex}
          onSlideViewed={handleSlideViewed}
          onStoryComplete={handleStoryComplete}
        />
      )}
    </>
  );
}

