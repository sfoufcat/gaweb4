'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import type {
  ChatPreference,
  ChatChannelType,
  ChatPreferenceAction,
} from '@/types/chat-preferences';
import { CHAT_PREFERENCES_COLLECTION } from '@/types/chat-preferences';

export interface UseChatPreferencesReturn {
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

async function updatePreference(
  channelId: string,
  channelType: ChatChannelType,
  action: ChatPreferenceAction
): Promise<void> {
  console.log('[useChatPreferences] updatePreference called:', { channelId, channelType, action });
  const response = await fetch('/api/user/chat-preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channelId, channelType, action }),
  });

  if (!response.ok) {
    const data = await response.json();
    console.error('[useChatPreferences] API error:', data);
    throw new Error(data.error || 'Failed to update chat preference');
  }
  console.log('[useChatPreferences] updatePreference success');
}

export function useChatPreferences(enabled: boolean = true): UseChatPreferencesReturn {
  const { user, isLoaded } = useUser();
  const [preferences, setPreferences] = useState<Map<string, ChatPreference>>(
    new Map()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Real-time listener for preferences subcollection
  useEffect(() => {
    // Don't set up listener until enabled (e.g., drawer is open)
    if (!enabled) {
      return;
    }

    if (!isLoaded || !user?.id) {
      setIsLoading(false);
      return;
    }

    // Guard: Firebase not initialized
    if (!db) {
      console.warn('[useChatPreferences] Firebase not initialized');
      setIsLoading(false);
      return;
    }

    const prefsRef = collection(
      db,
      'users',
      user.id,
      CHAT_PREFERENCES_COLLECTION
    );

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
      },
      (err) => {
        console.error('[useChatPreferences] Error:', err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.id, isLoaded, enabled]);

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

  return {
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
  };
}
