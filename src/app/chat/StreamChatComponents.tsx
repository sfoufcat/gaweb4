'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import {
  Chat,
  Channel,
  ChannelList,
  MessageList,
  MessageInput,
  Window,
  Thread,
  useChatContext,
  useChannelStateContext,
  ChannelPreviewUIComponentProps,
  DateSeparatorProps,
} from 'stream-chat-react';
import { CustomMessage } from '@/components/chat/CustomMessage';
import { CustomMessageInput } from '@/components/chat/CustomMessageInput';
import { SquadMemberStoryAvatar } from '@/components/chat/SquadMemberStoryAvatar';
import { CallButtons } from '@/components/chat/CallButtons';
import type { Channel as StreamChannel, ChannelSort, ChannelFilters, ChannelOptions } from 'stream-chat';
import { ANNOUNCEMENTS_CHANNEL_ID, SOCIAL_CORNER_CHANNEL_ID, SHARE_WINS_CHANNEL_ID } from '@/lib/chat-constants';
import { useSquad } from '@/hooks/useSquad';
import { useCoachingData } from '@/hooks/useCoachingData';
import { useCoachSquads } from '@/hooks/useCoachSquads';
import { isAdmin } from '@/lib/admin-utils-shared';
import type { UserRole } from '@/types';
import { formatDistanceToNow, format } from 'date-fns';

// Import Stream Chat default CSS
import 'stream-chat-react/dist/css/v2/index.css';
// Import custom CSS overrides
import './chat-styles.css';


/**
 * Custom Date Separator - Figma style with centered text and lines on both sides
 */
function CustomDateSeparator({ date }: DateSeparatorProps) {
  // Format the date (e.g., "Sat, Oct 4")
  const formattedDate = format(date, 'EEE, MMM d');
  
  return (
    <div className="flex items-center gap-4 py-4 px-2">
      <div className="flex-1 h-px bg-[#e1ddd8] dark:bg-[#262b35]" />
      <span className="font-sans text-[12px] text-[#a7a39e] dark:text-[#7d8190] whitespace-nowrap leading-[1.2]">
        {formattedDate}
      </span>
      <div className="flex-1 h-px bg-[#e1ddd8] dark:bg-[#262b35]" />
    </div>
  );
}

// Context for mobile view callback
const MobileViewContext = createContext<(() => void) | null>(null);

// Channel preview component with mobile view support
function ChannelPreviewWithMobile(props: ChannelPreviewUIComponentProps) {
  const { 
    channel, 
    setActiveChannel, 
    active,
    unread,
    lastMessage,
    displayTitle,
  } = props;
  
  const onMobileSelect = useContext(MobileViewContext);

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
    console.log('ChannelPreview clicked:', channel.id);
    setActiveChannel?.(channel);
    // Switch to channel view on mobile
    onMobileSelect?.();
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left ${
        active 
          ? 'bg-[#ffffff] dark:bg-[#171b22] shadow-sm dark:shadow-none' 
          : 'bg-transparent hover:bg-[#ffffff]/60 dark:hover:bg-[#171b22]/60'
      }`}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
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
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`font-albert text-[15px] truncate ${
            unread !== undefined && unread > 0 ? 'font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]' : 'font-medium text-[#1a1a1a] dark:text-[#f5f5f8]'
          }`}>
            {channelName}
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            {timestamp && (
              <span className="font-albert text-[12px] text-[#8c8c8c] dark:text-[#7d8190]">
                {timestamp}
              </span>
            )}
            {/* Unread indicator */}
            {unread !== undefined && unread > 0 && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-[#a07855] text-white text-[10px] font-albert font-bold">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </div>
        </div>
        {truncatedMessage && (
          <p className={`font-albert text-[13px] truncate mt-0.5 ${
            unread !== undefined && unread > 0 ? 'text-[#5f5a55] dark:text-[#b2b6c2] font-medium' : 'text-[#8c8c8c] dark:text-[#7d8190]'
          }`}>
            {truncatedMessage}
          </p>
        )}
      </div>
    </button>
  );
}

interface StreamChatComponentsProps {
  client: any;
  user: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
  };
  initialChannelId?: string | null;
}

// Pin icon component
function PinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
    </svg>
  );
}

// Special channel item component
function SpecialChannelItem({ 
  icon, 
  name, 
  description, 
  onClick,
  isActive,
  avatarUrl,
  isPinned,
  unreadCount,
  lastMessageTime,
}: { 
  icon?: React.ReactNode; 
  name: string; 
  description?: string;
  onClick: () => void;
  isActive?: boolean;
  avatarUrl?: string;
  isPinned?: boolean;
  unreadCount?: number;
  lastMessageTime?: Date | null;
}) {
  // Format timestamp
  const timestamp = lastMessageTime 
    ? formatDistanceToNow(lastMessageTime, { addSuffix: false })
    : '';

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left ${
        isActive 
          ? 'bg-[#ffffff] dark:bg-[#171b22] shadow-sm dark:shadow-none' 
          : 'bg-transparent hover:bg-[#ffffff]/60 dark:hover:bg-[#171b22]/60'
      }`}
    >
      {avatarUrl ? (
        <Image src={avatarUrl} alt={name} width={48} height={48} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded-full bg-[#a07855]/10 dark:bg-[#b8896a]/15 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="font-albert text-[15px] font-medium text-text-primary truncate">{name}</p>
            {isPinned && (
              <PinIcon className="w-3.5 h-3.5 text-[#a07855] flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {timestamp && (
              <span className="font-albert text-[12px] text-text-secondary">{timestamp}</span>
            )}
            {unreadCount && unreadCount > 0 ? (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-[#a07855] text-white text-[10px] font-albert font-bold">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </div>
        </div>
        {description && (
          <p className="font-albert text-[13px] text-text-secondary truncate">{description}</p>
        )}
      </div>
    </button>
  );
}

// Get your personal coach item (links to /get-coach page)
function CoachPromoItem() {
  return (
    <Link
      href="/get-coach"
      className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[#ffffff]/60 dark:hover:bg-[#171b22]/60 transition-colors"
    >
      <Image 
        src="https://images.unsplash.com/photo-1580518324671-c2f0833a3af3?q=80&w=987&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
        alt="Personal Coach"
        width={48}
        height={48}
        className="w-12 h-12 rounded-full object-cover flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="font-albert text-[15px] font-medium text-text-primary">Get your personal coach</p>
        <p className="font-albert text-[13px] text-text-secondary">Work with a performance psychologist 1:1</p>
      </div>
    </Link>
  );
}

// Custom header for DM channels - with story avatar for the other member
function CustomChannelHeader({ onBack }: { onBack?: () => void }) {
  const { channel } = useChatContext();
  const router = useRouter();
  
  // Cast channel.data to any to access custom properties like name and image
  const channelData = channel?.data as Record<string, unknown> | undefined;
  const members = Object.values(channel?.state?.members || {}).filter(m => m.user);
  const otherMember = members.find(m => m.user?.id !== channel?._client?.userID);
  
  // Get member count from channel data (reliable for large channels) or fallback to local state
  const memberCount = (channel?.data?.member_count as number) || members.length;

  // Check for special channels first
  const channelId = channel?.id;
  const isSpecialChannel = channelId === ANNOUNCEMENTS_CHANNEL_ID || channelId === SOCIAL_CORNER_CHANNEL_ID || channelId === SHARE_WINS_CHANNEL_ID;
  
  // Get channel name - prioritize special channel names, then explicit name, then other member's name
  const getChannelName = () => {
    if (channelId === ANNOUNCEMENTS_CHANNEL_ID) return 'Announcements';
    if (channelId === SOCIAL_CORNER_CHANNEL_ID) return 'Social Corner';
    if (channelId === SHARE_WINS_CHANNEL_ID) return 'Share your wins';
    const explicitName = channelData?.name as string | undefined;
    if (explicitName) return explicitName;
    return otherMember?.user?.name || 'Chat';
  };
  
  const channelName = getChannelName();
  const isDMChat = !isSpecialChannel && !(channelData?.name as string | undefined) && otherMember?.user?.id;
  
  // Handle profile click for DM chats
  const handleProfileClick = () => {
    if (isDMChat && otherMember?.user?.id) {
      router.push(`/profile/${otherMember.user.id}`);
    }
  };

  return (
    <div className="str-chat__header-livestream bg-[#faf8f6] dark:bg-[#05070b]">
      {/* Single Row Header - matches Squad header structure */}
      <div className="flex items-center justify-between px-4 py-2">
        {/* Left: Back + Avatar + Title */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Back button - always visible on mobile */}
          <button
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#171b22] rounded-full transition-colors lg:hidden flex-shrink-0"
            aria-label="Go back"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          {/* Avatar + Name container */}
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Avatar - Use SquadMemberStoryAvatar for DM chats to enable story/profile */}
            {isDMChat && otherMember?.user ? (
              <SquadMemberStoryAvatar
                userId={otherMember.user.id}
                streamUser={{
                  name: otherMember.user.name,
                  image: otherMember.user.image,
                }}
                size="sm"
                showName={false}
              />
              ) : channelId === ANNOUNCEMENTS_CHANNEL_ID ? (
              <div className="w-9 h-9 rounded-full bg-[#a07855]/10 dark:bg-[#b8896a]/15 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              ) : channelId === SOCIAL_CORNER_CHANNEL_ID ? (
                <div className="w-9 h-9 rounded-full bg-[#a07855]/10 dark:bg-[#b8896a]/15 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
              ) : channelId === SHARE_WINS_CHANNEL_ID ? (
                <div className="w-9 h-9 rounded-full bg-[#a07855]/10 dark:bg-[#b8896a]/15 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#a07855] to-[#7d5c3e] dark:from-[#b8896a] dark:to-[#8c7a6d] flex items-center justify-center text-white font-albert font-semibold text-sm flex-shrink-0">
                  {channelName.charAt(0).toUpperCase()}
                </div>
              )}
            
            <div className="min-w-0">
              {/* Name - Clickable to profile for DM chats */}
              {isDMChat ? (
                <button
                  type="button"
                  onClick={handleProfileClick}
                  className="font-albert text-[16px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] truncate hover:opacity-70 transition-opacity cursor-pointer text-left"
                >
                  {channelName}
                </button>
              ) : (
                <h2 className="font-albert text-[16px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] truncate">{channelName}</h2>
              )}
              {(memberCount > 2 || isSpecialChannel) && (
                <p className="font-albert text-[11px] text-[#5f5a55] dark:text-[#b2b6c2]">{memberCount} members</p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Call buttons (only for DM channels) */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <CallButtons channel={channel} />
        </div>
      </div>
    </div>
  );
}

// Squad header with member avatars inline - compact single row
function SquadChannelHeader({ onBack }: { onBack?: () => void }) {
  const { channel, members } = useChannelStateContext();
  
  // Cast channel.data to any to access custom properties like name
  const channelData = channel?.data as Record<string, unknown> | undefined;
  const channelName = (channelData?.name as string) || 'My Squad';
  const channelImage = channelData?.image as string | undefined;
  const channelMembers = Object.values(members || {}).filter(m => m.user);
  
  // Get initial for fallback avatar
  const squadInitial = channelName.charAt(0).toUpperCase();
  
  // Limit avatars shown, with overflow indicator
  const maxAvatars = 5;
  const visibleMembers = channelMembers.slice(0, maxAvatars);
  const overflowCount = channelMembers.length - maxAvatars;

  return (
    <div className="str-chat__header-livestream bg-[#faf8f6] dark:bg-[#05070b]">
      {/* Single Row Header */}
      <div className="flex items-center justify-between px-4 py-2">
        {/* Left: Back + Squad Avatar + Title (clickable to /squad) */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Back Button */}
          <button
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#171b22] rounded-full transition-colors lg:hidden flex-shrink-0"
            aria-label="Go back"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          {/* Squad Avatar + Name - Clickable to /squad */}
          <Link href="/squad" className="flex items-center gap-2.5 min-w-0 hover:opacity-80 transition-opacity">
            {/* Squad Avatar */}
            {channelImage ? (
              <Image 
                src={channelImage} 
                alt={channelName}
                width={36}
                height={36}
                className="w-9 h-9 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#a07855] to-[#7d5c3e] dark:from-[#b8896a] dark:to-[#8c7a6d] flex items-center justify-center text-white font-albert font-semibold text-sm flex-shrink-0">
                {squadInitial}
              </div>
            )}
            
            {/* Title + Member Count */}
            <div className="min-w-0">
              <h2 className="font-albert text-[16px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                {channelName}
              </h2>
              {channelMembers.length > 0 && (
                <p className="font-albert text-[11px] text-[#5f5a55] dark:text-[#b2b6c2]">{channelMembers.length} members</p>
              )}
            </div>
          </Link>
        </div>

        {/* Right: Avatars + Call Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Member Avatars */}
          {channelMembers.length > 0 && (
            <div className="flex items-center -space-x-1">
              {visibleMembers.map((member) => {
                const user = member.user;
                if (!user) return null;
                
                return (
                  <SquadMemberStoryAvatar
                    key={user.id}
                    userId={user.id}
                    streamUser={{
                      name: user.name,
                      image: user.image,
                    }}
                    size="sm"
                    showName={false}
                  />
                );
              })}
              
              {/* Overflow indicator */}
              {overflowCount > 0 && (
                <div className="w-10 h-10 rounded-full bg-[#f3f1ef] dark:bg-[#171b22] border-2 border-[#faf8f6] dark:border-[#05070b] flex items-center justify-center flex-shrink-0 ml-1">
                  <span className="font-albert text-[11px] font-semibold text-[#5f5a55] dark:text-[#b2b6c2]">
                    +{overflowCount}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Call Buttons (Audio + Video) */}
          <CallButtons channel={channel} />
        </div>
      </div>
    </div>
  );
}

// Pill selector tabs component
function ChatTabs({ 
  activeTab, 
  onTabChange,
  mainUnread = 0,
  directUnread = 0,
}: { 
  activeTab: 'main' | 'direct'; 
  onTabChange: (tab: 'main' | 'direct') => void;
  mainUnread?: number;
  directUnread?: number;
}) {
  return (
    <div className="bg-[#f3f1ef] dark:bg-[#11141b] rounded-[40px] p-2 flex gap-2">
      {/* Main Tab */}
      <button
        type="button"
        onClick={() => onTabChange('main')}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-[32px] transition-all ${
          activeTab === 'main'
            ? 'bg-white dark:bg-[#171b22] shadow-[0px_4px_10px_0px_rgba(0,0,0,0.1)] dark:shadow-none'
            : ''
        }`}
      >
        <svg className={`w-5 h-5 ${activeTab === 'main' ? 'text-[#1a1a1a] dark:text-[#f5f5f8]' : 'text-[#5f5a55] dark:text-[#7d8190]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <span className={`font-albert text-[18px] font-semibold tracking-[-1px] ${
          activeTab === 'main' ? 'text-[#1a1a1a] dark:text-[#f5f5f8]' : 'text-[#5f5a55] dark:text-[#7d8190]'
        }`}>
          Main
        </span>
        {mainUnread > 0 && (
          <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#a07855] dark:bg-[#b8896a] text-white text-[11px] font-albert font-semibold">
            {mainUnread > 9 ? '9+' : mainUnread}
          </span>
        )}
      </button>
      
      {/* Direct Tab */}
      <button
        type="button"
        onClick={() => onTabChange('direct')}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-[32px] transition-all ${
          activeTab === 'direct'
            ? 'bg-white dark:bg-[#171b22] shadow-[0px_4px_10px_0px_rgba(0,0,0,0.1)] dark:shadow-none'
            : ''
        }`}
      >
        <svg className={`w-5 h-5 ${activeTab === 'direct' ? 'text-[#1a1a1a] dark:text-[#f5f5f8]' : 'text-[#5f5a55] dark:text-[#7d8190]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span className={`font-albert text-[18px] font-semibold tracking-[-1px] ${
          activeTab === 'direct' ? 'text-[#1a1a1a] dark:text-[#f5f5f8]' : 'text-[#5f5a55] dark:text-[#7d8190]'
        }`}>
          Direct
        </span>
        {directUnread > 0 && (
          <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#a07855] dark:bg-[#b8896a] text-white text-[11px] font-albert font-semibold">
            {directUnread > 9 ? '9+' : directUnread}
          </span>
        )}
      </button>
    </div>
  );
}

// Inner component that has access to chat context
function ChatContent({ 
  user, 
  initialChannelId,
  userRole,
  onMobileViewChange,
  mobileView,
}: { 
  user: StreamChatComponentsProps['user']; 
  initialChannelId?: string | null;
  userRole?: UserRole;
  onMobileViewChange: (view: 'list' | 'channel') => void;
  mobileView: 'list' | 'channel';
}) {
  const { client, setActiveChannel, channel: activeChannel } = useChatContext();
  const [channelInitialized, setChannelInitialized] = useState(false);
  const [isAnnouncementsChannel, setIsAnnouncementsChannel] = useState(false);
  const [activeTab, setActiveTab] = useState<'main' | 'direct'>('main');
  const [mainUnread, setMainUnread] = useState(0);
  const [directUnread, setDirectUnread] = useState(0);
  // Specific channel unread counts
  const [announcementsUnread, setAnnouncementsUnread] = useState(0);
  const [socialCornerUnread, setSocialCornerUnread] = useState(0);
  const [shareWinsUnread, setShareWinsUnread] = useState(0);
  const [squadUnread, setSquadUnread] = useState(0);
  const [premiumSquadUnread, setPremiumSquadUnread] = useState(0);
  const [standardSquadUnread, setStandardSquadUnread] = useState(0);
  const [coachingUnread, setCoachingUnread] = useState(0);
  // Last message timestamps
  const [announcementsLastMessage, setAnnouncementsLastMessage] = useState<Date | null>(null);
  const [socialCornerLastMessage, setSocialCornerLastMessage] = useState<Date | null>(null);
  const [shareWinsLastMessage, setShareWinsLastMessage] = useState<Date | null>(null);
  const [squadLastMessage, setSquadLastMessage] = useState<Date | null>(null);
  const [premiumSquadLastMessage, setPremiumSquadLastMessage] = useState<Date | null>(null);
  const [standardSquadLastMessage, setStandardSquadLastMessage] = useState<Date | null>(null);
  const [coachingLastMessage, setCoachingLastMessage] = useState<Date | null>(null);
  
  // Get user's squad(s) for pinned squad chat (for regular users)
  // Supports dual squad membership - users can have both a premium and standard squad
  const { 
    squad, 
    premiumSquad, 
    standardSquad, 
    hasBothSquads,
    isLoading: isSquadLoading 
  } = useSquad();
  const squadChannelId = squad?.chatChannelId;
  const premiumSquadChannelId = premiumSquad?.chatChannelId;
  const standardSquadChannelId = standardSquad?.chatChannelId;
  
  // Get all squads a coach manages (for coaches with multiple squads)
  const { squads: coachSquads, isLoading: isCoachSquadsLoading, isCoach } = useCoachSquads();
  
  // Get user's coaching data for coaching chat
  const { coachingData, coach, hasCoaching, isLoading: _isCoachingLoading } = useCoachingData();
  const coachingChannelId = coachingData?.chatChannelId;
  
  // Track unread counts and last messages for all coach squads
  const [coachSquadUnreads, setCoachSquadUnreads] = useState<Record<string, number>>({});
  const [coachSquadLastMessages, setCoachSquadLastMessages] = useState<Record<string, Date | null>>({});
  
  // Track orphan channels (channels with unreads that aren't shown in the normal list)
  const [orphanSquadChannels, setOrphanSquadChannels] = useState<StreamChannel[]>([]);
  const [orphanCoachingChannels, setOrphanCoachingChannels] = useState<StreamChannel[]>([]);
  
  // Calculate unread counts and last message times from active channels
  const calculateUnreadCounts = useCallback(() => {
    if (!client) return;
    
    let main = 0;
    let direct = 0;
    let announcements = 0;
    let social = 0;
    let shareWins = 0;
    let squad = 0;
    let premiumSquadCount = 0;
    let standardSquadCount = 0;
    let coaching = 0;
    let announcementsTime: Date | null = null;
    let socialTime: Date | null = null;
    let shareWinsTime: Date | null = null;
    let squadTime: Date | null = null;
    let premiumSquadTime: Date | null = null;
    let standardSquadTime: Date | null = null;
    let coachingTime: Date | null = null;
    
    // Track coach squad unreads and last messages by channel ID
    const coachSquadUnreadMap: Record<string, number> = {};
    const coachSquadLastMessageMap: Record<string, Date | null> = {};
    
    // Track orphan channels (channels with unreads not shown in normal list)
    const orphanSquads: StreamChannel[] = [];
    const orphanCoaching: StreamChannel[] = [];
    
    // Build a set of coach squad channel IDs for quick lookup
    const coachSquadChannelIds = new Set(
      coachSquads
        .filter(s => s.chatChannelId)
        .map(s => s.chatChannelId!)
    );
    
    // Build set of user's own squad channel IDs
    const userSquadChannelIds = new Set<string>();
    if (premiumSquadChannelId) userSquadChannelIds.add(premiumSquadChannelId);
    if (standardSquadChannelId) userSquadChannelIds.add(standardSquadChannelId);
    if (squadChannelId) userSquadChannelIds.add(squadChannelId);
    
    const channels = Object.values(client.activeChannels);
    for (const channel of channels) {
      const channelId = channel.id;
      const unread = channel.countUnread();
      
      // Track last message times for special channels
      const lastMessageAt = channel.state?.last_message_at;
      if (channelId === ANNOUNCEMENTS_CHANNEL_ID && lastMessageAt) {
        announcementsTime = new Date(lastMessageAt);
      }
      if (channelId === SOCIAL_CORNER_CHANNEL_ID && lastMessageAt) {
        socialTime = new Date(lastMessageAt);
      }
      if (channelId === SHARE_WINS_CHANNEL_ID && lastMessageAt) {
        shareWinsTime = new Date(lastMessageAt);
      }
      if (channelId?.startsWith('squad-') && lastMessageAt) {
        squadTime = new Date(lastMessageAt);
        // Track specific squad times for dual membership
        if (channelId === premiumSquadChannelId) {
          premiumSquadTime = new Date(lastMessageAt);
        }
        if (channelId === standardSquadChannelId) {
          standardSquadTime = new Date(lastMessageAt);
        }
        // Track for coach squads specifically
        if (channelId && coachSquadChannelIds.has(channelId)) {
          coachSquadLastMessageMap[channelId] = new Date(lastMessageAt);
        }
      }
      if (channelId?.startsWith('coaching-') && lastMessageAt) {
        coachingTime = new Date(lastMessageAt);
      }
      
      if (unread > 0) {
        // Track specific channel unread counts
        if (channelId === ANNOUNCEMENTS_CHANNEL_ID) announcements = unread;
        if (channelId === SOCIAL_CORNER_CHANNEL_ID) social = unread;
        if (channelId === SHARE_WINS_CHANNEL_ID) shareWins = unread;
        
        if (channelId?.startsWith('squad-')) {
          squad += unread;
          // Track specific squad unreads for dual membership
          if (channelId === premiumSquadChannelId) {
            premiumSquadCount = unread;
          }
          if (channelId === standardSquadChannelId) {
            standardSquadCount = unread;
          }
          // Track for coach squads specifically
          if (channelId && coachSquadChannelIds.has(channelId)) {
            coachSquadUnreadMap[channelId] = unread;
          }
          // Check if this is an orphan squad (not user's squad, not a managed coach squad)
          if (!userSquadChannelIds.has(channelId) && !coachSquadChannelIds.has(channelId)) {
            orphanSquads.push(channel);
          }
        }
        
        if (channelId?.startsWith('coaching-')) {
          coaching += unread;
          // Check if this is an orphan coaching channel (not current coaching channel)
          if (channelId !== coachingChannelId) {
            orphanCoaching.push(channel);
          }
        }

        // Main: squad, coaching, announcements, social corner, share wins
        if (
          channelId === ANNOUNCEMENTS_CHANNEL_ID ||
          channelId === SOCIAL_CORNER_CHANNEL_ID ||
          channelId === SHARE_WINS_CHANNEL_ID ||
          channelId?.startsWith('squad-') ||
          channelId?.startsWith('coaching-')
        ) {
          main += unread;
        } else {
          // Direct messages
          direct += unread;
        }
      }
    }
    
    setMainUnread(main);
    setDirectUnread(direct);
    setAnnouncementsUnread(announcements);
    setSocialCornerUnread(social);
    setShareWinsUnread(shareWins);
    setSquadUnread(squad);
    setPremiumSquadUnread(premiumSquadCount);
    setStandardSquadUnread(standardSquadCount);
    setCoachingUnread(coaching);
    setAnnouncementsLastMessage(announcementsTime);
    setSocialCornerLastMessage(socialTime);
    setShareWinsLastMessage(shareWinsTime);
    setSquadLastMessage(squadTime);
    setPremiumSquadLastMessage(premiumSquadTime);
    setStandardSquadLastMessage(standardSquadTime);
    setCoachingLastMessage(coachingTime);
    setCoachSquadUnreads(coachSquadUnreadMap);
    setCoachSquadLastMessages(coachSquadLastMessageMap);
    setOrphanSquadChannels(orphanSquads);
    setOrphanCoachingChannels(orphanCoaching);
  }, [client, coachSquads, squadChannelId, premiumSquadChannelId, standardSquadChannelId, coachingChannelId]);

  // Watch global channels to ensure we get updates/counts even if not in active list
  useEffect(() => {
    if (!client) return;
    
    const watchGlobalChannels = async () => {
      const channelsToWatch = [ANNOUNCEMENTS_CHANNEL_ID, SOCIAL_CORNER_CHANNEL_ID, SHARE_WINS_CHANNEL_ID];
      if (squadChannelId) channelsToWatch.push(squadChannelId);
      if (coachingChannelId) channelsToWatch.push(coachingChannelId);
      
      // Add all coach squad channels
      for (const coachSquad of coachSquads) {
        if (coachSquad.chatChannelId && !channelsToWatch.includes(coachSquad.chatChannelId)) {
          channelsToWatch.push(coachSquad.chatChannelId);
        }
      }
      
      for (const channelId of channelsToWatch) {
        try {
          const channel = client.channel('messaging', channelId);
          // Always watch to ensure we get real-time events for unread counts
          await channel.watch();
        } catch (error) {
          console.warn(`Failed to watch channel ${channelId}`, error);
        }
      }
      calculateUnreadCounts();
    };
    
    watchGlobalChannels();
  }, [client, squadChannelId, coachingChannelId, coachSquads, calculateUnreadCounts]);
  
  // Listen for message events to update unread counts
  useEffect(() => {
    if (!client) return;
    
    // Initial calculation
    calculateUnreadCounts();
    
    const handleEvent = () => {
      calculateUnreadCounts();
    };
    
    client.on('message.new', handleEvent);
    client.on('message.read', handleEvent);
    client.on('notification.mark_read', handleEvent);
    client.on('notification.message_new', handleEvent);
    client.on('channel.visible', handleEvent);
    
    return () => {
      client.off('message.new', handleEvent);
      client.off('message.read', handleEvent);
      client.off('notification.mark_read', handleEvent);
      client.off('notification.message_new', handleEvent);
      client.off('channel.visible', handleEvent);
    };
  }, [client, calculateUnreadCounts]);

  // Force mark channel as read when it becomes active
  useEffect(() => {
    if (!activeChannel) return;
    
    const markAsRead = async () => {
      try {
        // Force mark all messages in this channel as read
        await activeChannel.markRead();
        // Recalculate counts after marking
        calculateUnreadCounts();
      } catch (error) {
        console.warn('Failed to mark channel as read:', error);
      }
    };
    
    // Mark read immediately when channel becomes active
    markAsRead();
    
    // Also mark read when tab/window gains focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        markAsRead();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', markAsRead);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', markAsRead);
    };
  }, [activeChannel, calculateUnreadCounts]);
  
  // Check if current channel is a squad channel
  const isSquadChannel = activeChannel?.id?.startsWith('squad-');
  
  // Check if user can post in announcements
  const canPostInAnnouncements = isAdmin(userRole);

  // Filter for regular DM channels (exclude special channels AND squad channels)
  const filters: ChannelFilters = { 
    type: 'messaging', 
    members: { $in: [user.id] },
  };
  
  const sort: ChannelSort = [{ last_message_at: -1 }];
  
  const options: ChannelOptions = {
    limit: 20,
    state: true,
    watch: true,
  };

  // Check if current channel is announcements (read-only for non-admins)
  useEffect(() => {
    if (activeChannel) {
      setIsAnnouncementsChannel(activeChannel.id === ANNOUNCEMENTS_CHANNEL_ID);
    }
  }, [activeChannel]);

  // Initialize the target channel when we have an initialChannelId
  useEffect(() => {
    if (initialChannelId && client && !channelInitialized) {
      const initChannel = async () => {
        try {
          console.log('Initializing channel:', initialChannelId);
          const channel = client.channel('messaging', initialChannelId);
          await channel.watch();
          setActiveChannel(channel);
          setChannelInitialized(true);
          onMobileViewChange('channel');
          console.log('Channel initialized successfully');
        } catch (error) {
          console.error('Failed to initialize channel:', error);
          setChannelInitialized(true);
        }
      };
      initChannel();
    } else if (!initialChannelId) {
      setChannelInitialized(true);
    }
  }, [initialChannelId, client, channelInitialized, setActiveChannel, onMobileViewChange]);

  // Handle special channel selection
  const handleChannelSelect = useCallback(async (channelId: string) => {
    try {
      console.log('Selecting channel:', channelId);
      const channel = client.channel('messaging', channelId);
      await channel.watch();
      setActiveChannel(channel);
      onMobileViewChange('channel');
    } catch (error) {
      console.error('Failed to switch to channel:', channelId, error);
    }
  }, [client, setActiveChannel, onMobileViewChange]);

  // Handle back button on mobile
  const handleBackToList = useCallback(() => {
    onMobileViewChange('list');
  }, [onMobileViewChange]);

  // Custom channel preview filter - exclude special channels from list
  const customChannelFilter = useCallback((channels: StreamChannel[]) => {
    return channels.filter(ch => {
      const channelId = ch.id;
      // Exclude special channels (they're shown separately)
      if (
        channelId === ANNOUNCEMENTS_CHANNEL_ID || 
        channelId === SOCIAL_CORNER_CHANNEL_ID ||
        channelId === SHARE_WINS_CHANNEL_ID
      ) {
        return false;
      }
      // Exclude squad channels (shown in pinned section)
      if (channelId?.startsWith('squad-')) {
        return false;
      }
      // Exclude coaching channels (shown in main section when user has coaching)
      if (channelId?.startsWith('coaching-')) {
        return false;
      }
      return true;
    });
  }, []);

  // Determine whether to show message input
  const showMessageInput = !isAnnouncementsChannel || canPostInAnnouncements;

  return (
    <div className="flex h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Channel List Sidebar - Hidden on mobile when viewing a channel */}
      <div className={`
        w-full lg:w-80 border-r border-[#e1ddd8] dark:border-[#262b35] bg-[#faf8f6] dark:bg-[#05070b] flex-shrink-0 flex flex-col
        ${mobileView === 'channel' ? 'hidden lg:flex' : 'flex'}
      `}>
        {/* Header */}
        <div className="p-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
          <h2 className="font-albert text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">Chats</h2>
        </div>
        
        {/* Pill Selector Tabs */}
        <div className="px-4 py-3">
          <ChatTabs 
            activeTab={activeTab} 
            onTabChange={setActiveTab}
            mainUnread={mainUnread}
            directUnread={directUnread}
          />
        </div>

        {/* Tab Content - Both tabs always rendered, visibility controlled by CSS to prevent reload */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
          {/* Main Tab Content */}
          <div className={`absolute inset-0 overflow-y-auto ${activeTab === 'main' ? 'block' : 'hidden'}`}>
            {/* Coach: Multiple Squad Chats - Show all squads the coach manages */}
            {isCoach && isCoachSquadsLoading && (
              <div className="p-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
                <div className="flex items-center gap-3 p-2 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-[#e1ddd8] dark:bg-[#262b35] animate-pulse flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="h-4 w-24 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse mb-1.5" />
                    <div className="h-3 w-16 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse" />
                  </div>
                </div>
              </div>
            )}
            
            {/* Coach: Render all coach squad chats */}
            {isCoach && !isCoachSquadsLoading && coachSquads.length > 0 && (
              <>
                {coachSquads.map((coachSquad) => {
                  if (!coachSquad.chatChannelId) return null;
                  return (
                    <div key={coachSquad.id} className="p-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
                      <SpecialChannelItem
                        avatarUrl={coachSquad.avatarUrl}
                        icon={
                          <svg className="w-6 h-6 text-[#a07855]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        }
                        name={coachSquad.name || 'Squad'}
                        description={`Squad chat${coachSquad.isPremium ? ' • Premium' : ''}`}
                        onClick={() => handleChannelSelect(coachSquad.chatChannelId!)}
                        isActive={activeChannel?.id === coachSquad.chatChannelId}
                        isPinned={true}
                        unreadCount={coachSquadUnreads[coachSquad.chatChannelId] || 0}
                        lastMessageTime={coachSquadLastMessages[coachSquad.chatChannelId] || null}
                      />
                    </div>
                  );
                })}
              </>
            )}
            
            {/* Regular User: Squad Chat(s) - Show skeleton while loading */}
            {!isCoach && isSquadLoading && (
              <div className="p-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
                <div className="flex items-center gap-3 p-2 rounded-lg">
                  {/* Avatar skeleton */}
                  <div className="w-10 h-10 rounded-full bg-[#e1ddd8] dark:bg-[#262b35] animate-pulse flex-shrink-0" />
                  {/* Text skeleton */}
                  <div className="flex-1 min-w-0">
                    <div className="h-4 w-24 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse mb-1.5" />
                    <div className="h-3 w-16 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse" />
                  </div>
                </div>
              </div>
            )}
            
            {/* Regular User: Premium Squad Chat (shown first if exists) */}
            {!isCoach && !isSquadLoading && premiumSquadChannelId && (
              <div className="p-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
                <SpecialChannelItem
                  avatarUrl={premiumSquad?.avatarUrl}
                  icon={
                    <svg className="w-6 h-6 text-[#FF6B6B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                    </svg>
                  }
                  name={premiumSquad?.name || 'Premium Squad'}
                  description="Premium squad chat"
                  onClick={() => handleChannelSelect(premiumSquadChannelId)}
                  isActive={activeChannel?.id === premiumSquadChannelId}
                  isPinned={true}
                  unreadCount={premiumSquadUnread}
                  lastMessageTime={premiumSquadLastMessage}
                />
              </div>
            )}
            
            {/* Regular User: Standard Squad Chat */}
            {!isCoach && !isSquadLoading && standardSquadChannelId && (
              <div className="p-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
                <SpecialChannelItem
                  avatarUrl={standardSquad?.avatarUrl}
                  icon={
                    <svg className="w-6 h-6 text-[#a07855]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  }
                  name={standardSquad?.name || 'My Squad'}
                  description={hasBothSquads ? 'Standard squad chat' : 'Squad chat'}
                  onClick={() => handleChannelSelect(standardSquadChannelId)}
                  isActive={activeChannel?.id === standardSquadChannelId}
                  isPinned={true}
                  unreadCount={standardSquadUnread}
                  lastMessageTime={standardSquadLastMessage}
                />
              </div>
            )}
            
            {/* Fallback: Legacy squad channel (for users not yet migrated to dual fields) */}
            {!isCoach && !isSquadLoading && squadChannelId && !premiumSquadChannelId && !standardSquadChannelId && (
              <div className="p-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
                <SpecialChannelItem
                  avatarUrl={squad?.avatarUrl}
                  icon={
                    <svg className="w-6 h-6 text-[#a07855]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  }
                  name={squad?.name || 'My Squad'}
                  description="Squad chat"
                  onClick={() => handleChannelSelect(squadChannelId)}
                  isActive={activeChannel?.id === squadChannelId}
                  isPinned={true}
                  unreadCount={squadUnread}
                  lastMessageTime={squadLastMessage}
                />
              </div>
            )}

            {/* Orphan Squad Channels - Previous squads with unread messages */}
            {orphanSquadChannels.map((channel) => {
              const channelData = channel.data as Record<string, unknown> | undefined;
              const channelName = (channelData?.name as string) || 'Previous Squad';
              const channelImage = channelData?.image as string | undefined;
              const lastMsgAt = channel.state?.last_message_at;
              return (
                <div key={channel.id} className="p-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
                  <SpecialChannelItem
                    avatarUrl={channelImage}
                    icon={
                      <svg className="w-6 h-6 text-[#a07855]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                    name={channelName}
                    description="Unread messages"
                    onClick={() => handleChannelSelect(channel.id!)}
                    isActive={activeChannel?.id === channel.id}
                    unreadCount={channel.countUnread()}
                    lastMessageTime={lastMsgAt ? new Date(lastMsgAt) : null}
                  />
                </div>
              );
            })}
            
            {/* Announcements */}
            <div className="p-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
              <SpecialChannelItem
                icon={
                  <svg className="w-6 h-6 text-[#a07855]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                }
                name="Announcements"
                description="Updates from the team"
                onClick={() => handleChannelSelect(ANNOUNCEMENTS_CHANNEL_ID)}
                isActive={activeChannel?.id === ANNOUNCEMENTS_CHANNEL_ID}
                unreadCount={announcementsUnread}
                lastMessageTime={announcementsLastMessage}
              />
            </div>
            
            {/* Social Corner */}
            <div className="p-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
              <SpecialChannelItem
                icon={
                  <svg className="w-6 h-6 text-[#a07855]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                }
                name="Social Corner"
                description="Chat with the community"
                onClick={() => handleChannelSelect(SOCIAL_CORNER_CHANNEL_ID)}
                isActive={activeChannel?.id === SOCIAL_CORNER_CHANNEL_ID}
                unreadCount={socialCornerUnread}
                lastMessageTime={socialCornerLastMessage}
              />
            </div>

            {/* Share Your Wins */}
            <div className="p-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
              <SpecialChannelItem
                icon={
                  <svg className="w-6 h-6 text-[#a07855]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                }
                name="Share your wins"
                description="Celebrate with the community"
                onClick={() => handleChannelSelect(SHARE_WINS_CHANNEL_ID)}
                isActive={activeChannel?.id === SHARE_WINS_CHANNEL_ID}
                unreadCount={shareWinsUnread}
                lastMessageTime={shareWinsLastMessage}
              />
            </div>

            {/* Coaching Chat - Only show when user has coaching and coach is assigned */}
            {hasCoaching && coachingChannelId && (
              <div className="p-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
                <SpecialChannelItem
                  avatarUrl={coach?.imageUrl}
                  icon={
                    <svg className="w-6 h-6 text-[#a07855]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  }
                  name={coach?.name || 'My Coach'}
                  description="1:1 coaching chat"
                  onClick={() => handleChannelSelect(coachingChannelId)}
                  isActive={activeChannel?.id === coachingChannelId}
                  isPinned={true}
                  unreadCount={coachingUnread}
                  lastMessageTime={coachingLastMessage}
                />
              </div>
            )}

            {/* Orphan Coaching Channels - Previous coaching chats with unread messages */}
            {orphanCoachingChannels.map((channel) => {
              const channelData = channel.data as Record<string, unknown> | undefined;
              const channelName = (channelData?.name as string) || 'Previous Coach';
              const channelImage = channelData?.image as string | undefined;
              const lastMsgAt = channel.state?.last_message_at;
              return (
                <div key={channel.id} className="p-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
                  <SpecialChannelItem
                    avatarUrl={channelImage}
                    icon={
                      <svg className="w-6 h-6 text-[#a07855]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                    name={channelName}
                    description="Unread messages"
                    onClick={() => handleChannelSelect(channel.id!)}
                    isActive={activeChannel?.id === channel.id}
                    unreadCount={channel.countUnread()}
                    lastMessageTime={lastMsgAt ? new Date(lastMsgAt) : null}
                  />
                </div>
              );
            })}

            {/* Get Your Personal Coach - Promo Item (only show if user doesn't have coaching) */}
            {!hasCoaching && (
              <div className="p-2">
                <CoachPromoItem />
              </div>
            )}
          </div>
          
          {/* Direct Tab Content - Always rendered to preserve state */}
          <div className={`absolute inset-0 overflow-y-auto ${activeTab === 'direct' ? 'block' : 'hidden'}`}>
            <MobileViewContext.Provider value={() => onMobileViewChange('channel')}>
                <ChannelList
                filters={filters}
                sort={sort}
                options={options}
                setActiveChannelOnMount={false}
                Preview={ChannelPreviewWithMobile}
                channelRenderFilterFn={customChannelFilter}
                EmptyStateIndicator={() => (
                  <div className="px-4 py-8 text-center">
                    <p className="font-albert text-[14px] text-[#8c8c8c] dark:text-[#7d8190]">
                      No direct messages yet
                    </p>
                    <p className="font-albert text-[12px] text-[#b3b3b3] dark:text-[#5f5a66] mt-1">
                      Start a conversation from someone&apos;s profile
                    </p>
                  </div>
                )}
              />
            </MobileViewContext.Provider>
          </div>
        </div>
      </div>

      {/* Main Chat Area - Full screen on mobile when viewing a channel */}
      <div className={`
        flex-1 flex flex-col bg-[#faf8f6] dark:bg-[#05070b] min-w-0
        ${mobileView === 'list' ? 'hidden lg:flex' : 'flex'}
      `}>
        {activeChannel ? (
          <Channel 
            DateSeparator={CustomDateSeparator}
            Message={CustomMessage}
            Input={CustomMessageInput}
          >
            <Window>
              {/* Use SquadChannelHeader for squad channels, custom header for others */}
              {isSquadChannel ? (
                <SquadChannelHeader onBack={handleBackToList} />
              ) : (
                <CustomChannelHeader onBack={handleBackToList} />
              )}
              <MessageList />
              {/* Only show MessageInput if allowed */}
              {showMessageInput ? (
                <MessageInput focus />
              ) : (
                <div className="p-4 bg-[#faf8f6] dark:bg-[#05070b] text-center">
                  <p className="font-albert text-[14px] text-text-secondary dark:text-[#b2b6c2]">
                    📢 This is a read-only announcements channel
                  </p>
                </div>
              )}
            </Window>
            <Thread Message={CustomMessage} Input={CustomMessageInput} />
          </Channel>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center px-4">
              <div className="w-16 h-16 rounded-full bg-[#a07855]/10 dark:bg-[#b8896a]/15 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[#a07855] dark:text-[#b8896a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="font-albert text-[18px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                Select a conversation
              </h3>
              <p className="font-albert text-[14px] text-[#5f5a55] dark:text-[#b2b6c2]">
                Choose from your messages or start a new chat
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StreamChatComponents({ client, user, initialChannelId }: StreamChatComponentsProps) {
  const [mobileView, setMobileView] = useState<'list' | 'channel'>('list');
  const { sessionClaims } = useAuth();
  
  // Get user role from session claims
  const userRole = (sessionClaims?.publicMetadata as { role?: UserRole })?.role;

  // Note: Joining global channels is now handled by StreamChatContext at app startup
  // This removes the blocking API call that was slowing down chat loading

  // Handle mobile view change
  const handleMobileViewChange = useCallback((view: 'list' | 'channel') => {
    setMobileView(view);
  }, []);

  return (
    <div 
      className="fixed top-0 left-0 right-0 lg:left-64 flex flex-col bg-[#faf8f6] dark:bg-[#05070b] pb-[85px] lg:pb-0"
      style={{ 
        height: '100dvh',
        // Fallback for browsers that don't support dvh
        minHeight: '-webkit-fill-available',
      }}
    >
      <Chat client={client} theme="str-chat__theme-light">
        <ChatContent 
          user={user} 
          initialChannelId={initialChannelId}
          userRole={userRole}
          onMobileViewChange={handleMobileViewChange}
          mobileView={mobileView}
        />
      </Chat>
    </div>
  );
}
