'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, X } from 'lucide-react';
import { SwipeableNotificationItem } from './SwipeableNotificationItem';
import type { Notification } from '@/types';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onNotificationClick: (notificationId: string) => void;
  onDelete: (notificationId: string) => void;
}

/**
 * NotificationPanel Component (Desktop Popover)
 * 
 * Displays notifications in a dropdown anchored to the bell icon.
 * Used on desktop/tablet screens.
 */
export function NotificationPanel({
  isOpen,
  onClose,
  notifications,
  onNotificationClick,
  onDelete,
}: NotificationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // Check if click is on the bell button (parent)
        const bellButton = (e.target as Element).closest('[aria-label*="Notifications"]');
        if (!bellButton) {
          onClose();
        }
      }
    };
    if (isOpen) {
      // Delay to prevent immediate close on open click
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    onNotificationClick(notification.id);
    onClose();
    if (notification.actionRoute) {
      router.push(notification.actionRoute);
    }
  };

  // Format relative time
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Invisible backdrop for click-outside detection */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Panel - anchored to bell (parent has relative positioning) */}
      <div 
        ref={panelRef}
        className="absolute right-0 top-full mt-2 z-50 w-[380px] max-w-[calc(100vw-32px)] bg-white dark:bg-[#171b22] rounded-[20px] shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#262b35]">
          <h2 className="font-albert text-[20px] font-semibold text-text-primary tracking-[-0.5px]">
            Notifications
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#1e222a] transition-colors"
            aria-label="Close notifications"
          >
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        {/* Notifications List */}
        <div className="max-h-[400px] overflow-y-auto overflow-hidden rounded-b-[20px]">
          {notifications.length === 0 ? (
            <div className="py-12 px-5 text-center">
              <div className="w-14 h-14 bg-[#f3f1ef] dark:bg-[#11141b] rounded-full flex items-center justify-center mx-auto mb-4">
                <Bell className="w-7 h-7 text-text-muted" />
              </div>
              <p className="font-sans text-[15px] text-text-secondary">
                No notifications yet
              </p>
              <p className="font-sans text-[13px] text-text-muted mt-1">
                We'll let you know when something important happens
              </p>
            </div>
          ) : (
            <div>
              {notifications.map((notification, index) => (
                <SwipeableNotificationItem
                  key={notification.id}
                  notification={notification}
                  onNotificationClick={handleNotificationClick}
                  onDelete={onDelete}
                  formatRelativeTime={formatRelativeTime}
                  isLast={index === notifications.length - 1}
                  isMobile={false}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default NotificationPanel;

