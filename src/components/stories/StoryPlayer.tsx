'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { StoryProgress } from './StoryProgress';
import { TaskStorySlide } from './TaskStorySlide';
import { GoalStorySlide } from './GoalStorySlide';
import { DayClosedStorySlide } from './DayClosedStorySlide';
import { WeekClosedStorySlide } from './WeekClosedStorySlide';
import { UserPostStorySlide } from './UserPostStorySlide';
import Image from 'next/image';
import { getProfileUrl } from '@/lib/utils';
import type { Task } from '@/types';

export interface StorySlide {
  /** Unique identifier for this slide (used for view tracking) */
  id: string;
  type: 'tasks' | 'goal' | 'dayClosed' | 'weekClosed' | 'user_post';
  data: {
    tasks?: Task[];
    goalTitle?: string;
    targetDate?: string;
    progress?: number;
    completedTasks?: Task[];
    tasksCompleted?: number;
    tasksTotal?: number;
    // Week closed slide data
    progressChange?: number;
    publicFocus?: string;
    // User post slide data
    imageUrl?: string;
    videoUrl?: string;
    caption?: string;
    createdAt?: string;
    expiresAt?: string;
  };
}

interface StoryPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  slides: StorySlide[];
  user: {
    id?: string;
    firstName: string;
    lastName: string;
    imageUrl: string;
  };
  isLoading?: boolean;
  /** Called when all slides finish (for auto-advancing to next user) */
  onStoryComplete?: () => void;
  /** Initial slide index to start from (for resuming where user left off) */
  initialSlideIndex?: number;
  /** Called when a slide is viewed (progress completes for that slide) */
  onSlideViewed?: (slideId: string) => void;
}

const SLIDE_DURATION = 6000; // 6 seconds per slide
const PROGRESS_INTERVAL = 50; // Update progress every 50ms
const ANIMATION_DURATION = 300; // Animation duration in ms

/**
 * StoryPlayer - Instagram-style full-screen story viewer
 * 
 * Features:
 * - Progress bars showing current slide
 * - Auto-advance after 6 seconds
 * - Tap left/right to navigate
 * - Pause button and hold-to-pause
 * - Close button and ESC key support
 * - Click avatar/name to go to profile
 * - Mobile and desktop responsive
 */
export function StoryPlayer({ 
  isOpen, 
  onClose, 
  slides, 
  user, 
  isLoading = false, 
  onStoryComplete,
  initialSlideIndex = 0,
  onSlideViewed,
}: StoryPlayerProps) {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [animationState, setAnimationState] = useState<'closed' | 'opening' | 'open' | 'closing'>('closed');
  const [isAnimating, setIsAnimating] = useState(false);
  const progressRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerDownTimeRef = useRef<number>(0);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const HOLD_THRESHOLD = 150; // ms - hold longer than this to pause

  // Track mount state for portal
  useEffect(() => {
    setMounted(true);
    return () => {
      setMounted(false);
      // Clean up any pending hold timeout
      if (holdTimeoutRef.current) {
        clearTimeout(holdTimeoutRef.current);
      }
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  // Handle open/close animations
  useEffect(() => {
    if (isOpen && animationState === 'closed') {
      // Start opening animation
      setAnimationState('opening');
      animationTimeoutRef.current = setTimeout(() => {
        setAnimationState('open');
      }, ANIMATION_DURATION);
    } else if (!isOpen && (animationState === 'open' || animationState === 'opening')) {
      // Start closing animation
      setAnimationState('closing');
      animationTimeoutRef.current = setTimeout(() => {
        setAnimationState('closed');
      }, ANIMATION_DURATION);
    }
  }, [isOpen, animationState]);

  // Trigger the visual animation after initial render (for smooth open effect)
  useEffect(() => {
    if (animationState === 'opening') {
      // Small delay to ensure initial state is rendered before animating
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else if (animationState === 'closing') {
      setIsAnimating(false);
    } else if (animationState === 'closed') {
      setIsAnimating(false);
    }
  }, [animationState]);

  // Reset state when opening - start from initialSlideIndex
  useEffect(() => {
    if (isOpen) {
      // Ensure initialSlideIndex is within bounds
      const validIndex = Math.max(0, Math.min(initialSlideIndex, slides.length - 1));
      setCurrentSlide(validIndex);
      setProgress(0);
      setIsPaused(false);
      startTimeRef.current = Date.now();
      pausedAtRef.current = 0;
    }
  }, [isOpen, initialSlideIndex, slides.length]);

  // Handle progress and auto-advance
  useEffect(() => {
    if (!isOpen || slides.length === 0 || isPaused) {
      if (progressRef.current) {
        clearInterval(progressRef.current);
        progressRef.current = null;
      }
      return;
    }

    // Adjust start time for paused time
    if (pausedAtRef.current > 0) {
      const pausedDuration = Date.now() - pausedAtRef.current;
      startTimeRef.current += pausedDuration;
      pausedAtRef.current = 0;
    } else if (startTimeRef.current === 0) {
      startTimeRef.current = Date.now();
    }

    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const newProgress = Math.min((elapsed / SLIDE_DURATION) * 100, 100);
      setProgress(newProgress);

      if (elapsed >= SLIDE_DURATION) {
        // Mark current slide as viewed
        const currentSlideData = slides[currentSlide];
        if (currentSlideData && onSlideViewed) {
          onSlideViewed(currentSlideData.id);
        }

        // Advance to next slide or complete
        if (currentSlide < slides.length - 1) {
          setCurrentSlide(prev => prev + 1);
          setProgress(0);
          startTimeRef.current = Date.now();
        } else {
          // All slides finished - call onStoryComplete if provided (for auto-advance)
          if (onStoryComplete) {
            // Reset state for next user's story
            setCurrentSlide(0);
            setProgress(0);
            startTimeRef.current = Date.now();
            onStoryComplete();
          } else {
            // Close with animation
            setAnimationState('closing');
            setTimeout(() => {
              setAnimationState('closed');
              onClose();
            }, ANIMATION_DURATION);
          }
        }
      }
    }, PROGRESS_INTERVAL);

    return () => {
      if (progressRef.current) {
        clearInterval(progressRef.current);
        progressRef.current = null;
      }
    };
  }, [isOpen, currentSlide, slides.length, onClose, isPaused]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentSlide, slides.length, onClose, isPaused]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleNext = useCallback(() => {
    // Mark current slide as viewed when skipping
    const currentSlideData = slides[currentSlide];
    if (currentSlideData && onSlideViewed) {
      onSlideViewed(currentSlideData.id);
    }

    if (currentSlide < slides.length - 1) {
      setCurrentSlide(prev => prev + 1);
      setProgress(0);
      startTimeRef.current = Date.now();
    } else {
      // All slides finished - call onStoryComplete if provided (for auto-advance)
      if (onStoryComplete) {
        // Reset state for next user's story
        setCurrentSlide(0);
        setProgress(0);
        startTimeRef.current = Date.now();
        onStoryComplete();
      } else if (animationState === 'open' || animationState === 'opening') {
        // Close with animation
        setAnimationState('closing');
        animationTimeoutRef.current = setTimeout(() => {
          setAnimationState('closed');
          onClose();
        }, ANIMATION_DURATION);
      }
    }
  }, [currentSlide, slides, onClose, animationState, onStoryComplete, onSlideViewed]);

  const handlePrevious = useCallback(() => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
      setProgress(0);
      startTimeRef.current = Date.now();
    }
  }, [currentSlide]);

  const togglePause = useCallback(() => {
    setIsPaused(prev => {
      if (!prev) {
        // Pausing
        pausedAtRef.current = Date.now();
      }
      return !prev;
    });
  }, []);

  // Handle hold to pause (only pause on long press, short tap = navigate)
  const handlePointerDown = useCallback((_e: React.PointerEvent) => {
    pointerDownTimeRef.current = Date.now();
    
    // Start a timeout - if held for HOLD_THRESHOLD, pause
    holdTimeoutRef.current = setTimeout(() => {
      pausedAtRef.current = Date.now();
      setIsPaused(true);
    }, HOLD_THRESHOLD);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    // Clear the hold timeout
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }

    const holdDuration = Date.now() - pointerDownTimeRef.current;
    
    if (isPaused) {
      // Was a long hold - just unpause, don't navigate
      setIsPaused(false);
    } else if (holdDuration < HOLD_THRESHOLD) {
      // Was a quick tap - navigate
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const halfWidth = rect.width / 2;

      if (x < halfWidth) {
        handlePrevious();
      } else {
        handleNext();
      }
    }
  }, [isPaused, handlePrevious, handleNext]);

  const handlePointerCancel = useCallback(() => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    setIsPaused(false);
  }, []);

  // Navigate to user profile (uses getProfileUrl for proper routing)
  const handleProfileClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // Close with animation then navigate
    setAnimationState('closing');
    setTimeout(() => {
      setAnimationState('closed');
      onClose();
      const profileUrl = getProfileUrl(user.id, clerkUser?.id || '');
      router.push(profileUrl);
    }, ANIMATION_DURATION);
  }, [onClose, router, user.id, clerkUser?.id]);

  // Handle close with animation
  const handleClose = useCallback(() => {
    if (animationState === 'open' || animationState === 'opening') {
      setAnimationState('closing');
      animationTimeoutRef.current = setTimeout(() => {
        setAnimationState('closed');
        onClose();
      }, ANIMATION_DURATION);
    }
  }, [animationState, onClose]);

  // Get user display name
  const userName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'User';

  // Don't render if not mounted or fully closed
  // BUT do render if isLoading (even with empty slides) so we show the spinner
  if (!mounted || animationState === 'closed' || (!isLoading && slides.length === 0)) return null;

  const currentSlideData = slides[currentSlide];

  // Animation classes based on state
  const backdropClasses = isAnimating || animationState === 'open'
    ? 'opacity-100 backdrop-blur-sm'
    : 'opacity-0 backdrop-blur-none';
  
  const containerClasses = isAnimating || animationState === 'open'
    ? 'scale-100 opacity-100 translate-y-0'
    : animationState === 'closing' 
      ? 'scale-90 opacity-0 translate-y-4'
      : 'scale-50 opacity-0 translate-y-8';

  const content = (
    <div 
      className={`fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center transition-all duration-300 ease-out ${backdropClasses}`}
      onClick={(e) => {
        // Close if clicking outside the story card
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      {/* Story Container */}
      <div 
        ref={containerRef}
        className={`relative w-full max-w-[450px] h-full max-h-[800px] sm:h-[85vh] sm:rounded-[24px] overflow-hidden bg-gray-900 cursor-pointer select-none transition-all duration-300 ease-spring ${containerClasses}`}
        style={{
          boxShadow: isAnimating || animationState === 'open' 
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)' 
            : 'none'
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerCancel}
        onPointerCancel={handlePointerCancel}
      >
        {/* Story Slide Content */}
        <div className="absolute inset-0">
          {isLoading ? (
            // Content-only spinner (shell shows above)
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : currentSlideData?.type === 'user_post' ? (
            <UserPostStorySlide
              imageUrl={currentSlideData.data.imageUrl}
              videoUrl={currentSlideData.data.videoUrl}
              caption={currentSlideData.data.caption}
              createdAt={currentSlideData.data.createdAt}
              expiresAt={currentSlideData.data.expiresAt}
              isPaused={isPaused}
            />
          ) : currentSlideData?.type === 'tasks' ? (
            <TaskStorySlide 
              tasks={currentSlideData.data.tasks || []} 
              userName={userName}
            />
          ) : currentSlideData?.type === 'goal' ? (
            <GoalStorySlide 
              goalTitle={currentSlideData.data.goalTitle || ''}
              targetDate={currentSlideData.data.targetDate || ''}
              progress={currentSlideData.data.progress}
              userName={userName}
            />
          ) : currentSlideData?.type === 'weekClosed' ? (
            <WeekClosedStorySlide
              progressChange={currentSlideData.data.progressChange || 0}
              publicFocus={currentSlideData.data.publicFocus}
              userName={userName}
            />
          ) : currentSlideData ? (
            <DayClosedStorySlide
              completedTasks={currentSlideData.data.completedTasks || []}
              userName={userName}
              tasksCompleted={currentSlideData.data.tasksCompleted}
              tasksTotal={currentSlideData.data.tasksTotal}
            />
          ) : null}
        </div>

        {/* Pause Indicator */}
        {isPaused && !isLoading && (
          <div className="absolute inset-0 z-15 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-black/40 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            </div>
          </div>
        )}

        {/* Header Overlay - ALWAYS visible (shell-first approach) */}
        <div className="absolute top-0 left-0 right-0 z-20 pt-3">
          {/* Progress Bars - show skeleton when loading */}
          <div className="mb-3">
            {isLoading ? (
              // Skeleton progress bar
              <div className="flex gap-1 px-4">
                <div className="flex-1 h-[3px] rounded-full bg-white/20" />
              </div>
            ) : (
              <StoryProgress 
                totalSlides={slides.length}
                currentSlide={currentSlide}
                progress={progress}
              />
            )}
          </div>

          {/* User Info + Controls - ALWAYS visible */}
          <div className="flex items-center justify-between px-4">
            {/* User Avatar + Name - Clickable to profile */}
            <button 
              onClick={handleProfileClick}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-600 ring-2 ring-white/30">
                {user.imageUrl ? (
                  <Image 
                    src={user.imageUrl} 
                    alt={userName} 
                    width={36}
                    height={36}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm">
                    {user.firstName?.[0]}{user.lastName?.[0]}
                  </div>
                )}
              </div>
              <span className="font-albert text-[16px] font-medium text-white">
                {userName}
              </span>
            </button>

            {/* Control Buttons */}
            <div className="flex items-center gap-1">
              {/* Pause/Play Button - only show when not loading */}
              {!isLoading && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePause();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white transition-colors"
                  aria-label={isPaused ? "Play story" : "Pause story"}
                >
                  {isPaused ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  )}
                </button>
              )}

              {/* Close Button */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white transition-colors"
                aria-label="Close story"
              >
                <svg 
                  className="w-6 h-6" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  strokeWidth={2} 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Hint Overlay (invisible tap areas) */}
        {!isLoading && (
          <div className="absolute inset-0 z-10 pointer-events-none">
            <div className="absolute left-0 top-0 bottom-0 w-1/3" />
            <div className="absolute right-0 top-0 bottom-0 w-1/3" />
          </div>
        )}
      </div>
    </div>
  );

  // Render through portal
  return createPortal(content, document.body);
}
