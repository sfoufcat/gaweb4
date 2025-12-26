'use client';

import { useCallback, useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import type { StorySlide } from '@/components/stories/StoryPlayer';

const STORAGE_KEY = 'ga_story_views_v2'; // v2 for new format with component values
const SLIDE_STORAGE_KEY = 'ga_story_slides_viewed';
const STORY_VIEWED_EVENT = 'ga:story-viewed';
const SLIDE_VIEWED_EVENT = 'ga:slide-viewed';

/**
 * Data representing the story content state when it was viewed
 * Used to determine if content has increased (new) or decreased (expired)
 */
export interface StoryContentData {
  hash: string;
  taskCount: number;
  userPostCount: number;
  hasDayClosed: boolean;
  hasWeekClosed: boolean;
  hasTasksToday: boolean;
}

interface StoryViewRecord {
  [key: string]: StoryContentData; // key: `${viewerUserId}:${storyUserId}`, value: content data
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
   * @param contentData - The content data representing current story state
   */
  const markStoryAsViewed = useCallback((storyUserId: string, contentData: StoryContentData) => {
    if (!viewerId || !storyUserId) return;
    
    const views = getStoredViews();
    const key = `${viewerId}:${storyUserId}`;
    views[key] = contentData;
    saveViews(views);
    
    // Dispatch custom event for cross-component reactivity
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(STORY_VIEWED_EVENT, {
        detail: { storyUserId, contentData }
      }));
    }
  }, [viewerId, getStoredViews, saveViews]);

  /**
   * Check if the current user has viewed a story
   * A story is considered "viewed" (gray ring) unless NEW content was added.
   * Content decreasing (story expiry) keeps the viewed status.
   * 
   * @param storyUserId - The ID of the user whose story to check
   * @param currentData - The current content data of the story
   * @returns true if the story has been viewed (no new content added)
   */
  const hasViewedStory = useCallback((storyUserId: string, currentData: StoryContentData): boolean => {
    if (!viewerId || !storyUserId) return false;
    
    const views = getStoredViews();
    const key = `${viewerId}:${storyUserId}`;
    const storedData = views[key];
    
    // Never viewed before
    if (!storedData) return false;
    
    // Check if content has INCREASED (new content added = unseen)
    // If any of these are true, we have new content -> return false (not viewed)
    const hasNewContent = 
      currentData.taskCount > storedData.taskCount ||
      currentData.userPostCount > storedData.userPostCount ||
      (currentData.hasDayClosed && !storedData.hasDayClosed) ||
      (currentData.hasWeekClosed && !storedData.hasWeekClosed) ||
      (currentData.hasTasksToday && !storedData.hasTasksToday);
    
    // If content has increased, consider it unseen (not viewed)
    // If content decreased or stayed same, keep viewed status
    return !hasNewContent;
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
 * Generate full content data for a story based on its current state
 * This is used for smart view tracking that distinguishes between
 * content being added (show green) vs removed (stay gray)
 * 
 * @param hasTasksToday - Whether the user has tasks today
 * @param hasDayClosed - Whether the user has completed evening check-in
 * @param taskCount - Number of tasks
 * @param hasWeekClosed - Whether the user has completed weekly check-in
 * @param userPostCount - Number of user-posted stories
 * @returns StoryContentData object with all component values
 */
export function generateStoryContentData(
  hasTasksToday: boolean,
  hasDayClosed: boolean,
  taskCount: number = 0,
  hasWeekClosed: boolean = false,
  userPostCount: number = 0
): StoryContentData {
  return {
    hash: generateStoryContentHash(hasTasksToday, hasDayClosed, taskCount, hasWeekClosed, userPostCount),
    hasTasksToday,
    hasDayClosed,
    taskCount,
    hasWeekClosed,
    userPostCount,
  };
}

/**
 * useStoryViewStatus Hook
 * 
 * Reactive hook that returns whether a story has been viewed.
 * A story is considered "viewed" (gray ring) unless NEW content was added.
 * Content decreasing (story expiry) keeps the viewed status.
 * 
 * Automatically updates when:
 * - The story is marked as viewed (via custom event)
 * - localStorage changes (cross-tab sync via storage event)
 * 
 * @param storyUserId - The ID of the user whose story to track
 * @param currentData - The current content data of the story (or just contentHash for backwards compat)
 * @returns hasViewed - Whether the story has been viewed (no new content added)
 */
export function useStoryViewStatus(
  storyUserId?: string, 
  currentData?: StoryContentData | string // Accept either full data or just hash for backwards compat
): boolean {
  const { user } = useUser();
  const viewerId = user?.id;
  
  const [hasViewed, setHasViewed] = useState(false);
  
  // Normalize currentData - if it's a string (old hash format), we can't do smart comparison
  const normalizedData: StoryContentData | null = typeof currentData === 'string' 
    ? null // Can't do smart comparison with just a hash
    : currentData || null;
  
  // Check localStorage for initial state and on dependency changes
  useEffect(() => {
    if (!viewerId || !storyUserId || !currentData) {
      setHasViewed(false);
      return;
    }
    
    const checkViewStatus = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          setHasViewed(false);
          return;
        }
        
        const views: StoryViewRecord = JSON.parse(stored);
        const key = `${viewerId}:${storyUserId}`;
        const storedData = views[key];
        
        if (!storedData) {
          setHasViewed(false);
          return;
        }
        
        // If we have full data, do smart comparison
        if (normalizedData) {
          // Check if content has INCREASED (new content added = unseen)
          const hasNewContent = 
            normalizedData.taskCount > storedData.taskCount ||
            normalizedData.userPostCount > storedData.userPostCount ||
            (normalizedData.hasDayClosed && !storedData.hasDayClosed) ||
            (normalizedData.hasWeekClosed && !storedData.hasWeekClosed) ||
            (normalizedData.hasTasksToday && !storedData.hasTasksToday);
          
          setHasViewed(!hasNewContent);
        } else {
          // Fallback: just compare hashes (old behavior)
          const currentHash = typeof currentData === 'string' ? currentData : currentData.hash;
          setHasViewed(storedData.hash === currentHash);
        }
      } catch {
        setHasViewed(false);
      }
    };
    
    // Check initial state
    checkViewStatus();
    
    // Listen for custom event (same-page sync)
    const handleStoryViewed = (event: Event) => {
      const customEvent = event as CustomEvent<{ storyUserId: string; contentData: StoryContentData }>;
      if (customEvent.detail.storyUserId === storyUserId) {
        // When a story is just viewed, mark it as viewed
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
  }, [viewerId, storyUserId, currentData, normalizedData]);
  
  return hasViewed;
}

