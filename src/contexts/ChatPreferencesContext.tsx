'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useUser } from '@clerk/nextjs';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import type {
  ChatPreference,
  ChatChannelType,
  ChatPreferenceAction,
} from '@/types/chat-preferences';
import { CHAT_PREFERENCES_COLLECTION } from '@/types/chat-preferences';

// Cache configuration
const CACHE_KEY_PREFIX = 'chat_preferences_v1_';
const CACHE_VERSION = 1;
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

interface CachedPreferences {
  version: number;
  timestamp: number;
  userId: string;
  data: Array<[string, ChatPreference]>; // Map serialized as array of tuples
}

/**
 * Load preferences from localStorage (synchronous for instant access)
 */
function loadFromCache(userId: string): Map<string, ChatPreference> | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(`${CACHE_KEY_PREFIX}${userId}`);
    if (!stored) return null;

    const parsed: CachedPreferences = JSON.parse(stored);

    // Validate version and user
    if (parsed.version !== CACHE_VERSION || parsed.userId !== userId) {
      return null;
    }

    // Check if cache is expired
    if (Date.now() - parsed.timestamp > CACHE_MAX_AGE) {
      return null;
    }

    // Reconstruct Map from array of tuples
    return new Map(parsed.data);
  } catch {
    return null;
  }
}

/**
 * Save preferences to localStorage
 */
function saveToCache(userId: string, preferences: Map<string, ChatPreference>): void {
  if (typeof window === 'undefined') return;

  try {
    const cacheData: CachedPreferences = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      userId,
      data: Array.from(preferences.entries()),
    };
    localStorage.setItem(`${CACHE_KEY_PREFIX}${userId}`, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('[ChatPreferencesContext] Failed to save cache:', error);
  }
}

/**
 * Clear preferences cache
 */
function clearCache(userId: string): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(`${CACHE_KEY_PREFIX}${userId}`);
  } catch (error) {
    console.warn('[ChatPreferencesContext] Failed to clear cache:', error);
  }
}

// Context value interface (matches UseChatPreferencesReturn for compatibility)
export interface ChatPreferencesContextValue {
  // State
  preferences: Map<string, ChatPreference>;
  isLoading: boolean;
  error: Error | null;

  // Computed sets for quick lookups
  pinnedChannelIds: Set<string>;
  archivedChannelIds: Set<string>;
  deletedChannelIds: Set<string>;

  // Actions
  pinChannel: (channelId: string, channelType: ChatChannelType) => Promise<void>;
  unpinChannel: (channelId: string, channelType: ChatChannelType) => Promise<void>;
  archiveChannel: (channelId: string, channelType: ChatChannelType) => Promise<void>;
  unarchiveChannel: (channelId: string, channelType: ChatChannelType) => Promise<void>;
  deleteChannel: (channelId: string, channelType: ChatChannelType) => Promise<void>;
  undeleteChannel: (channelId: string, channelType: ChatChannelType) => Promise<void>;

  // Helpers
  getPreference: (channelId: string) => ChatPreference | undefined;
  canPin: (channelType: ChatChannelType) => boolean;
  canArchive: (channelType: ChatChannelType) => boolean;
  canDelete: (channelType: ChatChannelType) => boolean;
}

// Default context value (empty state)
const defaultContextValue: ChatPreferencesContextValue = {
  preferences: new Map(),
  isLoading: false,
  error: null,
  pinnedChannelIds: new Set(),
  archivedChannelIds: new Set(),
  deletedChannelIds: new Set(),
  pinChannel: async () => {},
  unpinChannel: async () => {},
  archiveChannel: async () => {},
  unarchiveChannel: async () => {},
  deleteChannel: async () => {},
  undeleteChannel: async () => {},
  getPreference: () => undefined,
  canPin: () => true,
  canArchive: () => true,
  canDelete: () => false,
};

const ChatPreferencesContext = createContext<ChatPreferencesContextValue>(defaultContextValue);

/**
 * API call to update preference
 */
async function updatePreference(
  channelId: string,
  channelType: ChatChannelType,
  action: ChatPreferenceAction
): Promise<void> {
  const response = await fetch('/api/user/chat-preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channelId, channelType, action }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to update chat preference');
  }
}

interface ChatPreferencesProviderProps {
  children: ReactNode;
}

/**
 * ChatPreferencesProvider
 *
 * Root-level provider that manages chat preferences with:
 * - localStorage caching for instant hydration
 * - Firestore real-time listener for updates
 * - Automatic cache invalidation on user change
 */
export function ChatPreferencesProvider({ children }: ChatPreferencesProviderProps) {
  const { user, isLoaded } = useUser();
  const [preferences, setPreferences] = useState<Map<string, ChatPreference>>(() => {
    // Initialize from localStorage synchronously for instant access
    if (typeof window !== 'undefined' && user?.id) {
      return loadFromCache(user.id) ?? new Map();
    }
    return new Map();
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [previousUserId, setPreviousUserId] = useState<string | null>(null);

  // Handle user change - clear cache and reset state
  useEffect(() => {
    if (!isLoaded) return;

    const currentUserId = user?.id ?? null;

    // User changed (logged out or switched accounts)
    if (previousUserId && previousUserId !== currentUserId) {
      // Clear old user's cache
      clearCache(previousUserId);
      // Reset state
      setPreferences(new Map());
      setError(null);
    }

    // Load cache for new user
    if (currentUserId && currentUserId !== previousUserId) {
      const cached = loadFromCache(currentUserId);
      if (cached) {
        setPreferences(cached);
      }
    }

    setPreviousUserId(currentUserId);
  }, [user?.id, isLoaded, previousUserId]);

  // Set up Firestore real-time listener
  useEffect(() => {
    if (!isLoaded || !user?.id) {
      return;
    }

    // Guard: Firebase not initialized
    if (!db) {
      console.warn('[ChatPreferencesContext] Firebase not initialized');
      return;
    }

    const prefsRef = collection(db, 'users', user.id, CHAT_PREFERENCES_COLLECTION);

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      prefsRef,
      (snapshot) => {
        const newPrefs = new Map<string, ChatPreference>();
        snapshot.docs.forEach((doc) => {
          newPrefs.set(doc.id, {
            channelId: doc.id,
            ...doc.data(),
          } as ChatPreference);
        });
        setPreferences(newPrefs);
        setIsLoading(false);
        setError(null);

        // Update cache
        if (user.id) {
          saveToCache(user.id, newPrefs);
        }
      },
      (err) => {
        console.error('[ChatPreferencesContext] Firestore error:', err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.id, isLoaded]);

  // Computed sets for quick lookups
  const pinnedChannelIds = useMemo(() => {
    const ids = new Set<string>();
    preferences.forEach((pref, id) => {
      if (pref.isPinned) ids.add(id);
    });
    return ids;
  }, [preferences]);

  const archivedChannelIds = useMemo(() => {
    const ids = new Set<string>();
    preferences.forEach((pref, id) => {
      if (pref.isArchived) ids.add(id);
    });
    return ids;
  }, [preferences]);

  const deletedChannelIds = useMemo(() => {
    const ids = new Set<string>();
    preferences.forEach((pref, id) => {
      if (pref.isDeleted) ids.add(id);
    });
    return ids;
  }, [preferences]);

  // Permission helpers
  const canPin = useCallback((_channelType: ChatChannelType) => true, []);
  const canArchive = useCallback(
    (channelType: ChatChannelType) => channelType !== 'org',
    []
  );
  const canDelete = useCallback(
    (channelType: ChatChannelType) => channelType === 'dm',
    []
  );

  // Get preference helper
  const getPreference = useCallback(
    (channelId: string) => preferences.get(channelId),
    [preferences]
  );

  // Actions
  const pinChannel = useCallback(
    async (channelId: string, channelType: ChatChannelType) => {
      await updatePreference(channelId, channelType, 'pin');
    },
    []
  );

  const unpinChannel = useCallback(
    async (channelId: string, channelType: ChatChannelType) => {
      await updatePreference(channelId, channelType, 'unpin');
    },
    []
  );

  const archiveChannel = useCallback(
    async (channelId: string, channelType: ChatChannelType) => {
      await updatePreference(channelId, channelType, 'archive');
    },
    []
  );

  const unarchiveChannel = useCallback(
    async (channelId: string, channelType: ChatChannelType) => {
      await updatePreference(channelId, channelType, 'unarchive');
    },
    []
  );

  const deleteChannel = useCallback(
    async (channelId: string, channelType: ChatChannelType) => {
      await updatePreference(channelId, channelType, 'delete');
    },
    []
  );

  const undeleteChannel = useCallback(
    async (channelId: string, channelType: ChatChannelType) => {
      await updatePreference(channelId, channelType, 'undelete');
    },
    []
  );

  const contextValue = useMemo<ChatPreferencesContextValue>(
    () => ({
      preferences,
      isLoading,
      error,
      pinnedChannelIds,
      archivedChannelIds,
      deletedChannelIds,
      pinChannel,
      unpinChannel,
      archiveChannel,
      unarchiveChannel,
      deleteChannel,
      undeleteChannel,
      getPreference,
      canPin,
      canArchive,
      canDelete,
    }),
    [
      preferences,
      isLoading,
      error,
      pinnedChannelIds,
      archivedChannelIds,
      deletedChannelIds,
      pinChannel,
      unpinChannel,
      archiveChannel,
      unarchiveChannel,
      deleteChannel,
      undeleteChannel,
      getPreference,
      canPin,
      canArchive,
      canDelete,
    ]
  );

  return (
    <ChatPreferencesContext.Provider value={contextValue}>
      {children}
    </ChatPreferencesContext.Provider>
  );
}

/**
 * Hook to access chat preferences from context
 */
export function useChatPreferencesContext(): ChatPreferencesContextValue {
  return useContext(ChatPreferencesContext);
}
