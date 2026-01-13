/**
 * Chat Preferences Types
 * User-specific preferences for chat management (pin, archive, delete)
 */

export type ChatChannelType = 'dm' | 'squad' | 'org';

export interface ChatPreference {
  channelId: string;
  channelType: ChatChannelType;
  isPinned: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  pinnedAt?: string;
  archivedAt?: string;
  deletedAt?: string;
  unpinnedAt?: string; // Track when user explicitly unpinned (to override default pins)
  updatedAt: string;
}

export type ChatPreferenceAction =
  | 'pin'
  | 'unpin'
  | 'archive'
  | 'unarchive'
  | 'delete'
  | 'undelete';

export const CHAT_PREFERENCES_COLLECTION = 'chat_preferences';

/**
 * Get valid actions for a channel type
 */
export function getValidActionsForType(channelType: ChatChannelType): ChatPreferenceAction[] {
  switch (channelType) {
    case 'dm':
      return ['pin', 'unpin', 'archive', 'unarchive', 'delete', 'undelete'];
    case 'squad':
      return ['pin', 'unpin', 'archive', 'unarchive'];
    case 'org':
      return ['pin', 'unpin'];
    default:
      return [];
  }
}

/**
 * Check if an action is valid for a channel type
 */
export function canPerformAction(
  channelType: ChatChannelType,
  action: ChatPreferenceAction
): boolean {
  return getValidActionsForType(channelType).includes(action);
}
