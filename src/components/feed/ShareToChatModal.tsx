'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useStreamChatClient } from '@/contexts/StreamChatContext';
import { useBrandingValues } from '@/contexts/BrandingContext';
import { useSquad } from '@/hooks/useSquad';
import { useCoachingData } from '@/hooks/useCoachingData';
import { useCoachSquads } from '@/hooks/useCoachSquads';
import { ANNOUNCEMENTS_CHANNEL_ID, SOCIAL_CORNER_CHANNEL_ID, SHARE_WINS_CHANNEL_ID } from '@/lib/chat-constants';
import type { Channel } from 'stream-chat';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent } from '@/components/ui/drawer';

// Post data interface for the attachment
interface PostData {
  id: string;
  text?: string;
  images?: string[];
  author?: {
    name: string;
    imageUrl?: string;
  };
}

interface ShareToChatModalProps {
  postId: string;
  postUrl: string;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * ShareToChatModal - Modal for selecting a chat channel to share a post to
 * 
 * - Desktop: Centered popup
 * - Mobile: Bottom sheet
 * - Shows user's chat channels
 * - Allows selecting one and sending the post link with rich preview
 */
export function ShareToChatModal({ postId, postUrl, onClose, onSuccess }: ShareToChatModalProps) {
  const { client } = useStreamChatClient();
  const { colors } = useBrandingValues();
  const isDesktop = useMediaQuery('(min-width: 768px)');

  // Get squad and coaching info to find relevant channels
  const { squad, premiumSquad, standardSquad } = useSquad();
  const { coachingData } = useCoachingData();
  const { squads: coachSquads, isCoach } = useCoachSquads();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [postData, setPostData] = useState<PostData | null>(null);
  
  // Track if initial fetch has been done to prevent double fetching
  const hasFetchedRef = useRef(false);

  const accentColor = colors.accentLight || 'var(--brand-accent-light)';

  // Fetch post data for rich preview
  useEffect(() => {
    const fetchPostData = async () => {
      try {
        const response = await fetch(`/api/feed/${postId}`);
        if (response.ok) {
          const data = await response.json();
          setPostData(data.post);
        }
      } catch (err) {
        console.error('Failed to fetch post data:', err);
        // Continue without post data - will fall back to simple link
      }
    };

    if (postId) {
      fetchPostData();
    }
  }, [postId]);

  // Fetch user's channels
  useEffect(() => {
    const fetchChannels = async () => {
      if (!client?.userID) {
        setIsLoading(false);
        return;
      }
      
      // Prevent double fetching - only fetch once
      if (hasFetchedRef.current) {
        return;
      }
      hasFetchedRef.current = true;

      try {
        setIsLoading(true);
        
        // 1. Collect all "known" channel IDs that the user should have access to
        const knownChannelIds = new Set<string>();
        
        // Global channels
        knownChannelIds.add(ANNOUNCEMENTS_CHANNEL_ID);
        knownChannelIds.add(SOCIAL_CORNER_CHANNEL_ID);
        knownChannelIds.add(SHARE_WINS_CHANNEL_ID);
        
        // Squad channels
        if (squad?.chatChannelId) knownChannelIds.add(squad.chatChannelId);
        if (premiumSquad?.chatChannelId) knownChannelIds.add(premiumSquad.chatChannelId);
        if (standardSquad?.chatChannelId) knownChannelIds.add(standardSquad.chatChannelId);
        
        // Coaching channel
        if (coachingData?.chatChannelId) knownChannelIds.add(coachingData.chatChannelId);
        
        // Coach squads (if user is a coach)
        if (isCoach && coachSquads) {
          coachSquads.forEach(s => {
            if (s.chatChannelId) knownChannelIds.add(s.chatChannelId);
          });
        }

        // 2. Query for channels where user is a member OR it's one of the known channels
        // Note: Stream doesn't support "OR" between members and IDs easily in one query if we want to include "members: $in"
        // So we'll do two queries and merge them, or try to be smart.
        
        // Query 1: Channels where user is a member (Messaging, DMs, etc.)
        const memberFilter = { 
          members: { $in: [client.userID] } 
        };
        const sort = [{ last_message_at: -1 as const }];
        
        // Query 2: Explicit known channels (Squads, Global)
        // We query these by ID. 
        const knownChannelsFilter = {
          id: { $in: Array.from(knownChannelIds) }
        };

        const [memberChannels, knownChannels] = await Promise.all([
          client.queryChannels(memberFilter, sort, { limit: 30, watch: false, state: true }),
          knownChannelIds.size > 0 
            ? client.queryChannels(knownChannelsFilter, sort, { limit: 30, watch: false, state: true })
            : Promise.resolve([])
        ]);

        // Merge and deduplicate
        const allChannelsMap = new Map<string, Channel>();
        
        [...memberChannels, ...knownChannels].forEach(channel => {
          if (channel.id) {
            allChannelsMap.set(channel.id, channel);
          }
        });

        // Filter out channels where user cannot send messages or that don't have proper names
        const validChannels = Array.from(allChannelsMap.values()).filter(channel => {
          // Check capabilities if available
          const capabilities = channel.data?.own_capabilities as string[] | undefined;
          if (capabilities && !capabilities.includes('send-message')) {
            return false;
          }
          
          // Filter out channels that would display without a meaningful name
          const channelId = channel.id;
          const channelData = channel.data as Record<string, unknown> | undefined;
          const members = Object.values(channel.state.members).filter(m => m.user);
          const otherMember = members.find(m => m.user?.id !== client.userID);
          
          // Special channels are always valid
          if (channelId === ANNOUNCEMENTS_CHANNEL_ID || 
              channelId === SOCIAL_CORNER_CHANNEL_ID || 
              channelId === SHARE_WINS_CHANNEL_ID) {
            return true;
          }
          
          // Check if channel has a name
          const explicitName = channelData?.name as string | undefined;
          
          // Filter out channels that have names matching special channels but aren't the real ones
          // These are duplicates that shouldn't appear
          const specialChannelNames = ['Announcements', 'Social Corner', 'Share your wins', 'Share Wins'];
          if (explicitName && specialChannelNames.some(
            special => explicitName.toLowerCase() === special.toLowerCase()
          )) {
            return false;
          }
          
          if (explicitName) return true;
          
          // Check if it's a DM with a named user
          const isDM = channelId?.startsWith('dm-') || (members.length === 2 && !explicitName);
          if (isDM && otherMember?.user) {
            const userData = otherMember.user as unknown as Record<string, unknown>;
            const userName = (otherMember.user.name as string) || 
                           `${(userData.firstName as string) || ''} ${(userData.lastName as string) || ''}`.trim();
            if (userName) return true;
          }
          
          // Check for squad or coaching channels
          const isSquad = channelId?.startsWith('squad-') || 
                          Boolean(channelData?.isSquadChannel) || 
                          Boolean(channelData?.squadId);
          const isCoaching = channelId?.startsWith('coaching-') || Boolean(channelData?.coachingId);
          
          if (isSquad || isCoaching) return true;
          
          // Filter out channels without meaningful identification
          return false;
        });
        
        // Sort manually by last_message_at since we merged two lists
        validChannels.sort((a, b) => {
          const dateA = a.state.last_message_at ? new Date(a.state.last_message_at).getTime() : 0;
          const dateB = b.state.last_message_at ? new Date(b.state.last_message_at).getTime() : 0;
          return dateB - dateA;
        });

        setChannels(validChannels);
      } catch (err) {
        console.error('Failed to fetch channels:', err);
        setError('Failed to load conversations');
      } finally {
        setIsLoading(false);
      }
    };

    fetchChannels();
  }, [client, squad, premiumSquad, standardSquad, coachingData, coachSquads, isCoach]);

  // Handle share
  const handleShare = useCallback(async () => {
    if (!selectedChannel || !client) return;

    setIsSending(true);
    setError(null);

    try {
      // Build the message with a rich post preview attachment
      const truncatedText = postData?.text 
        ? (postData.text.length > 150 ? postData.text.substring(0, 150) + '...' : postData.text)
        : undefined;

      // Create attachment for rich post preview
      const attachment: Record<string, unknown> = {
        type: 'post_preview',
        title: postData?.author?.name ? `${postData.author.name}'s post` : 'Shared post',
        text: truncatedText,
        title_link: postUrl,
        og_scrape_url: postUrl,
        post_id: postId,
      };

      // Add image if available
      if (postData?.images && postData.images.length > 0) {
        attachment.image_url = postData.images[0];
      }

      // Add author image if available
      if (postData?.author?.imageUrl) {
        attachment.author_icon = postData.author.imageUrl;
        attachment.author_name = postData.author.name;
      }

      // Send message with attachment
      await selectedChannel.sendMessage({
        text: 'Check out this post!',
        attachments: [attachment],
      });

      setSuccess(true);
      
      // Close after showing success
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Failed to share:', err);
      setError('Failed to send message');
    } finally {
      setIsSending(false);
    }
  }, [selectedChannel, client, postUrl, postId, postData, onClose, onSuccess]);

  // Get channel display info
  const getChannelInfo = (channel: Channel) => {
    const channelId = channel.id;
    const channelData = channel.data as Record<string, unknown> | undefined;
    const members = Object.values(channel.state.members).filter(m => m.user);
    const otherMember = members.find(m => m.user?.id !== client?.userID);

    // Check for special global channels first
    if (channelId === ANNOUNCEMENTS_CHANNEL_ID) {
      return { name: 'Announcements', image: undefined, isDM: false, isSquad: false, isSpecial: true, isCoaching: false };
    }
    if (channelId === SOCIAL_CORNER_CHANNEL_ID) {
      return { name: 'Social Corner', image: undefined, isDM: false, isSquad: false, isSpecial: true, isCoaching: false };
    }
    if (channelId === SHARE_WINS_CHANNEL_ID) {
      return { name: 'Share your wins', image: undefined, isDM: false, isSquad: false, isSpecial: true, isCoaching: false };
    }

    // Check for coaching channel first - these have "Name - Coaching" format
    const isCoaching = channelId?.startsWith('coaching-') || Boolean(channelData?.coachingId);

    // For DMs, show the other person's name
    const isDM = channelId?.startsWith('dm-') || (members.length === 2 && !channelData?.name);
    const isSquad = channelId?.startsWith('squad-') ||
                    Boolean(channelData?.isSquadChannel) ||
                    Boolean(channelData?.squadId);

    let name = '';
    let image = channelData?.image as string | undefined;

    // For coaching channels, get the coach's name from the other member
    if (isCoaching && otherMember?.user) {
      const userData = otherMember.user as unknown as Record<string, unknown>;
      name = `${(userData.firstName as string) || ''} ${(userData.lastName as string) || ''}`.trim() ||
             (otherMember.user.name as string) ||
             'Coach';
      image = otherMember.user.image as string | undefined;
    } else if (isDM && otherMember?.user) {
      // For DMs, show the other person's name
      const userData = otherMember.user as unknown as Record<string, unknown>;
      name = `${(userData.firstName as string) || ''} ${(userData.lastName as string) || ''}`.trim() ||
             (otherMember.user.name as string) ||
             '';
      image = otherMember.user.image as string | undefined;
    } else {
      // Use channel name for other cases
      name = (channelData?.name as string) || '';
    }

    if (!name && isCoaching) {
      name = 'Coach Chat';
    }

    if (!name) {
      name = isSquad ? 'Squad Chat' : '';
    }

    return { name, image, isDM, isSquad, isSpecial: false, isCoaching };
  };

  // Shared content for both Dialog and Drawer
  const modalContent = (
    <>
      {/* Header */}
      <div className="px-6 pt-4 md:pt-6 pb-4 border-b border-[#e8e4df] dark:border-[#262b35]">
        <h2 className="font-semibold text-[18px] text-[#1a1a1a] dark:text-[#faf8f6]">
          Share to Chat
        </h2>
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto p-4 min-h-[200px] max-h-[400px]">
        {isLoading ? (
          // Loading skeleton
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl animate-pulse">
                <div className="w-10 h-10 rounded-full bg-[#f5f3f0] dark:bg-[#262b35]" />
                <div className="flex-1">
                  <div className="w-24 h-4 bg-[#f5f3f0] dark:bg-[#262b35] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : channels.length === 0 ? (
          // Empty state with helpful message
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-16 h-16 rounded-full bg-[#f5f3f0] dark:bg-[#262b35] flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-[#8a857f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-[15px] font-medium text-[#1a1a1a] dark:text-[#faf8f6] mb-1">
              No conversations yet
            </p>
            <p className="text-[13px] text-[#8a857f] text-center max-w-[200px]">
              Start a chat with someone first to share posts with them
            </p>
          </div>
        ) : (
          // Channel list
          <div className="space-y-1">
            {channels.map((channel) => {
              const { name, image, isDM, isSquad, isSpecial, isCoaching } = getChannelInfo(channel);
              const isSelected = selectedChannel?.id === channel.id;
              const initial = name.charAt(0).toUpperCase();

              // Get channel type label
              const getTypeLabel = () => {
                if (isSpecial) return 'Community';
                if (isCoaching) return 'Coaching';
                if (isSquad) return 'Squad';
                if (isDM) return 'Direct Message';
                return 'Chat';
              };

              // Get icon for special channels
              const getSpecialChannelIcon = () => {
                if (channel.id === ANNOUNCEMENTS_CHANNEL_ID) {
                  return (
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1v4h2v-4h1l5 3V6L8 9H4zm11.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z" />
                    </svg>
                  );
                }
                if (channel.id === SOCIAL_CORNER_CHANNEL_ID) {
                  return (
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                    </svg>
                  );
                }
                if (channel.id === SHARE_WINS_CHANNEL_ID) {
                  return (
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
                    </svg>
                  );
                }
                return null;
              };

              const specialIcon = getSpecialChannelIcon();

              return (
                <button
                  key={channel.id || channel.cid}
                  onClick={() => setSelectedChannel(channel)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    isSelected
                      ? 'bg-[#f5f3f0] dark:bg-[#262b35]'
                      : 'hover:bg-[#f5f3f0]/50 dark:hover:bg-[#262b35]/50'
                  }`}
                  style={isSelected ? { borderColor: accentColor, borderWidth: 2, borderStyle: 'solid' } : undefined}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-brand-accent to-[#7d5c3e] flex items-center justify-center flex-shrink-0">
                    {image ? (
                      <Image
                        src={image}
                        alt={name}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    ) : specialIcon ? (
                      specialIcon
                    ) : (
                      <span className="text-white font-semibold text-sm">
                        {initial}
                      </span>
                    )}
                  </div>

                  {/* Name - constrained width when selected to leave room for checkmark */}
                  <div className={`flex-1 text-left min-w-0 ${isSelected ? 'max-w-[calc(100%-80px)]' : ''}`}>
                    <p className="font-medium text-[15px] text-[#1a1a1a] dark:text-[#faf8f6] truncate">
                      {name}
                    </p>
                    <p className="text-[12px] text-[#8a857f]">
                      {getTypeLabel()}
                    </p>
                  </div>

                  {/* Selection indicator */}
                  {isSelected && (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: accentColor }}
                    >
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="px-6 pb-2">
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="font-sans text-[13px] text-red-800 dark:text-red-200 text-center">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className="px-6 pb-2">
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
            <p className="font-sans text-[13px] text-green-800 dark:text-green-200 text-center flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Shared successfully!
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-6 pb-6 pt-4 border-t border-[#e8e4df] dark:border-[#262b35] flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 py-3 rounded-xl bg-[#f5f3f0] dark:bg-[#262b35] text-[15px] font-medium text-[#5f5a55] dark:text-[#b5b0ab] hover:bg-[#ebe7e2] dark:hover:bg-[#313746] transition-colors"
        >
          Close
        </button>
        <button
          onClick={handleShare}
          disabled={!selectedChannel || isSending || success}
          className="flex-1 py-3 rounded-xl text-[15px] font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: accentColor }}
        >
          {isSending ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Sending...
            </span>
          ) : success ? (
            'Sent!'
          ) : (
            'Share'
          )}
        </button>
      </div>
    </>
  );

  // Desktop: Dialog (centered modal)
  if (isDesktop) {
    return (
      <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
        <DialogContent hideCloseButton className="sm:max-w-[440px] p-0 bg-white/95 dark:bg-[#171b22]/95 backdrop-blur-xl border border-[#e8e4df]/50 dark:border-[#262b35]/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <DialogTitle className="sr-only">Share to Chat</DialogTitle>
          {modalContent}
        </DialogContent>
      </Dialog>
    );
  }

  // Mobile: Drawer (slides up from bottom)
  return (
    <Drawer
      open={true}
      onOpenChange={(open) => !open && onClose()}
      shouldScaleBackground={false}
    >
      <DrawerContent className="max-h-[80dvh] flex flex-col overflow-hidden bg-white/95 dark:bg-[#171b22]/95 backdrop-blur-xl border-t border-[#e8e4df]/50 dark:border-[#262b35]/50">
        {modalContent}
      </DrawerContent>
    </Drawer>
  );
}

