'use client';

/**
 * ProgramScheduleView Component
 *
 * Unified schedule timeline that groups items by Today, Tomorrow, This Week, Upcoming.
 * Displays calls (with join button), courses (with link), and tasks (with checkbox).
 */

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Video,
  BookOpen,
  CheckCircle2,
  Circle,
  ChevronRight,
  Clock,
  Loader2,
} from 'lucide-react';
import type { ScheduledItem } from '@/types';

interface ScheduleGroup {
  label: string;
  items: ScheduledItem[];
}

interface ProgramScheduleViewProps {
  groups: ScheduleGroup[];
  isLoading?: boolean;
  onTaskComplete?: (itemId: string) => void;
  onJoinCall?: (eventId: string) => void;
}

export function ProgramScheduleView({
  groups,
  isLoading = false,
  onTaskComplete,
  onJoinCall,
}: ProgramScheduleViewProps) {
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

  const handleTaskClick = (itemId: string) => {
    setCompletedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
    onTaskComplete?.(itemId);
  };

  const getItemIcon = (type: ScheduledItem['type']) => {
    switch (type) {
      case 'call':
        return <Video className="w-4 h-4" />;
      case 'course_lesson':
      case 'course_module':
        return <BookOpen className="w-4 h-4" />;
      case 'assignment':
        return <CheckCircle2 className="w-4 h-4" />;
      default:
        return <Calendar className="w-4 h-4" />;
    }
  };

  const getItemColor = (type: ScheduledItem['type']) => {
    switch (type) {
      case 'call':
        return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400';
      case 'course_lesson':
      case 'course_module':
        return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
      case 'assignment':
        return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 text-brand-accent animate-spin" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-6 text-center">
        <Calendar className="w-10 h-10 text-[#d4cfc9] dark:text-[#7d8190] mx-auto mb-3" />
        <p className="text-[15px] text-text-secondary dark:text-[#b2b6c2]">
          No upcoming schedule items
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.label} className="space-y-3">
          {/* Group Label */}
          <h3 className="font-albert text-[15px] font-semibold text-text-secondary dark:text-[#b2b6c2] tracking-[-0.3px] uppercase">
            {group.label}
          </h3>

          {/* Items */}
          <div className="space-y-2">
            {group.items.map((item) => {
              const isCompleted = completedTasks.has(item.id);

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`
                    bg-white dark:bg-[#171b22] rounded-[16px] p-4
                    border border-transparent
                    hover:border-[#e8e4df] dark:hover:border-[#2a303c]
                    hover:shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:hover:shadow-[0_2px_12px_rgba(0,0,0,0.2)]
                    transition-all duration-200
                    ${isCompleted ? 'opacity-50' : ''}
                  `}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${getItemColor(
                        item.type
                      )}`}
                    >
                      {getItemIcon(item.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p
                            className={`font-sans text-[15px] font-medium text-text-primary dark:text-[#f5f5f8] leading-[1.4] ${
                              isCompleted ? 'line-through' : ''
                            }`}
                          >
                            {item.title}
                          </p>
                          {item.description && (
                            <p className="font-sans text-[13px] text-text-muted dark:text-[#7d8190] mt-0.5 line-clamp-1">
                              {item.description}
                            </p>
                          )}
                        </div>

                        {/* Action button */}
                        {item.type === 'call' && item.eventId && (
                          <button
                            onClick={() => onJoinCall?.(item.eventId!)}
                            className="shrink-0 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[13px] font-medium rounded-full transition-colors"
                          >
                            Join
                          </button>
                        )}
                        {(item.type === 'course_lesson' || item.type === 'course_module') &&
                          item.courseId && (
                            <Link
                              href={`/discover/courses/${item.courseId}${
                                item.lessonId ? `?lesson=${item.lessonId}` : ''
                              }`}
                              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
                            >
                              <ChevronRight className="w-5 h-5 text-text-secondary dark:text-[#b2b6c2]" />
                            </Link>
                          )}
                        {item.type === 'assignment' && (
                          <button
                            onClick={() => handleTaskClick(item.id)}
                            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="w-5 h-5 text-green-500" />
                            ) : (
                              <Circle className="w-5 h-5 text-text-muted dark:text-[#7d8190]" />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Time and duration */}
                      <div className="flex items-center gap-3 mt-2">
                        {item.scheduledTime && (
                          <span className="flex items-center gap-1 text-[12px] text-text-muted dark:text-[#7d8190]">
                            <Clock className="w-3.5 h-3.5" />
                            {formatTime(item.scheduledTime)}
                          </span>
                        )}
                        {item.estimatedMinutes && (
                          <span className="text-[12px] text-text-muted dark:text-[#7d8190]">
                            {item.estimatedMinutes} min
                          </span>
                        )}
                        {item.isRequired && (
                          <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-medium rounded">
                            Required
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
