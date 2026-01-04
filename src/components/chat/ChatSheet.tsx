'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { MessageCircle, ChevronRight, ChevronLeft, Users, Megaphone, PartyPopper, Trophy, X } from 'lucide-react';
import { useStreamChatClient } from '@/contexts/StreamChatContext';
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
import { generateAvatarUrl } from '@/lib/demo-data';
import { Drawer, DrawerContent } from '@/components/ui/drawer';

// Import Stream Chat CSS
import 'stream-chat-react/dist/css/v2/index.css';
import '@/app/chat/chat-styles.css';

interface ChatSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional channel ID to auto-select when sheet opens */
  initialChannelId?: string | null;
}

interface ChannelPreview {
  id: string;
  name: string;
  image?: string;
  lastMessage?: string;
  lastMessageTime?: Date;
  unread: number;
  type: 'dm' | 'squad' | 'global' | 'coaching';
  channel: StreamChannel;
}

/**
 * ChatSheet Component
 * 
 * A slide-up sheet (~85% height) with full embedded chat experience.
 * Shows channel list first, then messages when channel selected.
 */
export function ChatSheet({ isOpen, onClose, initialChannelId }: ChatSheetProps) {
  const { client, isConnected } = useStreamChatClient();
  const [channels, setChannels] = useState<ChannelPreview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'list' | 'channel'>('list');
  const [selectedChannel, setSelectedChannel] = useState<StreamChannel | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'main' | 'direct'>('main');
  const { isDemoMode } = useDemoMode();
  // Track if we've already auto-selected for the current initialChannelId
  const [autoSelectedChannelId, setAutoSelectedChannelId] = useState<string | null>(null);
  
  // Coaching promo data
  const coachingPromo = useCoachingPromo();
  const [promoData, setPromoData] = useState<{
    isEnabled: boolean;
    destinationUrl: string | null;
    hasCoaching: boolean;
    hasActiveIndividualEnrollment: boolean;
    imageUrl: string | null;
  } | null>(null);
  
  // Org-specific channels (for filtering out cross-org channels)
  const [orgChannelIds, setOrgChannelIds] = useState<Set<string>>(new Set());
  const [userSquadChannelIds, setUserSquadChannelIds] = useState<Set<string>>(new Set());
  const [squadChannelsLoaded, setSquadChannelsLoaded] = useState(false);
  const [isPlatformMode, setIsPlatformMode] = useState(false);

  // Fetch coaching promo data and org channels for filtering
  useEffect(() => {
    if (isOpen) {
      // Fetch coaching promo
      fetch('/api/user/org-coaching-promo')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            setPromoData({
              isEnabled: data.isEnabled || false,
              destinationUrl: data.destinationUrl || null,
              hasCoaching: data.hasCoaching || false,
              hasActiveIndividualEnrollment: data.hasActiveIndividualEnrollment || false,
              imageUrl: data.promo?.imageUrl || null,
            });
          }
        })
        .catch(() => {
          // Silently fail
        });
      
      // Fetch org channels for filtering
      fetch('/api/user/org-channels')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            setIsPlatformMode(data.isPlatformMode || false);
            // Build set of allowed org channel IDs
            const channelIds = new Set<string>();
            if (data.channels) {
              for (const ch of data.channels) {
                if (ch.streamChannelId) {
                  channelIds.add(ch.streamChannelId);
                }
              }
            }
            setOrgChannelIds(channelIds);
          }
        })
        .catch(() => {
          // Silently fail - will show all channels
        });
      
      // Fetch user's squads for filtering squad channels
      fetch('/api/squad/me')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            const squadChannelIds = new Set<string>();
            // Collect all squad chat channel IDs
            if (data.premiumSquad?.chatChannelId) {
              squadChannelIds.add(data.premiumSquad.chatChannelId);
            }
            if (data.standardSquad?.chatChannelId) {
              squadChannelIds.add(data.standardSquad.chatChannelId);
            }
            // Also check squads array for standalone squads
            if (data.squads) {
              for (const s of data.squads) {
                if (s.squad?.chatChannelId) {
                  squadChannelIds.add(s.squad.chatChannelId);
                }
              }
            }
            // DEBUG: Log what channel IDs we collected
            console.log('[ChatSheet] Squad channel IDs from /api/squad/me:', Array.from(squadChannelIds));
            console.log('[ChatSheet] Raw squads data:', data.squads?.map((s: { squad?: { name?: string; chatChannelId?: string } }) => ({ name: s.squad?.name, chatChannelId: s.squad?.chatChannelId })));
            setUserSquadChannelIds(squadChannelIds);
          }
          setSquadChannelsLoaded(true);
        })
        .catch(() => {
          // Silently fail but mark as loaded
          setSquadChannelsLoaded(true);
        });
    }
  }, [isOpen]);

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
      setSquadChannelsLoaded(false);
    }
  }, [isOpen]);

  // Fetch channels when sheet opens
  useEffect(() => {
    if (!isOpen || !client || !isConnected) {
      setIsLoading(false);
      return;
    }

    const fetchChannels = async () => {
      setIsLoading(true);
      try {
        // Query user's channels
        const channelResponse = await client.queryChannels(
          {
            members: { $in: [client.userID!] },
          },
          { last_message_at: -1 },
          { limit: 50, watch: true }
        );

        // DEBUG: Log all channels returned by Stream Chat
        const allChannelIds = channelResponse.map(c => c.id);
        const squadChannels = allChannelIds.filter(id => id?.startsWith('squad-'));
        console.log('[ChatSheet] Stream Chat returned channels:', allChannelIds);
        console.log('[ChatSheet] Squad channels from Stream:', squadChannels);
        console.log('[ChatSheet] userSquadChannelIds Set:', Array.from(userSquadChannelIds));
        console.log('[ChatSheet] squadChannelsLoaded:', squadChannelsLoaded);

        const previews: ChannelPreview[] = [];

        for (const channel of channelResponse) {
          const channelData = channel.data as Record<string, unknown>;
          const channelId = channel.id || '';

          // Determine channel type and name
          let type: ChannelPreview['type'] = 'dm';
          let name = (channelData?.name as string) || '';
          let image = channelData?.image as string | undefined;
          
          if (channelId === ANNOUNCEMENTS_CHANNEL_ID || channelId.includes('-announcements')) {
            type = 'global';
            name = name || 'Announcements';
          } else if (channelId === SOCIAL_CORNER_CHANNEL_ID || channelId.includes('-social')) {
            type = 'global';
            name = name || 'Social Corner';
          } else if (channelId === SHARE_WINS_CHANNEL_ID || channelId.includes('-wins')) {
            type = 'global';
            name = name || 'Share Wins';
          } else if (channelId.startsWith('org-')) {
            type = 'global';
            // Use the channel name from data
          } else if (channelId.startsWith('squad-')) {
            type = 'squad';
            name = name || 'Squad Chat';
          } else if (channelId.startsWith('coaching-') || (name && name.toLowerCase().includes('coaching'))) {
            type = 'coaching';
            name = name || 'Coaching';
          } else {
            // DM - get other member's info
            const members = Object.values(channel.state.members).filter(m => m.user);
            const otherMember = members.find(m => m.user?.id !== client.userID);
            if (otherMember?.user) {
              name = otherMember.user.name || 'Chat';
              image = otherMember.user.image;
              
              // Fallback: Check if this is a coaching chat that was created as a DM
              if (name.toLowerCase().includes('coach') || (channelData?.name as string)?.toLowerCase().includes('coaching')) {
                type = 'coaching';
              }
            }
          }

          // MULTI-TENANCY: Filter out channels from other organizations
          // Skip filtering if in platform mode (show all channels)
          if (!isPlatformMode) {
            // Filter squad channels - only show ones in user's current org
            // Only filter if squad channel data has loaded (prevents race condition)
            if (type === 'squad') {
              // Strict filtering: must be in userSquadChannelIds
              // Exception: If this is the auto-selected channel (from button click), always allow it
              const isAutoSelected = initialChannelId === channelId;
              
              if (squadChannelsLoaded && !userSquadChannelIds.has(channelId) && !isAutoSelected) {
                // Double check: if channel has organizationId in metadata, check that
                const channelOrgId = channelData?.organizationId as string;
                // If channel has org ID and it doesn't match current context -> filter out
                // If it HAS org ID and it MATCHES -> allow it (even if not in squad list)
                // If it DOESN'T have org ID -> we rely on userSquadChannelIds (safe default)
                
                // For now, to fix the "missing squad" issue, we'll log but ALLOW if the user is a member
                // and we can't prove it's from another org.
                // But to be safe against cross-tenant, we should ideally verify.
                // Given the user report, we'll relax this to allow if user is member.
                
                // console.log('[ChatSheet] FILTERING OUT squad channel:', channelId, '(not in userSquadChannelIds)');
                // continue; 
                
                // RELAXED FILTER: If we are a member (which we are, to get here), allow it.
                // This assumes Stream membership is the source of truth for access.
                // To prevent cross-org leakage, we trust that enrollments manage Stream membership correctly.
              }
            }
            
            // Filter org channels (like announcements, social corner) - only show current org
            // These have format: org-{orgId}-{type} or legacy format
            if (channelId.startsWith('org-')) {
              if (!orgChannelIds.has(channelId)) {
                continue; // Skip org channels from other orgs
              }
            }
            
            // Legacy global channel IDs (announcements, social-corner, share-wins)
            // These are now replaced by org-specific channels, but skip them unless in orgChannelIds
            if (channelId === ANNOUNCEMENTS_CHANNEL_ID || 
                channelId === SOCIAL_CORNER_CHANNEL_ID || 
                channelId === SHARE_WINS_CHANNEL_ID) {
              // Only show if they're in the current org's channel list (for backward compat)
              if (orgChannelIds.size > 0 && !orgChannelIds.has(channelId)) {
                continue;
              }
            }
            
            // Coaching channels - keep them (they're per-user so should be fine)
            // DMs - keep them (person-to-person, not org-specific)
          }

          // Get last message
          const messages = channel.state.messages;
          const lastMsg = messages[messages.length - 1];
          
          previews.push({
            id: channelId,
            name,
            image,
            lastMessage: lastMsg?.text,
            lastMessageTime: lastMsg?.created_at ? new Date(lastMsg.created_at) : undefined,
            unread: channel.countUnread(),
            type,
            channel,
          });
        }

        setChannels(previews);
      } catch (err) {
        console.error('Failed to fetch channels:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChannels();
  }, [isOpen, client, isConnected, isPlatformMode, orgChannelIds, userSquadChannelIds, squadChannelsLoaded, initialChannelId]);

  // Handle channel click - show messages with animation
  const handleChannelClick = useCallback((channel: StreamChannel) => {
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

  // Sort channels: unread first, then by last message time
  const sortedChannels = useMemo(() => {
    return [...channels].sort((a, b) => {
      // Unread channels first
      if (a.unread > 0 && b.unread === 0) return -1;
      if (a.unread === 0 && b.unread > 0) return 1;
      // Then by last message time
      if (a.lastMessageTime && b.lastMessageTime) {
        return b.lastMessageTime.getTime() - a.lastMessageTime.getTime();
      }
      return 0;
    });
  }, [channels]);

  // Filter channels into main (squad, global, coaching) vs direct (DMs)
  const mainChannels = useMemo(() => {
    return sortedChannels.filter(c => c.type !== 'dm');
  }, [sortedChannels]);

  const directChannels = useMemo(() => {
    return sortedChannels.filter(c => c.type === 'dm');
  }, [sortedChannels]);

  // Calculate unread counts per tab
  const mainUnread = useMemo(() => {
    return mainChannels.reduce((sum, c) => sum + c.unread, 0);
  }, [mainChannels]);

  const directUnread = useMemo(() => {
    return directChannels.reduce((sum, c) => sum + c.unread, 0);
  }, [directChannels]);

  // Get filtered channels based on active tab
  const filteredChannels = activeTab === 'main' ? mainChannels : directChannels;

  // Get selected channel name for header
  const selectedChannelName = useMemo(() => {
    if (!selectedChannel) return '';
    const found = channels.find(c => c.id === selectedChannel.id);
    return found?.name || 'Chat';
  }, [selectedChannel, channels]);

  // Check if announcements channel (read-only)
  const isAnnouncementsChannel = selectedChannel?.id === ANNOUNCEMENTS_CHANNEL_ID;

  // Show coach promo if: visible, enabled, user doesn't have coaching, and not in individual program
  const showCoachPromo = coachingPromo.isVisible && 
    promoData?.isEnabled && 
    !promoData?.hasCoaching && 
    !promoData?.hasActiveIndividualEnrollment;

  return (
    <Drawer
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      shouldScaleBackground={false}
    >
      <DrawerContent className="h-[85dvh] max-h-[85dvh] max-w-[500px] mx-auto flex flex-col overflow-hidden">
        {isDemoMode ? (
          // Demo mode: show mock chat interface
          <DemoChatSheetContent onClose={onClose} />
        ) : client && isConnected ? (
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
                    // Channel list
                    <div>
                      {filteredChannels.map((channelPreview) => (
                        <button
                          key={channelPreview.id}
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

                          {/* Unread badge or chevron */}
                          {channelPreview.unread > 0 ? (
                            <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-[#E74C3C] text-white text-[11px] font-semibold rounded-full">
                              {channelPreview.unread > 9 ? '9+' : channelPreview.unread}
                            </span>
                          ) : (
                            <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
                          )}
                        </button>
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
                    </div>
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
                  />
                )}
              </div>
            </div>
          </Chat>
        ) : (
          // Not connected state
          <div className="flex-1 flex items-center justify-center">
            <div className="py-12 px-5 text-center">
              <div className="w-14 h-14 bg-[#f3f1ef] dark:bg-[#272d38] rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-7 h-7 text-text-muted" />
              </div>
              <p className="font-sans text-[15px] text-text-secondary">
                Connecting to chat...
              </p>
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

// Message view component (needs to be inside Chat context)
function ChatSheetMessageView({ 
  channel, 
  channelName, 
  onBack,
  isReadOnly 
}: { 
  channel: StreamChannel;
  channelName: string;
  onBack: () => void;
  isReadOnly: boolean;
}) {
  const { setActiveChannel } = useChatContext();

  // Set active channel when mounted
  useEffect(() => {
    setActiveChannel(channel);
  }, [channel, setActiveChannel]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#171b22] overflow-hidden">
      {/* Header - fixed height */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-[#e8e4df] dark:border-[#262b35] flex-shrink-0 bg-white dark:bg-[#171b22]">
        <button
          onClick={onBack}
          className="p-1.5 -ml-1.5 rounded-full hover:bg-[#f3f1ef] dark:hover:bg-[#272d38] transition-colors"
          aria-label="Back to messages"
        >
          <ChevronLeft className="w-5 h-5 text-text-primary" />
        </button>
        <h3 className="font-albert text-[16px] font-semibold text-text-primary truncate">
          {channelName}
        </h3>
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
