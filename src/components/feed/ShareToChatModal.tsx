'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useChatContext } from 'stream-chat-react';
import { useBrandingValues } from '@/contexts/BrandingContext';
import type { Channel } from 'stream-chat';

interface ShareToChatModalProps {
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
 * - Allows selecting one and sending the post link
 */
export function ShareToChatModal({ postUrl, onClose, onSuccess }: ShareToChatModalProps) {
  const { client } = useChatContext();
  const { colors, isDefault } = useBrandingValues();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const accentColor = isDefault ? '#a07855' : colors.accentLight;

  // Fetch user's channels
  useEffect(() => {
    const fetchChannels = async () => {
      if (!client?.userID) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const filter = { 
          type: 'messaging', 
          members: { $in: [client.userID] } 
        };
        const sort = [{ last_message_at: -1 as const }];
        const result = await client.queryChannels(filter, sort, { limit: 30 });
        setChannels(result);
      } catch (err) {
        console.error('Failed to fetch channels:', err);
        setError('Failed to load conversations');
      } finally {
        setIsLoading(false);
      }
    };

    fetchChannels();
  }, [client]);

  // Handle share
  const handleShare = useCallback(async () => {
    if (!selectedChannel || !client) return;

    setIsSending(true);
    setError(null);

    try {
      // Send message to the selected channel
      await selectedChannel.sendMessage({
        text: `📢 Check out this post: ${postUrl}`,
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
  }, [selectedChannel, client, postUrl, onClose, onSuccess]);

  // Get channel display info
  const getChannelInfo = (channel: Channel) => {
    const channelData = channel.data as Record<string, unknown> | undefined;
    const members = Object.values(channel.state.members).filter(m => m.user);
    const otherMember = members.find(m => m.user?.id !== client?.userID);
    
    // For DMs, show the other person's name
    const isDM = channel.id?.startsWith('dm-') || members.length === 2;
    const isSquad = channel.id?.startsWith('squad-') || channelData?.isSquadChannel;
    
    let name = (channelData?.name as string) || '';
    let image = channelData?.image as string | undefined;
    
    if (!name && isDM && otherMember?.user) {
      name = otherMember.user.name || `${otherMember.user.first_name || ''} ${otherMember.user.last_name || ''}`.trim() || 'User';
      image = otherMember.user.image;
    }
    
    if (!name) {
      name = isSquad ? 'Squad Chat' : 'Chat';
    }

    return { name, image, isDM, isSquad };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal - Bottom sheet on mobile, centered popup on desktop */}
      <div className="relative w-full max-w-[440px] md:mx-4 bg-white dark:bg-[#171b22] rounded-t-[24px] md:rounded-[24px] shadow-2xl animate-in slide-in-from-bottom md:zoom-in-95 duration-300 max-h-[80vh] flex flex-col overflow-hidden safe-area-inset-bottom">
        {/* Handle - Mobile only */}
        <div className="flex justify-center pt-3 pb-2 md:hidden">
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
            // Empty state
            <div className="text-center py-8">
              <p className="text-[14px] text-[#8a857f]">
                No conversations found
              </p>
            </div>
          ) : (
            // Channel list
            <div className="space-y-1">
              {channels.map((channel) => {
                const { name, image, isDM, isSquad } = getChannelInfo(channel);
                const isSelected = selectedChannel?.id === channel.id;
                const initial = name.charAt(0).toUpperCase();

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
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-[#a07855] to-[#7d5c3e] flex items-center justify-center flex-shrink-0">
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

                    {/* Name */}
                    <div className="flex-1 text-left">
                      <p className="font-medium text-[15px] text-[#1a1a1a] dark:text-[#faf8f6] truncate">
                        {name}
                      </p>
                      <p className="text-[12px] text-[#8a857f]">
                        {isSquad ? 'Squad' : isDM ? 'Direct Message' : 'Chat'}
                      </p>
                    </div>

                    {/* Selection indicator */}
                    {isSelected && (
                      <div 
                        className="w-5 h-5 rounded-full flex items-center justify-center"
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

