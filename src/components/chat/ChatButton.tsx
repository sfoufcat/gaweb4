'use client';

import { MessageCircle } from 'lucide-react';
import { useChatUnreadCounts } from '@/hooks/useChatUnreadCounts';
import { useChatSheet } from '@/contexts/ChatSheetContext';

interface ChatButtonProps {
  className?: string;
}

/**
 * ChatButton Component
 * 
 * A larger chat button (62x62px) for the mobile top row.
 * Styled to match CalendarButton and NotificationBell.
 * Shows unread badge and opens ChatSheet on tap.
 * 
 * Uses ChatSheetContext to open the global ChatSheet instead of rendering its own.
 */
export function ChatButton({ className = '' }: ChatButtonProps) {
  const { totalUnread } = useChatUnreadCounts();
  const { openChatSheet } = useChatSheet();

  // Format badge count (cap at 9+)
  const badgeText = totalUnread > 9 ? '9+' : totalUnread.toString();

  return (
    <div className={`relative ${className}`}>
      {/* Chat Button - Styled like CalendarButton / NotificationBell */}
      <button
        onClick={() => openChatSheet()}
        className="bg-[#f3f1ef] dark:bg-[#181d28] rounded-[40px] p-2 flex items-center justify-center hover:bg-[#e9e5e0] dark:hover:bg-[#272d38] transition-colors"
        style={{ width: 62, height: 62 }}
        aria-label={`Chat${totalUnread > 0 ? ` (${totalUnread} unread)` : ''}`}
      >
        <div className="relative w-[50px] h-[50px] flex items-center justify-center">
          <MessageCircle 
            className="w-6 h-6 text-text-primary" 
            strokeWidth={2}
          />
          
          {/* Unread Badge */}
          {totalUnread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-[#E74C3C] text-white text-[10px] font-semibold rounded-full leading-none">
              {badgeText}
            </span>
          )}
        </div>
      </button>
    </div>
  );
}

export default ChatButton;
