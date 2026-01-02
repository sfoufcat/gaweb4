'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
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

// Import Stream Chat CSS
import 'stream-chat-react/dist/css/v2/index.css';
import '@/app/chat/chat-styles.css';

interface ChatSheetProps {
  isOpen: boolean;
  onClose: () => void;
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
export function ChatSheet({ isOpen, onClose }: ChatSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const { client, isConnected } = useStreamChatClient();
  const [channels, setChannels] = useState<ChannelPreview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'list' | 'channel'>('list');
  const [selectedChannel, setSelectedChannel] = useState<StreamChannel | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'main' | 'direct'>('main');
  
  // Coaching promo data
  const coachingPromo = useCoachingPromo();
  const [promoData, setPromoData] = useState<{
    isEnabled: boolean;
    destinationUrl: string | null;
    hasCoaching: boolean;
    hasActiveIndividualEnrollment: boolean;
  } | null>(null);

  // Fetch coaching promo data
  useEffect(() => {
    if (isOpen) {
      fetch('/api/user/org-coaching-promo')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            setPromoData({
              isEnabled: data.isEnabled || false,
              destinationUrl: data.destinationUrl || null,
              hasCoaching: data.hasCoaching || false,
              hasActiveIndividualEnrollment: data.hasActiveIndividualEnrollment || false,
            });
          }
        })
        .catch(() => {
          // Silently fail
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

  // Focus trap
  useEffect(() => {
    if (isOpen && sheetRef.current) {
      sheetRef.current.focus();
    }
  }, [isOpen]);

  // Reset view when sheet closes
  useEffect(() => {
    if (!isOpen) {
      setView('list');
      setSelectedChannel(null);
      setIsAnimating(false);
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
          { limit: 30, watch: true }
        );

        const previews: ChannelPreview[] = channelResponse.map((channel) => {
          const channelData = channel.data as Record<string, unknown>;
          const channelId = channel.id || '';
          
          // Determine channel type and name
          let type: ChannelPreview['type'] = 'dm';
          let name = (channelData?.name as string) || '';
          let image = channelData?.image as string | undefined;
          
          if (channelId === ANNOUNCEMENTS_CHANNEL_ID) {
            type = 'global';
            name = name || 'Announcements';
          } else if (channelId === SOCIAL_CORNER_CHANNEL_ID) {
            type = 'global';
            name = name || 'Social Corner';
          } else if (channelId === SHARE_WINS_CHANNEL_ID) {
            type = 'global';
            name = name || 'Share Wins';
          } else if (channelId.startsWith('squad-')) {
            type = 'squad';
            name = name || 'Squad Chat';
          } else if (channelId.startsWith('coaching-')) {
            type = 'coaching';
            name = name || 'Coaching';
          } else {
            // DM - get other member's info
            const members = Object.values(channel.state.members).filter(m => m.user);
            const otherMember = members.find(m => m.user?.id !== client.userID);
            if (otherMember?.user) {
              name = otherMember.user.name || 'Chat';
              image = otherMember.user.image;
            }
          }

          // Get last message
          const messages = channel.state.messages;
          const lastMsg = messages[messages.length - 1];
          
          return {
            id: channelId,
            name,
            image,
            lastMessage: lastMsg?.text,
            lastMessageTime: lastMsg?.created_at ? new Date(lastMsg.created_at) : undefined,
            unread: channel.countUnread(),
            type,
            channel,
          };
        });

        setChannels(previews);
      } catch (err) {
        console.error('Failed to fetch channels:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChannels();
  }, [isOpen, client, isConnected]);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={view === 'list' ? onClose : undefined}
      />

      {/* Sheet - 85% height for home visibility */}
      <div 
        ref={sheetRef}
        tabIndex={-1}
        className="relative w-full max-w-[500px] mx-0 bg-white dark:bg-[#171b22] rounded-t-[24px] shadow-2xl animate-in slide-in-from-bottom duration-300 outline-none flex flex-col overflow-hidden"
        style={{ height: '85vh', maxHeight: '85vh' }}
      >
        {/* Grabber */}
        <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
          <div className="w-9 h-1 bg-gray-300 dark:bg-[#272d38] rounded-full" />
        </div>

        {client && isConnected ? (
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
                            {coachingPromo.imageUrl ? (
                              <Image
                                src={coachingPromo.imageUrl}
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
      </div>
    </div>
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

export default ChatSheet;
