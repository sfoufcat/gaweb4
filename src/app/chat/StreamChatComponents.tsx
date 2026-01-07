'use client';

import { useState, useEffect, useCallback, createContext, useContext, useMemo } from 'react';
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
import { ChatActionsMenu } from '@/components/chat/ChatActionsMenu';
import { RequestCallModal } from '@/components/scheduling';
import { Calendar } from 'lucide-react';
import type { ChatChannelType } from '@/types/chat-preferences';
import type { Channel as StreamChannel, ChannelSort, ChannelFilters, ChannelOptions, StreamChat } from 'stream-chat';
import { ANNOUNCEMENTS_CHANNEL_ID, SOCIAL_CORNER_CHANNEL_ID, SHARE_WINS_CHANNEL_ID } from '@/lib/chat-constants';
import { useSquad } from '@/hooks/useSquad';
import { useCoachingData } from '@/hooks/useCoachingData';
import { useCoachSquads } from '@/hooks/useCoachSquads';
import { isAdmin } from '@/lib/admin-utils-shared';
import type { UserRole } from '@/types';
import type { OrgChannel } from '@/lib/org-channels';
import { formatDistanceToNow, format } from 'date-fns';
import { useMenuTitles, useCoachingPromo } from '@/contexts/BrandingContext';
import { useCoachingContext } from '@/contexts/CoachingContext';
import { CoachingPromoNotEnabledModal } from '@/components/coach/CoachingPromoNotEnabledModal';
import { useChatPreferences } from '@/hooks/useChatPreferences';
import { ArchivedChatsLink } from '@/components/chat/ArchivedChatsLink';
import { ArchiveRestore, ChevronLeft } from 'lucide-react';

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
  const { pinnedChannelIds } = useChatPreferences();
  const isPinned = channel.id ? pinnedChannelIds.has(channel.id) : false;

  // Get channel data - cast to Record to access custom properties
  const channelData = channel.data as Record<string, unknown> | undefined;
  const channelImage = channelData?.image as string | undefined;

  // Get first member's avatar for DMs if no channel image
  const members = Object.values(channel.state.members).filter(m => m.user);
  const otherMember = members.find(m => m.user?.id !== channel._client.userID);

  // Detect coaching channels and show other member's name instead of "FirstName - Coaching"
  const channelId = channel.id;
  const isCoachingChannel = channelId?.startsWith('coaching-');
  // For coaching channels, ALWAYS use other member's name (ignore displayTitle which has "Name - Coaching")
  const channelName = isCoachingChannel
    ? (otherMember?.user?.name || 'Coaching Chat')
    : (displayTitle || (channelData?.name as string) || 'Chat');
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
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-accent to-[#7d5c3e] flex items-center justify-center text-white font-albert font-semibold text-lg">
            {avatarInitial}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`font-albert text-[15px] truncate ${
              unread !== undefined && unread > 0 ? 'font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]' : 'font-medium text-[#1a1a1a] dark:text-[#f5f5f8]'
            }`}>
              {channelName}
            </span>
            {/* Pin indicator */}
            {isPinned && (
              <PinIcon className="w-3.5 h-3.5 text-brand-accent flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {timestamp && (
              <span className="font-albert text-[12px] text-[#8c8c8c] dark:text-[#7d8190]">
                {timestamp}
              </span>
            )}
            {/* Unread indicator */}
            {unread !== undefined && unread > 0 && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-brand-accent text-white text-[10px] font-albert font-bold">
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
  client: StreamChat;
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

// Star icon for coached squads
function CoachStarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
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
  isCoaching,
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
  isCoaching?: boolean;
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
        <div className="w-12 h-12 rounded-full bg-brand-accent/10 dark:bg-brand-accent/15 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="font-albert text-[15px] font-medium text-text-primary truncate">{name}</p>
            {isCoaching && (
              <CoachStarIcon className="w-4 h-4 text-amber-500 flex-shrink-0" />
            )}
            {isPinned && (
              <PinIcon className="w-3.5 h-3.5 text-brand-accent flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {timestamp && (
              <span className="font-albert text-[12px] text-text-secondary">{timestamp}</span>
            )}
            {unreadCount && unreadCount > 0 ? (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-brand-accent text-white text-[10px] font-albert font-bold">
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

// Get your personal coach item
// Links to the program landing page or funnel when enabled
// Shows disabled state for coaches when no program is linked
interface CoachPromoItemProps {
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  isEnabled?: boolean;
  destinationUrl?: string | null;
  isCoach?: boolean;
  onDisabledClick?: () => void;
}

function CoachPromoItem({
  title = 'Work with me 1:1',
  subtitle = 'Let me help you unleash your potential',
  imageUrl,
  isEnabled = false,
  destinationUrl,
  isCoach = false,
  onDisabledClick,
}: CoachPromoItemProps) {
  // Get promo image from context if not provided (instant - no fetch needed)
  const coachingCtx = useCoachingContext();
  const resolvedImageUrl = imageUrl || coachingCtx.promoImageUrl || null;
  
  // If not enabled and not a coach, don't render
  if (!isEnabled && !isCoach) {
    return null;
  }
  
  // For disabled state (coach only), show as clickable button that opens the explanation modal
  if (!isEnabled && isCoach) {
    return (
      <button
        onClick={onDisabledClick}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[#ffffff]/60 dark:hover:bg-[#171b22]/60 transition-colors relative text-left"
      >
        {/* Disabled overlay effect */}
        <div className="absolute inset-0 rounded-xl bg-[#faf8f6]/50 dark:bg-[#05070b]/50 pointer-events-none" />
        
        {resolvedImageUrl ? (
          <Image 
            src={resolvedImageUrl}
            alt="Personal Coach"
            width={48}
            height={48}
            className="w-12 h-12 rounded-full object-cover flex-shrink-0 opacity-60"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-accent/60 to-[#7d5c3e]/60 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
        )}
        <div className="flex-1 min-w-0 relative z-10">
          <div className="flex items-center gap-2">
            <p className="font-albert text-[15px] font-medium text-text-primary/60 dark:text-[#f5f5f8]/60">{title}</p>
            <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-albert text-[10px] font-semibold">
              Not enabled
            </span>
          </div>
          <p className="font-albert text-[13px] text-text-secondary/60">{subtitle}</p>
        </div>
      </button>
    );
  }
  
  // Enabled state - link to destination
  const href = destinationUrl || '/discover';
  
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[#ffffff]/60 dark:hover:bg-[#171b22]/60 transition-colors"
    >
      {resolvedImageUrl ? (
        <Image 
          src={resolvedImageUrl}
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
        <p className="font-albert text-[15px] font-medium text-text-primary">{title}</p>
        <p className="font-albert text-[13px] text-text-secondary">{subtitle}</p>
      </div>
    </Link>
  );
}

// Edit channels link for coaches (links to coach dashboard channels tab)
function EditChannelsLink() {
  return (
    <Link
      href="/coach?tab=channels"
      className="flex items-center justify-center gap-2 px-4 py-2 mx-2 text-brand-accent hover:bg-[#ffffff]/60 dark:hover:bg-[#171b22]/60 rounded-xl transition-colors"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <span className="font-albert text-[13px] font-medium">Edit channels</span>
    </Link>
  );
}

// Custom header for DM channels - with story avatar for the other member
function CustomChannelHeader({ onBack }: { onBack?: () => void }) {
  const { channel } = useChatContext();
  const router = useRouter();
  const [showRequestCallModal, setShowRequestCallModal] = useState(false);
  
  // Cast channel.data to any to access custom properties like name and image
  const channelData = channel?.data as Record<string, unknown> | undefined;
  const members = Object.values(channel?.state?.members || {}).filter(m => m.user);
  const otherMember = members.find(m => m.user?.id !== channel?._client?.userID);
  
  // Get member count from channel data (reliable for large channels) or fallback to local state
  const memberCount = (channel?.data?.member_count as number) || members.length;

  // Check for special channels first
  const channelId = channel?.id;
  const isGlobalChannel = channelId === ANNOUNCEMENTS_CHANNEL_ID || channelId === SOCIAL_CORNER_CHANNEL_ID || channelId === SHARE_WINS_CHANNEL_ID;
  const isOrgChannel = Boolean(channelData?.isOrgChannel);
  const isSpecialChannel = isGlobalChannel || isOrgChannel;
  
  // Check if this is a coaching channel (ID starts with 'coaching-')
  const isCoachingChannel = channelId?.startsWith('coaching-');
  
  // Get channel type for org channels (for icon display)
  const orgChannelType = channelData?.channelType as string | undefined;
  
  // Get channel name - prioritize special channel names, then explicit name, then other member's name
  const getChannelName = () => {
    if (channelId === ANNOUNCEMENTS_CHANNEL_ID) return 'Announcements';
    if (channelId === SOCIAL_CORNER_CHANNEL_ID) return 'Social Corner';
    if (channelId === SHARE_WINS_CHANNEL_ID) return 'Share your wins';
    // For coaching channels, always show the other member's name (coach for clients, client for coaches)
    if (isCoachingChannel) {
      return otherMember?.user?.name || 'Coach';
    }
    const explicitName = channelData?.name as string | undefined;
    if (explicitName) return explicitName;
    return otherMember?.user?.name || 'Chat';
  };
  
  const channelName = getChannelName();
  const isDMChat = !isSpecialChannel && !(channelData?.name as string | undefined) && otherMember?.user?.id;
  // Show member avatar for DM chats AND coaching channels (they also show other member's avatar)
  const showMemberAvatar = isDMChat || (isCoachingChannel && otherMember?.user);

  // Handle profile click for DM chats and coaching channels
  const handleProfileClick = () => {
    if ((isDMChat || isCoachingChannel) && otherMember?.user?.id) {
      router.push(`/profile/${otherMember.user.id}`);
    }
  };
  
  // Get coach name for scheduling (the other member in a coaching channel)
  const coachName = isCoachingChannel && otherMember?.user?.name ? otherMember.user.name : 'Coach';

  // Determine channel type for chat actions menu
  const getChatChannelType = (): ChatChannelType => {
    if (isDMChat || isCoachingChannel) return 'dm';
    if (channelData?.squadId || channelData?.isSquadChannel) return 'squad';
    if (isGlobalChannel || isOrgChannel) return 'org';
    return 'dm'; // Default to dm for unknown types
  };
  const chatChannelType = getChatChannelType();

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
            {/* Avatar - Use SquadMemberStoryAvatar for DM chats and coaching channels */}
            {showMemberAvatar && otherMember?.user ? (
              <SquadMemberStoryAvatar
                userId={otherMember.user.id}
                streamUser={{
                  name: otherMember.user.name,
                  image: otherMember.user.image,
                }}
                size="sm"
                showName={false}
              />
              ) : (channelId === ANNOUNCEMENTS_CHANNEL_ID || orgChannelType === 'announcements') ? (
              <div className="w-9 h-9 rounded-full bg-brand-accent/10 dark:bg-brand-accent/15 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              ) : (channelId === SOCIAL_CORNER_CHANNEL_ID || orgChannelType === 'social') ? (
                <div className="w-9 h-9 rounded-full bg-brand-accent/10 dark:bg-brand-accent/15 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
              ) : (channelId === SHARE_WINS_CHANNEL_ID || orgChannelType === 'wins') ? (
                <div className="w-9 h-9 rounded-full bg-brand-accent/10 dark:bg-brand-accent/15 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
              ) : isOrgChannel ? (
                <div className="w-9 h-9 rounded-full bg-brand-accent/10 dark:bg-brand-accent/15 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5" />
                  </svg>
                </div>
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-accent to-[#7d5c3e] dark:from-brand-accent dark:to-brand-accent/80 flex items-center justify-center text-white font-albert font-semibold text-sm flex-shrink-0">
                  {channelName.charAt(0).toUpperCase()}
                </div>
              )}
            
            <div className="min-w-0">
              {/* Name - Clickable to profile for DM chats and coaching channels */}
              {showMemberAvatar ? (
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

        {/* Right: Schedule call button + Call buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Schedule Call button for coaching channels */}
          {isCoachingChannel && (
            <button
              onClick={() => setShowRequestCallModal(true)}
              className="px-3 py-1.5 bg-brand-accent/10 text-brand-accent rounded-full text-xs font-albert font-medium hover:bg-brand-accent/20 transition-colors flex items-center gap-1.5"
              aria-label="Schedule a call"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Schedule</span>
            </button>
          )}
          <CallButtons channel={channel} />
          <ChatActionsMenu
            channelId={channelId || ''}
            channelType={chatChannelType}
          />
        </div>
      </div>

      {/* Request Call Modal for coaching channels */}
      {isCoachingChannel && (
        <RequestCallModal
          isOpen={showRequestCallModal}
          onClose={() => setShowRequestCallModal(false)}
          coachName={coachName}
          isPaid={false}
          priceInCents={0}
          onSuccess={() => {
            setShowRequestCallModal(false);
          }}
        />
      )}
    </div>
  );
}

// Squad header with member avatars inline - compact single row
function SquadChannelHeader({ onBack }: { onBack?: () => void }) {
  const { channel, members } = useChannelStateContext();
  const { mySquad: mySquadTitle } = useMenuTitles();
  
  // Cast channel.data to any to access custom properties like name
  const channelData = channel?.data as Record<string, unknown> | undefined;
  const channelName = (channelData?.name as string) || mySquadTitle;
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
          
          {/* Squad Avatar + Name - Clickable to /program?tab=squad */}
          <Link href="/program?tab=squad" className="flex items-center gap-2.5 min-w-0 hover:opacity-80 transition-opacity">
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
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-accent to-[#7d5c3e] dark:from-brand-accent dark:to-brand-accent/80 flex items-center justify-center text-white font-albert font-semibold text-sm flex-shrink-0">
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
          <ChatActionsMenu
            channelId={channel?.id || ''}
            channelType="squad"
          />
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
          <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-brand-accent dark:bg-brand-accent text-white text-[11px] font-albert font-semibold">
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
          <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-brand-accent dark:bg-brand-accent text-white text-[11px] font-albert font-semibold">
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
  const { squad: squadTitle, squadLower, mySquad: mySquadTitle } = useMenuTitles();
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
  // Supports multi-squad membership - users can be in multiple squads
  const {
    squad,
    squads,  // All squads user is in
    premiumSquad,
    standardSquad,
    hasBothSquads,
    isLoading: isSquadLoading
  } = useSquad();
  const squadChannelId = squad?.chatChannelId;
  const premiumSquadChannelId = premiumSquad?.chatChannelId;
  const standardSquadChannelId = standardSquad?.chatChannelId;
  // Build set of ALL user squad channel IDs (not just premium/standard)
  const allUserSquadChannelIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of squads) {
      if (s.chatChannelId) {
        ids.add(s.chatChannelId);
      }
    }
    return ids;
  }, [squads]);
  
  // Get all squads a coach manages (for coaches with multiple squads)
  const { squads: coachSquads, isLoading: isCoachSquadsLoading, isCoach } = useCoachSquads();
  
  // Get user's coaching data for coaching chat
  const { coachingData, coach, hasCoaching, isLoading: _isCoachingLoading } = useCoachingData();
  const coachingChannelId = coachingData?.chatChannelId;
  
  // Track unread counts and last messages for all coach squads
  const [coachSquadUnreads, setCoachSquadUnreads] = useState<Record<string, number>>({});
  const [coachSquadLastMessages, setCoachSquadLastMessages] = useState<Record<string, Date | null>>({});

  // Track unread counts and last messages for ALL user squads (not just premium/standard)
  const [userSquadUnreads, setUserSquadUnreads] = useState<Record<string, number>>({});
  const [userSquadLastMessages, setUserSquadLastMessages] = useState<Record<string, Date | null>>({});
  
  // Track orphan channels (channels with unreads that aren't shown in the normal list)
  const [orphanSquadChannels, setOrphanSquadChannels] = useState<StreamChannel[]>([]);
  const [orphanCoachingChannels, setOrphanCoachingChannels] = useState<StreamChannel[]>([]);
  
  // Organization channels (replaces hardcoded global channels for org members)
  const [orgChannels, setOrgChannels] = useState<OrgChannel[]>([]);
  const [orgChannelsLoading, setOrgChannelsLoading] = useState(false);
  const [hasOrgChannels, setHasOrgChannels] = useState(false);
  const [isPlatformMode, setIsPlatformMode] = useState(false);
  const [orgChannelUnreads, setOrgChannelUnreads] = useState<Record<string, number>>({});
  const [orgChannelLastMessages, setOrgChannelLastMessages] = useState<Record<string, Date | null>>({});
  
  // Get coaching promo from SSR context (prevents flash)
  const coachingPromo = useCoachingPromo();

  // Chat preferences for pin/archive/delete functionality
  const {
    pinnedChannelIds,
    archivedChannelIds,
    unarchiveChannel,
  } = useChatPreferences();

  // Archived view state - track which tab's archive to show
  const [showArchivedView, setShowArchivedView] = useState<'main' | 'direct' | null>(null);
  const [archivedChannels, setArchivedChannels] = useState<StreamChannel[]>([]);

  // Coaching data from context (loaded at app startup - instant!)
  const coachingCtxData = useCoachingContext();
  const promoIsEnabled = coachingCtxData.promoIsEnabled;
  const promoDestinationUrl = coachingCtxData.promoDestinationUrl;
  const [showPromoNotEnabledModal, setShowPromoNotEnabledModal] = useState(false);

  // Program-based coaching from context (instant access)
  const hasActiveIndividualEnrollment = coachingCtxData.hasActiveIndividualEnrollment;
  const programCoachingChannelId = coachingCtxData.coachingChatChannelId;
  const programCoachInfo = coachingCtxData.coachInfo;
  const [programCoachingUnread, setProgramCoachingUnread] = useState(0);
  const [programCoachingLastMessage, setProgramCoachingLastMessage] = useState<Date | null>(null);
  
  // Fetch org channels for users in organizations
  useEffect(() => {
    const fetchOrgChannels = async () => {
      try {
        setOrgChannelsLoading(true);
        const response = await fetch('/api/user/org-channels');
        if (response.ok) {
          const data = await response.json();
          // Track platform mode to suppress squad/org-specific channels
          setIsPlatformMode(data.isPlatformMode || false);
          
          if (data.channels && data.channels.length > 0) {
            setOrgChannels(data.channels);
            setHasOrgChannels(true);
          } else {
            setHasOrgChannels(false);
          }
        } else {
          setHasOrgChannels(false);
        }
      } catch (error) {
        console.warn('Failed to fetch org channels:', error);
        setHasOrgChannels(false);
      } finally {
        setOrgChannelsLoading(false);
      }
    };

    fetchOrgChannels();
  }, []);

  // Fetch archived channels when archivedChannelIds changes
  useEffect(() => {
    if (!client || archivedChannelIds.size === 0) {
      setArchivedChannels([]);
      return;
    }

    const fetchArchivedChannels = async () => {
      try {
        const channelIds = Array.from(archivedChannelIds);
        const channels = await client.queryChannels(
          { type: 'messaging', id: { $in: channelIds } },
          { last_message_at: -1 },
          { limit: 50 }
        );
        setArchivedChannels(channels);
      } catch (error) {
        console.warn('Failed to fetch archived channels:', error);
        setArchivedChannels([]);
      }
    };

    fetchArchivedChannels();
  }, [client, archivedChannelIds]);

  // Split archived channels by tab type
  const archivedMainChannels = useMemo(() => {
    return archivedChannels.filter(ch => {
      const channelId = ch.id;
      // Main tab: squad channels and org channels
      return channelId?.startsWith('squad-') ||
             orgChannels.some(oc => oc.streamChannelId === channelId);
    });
  }, [archivedChannels, orgChannels]);

  const archivedDirectChannels = useMemo(() => {
    return archivedChannels.filter(ch => {
      const channelId = ch.id;
      // Direct tab: DMs and coaching channels (everything not in Main)
      return channelId?.startsWith('coaching-') ||
             (!channelId?.startsWith('squad-') &&
              !orgChannels.some(oc => oc.streamChannelId === channelId));
    });
  }, [archivedChannels, orgChannels]);

  // Coaching promo data is now loaded from CoachingContext at app startup - no fetch needed!

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

    // Track ALL user squad unreads and last messages by channel ID
    const userSquadUnreadMap: Record<string, number> = {};
    const userSquadLastMessageMap: Record<string, Date | null> = {};

    // Track orphan channels (channels with unreads not shown in normal list)
    const orphanSquads: StreamChannel[] = [];
    const orphanCoaching: StreamChannel[] = [];
    
    // Track org channel unreads
    const orgChannelUnreadMap: Record<string, number> = {};
    const orgChannelLastMessageMap: Record<string, Date | null> = {};
    const orgChannelStreamIds = new Set(orgChannels.map(c => c.streamChannelId));
    
    // Build a set of coach squad channel IDs for quick lookup
    const coachSquadChannelIds = new Set(
      coachSquads
        .filter(s => s.chatChannelId)
        .map(s => s.chatChannelId!)
    );
    
    // Build set of user's own squad channel IDs (from ALL squads, not just premium/standard)
    const userSquadChannelIds = new Set<string>(allUserSquadChannelIds);
    // Also add legacy fields for backward compatibility
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
      // Track org channel last messages
      if (channelId && orgChannelStreamIds.has(channelId) && lastMessageAt) {
        orgChannelLastMessageMap[channelId] = new Date(lastMessageAt);
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
        // Track for ALL user squads
        if (channelId && userSquadChannelIds.has(channelId)) {
          userSquadLastMessageMap[channelId] = new Date(lastMessageAt);
        }
        // Track for coach squads specifically
        if (channelId && coachSquadChannelIds.has(channelId)) {
          coachSquadLastMessageMap[channelId] = new Date(lastMessageAt);
        }
      }
      if (channelId?.startsWith('coaching-') && lastMessageAt) {
        coachingTime = new Date(lastMessageAt);
      }
      
      // Track program-based coaching channel specifically
      let programCoachingUnreadCount = 0;
      let programCoachingTime: Date | null = null;
      if (programCoachingChannelId && channelId === programCoachingChannelId) {
        if (lastMessageAt) {
          programCoachingTime = new Date(lastMessageAt);
          setProgramCoachingLastMessage(programCoachingTime);
        }
        programCoachingUnreadCount = channel.countUnread();
        setProgramCoachingUnread(programCoachingUnreadCount);
      }
      
      if (unread > 0) {
        // Track specific channel unread counts
        if (channelId === ANNOUNCEMENTS_CHANNEL_ID) announcements = unread;
        if (channelId === SOCIAL_CORNER_CHANNEL_ID) social = unread;
        if (channelId === SHARE_WINS_CHANNEL_ID) shareWins = unread;
        
        // Track org channel unreads
        if (channelId && orgChannelStreamIds.has(channelId)) {
          orgChannelUnreadMap[channelId] = unread;
        }
        
        if (channelId?.startsWith('squad-')) {
          squad += unread;
          // Track specific squad unreads for dual membership
          if (channelId === premiumSquadChannelId) {
            premiumSquadCount = unread;
          }
          if (channelId === standardSquadChannelId) {
            standardSquadCount = unread;
          }
          // Track for ALL user squads
          if (channelId && userSquadChannelIds.has(channelId)) {
            userSquadUnreadMap[channelId] = unread;
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
          // Check if this is an orphan coaching channel (not current coaching channel and not program coaching)
          if (channelId !== coachingChannelId && channelId !== programCoachingChannelId) {
            orphanCoaching.push(channel);
          }
        }

        // Main vs Direct tab assignment depends on channel type AND user role
        // For coaches: coaching channels go to Direct (that's where they see client chats)
        // For clients: coaching channels go to Main (that's where they see their coach)
        const isCoachingChannelForUser = channelId?.startsWith('coaching-');
        const coachingGoesToDirect = isCoachingChannelForUser && isCoach;
        
        // Main: squad, org channels, announcements, social corner, share wins
        // AND coaching channels for CLIENTS only
        if (
          channelId === ANNOUNCEMENTS_CHANNEL_ID ||
          channelId === SOCIAL_CORNER_CHANNEL_ID ||
          channelId === SHARE_WINS_CHANNEL_ID ||
          channelId?.startsWith('squad-') ||
          (isCoachingChannelForUser && !isCoach) || // Coaching goes to Main for clients
          (channelId && orgChannelStreamIds.has(channelId))
        ) {
          main += unread;
        } else if (coachingGoesToDirect) {
          // Coaching channels go to Direct for coaches
          direct += unread;
        } else {
          // Regular DMs go to Direct
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
    setUserSquadUnreads(userSquadUnreadMap);
    setUserSquadLastMessages(userSquadLastMessageMap);
    setOrphanSquadChannels(orphanSquads);
    setOrphanCoachingChannels(orphanCoaching);
    setOrgChannelUnreads(orgChannelUnreadMap);
    setOrgChannelLastMessages(orgChannelLastMessageMap);
  }, [client, coachSquads, squadChannelId, premiumSquadChannelId, standardSquadChannelId, coachingChannelId, programCoachingChannelId, orgChannels, allUserSquadChannelIds]);

  // Watch global channels to ensure we get updates/counts even if not in active list
  useEffect(() => {
    if (!client) return;

    const watchGlobalChannels = async () => {
      const channelsToWatch = [ANNOUNCEMENTS_CHANNEL_ID, SOCIAL_CORNER_CHANNEL_ID, SHARE_WINS_CHANNEL_ID];

      // Add ALL user squad channels (not just legacy squadChannelId)
      for (const channelId of allUserSquadChannelIds) {
        if (!channelsToWatch.includes(channelId)) {
          channelsToWatch.push(channelId);
        }
      }
      // Legacy fallback
      if (squadChannelId && !channelsToWatch.includes(squadChannelId)) {
        channelsToWatch.push(squadChannelId);
      }
      if (coachingChannelId) channelsToWatch.push(coachingChannelId);

      // Add program-based coaching channel (independent of legacy coachingChannelId)
      if (programCoachingChannelId && !channelsToWatch.includes(programCoachingChannelId)) {
        channelsToWatch.push(programCoachingChannelId);
      }

      // Add all coach squad channels
      for (const coachSquad of coachSquads) {
        if (coachSquad.chatChannelId && !channelsToWatch.includes(coachSquad.chatChannelId)) {
          channelsToWatch.push(coachSquad.chatChannelId);
        }
      }

      // Add org channels
      for (const orgChannel of orgChannels) {
        if (orgChannel.streamChannelId && !channelsToWatch.includes(orgChannel.streamChannelId)) {
          channelsToWatch.push(orgChannel.streamChannelId);
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
  }, [client, squadChannelId, coachingChannelId, programCoachingChannelId, coachSquads, orgChannels, calculateUnreadCounts, allUserSquadChannelIds]);
  
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
      // Query for the channel to ensure it's properly initialized with all state
      // Using queryChannels instead of client.channel() ensures we get the full channel state
      const channels = await client.queryChannels(
        { type: 'messaging', id: channelId },
        {},
        { limit: 1, state: true, watch: true }
      );
      
      if (channels.length > 0) {
        setActiveChannel(channels[0]);
        onMobileViewChange('channel');
      } else {
        // Fallback: create and watch if not found (e.g., new channel)
        const channel = client.channel('messaging', channelId);
        await channel.watch();
        setActiveChannel(channel);
        onMobileViewChange('channel');
      }
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
    const orgChannelIds = new Set(orgChannels.map(c => c.streamChannelId));
    return channels.filter(ch => {
      const channelId = ch.id;

      // Filter out archived channels
      if (channelId && archivedChannelIds.has(channelId)) {
        return false;
      }

      // Exclude special channels (they're shown separately)
      if (
        channelId === ANNOUNCEMENTS_CHANNEL_ID ||
        channelId === SOCIAL_CORNER_CHANNEL_ID ||
        channelId === SHARE_WINS_CHANNEL_ID
      ) {
        return false;
      }
      // Exclude org channels (shown in main section)
      if (channelId && orgChannelIds.has(channelId)) {
        return false;
      }
      // Exclude squad channels (shown in pinned section)
      if (channelId?.startsWith('squad-')) {
        return false;
      }
      // Exclude coaching channels from Direct tab for CLIENTS (shown in Main section)
      // For COACHES: allow coaching channels in Direct tab (that's where they see client chats)
      if (channelId?.startsWith('coaching-') && !isCoach) {
        return false;
      }
      return true;
    });
  }, [orgChannels, isCoach, archivedChannelIds]);

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
            {/* Coaching Chat - PINNED TO TOP (for clients only) */}
            {/* For coaches: coaching channels appear in Direct tab instead */}
            {/* Priority: Program coaching (from individual program enrollment) takes precedence */}
            {/* Don't show on platform domain - coaching is tenant-specific */}
            {!isPlatformMode && programCoachingChannelId && !isCoach && (
              <div className="p-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
                <SpecialChannelItem
                  avatarUrl={programCoachInfo?.imageUrl || coach?.imageUrl}
                  icon={
                    <svg className="w-6 h-6 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  }
                  name={programCoachInfo?.name || coach?.name || 'My Coach'}
                  description="1:1 coaching chat"
                  onClick={() => handleChannelSelect(programCoachingChannelId)}
                  isActive={activeChannel?.id === programCoachingChannelId}
                  isPinned={true}
                  unreadCount={programCoachingUnread}
                  lastMessageTime={programCoachingLastMessage}
                />
              </div>
            )}

            {/* Legacy Coaching Chat - Only show if there's NO program coaching and user has legacy coaching */}
            {/* This handles users with manual coaching assignment that predates program enrollment */}
            {/* For coaches: coaching channels appear in Direct tab instead */}
            {!isPlatformMode && !programCoachingChannelId && hasCoaching && coachingChannelId && !isCoach && (
              <div className="p-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
                <SpecialChannelItem
                  avatarUrl={coach?.imageUrl}
                  icon={
                    <svg className="w-6 h-6 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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

            {/* Coach: Multiple Squad Chats - Show all squads the coach manages */}
            {/* Don't show on platform domain - coach squads are tenant-specific */}
            {isCoach && !isPlatformMode && isCoachSquadsLoading && (
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
            {isCoach && !isPlatformMode && !isCoachSquadsLoading && coachSquads.length > 0 && (
              <>
                {coachSquads.map((coachSquad) => {
                  if (!coachSquad.chatChannelId) return null;
                  // Skip archived squad channels
                  if (archivedChannelIds.has(coachSquad.chatChannelId)) return null;
                  // Show star icon if user is the assigned coach of this squad
                  const isUserTheCoach = coachSquad.coachId === user.id;
                  return (
                    <div key={coachSquad.id} className="p-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
                      <SpecialChannelItem
                        avatarUrl={coachSquad.avatarUrl}
                        icon={
                          <svg className="w-6 h-6 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        }
                        name={coachSquad.name || squadTitle}
                        description={`${squadTitle} chat${coachSquad.isPremium ? ' • Premium' : ''}`}
                        onClick={() => handleChannelSelect(coachSquad.chatChannelId!)}
                        isActive={activeChannel?.id === coachSquad.chatChannelId}
                        isPinned={true}
                        unreadCount={coachSquadUnreads[coachSquad.chatChannelId] || 0}
                        lastMessageTime={coachSquadLastMessages[coachSquad.chatChannelId] || null}
                        isCoaching={isUserTheCoach}
                      />
                    </div>
                  );
                })}
              </>
            )}
            
            {/* Regular User: Squad Chat(s) - Show skeleton while loading */}
            {/* Don't show squad chats on platform domain - they are tenant-specific */}
            {!isCoach && !isPlatformMode && isSquadLoading && (
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
            
            {/* Regular User: ALL Squad Chats - Iterate through all squads */}
            {!isCoach && !isPlatformMode && !isSquadLoading && squads.length > 0 && (
              <>
                {squads.map((userSquad) => {
                  if (!userSquad.chatChannelId) return null;
                  // Skip archived squad channels
                  if (archivedChannelIds.has(userSquad.chatChannelId)) return null;
                  const isPremium = userSquad.hasCoach === true;
                  return (
                    <div key={userSquad.id} className="p-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
                      <SpecialChannelItem
                        avatarUrl={userSquad.avatarUrl}
                        icon={
                          isPremium ? (
                            <svg className="w-6 h-6 text-[#FF6B6B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                            </svg>
                          ) : (
                            <svg className="w-6 h-6 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          )
                        }
                        name={userSquad.name || mySquadTitle}
                        description={`${squadTitle} chat${isPremium ? ' • Premium' : ''}`}
                        onClick={() => handleChannelSelect(userSquad.chatChannelId!)}
                        isActive={activeChannel?.id === userSquad.chatChannelId}
                        isPinned={true}
                        unreadCount={userSquadUnreads[userSquad.chatChannelId] || 0}
                        lastMessageTime={userSquadLastMessages[userSquad.chatChannelId] || null}
                      />
                    </div>
                  );
                })}
              </>
            )}

            {/* Orphan Squad Channels - Previous squads with unread messages */}
            {/* Don't show on platform domain - these are tenant-specific */}
            {!isPlatformMode && orphanSquadChannels
              .filter((channel) => !archivedChannelIds.has(channel.id!))
              .map((channel) => {
              const channelData = channel.data as Record<string, unknown> | undefined;
              const channelName = (channelData?.name as string) || 'Previous Squad';
              const channelImage = channelData?.image as string | undefined;
              const lastMsgAt = channel.state?.last_message_at;
              return (
                <div key={channel.id} className="p-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
                  <SpecialChannelItem
                    avatarUrl={channelImage}
                    icon={
                      <svg className="w-6 h-6 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
            
            {/* Organization Channels OR Global Channels */}
            {hasOrgChannels ? (
              <>
                {/* Org Channels - Loading state */}
                {orgChannelsLoading && (
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
                
                {/* Render org channels dynamically */}
                {!orgChannelsLoading && orgChannels.map((orgChannel) => {
                  const iconMap: Record<string, React.ReactNode> = {
                    megaphone: (
                      <svg className="w-6 h-6 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                      </svg>
                    ),
                    chat: (
                      <svg className="w-6 h-6 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    ),
                    sparkles: (
                      <svg className="w-6 h-6 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                    ),
                    hash: (
                      <svg className="w-6 h-6 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5" />
                      </svg>
                    ),
                  };
                  
                  return (
                    <div key={orgChannel.id} className="p-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
                      <SpecialChannelItem
                        icon={iconMap[orgChannel.icon || 'hash'] || iconMap.hash}
                        name={orgChannel.title}
                        description={orgChannel.subtitle}
                        onClick={() => handleChannelSelect(orgChannel.streamChannelId)}
                        isActive={activeChannel?.id === orgChannel.streamChannelId}
                        isPinned={orgChannel.isPinned}
                        unreadCount={orgChannelUnreads[orgChannel.streamChannelId] || 0}
                        lastMessageTime={orgChannelLastMessages[orgChannel.streamChannelId] || null}
                      />
                    </div>
                  );
                })}
              </>
            ) : (
              <>
                {/* Global Channels (fallback for users without org) */}
                {/* Announcements */}
                <div className="p-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
                  <SpecialChannelItem
                    icon={
                      <svg className="w-6 h-6 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
                      <svg className="w-6 h-6 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
                      <svg className="w-6 h-6 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
              </>
            )}

            {/* Orphan Coaching Channels - Previous coaching chats with unread messages */}
            {/* Don't show on platform domain - these are tenant-specific */}
            {!isPlatformMode && orphanCoachingChannels.map((channel) => {
              const channelData = channel.data as Record<string, unknown> | undefined;
              const channelName = (channelData?.name as string) || 'Previous Coach';
              const channelImage = channelData?.image as string | undefined;
              const lastMsgAt = channel.state?.last_message_at;
              return (
                <div key={channel.id} className="p-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
                  <SpecialChannelItem
                    avatarUrl={channelImage}
                    icon={
                      <svg className="w-6 h-6 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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

            {/* Get Your Personal Coach - Promo Item */}
            {/* Show to coaches even if not enabled (with disabled state) */}
            {/* Show to users only if enabled and visible AND not in active individual program */}
            {/* Don't show on platform domain */}
            {!isPlatformMode && !hasCoaching && !hasActiveIndividualEnrollment && coachingPromo.isVisible && (
              <div className="p-2 border-t border-[#e1ddd8] dark:border-[#262b35]">
                <CoachPromoItem 
                  title={coachingPromo.title}
                  subtitle={coachingPromo.subtitle}
                  imageUrl={coachingPromo.imageUrl}
                  isEnabled={promoIsEnabled}
                  destinationUrl={promoDestinationUrl}
                  isCoach={userRole === 'coach'}
                  onDisabledClick={() => setShowPromoNotEnabledModal(true)}
                />
              </div>
            )}
            
            {/* Coaching Promo Not Enabled Modal (for coaches) */}
            <CoachingPromoNotEnabledModal
              isOpen={showPromoNotEnabledModal}
              onClose={() => setShowPromoNotEnabledModal(false)}
            />

            {/* Edit Channels Link - Only show for coaches with org channels */}
            {userRole === 'coach' && hasOrgChannels && (
              <div className="p-2">
                <EditChannelsLink />
              </div>
            )}

            {/* Archived Chats Link - Main Tab */}
            {archivedMainChannels.length > 0 && (
              <div className="p-2 border-t border-[#e1ddd8] dark:border-[#262b35]">
                <ArchivedChatsLink
                  count={archivedMainChannels.length}
                  onClick={() => setShowArchivedView('main')}
                />
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
            {/* Archived Chats Link - Direct Tab */}
            {archivedDirectChannels.length > 0 && (
              <div className="p-2 border-t border-[#e1ddd8] dark:border-[#262b35]">
                <ArchivedChatsLink
                  count={archivedDirectChannels.length}
                  onClick={() => setShowArchivedView('direct')}
                />
              </div>
            )}
          </div>

          {/* Archived Channels View - Overlay that appears when showArchivedView is set */}
          {showArchivedView && (
            <div className="absolute inset-0 bg-[#faf8f6] dark:bg-[#05070b] z-10 flex flex-col animate-in slide-in-from-right-4 duration-200">
              {/* Header */}
              <div className="flex items-center gap-3 p-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
                <button
                  onClick={() => setShowArchivedView(null)}
                  className="w-8 h-8 flex items-center justify-center text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#171b22] rounded-full transition-colors"
                  aria-label="Go back"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="font-albert text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                  Archived Chats
                </h3>
              </div>

              {/* Archived Channels List - show tab-specific channels */}
              <div className="flex-1 overflow-y-auto p-2">
                {(() => {
                  const currentArchivedChannels = showArchivedView === 'main' ? archivedMainChannels : archivedDirectChannels;
                  return currentArchivedChannels.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="font-albert text-[14px] text-[#8c8c8c] dark:text-[#7d8190]">
                      No archived chats
                    </p>
                  </div>
                ) : (
                  currentArchivedChannels.map((channel) => {
                    const channelData = channel.data as Record<string, unknown> | undefined;
                    const channelName = (channelData?.name as string) || channel.id || 'Chat';
                    const channelImage = channelData?.image as string | undefined;
                    const members = Object.values(channel.state.members).filter(m => m.user);
                    const otherMember = members.find(m => m.user?.id !== client?.userID);
                    const avatarUrl = channelImage || otherMember?.user?.image;
                    const displayName = channel.id?.startsWith('coaching-')
                      ? (otherMember?.user?.name || 'Coaching Chat')
                      : (channelData?.name as string) || otherMember?.user?.name || 'Chat';

                    // Determine channel type for unarchive
                    const orgChannelStreamIds = new Set(orgChannels.map(c => c.streamChannelId));
                    const isOrgChannel = channel.id && orgChannelStreamIds.has(channel.id);
                    const isDmChannel = channel.id?.startsWith('coaching-') || (members.length <= 2 && !channelName);
                    const channelType: ChatChannelType = isOrgChannel ? 'org' : isDmChannel ? 'dm' : 'squad';

                    return (
                      <div
                        key={channel.id}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[#ffffff]/60 dark:hover:bg-[#171b22]/60 transition-colors"
                      >
                        {/* Avatar */}
                        {avatarUrl ? (
                          <Image
                            src={avatarUrl}
                            alt={displayName}
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-accent to-[#7d5c3e] flex items-center justify-center text-white font-albert font-semibold text-lg flex-shrink-0">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                        )}

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <p className="font-albert text-[15px] font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                            {displayName}
                          </p>
                          <p className="font-albert text-[13px] text-[#8c8c8c] dark:text-[#7d8190]">
                            Archived
                          </p>
                        </div>

                        {/* Restore button */}
                        <button
                          onClick={() => {
                            if (channel.id) {
                              unarchiveChannel(channel.id, channelType);
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-accent/10 hover:bg-brand-accent/20 text-brand-accent transition-colors"
                        >
                          <ArchiveRestore className="w-4 h-4" />
                          <span className="font-albert text-[13px] font-medium">Restore</span>
                        </button>
                      </div>
                    );
                  })
                );
                })()}
              </div>
            </div>
          )}
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
              <div className="w-16 h-16 rounded-full bg-brand-accent/10 dark:bg-brand-accent/15 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
      className="fixed top-0 left-0 right-0 lg:left-[72px] flex flex-col bg-[#faf8f6] dark:bg-[#05070b] pb-[85px] lg:pb-0"
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
