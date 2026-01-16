'use client';

import React from 'react';
import { Activity, RotateCcw, BookOpen, Calendar, Clock, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EngagementItem {
  contentId: string;
  title: string;
  count: number;
}

interface EngagementInsightsProps {
  reWatched: EngagementItem[];
  reRead: EngagementItem[];
  mostActiveDays: string[];
  mostActiveHours: string;
  pattern?: string;
  className?: string;
}

export function EngagementInsights({
  reWatched,
  reRead,
  mostActiveDays,
  mostActiveHours,
  pattern,
  className,
}: EngagementInsightsProps) {
  const hasEngagement = reWatched.length > 0 || reRead.length > 0 || mostActiveDays.length > 0;

  if (!hasEngagement) {
    return (
      <div className={cn('bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] p-6', className)}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-cyan-100 dark:bg-cyan-900/30">
            <Activity className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          </div>
          <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Engagement Insights
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-[#f3f1ef] dark:bg-[#262b35] flex items-center justify-center mb-3">
            <Activity className="w-6 h-6 text-[#a7a39e] dark:text-[#5f6470]" />
          </div>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            No engagement data yet
          </p>
          <p className="text-xs text-[#a7a39e] dark:text-[#5f6470] mt-1">
            Insights will appear as the client interacts with content
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] p-6', className)}>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-cyan-100 dark:bg-cyan-900/30">
          <Activity className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
        </div>
        <div>
          <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Engagement Insights
          </h3>
          <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
            How the client engages with content
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Pattern insight */}
        {pattern && (
          <div className="p-3 rounded-xl bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 border border-cyan-200/50 dark:border-cyan-800/30">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-cyan-600 dark:text-cyan-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-cyan-800 dark:text-cyan-300 font-albert">
                  Learning Pattern
                </p>
                <p className="text-sm text-cyan-700 dark:text-cyan-400/80 mt-0.5">
                  {pattern}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Activity times */}
        <div className="grid grid-cols-2 gap-3">
          {/* Most active days */}
          {mostActiveDays.length > 0 && (
            <div className="p-3 rounded-xl bg-[#faf8f6] dark:bg-[#11141b] border border-[#f0ede9] dark:border-[#1e222a]">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-[#8c8c8c] dark:text-[#7d8190]" />
                <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">Most Active</span>
              </div>
              <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                {mostActiveDays.join(', ')}
              </p>
            </div>
          )}

          {/* Most active hours */}
          {mostActiveHours && (
            <div className="p-3 rounded-xl bg-[#faf8f6] dark:bg-[#11141b] border border-[#f0ede9] dark:border-[#1e222a]">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-[#8c8c8c] dark:text-[#7d8190]" />
                <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">Peak Hours</span>
              </div>
              <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                {mostActiveHours}
              </p>
            </div>
          )}
        </div>

        {/* Re-watched content */}
        {reWatched.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <RotateCcw className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Re-watched Content
              </span>
            </div>
            <div className="space-y-2">
              {reWatched.map((item) => (
                <div
                  key={item.contentId}
                  className="flex items-center justify-between p-2 rounded-lg bg-[#faf8f6] dark:bg-[#11141b]"
                >
                  <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] truncate flex-1">
                    {item.title}
                  </span>
                  <span className="text-xs font-medium text-purple-600 dark:text-purple-400 flex-shrink-0 ml-2">
                    {item.count}x
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Re-read content */}
        {reRead.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Re-read Articles
              </span>
            </div>
            <div className="space-y-2">
              {reRead.map((item) => (
                <div
                  key={item.contentId}
                  className="flex items-center justify-between p-2 rounded-lg bg-[#faf8f6] dark:bg-[#11141b]"
                >
                  <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] truncate flex-1">
                    {item.title}
                  </span>
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2">
                    {item.count}x
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
