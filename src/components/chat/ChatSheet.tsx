'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { MessageCircle, ChevronRight, ChevronLeft, Users, Megaphone, PartyPopper, Trophy, X, Pin, Calendar } from 'lucide-react';
import { useStreamChatClient } from '@/contexts/StreamChatContext';
import { useChatChannels, type ChannelPreview } from '@/contexts/ChatChannelsContext';
import { ANNOUNCEMENTS_CHANNEL_ID, SOCIAL_CORNER_CHANNEL_ID, SHARE_WINS_CHANNEL_ID } from '@/lib/chat-constants';
import { formatDistanceToNow } from 'date-fns';
import Image from 'next/image';
import {
  Chat,
  Channel,
  MessageList,
  MessageInput,
  Window,
  useChatContext,
} from 'stream-chat-react';
import type { Channel as StreamChannel } from 'stream-chat';
import { CustomMessage } from '@/components/chat/CustomMessage';
import { CustomMessageInput } from '@/components/chat/CustomMessageInput';
import { useCoachingPromo } from '@/contexts/BrandingContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useSquad } from '@/hooks/useSquad';
import { useCoachSquads } from '@/hooks/useCoachSquads';
import { useCoachingContext } from '@/contexts/CoachingContext';
import { generateAvatarUrl } from '@/lib/demo-data';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { SwipeableChatItem, type SwipeAction } from '@/components/chat/SwipeableChatItem';
import { ArchivedChatsLink } from '@/components/chat/ArchivedChatsLink';
import { useChatPreferences } from '@/hooks/useChatPreferences';
import type { ChatChannelType } from '@/types/chat-preferences';
import { Archive, Trash2, PinOff, ArchiveRestore } from 'lucide-react';
import { RequestCallModal, ScheduleCallModal } from '@/components/scheduling';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
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

// Helper to convert ChannelPreview type to ChatChannelType
function toChatChannelType(type: 'dm' | 'squad' | 'global' | 'coaching'): ChatChannelType {
  switch (type) {
    case 'dm':
    case 'coaching':
      return 'dm';
    case 'squad':
      return 'squad';
    case 'global':
      return 'org';
    default:
      return 'dm';
  }
}

// Import Stream Chat CSS
import 'stream-chat-react/dist/css/v2/index.css';
import '@/app/chat/chat-styles.css';

interface ChatSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional channel ID to auto-select when sheet opens */
  initialChannelId?: string | null;
}

// ChannelPreview interface is now imported from ChatChannelsContext

/**
 * ChatSheet Component
 * 
 * A slide-up sheet (~85% height) with full embedded chat experience.
 * Shows channel list first, then messages when channel selected.
 */
export function ChatSheet({ isOpen, onClose, initialChannelId }: ChatSheetProps) {
  const { client, isConnected } = useStreamChatClient();
  // Use client.user as direct source of truth - bypasses any state sync issues
  const actuallyConnected = !!(client?.user) || isConnected;

  // PRE-FETCHED CHANNEL DATA from ChatChannelsContext
  // Channels are loaded in background after Stream connects, making this instant!
  const {
    channels,
    orgChannelIds,
    isPlatformMode,
    isLoading: isChannelsLoading,
    isInitialized: channelsInitialized,
    removeChannel,
  } = useChatChannels();

  // Show loading only if channels haven't been initialized yet
  const isLoading = !channelsInitialized;

  const [view, setView] = useState<'list' | 'channel'>('list');
  const [selectedChannel, setSelectedChannel] = useState<StreamChannel | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'main' | 'direct'>('main');
  const { isDemoMode } = useDemoMode();
  // Track if we've already auto-selected for the current initialChannelId
  const [autoSelectedChannelId, setAutoSelectedChannelId] = useState<string | null>(null);
  // Delete confirmation dialog state
  const [deleteDialogChannel, setDeleteDialogChannel] = useState<{ id: string; type: ChatChannelType } | null>(null);

  // Coaching promo data - from context (loaded at app startup - instant!)
  const coachingPromo = useCoachingPromo();
  const coachingData = useCoachingContext();

  // Build promoData from context for backward compatibility with existing code
  const promoData = useMemo(() => ({
    isEnabled: coachingData.promoIsEnabled,
    destinationUrl: coachingData.promoDestinationUrl,
    hasActiveIndividualEnrollment: coachingData.hasActiveIndividualEnrollment,
    coachingChatChannelId: coachingData.coachingChatChannelId,
    coachInfo: coachingData.coachInfo,
    imageUrl: coachingData.promoImageUrl,
  }), [coachingData]);

  // Squad data from context (already loaded at app startup - instant!)
  const { squads } = useSquad();

  // Check if user is a coach (affects where coaching channels appear)
  const { isCoach } = useCoachSquads();

  // Chat preferences for pinning/archiving/deleting
  // Only enable after Stream Chat is connected to avoid competing network requests
  const {
    pinnedChannelIds,
    archivedChannelIds,
    explicitlyUnpinnedChannelIds,
    pinChannel,
    unpinChannel,
    archiveChannel,
    unarchiveChannel,
    deleteChannel,
    canPin,
    canArchive,
    canDelete,
    getPreference,
  } = useChatPreferences();

  // State for archived view - track which tab's archive to show
  const [showArchivedView, setShowArchivedView] = useState<'main' | 'direct' | null>(null);

  // State for which swipe item is open (only one at a time)
  const [openSwipeItemId, setOpenSwipeItemId] = useState<string | null>(null);

  // Build userSquadChannelIds from context data (for local reference only)
  const userSquadChannelIds = useMemo(() => {
    const ids = new Set<string>();
    for (const squad of squads) {
      if (squad.chatChannelId) {
        ids.add(squad.chatChannelId);
      }
    }
    return ids;
  }, [squads]);

  // NOTE: Org channels and channel fetching is now handled by ChatChannelsContext
  // The context pre-fetches data after Stream connects, so it's ready when this opens

  // Close on escape key and lock body scroll
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (view === 'channel') {
          handleBack();
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, view]);

  // Reset view when sheet closes
  useEffect(() => {
    if (!isOpen) {
      setView('list');
      setSelectedChannel(null);
      setIsAnimating(false);
      setShowArchivedView(null);
      // Squad data is from context now - no state to reset
    }
  }, [isOpen]);

  // NOTE: Channel fetching is now handled by ChatChannelsContext
  // Channels are pre-fetched when Stream connects, so they're ready when this opens

  // Handle channel click - show messages with animation
  const handleChannelClick = useCallback((channel: StreamChannel | null) => {
    // Skip if channel is null (cached preview without real channel)
    if (!channel) return;

    setSelectedChannel(channel);
    setIsAnimating(true);
    // Small delay for animation
    requestAnimationFrame(() => {
      setView('channel');
      // Mark as read
      channel.markRead();
    });
  }, []);

  // Handle back to list with animation
  const handleBack = useCallback(() => {
    setIsAnimating(true);
    setView('list');
    // Clear channel after animation
    setTimeout(() => {
      setSelectedChannel(null);
      setIsAnimating(false);
    }, 200);
  }, []);

  // Auto-select channel if initialChannelId is provided
  useEffect(() => {
    if (!isOpen || !initialChannelId || !channels.length) return;
    // Don't auto-select if we've already selected this channel
    if (autoSelectedChannelId === initialChannelId) return;
    
    // Find the channel in our list
    const channelToSelect = channels.find(c => c.id === initialChannelId);
    if (channelToSelect) {
      setAutoSelectedChannelId(initialChannelId);
      handleChannelClick(channelToSelect.channel);
    }
  }, [isOpen, initialChannelId, channels, autoSelectedChannelId, handleChannelClick]);

  // Reset auto-selected state when sheet closes
  useEffect(() => {
    if (!isOpen) {
      setAutoSelectedChannelId(null);
      // Reset to list view when closing
      setView('list');
      setSelectedChannel(null);
    }
  }, [isOpen]);

  // Get icon for channel type
  const getChannelIcon = (type: ChannelPreview['type'], channelId: string) => {
    if (channelId === ANNOUNCEMENTS_CHANNEL_ID) {
      return <Megaphone className="w-5 h-5 text-amber-500" />;
    }
    if (channelId === SOCIAL_CORNER_CHANNEL_ID) {
      return <PartyPopper className="w-5 h-5 text-pink-500" />;
    }
    if (channelId === SHARE_WINS_CHANNEL_ID) {
      return <Trophy className="w-5 h-5 text-yellow-500" />;
    }
    if (type === 'squad') {
      return <Users className="w-5 h-5 text-brand-accent" />;
    }
    return <MessageCircle className="w-5 h-5 text-text-secondary" />;
  };

  // Sort channels: user-pinned first (by pinnedAt), then coaching for clients (unless explicitly unpinned), then unread, then by last message time
  const sortedChannels = useMemo(() => {
    // First filter out archived channels
    const visibleChannels = channels.filter(c =>
      !archivedChannelIds.has(c.id)
    );

    return visibleChannels.sort((a, b) => {
      // User-pinned channels first
      const aPinned = pinnedChannelIds.has(a.id);
      const bPinned = pinnedChannelIds.has(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      // If both are user-pinned, sort by pinnedAt (most recent first)
      if (aPinned && bPinned) {
        const aPinnedAt = getPreference(a.id)?.pinnedAt;
        const bPinnedAt = getPreference(b.id)?.pinnedAt;
        if (aPinnedAt && bPinnedAt) {
          return new Date(bPinnedAt).getTime() - new Date(aPinnedAt).getTime();
        }
        if (aPinnedAt) return -1;
        if (bPinnedAt) return 1;
      }

      // Coaching channels pinned to top ONLY for clients (not coaches)
      // UNLESS the user has explicitly unpinned them
      if (!isCoach) {
        const aIsDefaultPinnedCoaching = a.type === 'coaching' && !explicitlyUnpinnedChannelIds.has(a.id);
        const bIsDefaultPinnedCoaching = b.type === 'coaching' && !explicitlyUnpinnedChannelIds.has(b.id);
        if (aIsDefaultPinnedCoaching && !bIsDefaultPinnedCoaching) return -1;
        if (!aIsDefaultPinnedCoaching && bIsDefaultPinnedCoaching) return 1;
      }
      // Then unread channels
      if (a.unread > 0 && b.unread === 0) return -1;
      if (a.unread === 0 && b.unread > 0) return 1;
      // Then by last message time
      if (a.lastMessageTime && b.lastMessageTime) {
        return b.lastMessageTime.getTime() - a.lastMessageTime.getTime();
      }
      return 0;
    });
  }, [channels, isCoach, pinnedChannelIds, archivedChannelIds, explicitlyUnpinnedChannelIds, getPreference]);

  // Filter channels into main vs direct
  // For coaches: coaching channels go in Direct tab (like DMs with clients)
  // For clients: coaching channels go in Main tab (pinned at top)
  const mainChannels = useMemo(() => {
    return sortedChannels.filter(c => {
      if (c.type === 'coaching') {
        return !isCoach; // Only in Main for clients
      }
      return c.type !== 'dm';
    });
  }, [sortedChannels, isCoach]);

  const directChannels = useMemo(() => {
    return sortedChannels.filter(c => {
      if (c.type === 'coaching') {
        return isCoach; // Only in Direct for coaches
      }
      return c.type === 'dm';
    });
  }, [sortedChannels, isCoach]);

  // Calculate unread counts per tab
  const mainUnread = useMemo(() => {
    return mainChannels.reduce((sum, c) => sum + c.unread, 0);
  }, [mainChannels]);

  const directUnread = useMemo(() => {
    return directChannels.reduce((sum, c) => sum + c.unread, 0);
  }, [directChannels]);

  // Get filtered channels based on active tab
  const filteredChannels = activeTab === 'main' ? mainChannels : directChannels;

  // Get archived channels split by tab type
  const archivedMainChannels = useMemo(() => {
    return channels.filter(c =>
      archivedChannelIds.has(c.id) &&
      c.type !== 'dm' && (c.type !== 'coaching' || !isCoach)
    );
  }, [channels, archivedChannelIds, isCoach]);

  const archivedDirectChannels = useMemo(() => {
    return channels.filter(c =>
      archivedChannelIds.has(c.id) &&
      (c.type === 'dm' || (c.type === 'coaching' && isCoach))
    );
  }, [channels, archivedChannelIds, isCoach]);

  // Build swipe actions for a channel
  const getSwipeActions = useCallback((channelPreview: ChannelPreview): SwipeAction[] => {
    const channelType = toChatChannelType(channelPreview.type);
    const isUserPinned = pinnedChannelIds.has(channelPreview.id);
    const isArchived = archivedChannelIds.has(channelPreview.id);
    const isExplicitlyUnpinned = explicitlyUnpinnedChannelIds.has(channelPreview.id);

    // For coaching channels (for non-coaches), they're "pinned" by default unless explicitly unpinned
    const isDefaultPinnedCoaching = !isCoach && channelPreview.type === 'coaching' && !isExplicitlyUnpinned;
    // Channel appears pinned if: user pinned OR default pinned coaching
    const appearsPinned = isUserPinned || isDefaultPinnedCoaching;

    const actions: SwipeAction[] = [];

    // Pin action (all channel types)
    if (canPin(channelType)) {
      actions.push({
        icon: appearsPinned ? <PinOff className="w-5 h-5" /> : <Pin className="w-5 h-5" />,
        label: appearsPinned ? 'Unpin' : 'Pin',
        bgColor: 'bg-blue-500',
        onClick: async () => {
          console.log('[ChatSheet] Pin action clicked:', { channelId: channelPreview.id, channelType, appearsPinned, isUserPinned, isDefaultPinnedCoaching });
          try {
            if (appearsPinned) {
              await unpinChannel(channelPreview.id, channelType);
            } else {
              await pinChannel(channelPreview.id, channelType);
            }
            console.log('[ChatSheet] Pin action completed');
          } catch (error) {
            console.error('[ChatSheet] Pin action failed:', error);
          }
        },
      });
    }

    // Archive action (DMs and squads only)
    if (canArchive(channelType)) {
      actions.push({
        icon: isArchived ? <ArchiveRestore className="w-5 h-5" /> : <Archive className="w-5 h-5" />,
        label: isArchived ? 'Restore' : 'Archive',
        bgColor: 'bg-amber-500',
        onClick: async () => {
          console.log('[ChatSheet] Archive action clicked:', { channelId: channelPreview.id, channelType, isArchived });
          try {
            if (isArchived) {
              await unarchiveChannel(channelPreview.id, channelType);
            } else {
              await archiveChannel(channelPreview.id, channelType);
            }
            console.log('[ChatSheet] Archive action completed');
          } catch (error) {
            console.error('[ChatSheet] Archive action failed:', error);
          }
        },
      });
    }

    // Delete action (DMs only)
    if (canDelete(channelType)) {
      actions.push({
        icon: <Trash2 className="w-5 h-5" />,
        label: 'Delete',
        bgColor: 'bg-red-500',
        onClick: () => {
          console.log('[ChatSheet] Delete action clicked:', { channelId: channelPreview.id, channelType });
          setDeleteDialogChannel({ id: channelPreview.id, type: channelType });
        },
      });
    }

    return actions;
  }, [pinnedChannelIds, archivedChannelIds, explicitlyUnpinnedChannelIds, isCoach, canPin, canArchive, canDelete, pinChannel, unpinChannel, archiveChannel, unarchiveChannel, deleteChannel, setDeleteDialogChannel]);

  // Get selected channel name for header
  const selectedChannelName = useMemo(() => {
    if (!selectedChannel) return '';
    const found = channels.find(c => c.id === selectedChannel.id);
    return found?.name || 'Chat';
  }, [selectedChannel, channels]);

  // Check if announcements channel (read-only)
  const isAnnouncementsChannel = selectedChannel?.id === ANNOUNCEMENTS_CHANNEL_ID;

  // Show coach promo if: visible, enabled, user doesn't already have coaching
  // User has coaching if: enrolled in individual program OR has a coaching chat channel
  const hasCoaching = promoData?.hasActiveIndividualEnrollment || !!promoData?.coachingChatChannelId;
  const showCoachPromo = coachingPromo.isVisible &&
    promoData?.isEnabled &&
    !hasCoaching;

  // Handle delete confirmation
  const handleConfirmDelete = async () => {
    if (!deleteDialogChannel) return;
    const channelId = deleteDialogChannel.id;
    try {
      await deleteChannel(channelId, deleteDialogChannel.type);
      // Optimistically remove from UI immediately
      removeChannel(channelId);
    } catch (error) {
      console.error('[ChatSheet] Delete action failed:', error);
    }
    setDeleteDialogChannel(null);
  };

  return (
    <>
    <Drawer
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      shouldScaleBackground={false}
    >
      <DrawerContent className="h-[85dvh] max-h-[85dvh] max-w-[500px] mx-auto flex flex-col overflow-hidden">
        {isDemoMode ? (
          // Demo mode: show mock chat interface
          <DemoChatSheetContent onClose={onClose} />
        ) : client && actuallyConnected ? (
          <Chat client={client} theme={theme === 'dark' ? 'str-chat__theme-dark' : 'str-chat__theme-light'}>
            {/* Views Container - handles animation */}
            <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
              {/* Channel List View */}
              <div 
                className={`absolute inset-0 flex flex-col transition-transform duration-200 ease-out ${
                  view === 'channel' ? '-translate-x-full' : 'translate-x-0'
                }`}
              >
                {/* Header */}
                <div className="px-5 pb-3 flex items-center justify-between flex-shrink-0">
                  <h2 className="font-albert text-[20px] font-semibold text-text-primary tracking-[-0.5px]">
                    Messages
                  </h2>
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-full hover:bg-[#f3f1ef] dark:hover:bg-[#272d38] transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5 text-text-secondary" />
                  </button>
                </div>

                {/* Main/Direct Tabs */}
                <div className="px-5 pb-3 flex-shrink-0">
                  <div className="bg-[#f3f1ef] dark:bg-[#11141b] rounded-[32px] p-1.5 flex gap-1.5">
                    {/* Main Tab */}
                    <button
                      type="button"
                      onClick={() => setActiveTab('main')}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[24px] transition-all ${
                        activeTab === 'main'
                          ? 'bg-white dark:bg-[#171b22] shadow-sm'
                          : ''
                      }`}
                    >
                      <Users className={`w-4 h-4 ${activeTab === 'main' ? 'text-text-primary' : 'text-text-muted'}`} />
                      <span className={`font-albert text-[14px] font-semibold ${
                        activeTab === 'main' ? 'text-text-primary' : 'text-text-muted'
                      }`}>
                        Main
                      </span>
                      {mainUnread > 0 && (
                        <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-brand-accent text-white text-[10px] font-semibold">
                          {mainUnread > 9 ? '9+' : mainUnread}
                        </span>
                      )}
                    </button>
                    
                    {/* Direct Tab */}
                    <button
                      type="button"
                      onClick={() => setActiveTab('direct')}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[24px] transition-all ${
                        activeTab === 'direct'
                          ? 'bg-white dark:bg-[#171b22] shadow-sm'
                          : ''
                      }`}
                    >
                      <MessageCircle className={`w-4 h-4 ${activeTab === 'direct' ? 'text-text-primary' : 'text-text-muted'}`} />
                      <span className={`font-albert text-[14px] font-semibold ${
                        activeTab === 'direct' ? 'text-text-primary' : 'text-text-muted'
                      }`}>
                        Direct
                      </span>
                      {directUnread > 0 && (
                        <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-brand-accent text-white text-[10px] font-semibold">
                          {directUnread > 9 ? '9+' : directUnread}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Channel List */}
                <div className="flex-1 overflow-y-auto pb-safe">
                  {isLoading ? (
                    // Loading skeleton
                    <div className="px-5 space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex items-center gap-3 py-3">
                          <div className="w-12 h-12 rounded-full bg-[#f3f1ef] dark:bg-[#272d38] animate-pulse" />
                          <div className="flex-1">
                            <div className="h-4 w-24 bg-[#f3f1ef] dark:bg-[#272d38] rounded animate-pulse mb-2" />
                            <div className="h-3 w-40 bg-[#f3f1ef] dark:bg-[#272d38] rounded animate-pulse" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : filteredChannels.length === 0 ? (
                    // Empty state - different message based on tab
                    <div className="py-12 px-5 text-center">
                      <div className="w-14 h-14 bg-[#f3f1ef] dark:bg-[#272d38] rounded-full flex items-center justify-center mx-auto mb-4">
                        {activeTab === 'main' ? (
                          <Users className="w-7 h-7 text-text-muted" />
                        ) : (
                          <MessageCircle className="w-7 h-7 text-text-muted" />
                        )}
                      </div>
                      <p className="font-sans text-[15px] text-text-secondary">
                        {activeTab === 'main' ? 'No group chats yet' : 'No direct messages yet'}
                      </p>
                      <p className="font-sans text-[13px] text-text-muted mt-1">
                        {activeTab === 'main' 
                          ? 'Join a squad to start chatting with your group'
                          : 'Start a conversation from someone\'s profile'
                        }
                      </p>
                    </div>
                  ) : (
                    // Channel list with animated reordering
                    <LayoutGroup>
                      <div>
                        {filteredChannels.map((channelPreview) => (
                          <motion.div
                            key={channelPreview.id}
                            layout
                            layoutId={channelPreview.id}
                            initial={false}
                            transition={{
                              layout: { type: 'spring', stiffness: 500, damping: 35 }
                            }}
                          >
                            <SwipeableChatItem
                              itemId={channelPreview.id}
                              openItemId={openSwipeItemId}
                              onOpen={setOpenSwipeItemId}
                              actions={getSwipeActions(channelPreview)}
                            >
                              <button
                                onClick={() => handleChannelClick(channelPreview.channel)}
                                className="w-full px-5 py-3 flex items-center gap-3 hover:bg-[#f3f1ef] dark:hover:bg-[#1e222a] transition-colors text-left active:bg-[#e9e5e0] dark:active:bg-[#252a33]"
                              >
                                {/* Avatar */}
                                <div className="relative w-12 h-12 rounded-full bg-[#f3f1ef] dark:bg-[#272d38] flex items-center justify-center overflow-hidden flex-shrink-0">
                                  {channelPreview.image ? (
                                    <Image
                                      src={channelPreview.image}
                                      alt={channelPreview.name}
                                      fill
                                      className="object-cover"
                                    />
                                  ) : (
                                    getChannelIcon(channelPreview.type, channelPreview.id)
                                  )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className={`font-albert text-[15px] truncate ${channelPreview.unread > 0 ? 'font-semibold text-text-primary' : 'text-text-primary'}`}>
                                      {channelPreview.name}
                                    </span>
                                    {channelPreview.lastMessageTime && (
                                      <span className="font-sans text-[12px] text-text-muted flex-shrink-0">
                                        {formatDistanceToNow(channelPreview.lastMessageTime, { addSuffix: false })}
                                      </span>
                                    )}
                                  </div>
                                  {channelPreview.lastMessage && (
                                    <p className={`font-sans text-[13px] truncate ${channelPreview.unread > 0 ? 'text-text-secondary font-medium' : 'text-text-muted'}`}>
                                      {channelPreview.lastMessage}
                                    </p>
                                  )}
                                </div>

                                {/* Pinned indicator - show for user-pinned OR default-pinned coaching (if not explicitly unpinned) */}
                                {(pinnedChannelIds.has(channelPreview.id) ||
                                  (!isCoach && channelPreview.type === 'coaching' && !explicitlyUnpinnedChannelIds.has(channelPreview.id))) && (
                                  <Pin className="w-3.5 h-3.5 text-brand-accent flex-shrink-0" />
                                )}

                                {/* Unread badge or chevron */}
                                {channelPreview.unread > 0 ? (
                                  <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-[#E74C3C] text-white text-[11px] font-semibold rounded-full">
                                    {channelPreview.unread > 9 ? '9+' : channelPreview.unread}
                                  </span>
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
                                )}
                              </button>
                            </SwipeableChatItem>
                          </motion.div>
                        ))}

                      {/* Coach Promo Item */}
                      {showCoachPromo && promoData?.destinationUrl && (
                        <a
                          href={promoData.destinationUrl}
                          className="block w-full px-5 py-4 mt-2 border-t border-[#e8e4df] dark:border-[#262b35]"
                        >
                          <div className="flex items-center gap-3">
                            {promoData?.imageUrl ? (
                              <Image
                                src={promoData.imageUrl}
                                alt="Personal Coach"
                                width={48}
                                height={48}
                                className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-accent to-[#7d5c3e] flex items-center justify-center flex-shrink-0">
                                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                </svg>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-albert text-[15px] font-medium text-text-primary">
                                {coachingPromo.title || 'Work with me 1:1'}
                              </p>
                              <p className="font-sans text-[13px] text-text-muted truncate">
                                {coachingPromo.subtitle || 'Let me help you unleash your potential'}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-brand-accent flex-shrink-0" />
                          </div>
                        </a>
                      )}

                      {/* Archived Chats Link - tab-specific */}
                      <ArchivedChatsLink
                        count={activeTab === 'main' ? archivedMainChannels.length : archivedDirectChannels.length}
                        onClick={() => setShowArchivedView(activeTab)}
                      />
                      </div>
                    </LayoutGroup>
                  )}
                </div>
              </div>

              {/* Message View - slides in from right */}
              <div 
                className={`absolute inset-0 flex flex-col transition-transform duration-200 ease-out ${
                  view === 'channel' ? 'translate-x-0' : 'translate-x-full'
                }`}
              >
                {selectedChannel && (
                  <ChatSheetMessageView
                    channel={selectedChannel}
                    channelName={selectedChannelName}
                    onBack={handleBack}
                    isReadOnly={isAnnouncementsChannel}
                    isCoach={isCoach}
                  />
                )}
              </div>

              {/* Archived View - slides in from right */}
              <div
                className={`absolute inset-0 flex flex-col transition-transform duration-200 ease-out bg-white dark:bg-[#171b22] ${
                  showArchivedView ? 'translate-x-0' : 'translate-x-full'
                }`}
              >
                {/* Header */}
                <div className="px-4 py-3 flex items-center gap-3 border-b border-[#e8e4df] dark:border-[#262b35] flex-shrink-0">
                  <button
                    onClick={() => setShowArchivedView(null)}
                    className="p-1.5 -ml-1.5 rounded-full hover:bg-[#f3f1ef] dark:hover:bg-[#272d38] transition-colors"
                    aria-label="Back to messages"
                  >
                    <ChevronLeft className="w-5 h-5 text-text-primary" />
                  </button>
                  <h3 className="font-albert text-[16px] font-semibold text-text-primary truncate">
                    Archived
                  </h3>
                </div>

                {/* Archived Channel List - show tab-specific channels */}
                <div className="flex-1 overflow-y-auto pb-safe">
                  {(() => {
                    const currentArchivedChannels = showArchivedView === 'main' ? archivedMainChannels : archivedDirectChannels;
                    return currentArchivedChannels.length === 0 ? (
                    <div className="py-12 px-5 text-center">
                      <div className="w-14 h-14 bg-[#f3f1ef] dark:bg-[#272d38] rounded-full flex items-center justify-center mx-auto mb-4">
                        <Archive className="w-7 h-7 text-text-muted" />
                      </div>
                      <p className="font-sans text-[15px] text-text-secondary">
                        No archived chats
                      </p>
                    </div>
                  ) : (
                    <div>
                      {currentArchivedChannels.map((channelPreview) => {
                        const channelType = toChatChannelType(channelPreview.type);

                        return (
                          <div
                            key={channelPreview.id}
                            className="w-full px-5 py-3 flex items-center gap-3 border-b border-[#e8e4df] dark:border-[#262b35]"
                          >
                            {/* Avatar */}
                            <div className="relative w-12 h-12 rounded-full bg-[#f3f1ef] dark:bg-[#272d38] flex items-center justify-center overflow-hidden flex-shrink-0">
                              {channelPreview.image ? (
                                <Image
                                  src={channelPreview.image}
                                  alt={channelPreview.name}
                                  fill
                                  className="object-cover"
                                />
                              ) : (
                                getChannelIcon(channelPreview.type, channelPreview.id)
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <span className="font-albert text-[15px] text-text-primary truncate block">
                                {channelPreview.name}
                              </span>
                              <span className="font-sans text-[12px] text-text-muted">
                                Archived
                              </span>
                            </div>

                            {/* Restore button */}
                            <button
                              onClick={async () => {
                                await unarchiveChannel(channelPreview.id, channelType);
                              }}
                              className="px-3 py-1.5 text-[13px] font-medium text-brand-accent hover:bg-[#f3f1ef] dark:hover:bg-[#272d38] rounded-lg transition-colors"
                            >
                              Restore
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                </div>
              </div>
            </div>
          </Chat>
        ) : null}
      </DrawerContent>
    </Drawer>

      <AlertDialog open={!!deleteDialogChannel} onOpenChange={(open) => !open && setDeleteDialogChannel(null)}>
        <AlertDialogContent className="max-w-[280px] z-[10001] rounded-3xl p-5 gap-3">
          <AlertDialogHeader className="pb-2 border-b-0">
            <AlertDialogTitle className="text-base text-center">Delete conversation</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-center">
              This will permanently delete it for everyone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 pt-2">
            <AlertDialogCancel className="flex-1 m-0 rounded-xl h-11">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="flex-1 rounded-xl h-11 bg-red-500 hover:bg-red-600 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Message view component (needs to be inside Chat context)
function ChatSheetMessageView({
  channel,
  channelName,
  onBack,
  isReadOnly,
  isCoach
}: {
  channel: StreamChannel;
  channelName: string;
  onBack: () => void;
  isReadOnly: boolean;
  isCoach: boolean;
}) {
  const { setActiveChannel } = useChatContext();
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  // Scheduling modal state
  const [showRequestCallModal, setShowRequestCallModal] = useState(false);
  const [showScheduleCallModal, setShowScheduleCallModal] = useState(false);
  const [clientEnrollmentId, setClientEnrollmentId] = useState<string | undefined>();

  // Determine if this is a coaching channel (supports scheduling)
  const channelId = channel.id;
  const isCoachingChannel = channelId?.startsWith('coaching-');

  // Get other member info for scheduling (used for coach scheduling with client)
  const members = Object.values(channel.state?.members || {});
  const { client } = useChatContext();
  const otherMember = members.find(m => m.user?.id !== client?.userID);

  // Fetch client enrollment when modal opens (for non-coaches)
  useEffect(() => {
    if (showRequestCallModal && !isCoach) {
      fetch('/api/scheduling/my-enrollment')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.enrollmentId) {
            setClientEnrollmentId(data.enrollmentId);
          }
        })
        .catch(console.error);
    }
  }, [showRequestCallModal, isCoach]);

  // Set active channel when mounted
  useEffect(() => {
    setActiveChannel(channel);
  }, [channel, setActiveChannel]);

  // Handle swipe-right to go back (edge swipe)
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    // Only track if starting from left edge (within 30px)
    if (touch.clientX < 30) {
      setTouchStart({ x: touch.clientX, y: touch.clientY });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = Math.abs(touch.clientY - touchStart.y);

    // Swipe right detected (moved at least 80px right, and more horizontal than vertical)
    if (deltaX > 80 && deltaX > deltaY * 2) {
      setTouchStart(null);
      onBack();
    }
  };

  const handleTouchEnd = () => {
    setTouchStart(null);
  };

  return (
    <div
      className="h-full flex flex-col bg-white dark:bg-[#171b22] overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header - fixed height */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-[#e8e4df] dark:border-[#262b35] flex-shrink-0 bg-white dark:bg-[#171b22]">
        <button
          onClick={onBack}
          className="p-1.5 -ml-1.5 rounded-full hover:bg-[#f3f1ef] dark:hover:bg-[#272d38] transition-colors"
          aria-label="Back to messages"
        >
          <ChevronLeft className="w-5 h-5 text-text-primary" />
        </button>
        <h3 className="font-albert text-[16px] font-semibold text-text-primary truncate flex-1">
          {channelName}
        </h3>
        {/* Schedule button for coaching channels */}
        {isCoachingChannel && (
          <button
            onClick={() => {
              if (isCoach) {
                setShowScheduleCallModal(true);
              } else {
                setShowRequestCallModal(true);
              }
            }}
            className="p-2 rounded-full hover:bg-[#f3f1ef] dark:hover:bg-[#272d38] transition-colors"
            aria-label="Schedule a call"
          >
            <Calendar className="w-5 h-5 text-text-secondary" />
          </button>
        )}
      </div>

      {/* Messages + Input Container - explicit flex layout */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <Channel
          Message={CustomMessage}
          Input={CustomMessageInput}
        >
          <Window>
            {/* Message list wrapper with explicit overflow */}
            <div className="flex-1 overflow-y-auto min-h-0 chat-sheet-message-list">
              <MessageList />
            </div>
            {/* Input - fixed at bottom */}
            {isReadOnly ? (
              <div className="p-4 bg-[#faf8f6] dark:bg-[#0a0d12] text-center border-t border-[#e8e4df] dark:border-[#262b35] flex-shrink-0">
                <p className="font-albert text-[14px] text-text-secondary">
                  📢 This is a read-only announcements channel
                </p>
              </div>
            ) : (
              <div className="flex-shrink-0 border-t border-[#e8e4df] dark:border-[#262b35] bg-white dark:bg-[#171b22]">
                <MessageInput focus />
              </div>
            )}
          </Window>
        </Channel>
      </div>

      {/* Request Call Modal for clients in coaching channels */}
      {isCoachingChannel && !isCoach && (
        <RequestCallModal
          isOpen={showRequestCallModal}
          onClose={() => setShowRequestCallModal(false)}
          coachName={channelName}
          isPaid={false}
          priceInCents={0}
          enrollmentId={clientEnrollmentId}
          onSuccess={() => {
            setShowRequestCallModal(false);
          }}
        />
      )}

      {/* Schedule Call Modal for coaches */}
      {isCoach && otherMember?.user?.id && (
        <ScheduleCallModal
          isOpen={showScheduleCallModal}
          onClose={() => setShowScheduleCallModal(false)}
          clientId={otherMember.user.id}
          clientName={otherMember.user.name || 'Client'}
          onSuccess={() => {
            setShowScheduleCallModal(false);
          }}
        />
      )}
    </div>
  );
}

// Demo chat conversations
const DEMO_CONVERSATIONS = [
  {
    id: 'announcements',
    name: 'Announcements',
    type: 'global' as const,
    lastMessage: '🎉 Welcome to the demo! This is a preview of the chat feature.',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
    unread: 0,
  },
  {
    id: 'social-corner',
    name: 'Social Corner',
    type: 'global' as const,
    lastMessage: "Anyone else trying the new meditation routine?",
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 45), // 45 mins ago
    unread: 2,
  },
  {
    id: 'share-wins',
    name: 'Share Wins',
    type: 'global' as const,
    lastMessage: "🏆 Just hit my 30-day streak!",
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    unread: 0,
  },
  {
    id: 'squad-momentum',
    name: 'Momentum Masters',
    type: 'squad' as const,
    lastMessage: "Great job everyone this week!",
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 3), // 3 hours ago
    unread: 1,
  },
  {
    id: 'dm-sarah',
    name: 'Sarah Miller',
    type: 'dm' as const,
    avatar: generateAvatarUrl('Sarah Miller'),
    lastMessage: "Looking forward to our session tomorrow!",
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
    unread: 0,
  },
  {
    id: 'dm-michael',
    name: 'Michael Chen',
    type: 'dm' as const,
    avatar: generateAvatarUrl('Michael Chen'),
    lastMessage: "Thanks for the advice!",
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    unread: 0,
  },
];

const DEMO_MESSAGES = [
  { id: '1', text: '👋 Welcome to the community chat!', isMe: false, time: new Date(Date.now() - 1000 * 60 * 60 * 2), sender: 'Coach Adam' },
  { id: '2', text: 'This is a preview of the chat feature. In the full version, you can message your coach and connect with other members.', isMe: false, time: new Date(Date.now() - 1000 * 60 * 60 * 2), sender: 'Coach Adam' },
  { id: '3', text: 'Feel free to explore!', isMe: false, time: new Date(Date.now() - 1000 * 60 * 30), sender: 'Coach Adam' },
];

// Demo Chat Sheet Content Component
function DemoChatSheetContent({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'main' | 'direct'>('main');
  const [selectedConversation, setSelectedConversation] = useState<typeof DEMO_CONVERSATIONS[0] | null>(null);
  const { openSignupModal } = useDemoMode();

  const mainConversations = DEMO_CONVERSATIONS.filter(c => c.type !== 'dm');
  const directConversations = DEMO_CONVERSATIONS.filter(c => c.type === 'dm');
  const filteredConversations = activeTab === 'main' ? mainConversations : directConversations;

  const mainUnread = mainConversations.reduce((sum, c) => sum + c.unread, 0);
  const directUnread = directConversations.reduce((sum, c) => sum + c.unread, 0);

  const getChannelIcon = (type: 'dm' | 'squad' | 'global' | 'coaching') => {
    if (type === 'global') return <Megaphone className="w-5 h-5 text-blue-500" />;
    if (type === 'squad') return <Users className="w-5 h-5 text-brand-accent" />;
    return <MessageCircle className="w-5 h-5 text-text-secondary" />;
  };

  const handleSendMessage = () => {
    openSignupModal();
  };

  // Message view
  if (selectedConversation) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="px-4 py-3 flex items-center gap-3 border-b border-[#e8e4df] dark:border-[#262b35] flex-shrink-0">
          <button
            onClick={() => setSelectedConversation(null)}
            className="p-1.5 -ml-1.5 rounded-full hover:bg-[#f3f1ef] dark:hover:bg-[#272d38] transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-text-primary" />
          </button>
          <h3 className="font-albert text-[16px] font-semibold text-text-primary truncate">
            {selectedConversation.name}
          </h3>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {DEMO_MESSAGES.map((msg) => (
            <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${msg.isMe ? 'order-2' : ''}`}>
                {!msg.isMe && (
                  <p className="text-xs text-text-muted mb-1 ml-1">{msg.sender}</p>
                )}
                <div className={`px-4 py-2.5 rounded-2xl ${
                  msg.isMe 
                    ? 'bg-brand-accent text-white' 
                    : 'bg-[#f3f1ef] dark:bg-[#272d38] text-text-primary'
                }`}>
                  <p className="text-[15px]">{msg.text}</p>
                </div>
                <p className="text-[11px] text-text-muted mt-1 ml-1">
                  {formatDistanceToNow(msg.time, { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-[#e8e4df] dark:border-[#262b35] flex-shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Type a message..."
              className="flex-1 px-4 py-2.5 rounded-full bg-[#f3f1ef] dark:bg-[#272d38] text-text-primary placeholder:text-text-muted text-[15px] outline-none"
              onFocus={handleSendMessage}
            />
            <button
              onClick={handleSendMessage}
              className="w-10 h-10 rounded-full bg-brand-accent text-white flex items-center justify-center"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>

      </div>
    );
  }

  // Channel list view
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Demo banner */}
      <div className="px-5 py-2 bg-brand-accent/10 border-b border-brand-accent/20 flex-shrink-0">
        <p className="text-xs text-brand-accent font-medium text-center">
          Demo Mode: Preview the chat experience
        </p>
      </div>

      {/* Header */}
      <div className="px-5 pb-3 pt-2 flex items-center justify-between flex-shrink-0">
        <h2 className="font-albert text-[20px] font-semibold text-text-primary tracking-[-0.5px]">
          Messages
        </h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-[#f3f1ef] dark:hover:bg-[#272d38] transition-colors"
        >
          <X className="w-5 h-5 text-text-secondary" />
        </button>
      </div>

      {/* Tabs */}
      <div className="px-5 pb-3 flex-shrink-0">
        <div className="bg-[#f3f1ef] dark:bg-[#11141b] rounded-[32px] p-1.5 flex gap-1.5">
          <button
            onClick={() => setActiveTab('main')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[24px] transition-all ${
              activeTab === 'main' ? 'bg-white dark:bg-[#171b22] shadow-sm' : ''
            }`}
          >
            <Users className={`w-4 h-4 ${activeTab === 'main' ? 'text-text-primary' : 'text-text-muted'}`} />
            <span className={`font-albert text-[14px] font-semibold ${activeTab === 'main' ? 'text-text-primary' : 'text-text-muted'}`}>
              Main
            </span>
            {mainUnread > 0 && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-brand-accent text-white text-[10px] font-semibold">
                {mainUnread}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('direct')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[24px] transition-all ${
              activeTab === 'direct' ? 'bg-white dark:bg-[#171b22] shadow-sm' : ''
            }`}
          >
            <MessageCircle className={`w-4 h-4 ${activeTab === 'direct' ? 'text-text-primary' : 'text-text-muted'}`} />
            <span className={`font-albert text-[14px] font-semibold ${activeTab === 'direct' ? 'text-text-primary' : 'text-text-muted'}`}>
              Direct
            </span>
            {directUnread > 0 && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-brand-accent text-white text-[10px] font-semibold">
                {directUnread}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto pb-safe">
        <div className="px-5 space-y-1">
          {filteredConversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelectedConversation(conv)}
              className="w-full flex items-center gap-3 py-3 px-3 rounded-xl hover:bg-[#f3f1ef] dark:hover:bg-[#272d38] transition-colors text-left"
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {conv.type === 'dm' && conv.avatar ? (
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-earth-200">
                    <Image
                      src={conv.avatar}
                      alt={conv.name}
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#f3f1ef] dark:bg-[#272d38] flex items-center justify-center">
                    {getChannelIcon(conv.type)}
                  </div>
                )}
                {conv.unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-brand-accent text-white text-[10px] font-semibold">
                    {conv.unread}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <p className={`font-albert text-[15px] truncate ${conv.unread > 0 ? 'font-semibold text-text-primary' : 'font-medium text-text-primary'}`}>
                    {conv.name}
                  </p>
                  <span className="text-[12px] text-text-muted flex-shrink-0 ml-2">
                    {formatDistanceToNow(conv.lastMessageTime, { addSuffix: false })}
                  </span>
                </div>
                <p className={`text-[13px] truncate ${conv.unread > 0 ? 'text-text-secondary font-medium' : 'text-text-muted'}`}>
                  {conv.lastMessage}
                </p>
              </div>

              <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ChatSheet;
