'use client';

import Image from 'next/image';
import { ChannelPreviewUIComponentProps } from 'stream-chat-react';
import { formatDistanceToNow } from 'date-fns';

/**
 * CustomChannelPreview Component
 * 
 * Custom channel list item for Growth Addicts chat:
 * - Avatar on left
 * - Channel name and last message preview
 * - Timestamp on right
 * - Unread indicator
 */

interface CustomChannelPreviewProps extends ChannelPreviewUIComponentProps {
  onChannelSelect?: () => void;
}

export function CustomChannelPreview(props: CustomChannelPreviewProps) {
  const { 
    channel, 
    setActiveChannel, 
    active,
    unread,
    lastMessage,
    displayTitle,
    onChannelSelect,
  } = props;

  // Get channel data - cast to Record to access custom properties
  const channelData = channel.data as Record<string, unknown> | undefined;
  const channelName = displayTitle || (channelData?.name as string) || 'Chat';
  const channelImage = channelData?.image as string | undefined;
  
  // Get first member's avatar for DMs if no channel image
  const members = Object.values(channel.state.members).filter(m => m.user);
  const otherMember = members.find(m => m.user?.id !== channel._client.userID);
  const avatarUrl = channelImage || otherMember?.user?.image;
  const avatarInitial = channelName.charAt(0).toUpperCase();
  
  // Last message preview
  const lastMessageText = lastMessage?.text || '';
  const truncatedMessage = lastMessageText.length > 40 
    ? `${lastMessageText.substring(0, 40)}...` 
    : lastMessageText;
  
  // Timestamp
  const timestamp = lastMessage?.created_at 
    ? formatDistanceToNow(new Date(lastMessage.created_at), { addSuffix: false })
    : '';

  const handleClick = () => {
    console.log('CustomChannelPreview clicked:', channel.id);
    setActiveChannel?.(channel);
    // Call the custom callback for mobile view switching
    onChannelSelect?.();
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left ${
        active 
          ? 'bg-white shadow-sm' 
          : 'hover:bg-white/60'
      }`}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {avatarUrl ? (
          <Image 
            src={avatarUrl} 
            alt={channelName}
            width={48}
            height={48}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#a07855] to-[#7d5c3e] flex items-center justify-center text-white font-albert font-semibold text-lg">
            {avatarInitial}
          </div>
        )}
        
        {/* Unread indicator */}
        {unread && unread > 0 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#a07855] dark:bg-[#b8896a] rounded-full flex items-center justify-center">
            <span className="font-albert text-[10px] font-semibold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`font-albert text-[15px] truncate ${
            unread && unread > 0 ? 'font-semibold text-[#1a1a1a]' : 'font-medium text-[#1a1a1a]'
          }`}>
            {channelName}
          </span>
          {timestamp && (
            <span className="font-albert text-[11px] text-[#8c8c8c] flex-shrink-0">
              {timestamp}
            </span>
          )}
        </div>
        {truncatedMessage && (
          <p className={`font-albert text-[13px] truncate mt-0.5 ${
            unread && unread > 0 ? 'text-[#5f5a55] font-medium' : 'text-[#8c8c8c]'
          }`}>
            {truncatedMessage}
          </p>
        )}
      </div>
    </button>
  );
}

export default CustomChannelPreview;
