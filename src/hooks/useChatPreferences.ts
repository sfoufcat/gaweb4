'use client';

import { useChatPreferencesContext, type ChatPreferencesContextValue } from '@/contexts/ChatPreferencesContext';
import type { ChatPreference, ChatChannelType } from '@/types/chat-preferences';

/**
 * Return type for useChatPreferences hook
 * Maintained for backwards compatibility with existing consumers
 */
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

/**
 * useChatPreferences
 *
 * Hook to access chat preferences (pin, archive, delete).
 * This is a thin wrapper around ChatPreferencesContext for backwards compatibility.
 *
 * Preferences are:
 * - Loaded instantly from localStorage cache
 * - Updated in real-time via Firestore listener
 * - Available immediately without blocking on network
 *
 * @param _enabled - Deprecated, kept for backwards compatibility. Has no effect.
 * @returns Chat preferences state and actions
 */
export function useChatPreferences(_enabled: boolean = true): UseChatPreferencesReturn {
  const context: ChatPreferencesContextValue = useChatPreferencesContext();

  // Return context values directly (same interface)
  return {
    preferences: context.preferences,
    isLoading: context.isLoading,
    error: context.error,
    pinnedChannelIds: context.pinnedChannelIds,
    archivedChannelIds: context.archivedChannelIds,
    deletedChannelIds: context.deletedChannelIds,
    pinChannel: context.pinChannel,
    unpinChannel: context.unpinChannel,
    archiveChannel: context.archiveChannel,
    unarchiveChannel: context.unarchiveChannel,
    deleteChannel: context.deleteChannel,
    undeleteChannel: context.undeleteChannel,
    getPreference: context.getPreference,
    canPin: context.canPin,
    canArchive: context.canArchive,
    canDelete: context.canDelete,
  };
}
