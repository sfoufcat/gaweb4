'use client';

import React from 'react';
import { CalendarDays, Phone, FileQuestion, Unlock, Clock, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';

export interface UpcomingItem {
  type: 'call' | 'form' | 'week_unlock';
  title: string;
  date?: string;
  actionType?: 'reschedule' | 'send_reminder';
}

interface UpcomingSectionProps {
  items: UpcomingItem[];
  onAction?: (item: UpcomingItem, action: string) => void;
  className?: string;
}

const TYPE_CONFIG = {
  call: {
    icon: Phone,
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-900/30',
    label: 'Scheduled Call',
  },
  form: {
    icon: FileQuestion,
    color: 'text-pink-600 dark:text-pink-400',
    bg: 'bg-pink-100 dark:bg-pink-900/30',
    label: 'Form Due',
  },
  week_unlock: {
    icon: Unlock,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    label: 'Week Unlock',
  },
};

export function UpcomingSection({ items, onAction, className }: UpcomingSectionProps) {
  if (items.length === 0) {
    return (
      <div className={cn('bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] p-6', className)}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-900/30">
            <CalendarDays className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Upcoming
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-[#f3f1ef] dark:bg-[#262b35] flex items-center justify-center mb-3">
            <CalendarDays className="w-6 h-6 text-[#a7a39e] dark:text-[#5f6470]" />
          </div>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            Nothing scheduled
          </p>
          <p className="text-xs text-[#a7a39e] dark:text-[#5f6470] mt-1">
            Upcoming events will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] p-6', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-900/30">
            <CalendarDays className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Upcoming
            </h3>
            <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
              {items.length} event{items.length !== 1 ? 's' : ''} scheduled
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => {
          const config = TYPE_CONFIG[item.type];
          const TypeIcon = config.icon;
          const dateObj = item.date ? new Date(item.date) : null;
          const relativeTime = dateObj ? formatDistanceToNow(dateObj, { addSuffix: true }) : null;
          const formattedDate = dateObj
            ? format(dateObj, 'EEE, MMM d')
            : null;
          const formattedTime = dateObj
            ? format(dateObj, 'h:mm a')
            : null;

          return (
            <div
              key={`${item.type}-${index}`}
              className="flex items-center gap-3 p-3 rounded-xl bg-[#faf8f6] dark:bg-[#11141b] border border-[#f0ede9] dark:border-[#1e222a] hover:border-violet-200 dark:hover:border-violet-800/50 transition-colors group"
            >
              {/* Icon */}
              <div className={cn('p-2 rounded-lg flex-shrink-0', config.bg)}>
                <TypeIcon className={cn('w-4 h-4', config.color)} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
                  {item.title}
                </p>
                {dateObj && (
                  <div className="flex items-center gap-2 mt-0.5">
                    <Clock className="w-3 h-3 text-[#8c8c8c] dark:text-[#7d8190]" />
                    <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
                      {formattedDate} at {formattedTime}
                    </span>
                  </div>
                )}
              </div>

              {/* Relative time badge */}
              {relativeTime && (
                <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] bg-[#e1ddd8] dark:bg-[#262b35] px-2 py-1 rounded-full flex-shrink-0">
                  {relativeTime}
                </span>
              )}

              {/* Action button */}
              {onAction && item.actionType && (
                <button
                  onClick={() => onAction(item, item.actionType!)}
                  className="p-1.5 rounded-lg hover:bg-[#e1ddd8] dark:hover:bg-[#262b35] transition-colors opacity-0 group-hover:opacity-100"
                >
                  <ChevronRight className="w-4 h-4 text-[#8c8c8c] dark:text-[#7d8190]" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
