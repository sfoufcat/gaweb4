'use client';

import { useCallback, useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import type { StorySlide } from '@/components/stories/StoryPlayer';

const STORAGE_KEY = 'ga_story_views';
const SLIDE_STORAGE_KEY = 'ga_story_slides_viewed';
const STORY_VIEWED_EVENT = 'ga:story-viewed';
const SLIDE_VIEWED_EVENT = 'ga:slide-viewed';

interface StoryViewRecord {
  [key: string]: string; // key: `${viewerUserId}:${storyUserId}`, value: contentHash
}

interface SlideViewState {
  viewedAt: number;        // timestamp when viewed
  weekNumber?: number;     // for Goal: which week it was viewed
}

interface SlideViewRecord {
  [key: string]: SlideViewState; // key: slideId
}

interface UserSlideViews {
  [key: string]: SlideViewRecord; // key: `${viewerUserId}:${storyOwnerId}`
}

/**
 * Get ISO week number for a date
 */
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * useStoryViewTracking Hook
 * 
 * Tracks which stories the current user has viewed using localStorage.
 * A story is considered "viewed" if the user has seen it with the current content hash.
 * 
 * The content hash changes when:
 * - Morning check-in adds tasks (hasTasksToday changes)
 * - Evening check-in completes (hasDayClosed changes)
 * - Tasks are added/removed (taskCount changes)
 * - New day starts (both states reset)
 * 
 * This allows the UI to gray out already-viewed stories.
 */
export function useStoryViewTracking() {
  const { user } = useUser();
  const viewerId = user?.id;

  /**
   * Get all stored view records from localStorage
   */
  const getStoredViews = useCallback((): StoryViewRecord => {
    if (typeof window === 'undefined') return {};
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }, []);

  /**
   * Save view records to localStorage
   */
  const saveViews = useCallback((views: StoryViewRecord) => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
    } catch (error) {
      console.error('Failed to save story views:', error);
    }
  }, []);

  /**
   * Mark a story as viewed by the current user
   * @param storyUserId - The ID of the user whose story was viewed
   * @param contentHash - A hash representing the current story content
   */
  const markStoryAsViewed = useCallback((storyUserId: string, contentHash: string) => {
    if (!viewerId || !storyUserId) return;
    
    const views = getStoredViews();
    const key = `${viewerId}:${storyUserId}`;
    views[key] = contentHash;
    saveViews(views);
    
    // Dispatch custom event for cross-component reactivity
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(STORY_VIEWED_EVENT, {
        detail: { storyUserId, contentHash }
      }));
    }
  }, [viewerId, getStoredViews, saveViews]);

  /**
   * Check if the current user has viewed a story with the given content hash
   * @param storyUserId - The ID of the user whose story to check
   * @param contentHash - The current content hash of the story
   * @returns true if the story has been viewed with this exact content hash
   */
  const hasViewedStory = useCallback((storyUserId: string, contentHash: string): boolean => {
    if (!viewerId || !storyUserId) return false;
    
    const views = getStoredViews();
    const key = `${viewerId}:${storyUserId}`;
    const storedHash = views[key];
    
    // Story is "viewed" only if the stored hash matches the current content hash
    return storedHash === contentHash;
  }, [viewerId, getStoredViews]);

  /**
   * Clear all stored view records (useful for testing/debugging)
   */
  const clearAllViews = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SLIDE_STORAGE_KEY);
  }, []);

  // ==========================================================================
  // INDIVIDUAL SLIDE TRACKING
  // ==========================================================================

  /**
   * Get all stored slide view records from localStorage
   */
  const getStoredSlideViews = useCallback((): UserSlideViews => {
    if (typeof window === 'undefined') return {};
    
    try {
      const stored = localStorage.getItem(SLIDE_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }, []);

  /**
   * Save slide view records to localStorage
   */
  const saveSlideViews = useCallback((views: UserSlideViews) => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(SLIDE_STORAGE_KEY, JSON.stringify(views));
    } catch (error) {
      console.error('Failed to save slide views:', error);
    }
  }, []);

  /**
   * Mark a single slide as viewed
   * @param storyOwnerId - The ID of the user whose story contains this slide
   * @param slideId - The unique ID of the slide
   */
  const markSlideAsViewed = useCallback((storyOwnerId: string, slideId: string) => {
    if (!viewerId || !storyOwnerId || !slideId) return;
    
    const views = getStoredSlideViews();
    const key = `${viewerId}:${storyOwnerId}`;
    
    if (!views[key]) {
      views[key] = {};
    }
    
    const viewState: SlideViewState = {
      viewedAt: Date.now(),
    };
    
    // For Goal slides, also store the week number
    if (slideId === 'goal') {
      viewState.weekNumber = getISOWeekNumber(new Date());
    }
    
    views[key][slideId] = viewState;
    saveSlideViews(views);
    
    // Dispatch custom event for cross-component reactivity
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SLIDE_VIEWED_EVENT, {
        detail: { storyOwnerId, slideId }
      }));
    }
  }, [viewerId, getStoredSlideViews, saveSlideViews]);

  /**
   * Check if a single slide has been viewed
   * @param storyOwnerId - The ID of the user whose story contains this slide
   * @param slideId - The unique ID of the slide
   * @returns true if the slide has been viewed (with weekly reset for Goal)
   */
  const isSlideViewed = useCallback((storyOwnerId: string, slideId: string): boolean => {
    if (!viewerId || !storyOwnerId || !slideId) return false;
    
    const views = getStoredSlideViews();
    const key = `${viewerId}:${storyOwnerId}`;
    const slideState = views[key]?.[slideId];
    
    if (!slideState) return false;
    
    // For Goal slides, check if it was viewed in the current week
    if (slideId === 'goal' && slideState.weekNumber !== undefined) {
      const currentWeek = getISOWeekNumber(new Date());
      return slideState.weekNumber === currentWeek;
    }
    
    // For other slides, just check if it exists (was viewed)
    return true;
  }, [viewerId, getStoredSlideViews]);

  /**
   * Get the index of the first unviewed slide
   * @param storyOwnerId - The ID of the user whose story to check
   * @param slides - Array of slides to check
   * @returns The index of the first unviewed slide, or 0 if all are viewed
   */
  const getFirstUnviewedSlideIndex = useCallback((storyOwnerId: string, slides: StorySlide[]): number => {
    if (!viewerId || !storyOwnerId || slides.length === 0) return 0;
    
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      if (!isSlideViewed(storyOwnerId, slide.id)) {
        return i;
      }
    }
    
    // All slides viewed - start from beginning
    return 0;
  }, [viewerId, isSlideViewed]);

  /**
   * Check if all slides have been viewed
   * @param storyOwnerId - The ID of the user whose story to check
   * @param slides - Array of slides to check
   * @returns true if all slides have been viewed
   */
  const areAllSlidesViewed = useCallback((storyOwnerId: string, slides: StorySlide[]): boolean => {
    if (!viewerId || !storyOwnerId || slides.length === 0) return false;
    
    return slides.every(slide => isSlideViewed(storyOwnerId, slide.id));
  }, [viewerId, isSlideViewed]);

  /**
   * Clear slide view records for a specific user (useful when content changes dramatically)
   */
  const clearSlideViewsForUser = useCallback((storyOwnerId: string) => {
    if (!viewerId || !storyOwnerId) return;
    
    const views = getStoredSlideViews();
    const key = `${viewerId}:${storyOwnerId}`;
    delete views[key];
    saveSlideViews(views);
  }, [viewerId, getStoredSlideViews, saveSlideViews]);

  return {
    markStoryAsViewed,
    hasViewedStory,
    clearAllViews,
    // Individual slide tracking
    markSlideAsViewed,
    isSlideViewed,
    getFirstUnviewedSlideIndex,
    areAllSlidesViewed,
    clearSlideViewsForUser,
  };
}

/**
 * Generate a content hash for a story based on its current state
 * This hash changes when the story content changes, resetting the "viewed" state
 * 
 * @param hasTasksToday - Whether the user has tasks today
 * @param hasDayClosed - Whether the user has completed evening check-in
 * @param taskCount - Number of tasks (optional, for more granular tracking)
 * @param hasWeekClosed - Whether the user has completed weekly check-in
 * @param userPostCount - Number of user-posted stories (optional)
 * @returns A string hash representing the story content state
 */
export function generateStoryContentHash(
  hasTasksToday: boolean,
  hasDayClosed: boolean,
  taskCount: number = 0,
  hasWeekClosed: boolean = false,
  userPostCount: number = 0
): string {
  return `${hasTasksToday}:${hasDayClosed}:${taskCount}:${hasWeekClosed}:${userPostCount}`;
}

/**
 * useStoryViewStatus Hook
 * 
 * Reactive hook that returns whether a story has been viewed.
 * Automatically updates when:
 * - The story is marked as viewed (via custom event)
 * - localStorage changes (cross-tab sync via storage event)
 * 
 * @param storyUserId - The ID of the user whose story to track
 * @param contentHash - The current content hash of the story
 * @returns hasViewed - Whether the story has been viewed with the current content hash
 */
export function useStoryViewStatus(storyUserId?: string, contentHash?: string): boolean {
  const { user } = useUser();
  const viewerId = user?.id;
  
  const [hasViewed, setHasViewed] = useState(false);
  
  // Check localStorage for initial state and on dependency changes
  useEffect(() => {
    if (!viewerId || !storyUserId || !contentHash) {
      setHasViewed(false);
      return;
    }
    
    const checkViewStatus = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const views = JSON.parse(stored);
          const key = `${viewerId}:${storyUserId}`;
          setHasViewed(views[key] === contentHash);
        } else {
          setHasViewed(false);
        }
      } catch {
        setHasViewed(false);
      }
    };
    
    // Check initial state
    checkViewStatus();
    
    // Listen for custom event (same-page sync)
    const handleStoryViewed = (event: Event) => {
      const customEvent = event as CustomEvent<{ storyUserId: string; contentHash: string }>;
      if (customEvent.detail.storyUserId === storyUserId && customEvent.detail.contentHash === contentHash) {
        setHasViewed(true);
      }
    };
    
    // Listen for storage event (cross-tab sync)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        checkViewStatus();
      }
    };
    
    window.addEventListener(STORY_VIEWED_EVENT, handleStoryViewed);
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener(STORY_VIEWED_EVENT, handleStoryViewed);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [viewerId, storyUserId, contentHash]);
  
  return hasViewed;
}

