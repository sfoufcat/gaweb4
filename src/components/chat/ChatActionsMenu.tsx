'use client';

import { useState } from 'react';
import { MoreVertical, Pin, Archive, Trash2, PinOff, ArchiveRestore } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useChatPreferences } from '@/hooks/useChatPreferences';
import type { ChatChannelType } from '@/types/chat-preferences';

interface ChatActionsMenuProps {
  channelId: string;
  channelType: ChatChannelType;
  onActionComplete?: () => void;
}

export function ChatActionsMenu({
  channelId,
  channelType,
  onActionComplete,
}: ChatActionsMenuProps) {
  const [isLoading, setIsLoading] = useState(false);
  const {
    getPreference,
    pinChannel,
    unpinChannel,
    archiveChannel,
    unarchiveChannel,
    deleteChannel,
    canPin,
    canArchive,
    canDelete,
  } = useChatPreferences();

  const preference = getPreference(channelId);
  const isPinned = preference?.isPinned ?? false;
  const isArchived = preference?.isArchived ?? false;

  const handleAction = async (action: () => Promise<void>) => {
    setIsLoading(true);
    try {
      await action();
      onActionComplete?.();
    } catch (error) {
      console.error('[ChatActionsMenu] Action failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePin = () =>
    handleAction(() =>
      isPinned
        ? unpinChannel(channelId, channelType)
        : pinChannel(channelId, channelType)
    );

  const handleArchive = () =>
    handleAction(() =>
      isArchived
        ? unarchiveChannel(channelId, channelType)
        : archiveChannel(channelId, channelType)
    );

  const handleDelete = () => {
    if (window.confirm('Delete this conversation? You can restore it from Archived Chats.')) {
      handleAction(() => deleteChannel(channelId, channelType));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="p-2 rounded-full hover:bg-[#f3f1ef] dark:hover:bg-[#272d38] transition-colors flex-shrink-0"
          aria-label="Chat options"
          disabled={isLoading}
        >
          <MoreVertical className="w-5 h-5 text-text-secondary" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {canPin(channelType) && (
          <DropdownMenuItem
            onClick={handlePin}
            className="gap-2 cursor-pointer"
            disabled={isLoading}
          >
            {isPinned ? (
              <>
                <PinOff className="w-4 h-4" />
                Unpin
              </>
            ) : (
              <>
                <Pin className="w-4 h-4" />
                Pin
              </>
            )}
          </DropdownMenuItem>
        )}

        {canArchive(channelType) && (
          <DropdownMenuItem
            onClick={handleArchive}
            className="gap-2 cursor-pointer"
            disabled={isLoading}
          >
            {isArchived ? (
              <>
                <ArchiveRestore className="w-4 h-4" />
                Unarchive
              </>
            ) : (
              <>
                <Archive className="w-4 h-4" />
                Archive
              </>
            )}
          </DropdownMenuItem>
        )}

        {canDelete(channelType) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleDelete}
              className="gap-2 cursor-pointer text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
              disabled={isLoading}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
