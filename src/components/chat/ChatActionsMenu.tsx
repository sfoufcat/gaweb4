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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useChatPreferences } from '@/hooks/useChatPreferences';
import { useChatChannels } from '@/contexts/ChatChannelsContext';
import type { ChatChannelType } from '@/types/chat-preferences';

interface ChatActionsMenuProps {
  channelId: string;
  channelType: ChatChannelType;
  /** Whether this channel is default-pinned (e.g., coaching channels for clients) */
  isDefaultPinned?: boolean;
  onActionComplete?: () => void;
}

export function ChatActionsMenu({
  channelId,
  channelType,
  isDefaultPinned = false,
  onActionComplete,
}: ChatActionsMenuProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
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
    isExplicitlyUnpinned,
  } = useChatPreferences();
  const { removeChannel } = useChatChannels();

  const preference = getPreference(channelId);
  const isUserPinned = preference?.isPinned ?? false;
  const isArchived = preference?.isArchived ?? false;
  const wasExplicitlyUnpinned = isExplicitlyUnpinned(channelId);

  // A channel appears pinned if: user pinned OR default-pinned (and not explicitly unpinned)
  const appearsPinned = isUserPinned || (isDefaultPinned && !wasExplicitlyUnpinned);

  // Debug: log rendered state
  console.log('[ChatActionsMenu] render:', {
    channelId,
    channelType,
    isUserPinned,
    isDefaultPinned,
    wasExplicitlyUnpinned,
    appearsPinned,
    isArchived,
    canPinResult: canPin(channelType),
    canArchiveResult: canArchive(channelType),
    canDeleteResult: canDelete(channelType),
  });

  const handleAction = async (actionName: string, action: () => Promise<void>) => {
    console.log('[ChatActionsMenu] Starting action:', actionName, { channelId, channelType });
    setIsLoading(true);
    try {
      await action();
      console.log('[ChatActionsMenu] Action completed:', actionName);
      onActionComplete?.();
    } catch (error) {
      console.error('[ChatActionsMenu] Action failed:', actionName, error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePin = () =>
    handleAction(appearsPinned ? 'unpin' : 'pin', () =>
      appearsPinned
        ? unpinChannel(channelId, channelType)
        : pinChannel(channelId, channelType)
    );

  const handleArchive = () =>
    handleAction(isArchived ? 'unarchive' : 'archive', () =>
      isArchived
        ? unarchiveChannel(channelId, channelType)
        : archiveChannel(channelId, channelType)
    );

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    await handleAction('delete', async () => {
      await deleteChannel(channelId, channelType);
      // Optimistically remove from UI
      removeChannel(channelId);
    });
    setShowDeleteDialog(false);
  };

  return (
    <>
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
        <DropdownMenuContent align="end" className="w-44">
          {canPin(channelType) && (
            <DropdownMenuItem
              onSelect={() => handlePin()}
              className="gap-3"
              disabled={isLoading}
            >
              {appearsPinned ? (
                <>
                  <PinOff className="w-[18px] h-[18px] text-text-secondary" />
                  Unpin
                </>
              ) : (
                <>
                  <Pin className="w-[18px] h-[18px] text-text-secondary" />
                  Pin
                </>
              )}
            </DropdownMenuItem>
          )}

          {canArchive(channelType) && (
            <DropdownMenuItem
              onSelect={() => handleArchive()}
              className="gap-3"
              disabled={isLoading}
            >
              {isArchived ? (
                <>
                  <ArchiveRestore className="w-[18px] h-[18px] text-text-secondary" />
                  Unarchive
                </>
              ) : (
                <>
                  <Archive className="w-[18px] h-[18px] text-text-secondary" />
                  Archive
                </>
              )}
            </DropdownMenuItem>
          )}

          {canDelete(channelType) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => handleDelete()}
                className="gap-3 text-red-500 focus:text-red-500 dark:text-red-400 dark:focus:text-red-400"
                disabled={isLoading}
              >
                <Trash2 className="w-[18px] h-[18px]" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this conversation? This will permanently delete it for everyone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
