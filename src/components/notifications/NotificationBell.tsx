'use client';

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationPanel } from './NotificationPanel';
import { NotificationSheet } from './NotificationSheet';

interface NotificationBellProps {
  className?: string;
}

/**
 * NotificationBell Component
 * 
 * Displays a notification bell with unread count badge.
 * - Desktop: Opens a popover dropdown
 * - Mobile: Opens a bottom sheet
 * 
 * Styled to match the AlignmentGauge component.
 */
export function NotificationBell({ className = '' }: NotificationBellProps) {
  const { notifications, unreadCount, isLoading, markAllAsRead, markAsRead, deleteNotification } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile vs desktop
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Mark all as read when panel opens
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

  // Loading state
  if (isLoading) {
    return (
      <div 
        className={`bg-[#f3f1ef] dark:bg-[#181d28] rounded-[40px] p-2 flex items-center justify-center ${className}`}
        style={{ width: 62, height: 62 }}
      >
        <div className="w-[50px] h-[50px] rounded-full bg-[#e1ddd8] dark:bg-[#272d38] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Bell Button - Styled like AlignmentGauge */}
      <button
        onClick={handleOpen}
        className={`bg-[#f3f1ef] dark:bg-[#181d28] rounded-[40px] p-2 flex items-center justify-center hover:bg-[#e9e5e0] dark:hover:bg-[#272d38] transition-colors ${className}`}
        style={{ width: 62, height: 62 }}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <div className="relative w-[50px] h-[50px] flex items-center justify-center">
          <Bell 
            className="w-6 h-6 text-text-primary" 
            strokeWidth={2}
          />
          
          {/* Unread Badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-[#E74C3C] text-white text-[10px] font-semibold rounded-full leading-none">
              {badgeText}
            </span>
          )}
        </div>
      </button>

      {/* Desktop: Popover Panel */}
      {!isMobile && (
        <NotificationPanel
          isOpen={isOpen}
          onClose={handleClose}
          notifications={notifications}
          onNotificationClick={markAsRead}
          onDelete={deleteNotification}
        />
      )}

      {/* Mobile: Bottom Sheet */}
      {isMobile && (
        <NotificationSheet
          isOpen={isOpen}
          onClose={handleClose}
          notifications={notifications}
          onNotificationClick={markAsRead}
          onDelete={deleteNotification}
        />
      )}
    </div>
  );
}

export default NotificationBell;

