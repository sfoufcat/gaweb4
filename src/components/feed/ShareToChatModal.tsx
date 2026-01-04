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
import { useDragToDismiss } from '@/hooks/useDragToDismiss';

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
  const { colors, isDefault } = useBrandingValues();
  const { sheetRef, handleRef, handleProps } = useDragToDismiss({ onClose });
  
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
      return { name: 'Announcements', image: undefined, isDM: false, isSquad: false, isSpecial: true };
    }
    if (channelId === SOCIAL_CORNER_CHANNEL_ID) {
      return { name: 'Social Corner', image: undefined, isDM: false, isSquad: false, isSpecial: true };
    }
    if (channelId === SHARE_WINS_CHANNEL_ID) {
      return { name: 'Share your wins', image: undefined, isDM: false, isSquad: false, isSpecial: true };
    }
    
    // For DMs, show the other person's name
    const isDM = channelId?.startsWith('dm-') || (members.length === 2 && !channelData?.name);
    const isSquad = channelId?.startsWith('squad-') || 
                    Boolean(channelData?.isSquadChannel) || 
                    Boolean(channelData?.squadId);
    
    let name = (channelData?.name as string) || '';
    let image = channelData?.image as string | undefined;
    
    if (!name && isDM && otherMember?.user) {
      // Stream Chat user properties - cast to access custom fields
      const userData = otherMember.user as unknown as Record<string, unknown>;
      name = (otherMember.user.name as string) || 
             `${(userData.firstName as string) || ''} ${(userData.lastName as string) || ''}`.trim() || 
             '';
      image = otherMember.user.image as string | undefined;
    }
    
    // Check for coaching channel
    const isCoaching = channelId?.startsWith('coaching-') || Boolean(channelData?.coachingId);
    if (!name && isCoaching) {
      name = 'Coach Chat';
    }
    
    if (!name) {
      name = isSquad ? 'Squad Chat' : '';
    }

    return { name, image, isDM, isSquad, isSpecial: false };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal - Bottom sheet on mobile, centered popup on desktop */}
      <div ref={sheetRef} className="relative w-full md:max-w-[440px] md:mx-4 bg-white dark:bg-[#171b22] rounded-t-[24px] md:rounded-[24px] shadow-2xl animate-in slide-in-from-bottom md:zoom-in-95 duration-300 max-h-[80dvh] flex flex-col overflow-hidden safe-area-inset-bottom">
        {/* Handle - Mobile only (drag handle) */}
        <div ref={handleRef} {...handleProps} className="flex justify-center pt-4 pb-3 md:hidden touch-none select-none cursor-grab active:cursor-grabbing">
          <div className="w-9 h-1 bg-gray-300 dark:bg-[#262b35] rounded-full" />
        </div>

        {/* Header */}
        <div className="px-6 pt-2 md:pt-6 pb-4 border-b border-[#e8e4df] dark:border-[#262b35] flex items-center justify-between">
          <h2 className="font-semibold text-[18px] text-[#1a1a1a] dark:text-[#faf8f6]">
            Share to Chat
          </h2>
          {/* Close button - Desktop only */}
          <button
            onClick={onClose}
            className="hidden md:block text-text-muted dark:text-[#7d8190] hover:text-text-primary dark:hover:text-[#f5f5f8] transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto p-4 min-h-[200px]">
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
                const { name, image, isDM, isSquad, isSpecial } = getChannelInfo(channel);
                const isSelected = selectedChannel?.id === channel.id;
                const initial = name.charAt(0).toUpperCase();
                
                // Get channel type label
                const getTypeLabel = () => {
                  if (isSpecial) return 'Community';
                  if (isSquad) return 'Squad';
                  if (isDM) return 'Direct Message';
                  return 'Chat';
                };

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
            Cancel
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
      </div>
    </div>
  );
}

