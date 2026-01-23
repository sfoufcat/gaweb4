'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { MessageCircle } from 'lucide-react';
import { useChatUnreadCounts } from '@/hooks/useChatUnreadCounts';

// Lazy load ChatSheet - heavy component only needed when chat is opened
const ChatSheet = dynamic(
  () => import('./ChatSheet').then(mod => ({ default: mod.ChatSheet })),
  { ssr: false }
);

interface ChatIconButtonProps {
  className?: string;
}

/**
 * ChatIconButton Component
 * 
 * A compact chat message icon for mobile date row.
 * 28px height to match the horizontal ThemeToggle.
 * Shows unread badge and opens ChatSheet on tap.
 */
export function ChatIconButton({ className = '' }: ChatIconButtonProps) {
  const { totalUnread } = useChatUnreadCounts();
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  // Format badge count (cap at 9+)
  const badgeText = totalUnread > 9 ? '9+' : totalUnread.toString();

  return (
    <>
      <button
        onClick={handleOpen}
        className={`
          relative h-[28px] w-[28px] rounded-full
          bg-[#f3f1ef] dark:bg-[#181d28]
          flex items-center justify-center
          hover:bg-[#e9e5e0] dark:hover:bg-[#272d38]
          transition-colors
          ${className}
        `}
        aria-label={`Chat${totalUnread > 0 ? ` (${totalUnread} unread)` : ''}`}
      >
        <MessageCircle 
          className="w-3.5 h-3.5 text-text-primary" 
          strokeWidth={2}
        />
        
        {/* Unread Badge */}
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 flex items-center justify-center bg-[#E74C3C] text-white text-[8px] font-semibold rounded-full leading-none">
            {badgeText}
          </span>
        )}
      </button>

      {/* Chat Sheet */}
      <ChatSheet
        isOpen={isOpen}
        onClose={handleClose}
      />
    </>
  );
}

export default ChatIconButton;

