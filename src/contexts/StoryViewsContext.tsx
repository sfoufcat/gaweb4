'use client';

import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { DEMO_USER } from '@/lib/demo-utils';
import type { StoryContentData } from '@/hooks/useStoryViewTracking';

const STORAGE_KEY = 'ga_story_views_v2';
const STORY_VIEWED_EVENT = 'ga:story-viewed';

interface StoryViewRecord {
  [key: string]: StoryContentData; // key: `${viewerId}:${storyUserId}`
}

interface StoryViewsContextValue {
  /** Check if a story has been viewed (no new content since last view) */
  hasViewedStory: (storyOwnerId: string, currentData: StoryContentData) => boolean;
  /** Mark a story as viewed (saves to localStorage + server) */
  markStoryAsViewed: (storyOwnerId: string, contentData: StoryContentData) => void;
  /** Batch fetch view statuses from server (call once when stories load) */
  fetchServerViews: (storyOwnerIds: string[]) => Promise<void>;
  /** Whether server views have been fetched */
  hasFetchedServer: boolean;
}

const StoryViewsContext = createContext<StoryViewsContextValue | null>(null);

export function StoryViewsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const { isDemoMode } = useDemoMode();
  const [hasFetchedServer, setHasFetchedServer] = useState(false);
  const fetchedRef = useRef(false);

  // Version counter to trigger re-renders when views change
  const [, setVersion] = useState(0);

  const viewerId = useMemo(() => {
    if (isDemoMode) return DEMO_USER.id;
    return user?.id;
  }, [isDemoMode, user?.id]);

  // Get views from localStorage
  const getStoredViews = useCallback((): StoryViewRecord => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }, []);

  // Save views to localStorage
  const saveViews = useCallback((views: StoryViewRecord) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
      // Trigger re-render for consumers
      setVersion(v => v + 1);
    } catch (error) {
      console.error('Failed to save story views:', error);
    }
  }, []);

  // Check if story is viewed based on stored data vs current data
  const checkIfViewed = useCallback((storedData: StoryContentData | null, currentData: StoryContentData): boolean => {
    if (!storedData) return false;

    // Check if content has INCREASED (new content added = unseen)
    const hasNewContent =
      currentData.taskCount > storedData.taskCount ||
      currentData.userPostCount > storedData.userPostCount ||
      (currentData.hasDayClosed && !storedData.hasDayClosed) ||
      (currentData.hasWeekClosed && !storedData.hasWeekClosed) ||
      (currentData.hasTasksToday && !storedData.hasTasksToday);

    return !hasNewContent;
  }, []);

  // Check if user has viewed a story
  const hasViewedStory = useCallback((storyOwnerId: string, currentData: StoryContentData): boolean => {
    if (!viewerId || !storyOwnerId) return false;

    const views = getStoredViews();
    const key = `${viewerId}:${storyOwnerId}`;
    const storedData = views[key];

    return checkIfViewed(storedData, currentData);
  }, [viewerId, getStoredViews, checkIfViewed]);

  // Mark a story as viewed
  const markStoryAsViewed = useCallback((storyOwnerId: string, contentData: StoryContentData) => {
    if (!viewerId || !storyOwnerId) return;

    // 1. Save to localStorage
    const views = getStoredViews();
    const key = `${viewerId}:${storyOwnerId}`;
    views[key] = contentData;
    saveViews(views);

    // 2. Dispatch event for cross-component reactivity
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(STORY_VIEWED_EVENT, {
        detail: { storyUserId: storyOwnerId, contentData }
      }));
    }

    // 3. Sync to server (fire-and-forget)
    if (!isDemoMode) {
      fetch('/api/story-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyOwnerId, contentData }),
      }).catch(err => console.error('Failed to sync story view to server:', err));
    }
  }, [viewerId, isDemoMode, getStoredViews, saveViews]);

  // Batch fetch view statuses from server
  const fetchServerViews = useCallback(async (storyOwnerIds: string[]) => {
    if (!viewerId || isDemoMode || storyOwnerIds.length === 0 || fetchedRef.current) {
      return;
    }

    fetchedRef.current = true;

    try {
      const response = await fetch(`/api/story-views?storyOwnerIds=${storyOwnerIds.join(',')}`);
      if (!response.ok) return;

      const data = await response.json();
      const serverViews = data.views as Record<string, StoryContentData | null>;

      // Merge server data with localStorage
      const localViews = getStoredViews();
      let hasChanges = false;

      for (const [ownerId, serverData] of Object.entries(serverViews)) {
        if (serverData) {
          const key = `${viewerId}:${ownerId}`;
          // Only add if not in localStorage (server is source of truth for cross-device)
          if (!localViews[key]) {
            localViews[key] = serverData;
            hasChanges = true;
          }
        }
      }

      if (hasChanges) {
        saveViews(localViews);
      }

      setHasFetchedServer(true);
    } catch {
      // Silent fail - localStorage is the fallback
    }
  }, [viewerId, isDemoMode, getStoredViews, saveViews]);

  // Listen for storage events (cross-tab sync)
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setVersion(v => v + 1);
      }
    };

    const handleStoryViewed = () => {
      setVersion(v => v + 1);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(STORY_VIEWED_EVENT, handleStoryViewed);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(STORY_VIEWED_EVENT, handleStoryViewed);
    };
  }, []);

  const value = useMemo(() => ({
    hasViewedStory,
    markStoryAsViewed,
    fetchServerViews,
    hasFetchedServer,
  }), [hasViewedStory, markStoryAsViewed, fetchServerViews, hasFetchedServer]);

  return (
    <StoryViewsContext.Provider value={value}>
      {children}
    </StoryViewsContext.Provider>
  );
}

export function useStoryViews() {
  const context = useContext(StoryViewsContext);
  if (!context) {
    throw new Error('useStoryViews must be used within a StoryViewsProvider');
  }
  return context;
}
