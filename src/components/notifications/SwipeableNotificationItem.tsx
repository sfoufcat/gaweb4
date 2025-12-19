'use client';

import { useState } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { ChevronRight, Trash2 } from 'lucide-react';
import type { Notification } from '@/types';

interface SwipeableNotificationItemProps {
  notification: Notification;
  onNotificationClick: (notification: Notification) => void;
  onDelete: (notificationId: string) => void;
  formatRelativeTime: (dateString: string) => string;
  isLast?: boolean;
  isMobile?: boolean;
}

const SWIPE_THRESHOLD = 100;

export function SwipeableNotificationItem({
  notification,
  onNotificationClick,
  onDelete,
  formatRelativeTime,
  isLast = false,
  isMobile = false,
}: SwipeableNotificationItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const x = useMotionValue(0);
  
  // Transform x position to delete button opacity
  const deleteOpacity = useTransform(x, [-SWIPE_THRESHOLD, -50, 0], [1, 0.5, 0]);
  const deleteScale = useTransform(x, [-SWIPE_THRESHOLD, -50, 0], [1, 0.8, 0.5]);
  
  const handleDragEnd = () => {
    const currentX = x.get();
    if (currentX < -SWIPE_THRESHOLD) {
      // Trigger delete
      setIsDeleting(true);
      onDelete(notification.id);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
    onDelete(notification.id);
  };

  return (
    <AnimatePresence>
      {!isDeleting && (
        <motion.div
          initial={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
          transition={{ duration: 0.2 }}
          className="relative overflow-hidden"
        >
          {/* Delete background */}
          <motion.div
            className={`absolute inset-0 bg-red-500 flex items-center justify-end pr-6 ${
              isLast ? 'rounded-b-[20px]' : ''
            }`}
            style={{ opacity: deleteOpacity }}
          >
            <motion.div style={{ scale: deleteScale }}>
              <Trash2 className="w-6 h-6 text-white" />
            </motion.div>
          </motion.div>

          {/* Swipeable notification content */}
          <motion.button
            drag="x"
            dragConstraints={{ left: -150, right: 0 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
            style={{ x }}
            onClick={() => onNotificationClick(notification)}
            className={`relative w-full text-left px-5 py-4 ${
              isMobile ? 'active:bg-[#f3f1ef] dark:active:bg-[#1e222a]' : 'hover:bg-[#f9f8f7] dark:hover:bg-[#1e222a]'
            } transition-colors flex gap-3 bg-white dark:bg-[#171b22] ${
              !notification.read ? 'bg-[#faf9f8] dark:bg-[#1e222a]' : ''
            } ${isLast ? 'rounded-b-[20px]' : ''}`}
            whileTap={{ cursor: 'grabbing' }}
          >
            {/* Unread indicator */}
            <div className="flex-shrink-0 pt-1.5">
              <div
                className={`w-2 h-2 rounded-full ${
                  notification.read ? 'bg-transparent' : 'bg-[#E74C3C]'
                }`}
              />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p
                className={`font-sans ${isMobile ? 'text-[15px]' : 'text-[14px]'} leading-[1.4] ${
                  notification.read
                    ? 'text-text-secondary'
                    : 'text-text-primary font-medium'
                }`}
              >
                {notification.title}
              </p>
              {notification.body && (
                <p
                  className={`font-sans ${
                    isMobile ? 'text-[14px]' : 'text-[13px]'
                  } text-text-muted leading-[1.4] mt-0.5 line-clamp-2`}
                >
                  {notification.body}
                </p>
              )}
              <p
                className={`font-sans ${
                  isMobile ? 'text-[12px] mt-2' : 'text-[11px] mt-1.5'
                } text-text-muted`}
              >
                {formatRelativeTime(notification.createdAt)}
              </p>
            </div>

            {/* Action indicator */}
            {notification.actionRoute && (
              <div className="flex-shrink-0 self-center">
                <ChevronRight
                  className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'} text-text-muted`}
                />
              </div>
            )}
          </motion.button>

          {/* Delete button for non-touch devices */}
          <motion.button
            onClick={handleDelete}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 transition-colors opacity-0 group-hover:opacity-100"
            style={{ opacity: deleteOpacity }}
            aria-label="Delete notification"
          >
            <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default SwipeableNotificationItem;

