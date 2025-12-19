'use client';

import { useCallback, useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

const STORAGE_KEY = 'ga_story_views';
const STORY_VIEWED_EVENT = 'ga:story-viewed';

interface StoryViewRecord {
  [key: string]: string; // key: `${viewerUserId}:${storyUserId}`, value: contentHash
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
  }, []);

  return {
    markStoryAsViewed,
    hasViewedStory,
    clearAllViews,
  };
}

/**
 * Generate a content hash for a story based on its current state
 * This hash changes when the story content changes, resetting the "viewed" state
 * 
 * @param hasTasksToday - Whether the user has tasks today
 * @param hasDayClosed - Whether the user has completed evening check-in
 * @param taskCount - Number of tasks (optional, for more granular tracking)
 * @returns A string hash representing the story content state
 */
export function generateStoryContentHash(
  hasTasksToday: boolean,
  hasDayClosed: boolean,
  taskCount: number = 0,
  hasWeekClosed: boolean = false
): string {
  return `${hasTasksToday}:${hasDayClosed}:${taskCount}:${hasWeekClosed}`;
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

