'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { SwipeableNotificationItem } from './SwipeableNotificationItem';
import type { Notification } from '@/types';
import { useDragToDismiss } from '@/hooks/useDragToDismiss';

interface NotificationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onNotificationClick: (notificationId: string) => void;
  onDelete: (notificationId: string) => void;
}

/**
 * NotificationSheet Component (Mobile Bottom Sheet)
 * 
 * Displays notifications in a bottom-up sheet.
 * Used on mobile screens. Follows the same pattern as AlignmentSheet.
 */
export function NotificationSheet({
  isOpen,
  onClose,
  notifications,
  onNotificationClick,
  onDelete,
}: NotificationSheetProps) {
  const { sheetRef, handleRef, handleProps } = useDragToDismiss({ onClose });
  const router = useRouter();

  // Close on escape key and lock body scroll
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (isOpen && sheetRef.current) {
      sheetRef.current.focus();
    }
  }, [isOpen]);

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
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div 
        ref={sheetRef}
        tabIndex={-1}
        className="relative w-full max-w-[500px] mx-0 bg-white rounded-t-[24px] shadow-2xl animate-in slide-in-from-bottom duration-300 outline-none"
        style={{ maxHeight: '85dvh' }}
      >
        {/* Grabber (drag handle) */}
        <div ref={handleRef} {...handleProps} className="flex justify-center pt-4 pb-3 touch-none select-none cursor-grab active:cursor-grabbing">
          <div className="w-9 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pb-3">
          <h2 className="font-albert text-[20px] font-semibold text-text-primary tracking-[-0.5px]">
            Notifications
          </h2>
        </div>

        {/* Notifications List */}
        <div className="overflow-y-auto overflow-hidden pb-8" style={{ maxHeight: 'calc(85dvh - 80px)' }}>
          {notifications.length === 0 ? (
            <div className="py-12 px-5 text-center">
              <div className="w-14 h-14 bg-[#f3f1ef] rounded-full flex items-center justify-center mx-auto mb-4">
                <Bell className="w-7 h-7 text-text-muted" />
              </div>
              <p className="font-sans text-[15px] text-text-secondary">
                No notifications yet
              </p>
              <p className="font-sans text-[13px] text-text-muted mt-1">
                We&apos;ll let you know when something important happens
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
                  isMobile={true}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NotificationSheet;




