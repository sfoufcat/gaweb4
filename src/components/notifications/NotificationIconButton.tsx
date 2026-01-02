'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationSheet } from './NotificationSheet';

interface NotificationIconButtonProps {
  className?: string;
}

/**
 * NotificationIconButton Component
 * 
 * A compact notification bell icon for mobile date row.
 * 28px height to match the horizontal ThemeToggle.
 * Opens NotificationSheet on tap.
 */
export function NotificationIconButton({ className = '' }: NotificationIconButtonProps) {
  const { notifications, unreadCount, isLoading, markAllAsRead, markAsRead, deleteNotification } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => {
    setIsOpen(true);
    // Mark all as read after a short delay (UX improvement)
    if (unreadCount > 0) {
      setTimeout(() => {
        markAllAsRead();
      }, 1000);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  // Format badge count (cap at 9+)
  const badgeText = unreadCount > 9 ? '9+' : unreadCount.toString();

  return (
    <>
      <button
        onClick={handleOpen}
        disabled={isLoading}
        className={`
          relative h-[28px] w-[28px] rounded-full
          bg-[#f3f1ef] dark:bg-[#181d28]
          flex items-center justify-center
          hover:bg-[#e9e5e0] dark:hover:bg-[#272d38]
          transition-colors
          disabled:opacity-50
          ${className}
        `}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell 
          className="w-3.5 h-3.5 text-text-primary" 
          strokeWidth={2}
        />
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 flex items-center justify-center bg-[#E74C3C] text-white text-[8px] font-semibold rounded-full leading-none">
            {badgeText}
          </span>
        )}
      </button>

      {/* Mobile Sheet */}
      <NotificationSheet
        isOpen={isOpen}
        onClose={handleClose}
        notifications={notifications}
        onNotificationClick={markAsRead}
        onDelete={deleteNotification}
      />
    </>
  );
}

export default NotificationIconButton;

