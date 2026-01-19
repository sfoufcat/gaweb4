'use client';

import React from 'react';
import { BookOpen, CheckCircle, GraduationCap, FileText, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ContentCompletionItem {
  contentId: string;
  contentType: 'course' | 'article' | 'module' | 'lesson';
  title: string;
  completedCount: number;
  totalCount: number;
  /** Completion percentage (0-100). API may return as completionPercent or completionRate */
  completionRate?: number;
  completionPercent?: number;
}

interface ContentCompletionListProps {
  items: ContentCompletionItem[];
  className?: string;
}

const TYPE_CONFIG = {
  course: {
    icon: GraduationCap,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-100 dark:bg-purple-900/30',
  },
  article: {
    icon: FileText,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
  },
  module: {
    icon: BookOpen,
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
  },
  lesson: {
    icon: CheckCircle,
    color: 'text-teal-600 dark:text-teal-400',
    bg: 'bg-teal-100 dark:bg-teal-900/30',
  },
};

export function ContentCompletionList({ items, className }: ContentCompletionListProps) {
  if (items.length === 0) {
    return (
      <div className={cn('bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] p-6', className)}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/30">
            <BookOpen className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Content Completion
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-[#f3f1ef] dark:bg-[#262b35] flex items-center justify-center mb-3">
            <BookOpen className="w-6 h-6 text-[#a7a39e] dark:text-[#5f6470]" />
          </div>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            No content assigned yet
          </p>
          <p className="text-xs text-[#a7a39e] dark:text-[#5f6470] mt-1">
            Add courses and articles to track completion
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] p-6', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/30">
            <BookOpen className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Content Completion
            </h3>
            <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
              {items.length} content item{items.length !== 1 ? 's' : ''} tracked
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const config = TYPE_CONFIG[item.contentType];
          const TypeIcon = config.icon;
          // Support both completionRate and completionPercent from API
          const rate = item.completionRate ?? item.completionPercent ?? 0;

          return (
            <div
              key={item.contentId}
              className="p-3 rounded-xl bg-[#faf8f6] dark:bg-[#11141b] border border-[#f0ede9] dark:border-[#1e222a]"
            >
              <div className="flex items-start gap-3">
                <div className={cn('p-2 rounded-lg flex-shrink-0', config.bg)}>
                  <TypeIcon className={cn('w-4 h-4', config.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
                    {item.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Users className="w-3 h-3 text-[#8c8c8c] dark:text-[#7d8190]" />
                    <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
                      {item.completedCount}/{item.totalCount} completed
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2">
                    <div className="h-2 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          rate >= 80
                            ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                            : rate >= 50
                            ? 'bg-gradient-to-r from-blue-400 to-blue-500'
                            : 'bg-gradient-to-r from-amber-400 to-amber-500'
                        )}
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p
                    className={cn(
                      'text-lg font-bold font-albert',
                      rate >= 80
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : rate >= 50
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-amber-600 dark:text-amber-400'
                    )}
                  >
                    {rate}%
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
