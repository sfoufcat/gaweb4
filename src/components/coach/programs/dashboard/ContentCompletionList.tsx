'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, GraduationCap, FileText, Users, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LessonCompletion {
  lessonId: string;
  title: string;
  completedCount: number;
  totalCount: number;
}

interface ModuleCompletion {
  moduleId: string;
  title: string;
  lessons: LessonCompletion[];
}

export interface ContentCompletionItem {
  contentId: string;
  contentType: 'course' | 'article' | 'module' | 'lesson' | 'questionnaire';
  title: string;
  completedCount: number;
  totalCount: number;
  /** Completion percentage (0-100). API may return as completionPercent or completionRate */
  completionRate?: number;
  completionPercent?: number;
  /** Module/lesson completion data for courses */
  modules?: ModuleCompletion[];
  /** Cover image URL for courses */
  coverImageUrl?: string;
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
    icon: BookOpen,
    color: 'text-teal-600 dark:text-teal-400',
    bg: 'bg-teal-100 dark:bg-teal-900/30',
  },
  questionnaire: {
    icon: FileText,
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-100 dark:bg-orange-900/30',
  },
};

// Lesson completion checkbox (small, square)
function LessonCheckbox({ completed, total }: { completed: number; total: number }) {
  const isComplete = completed === total && total > 0;
  const isPartial = completed > 0 && completed < total;

  return (
    <div
      className={cn(
        'w-3.5 h-3.5 rounded border-[1.5px] flex items-center justify-center transition-all flex-shrink-0',
        isComplete
          ? 'bg-emerald-500 border-emerald-500'
          : isPartial
          ? 'bg-amber-400/30 border-amber-400'
          : 'border-[#d1cdc8] dark:border-[#3a3f4b] bg-white dark:bg-[#1d222b]'
      )}
    >
      {isComplete && (
        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
      {isPartial && (
        <svg className="w-2.5 h-2.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" />
        </svg>
      )}
    </div>
  );
}

// Module completion checkbox (larger, rounded)
function ModuleCheckbox({ completed, total }: { completed: number; total: number }) {
  const isComplete = completed === total && total > 0;
  const isPartial = completed > 0 && completed < total;

  return (
    <div
      className={cn(
        'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0',
        isComplete
          ? 'bg-emerald-500 border-emerald-500'
          : isPartial
          ? 'bg-amber-400/30 border-amber-400'
          : 'border-[#d1cdc8] dark:border-[#3a3f4b] bg-white dark:bg-[#1d222b]'
      )}
    >
      {isComplete && (
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
      {isPartial && (
        <svg className="w-3 h-3 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" />
        </svg>
      )}
    </div>
  );
}

// Completion badge
function CompletionBadge({ completed, total }: { completed: number; total: number }) {
  const isComplete = completed === total && total > 0;
  const isPartial = completed > 0 && completed < total;

  return (
    <span
      className={cn(
        'text-xs px-2 py-0.5 rounded-full font-medium tabular-nums',
        isComplete
          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
          : isPartial
          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
          : 'bg-[#f3f1ef] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2]'
      )}
    >
      {completed}/{total}
    </span>
  );
}

export function ContentCompletionList({ items, className }: ContentCompletionListProps) {
  // Track expanded courses and modules
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const toggleCourse = (contentId: string) => {
    setExpandedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(contentId)) {
        next.delete(contentId);
      } else {
        next.add(contentId);
      }
      return next;
    });
  };

  const toggleModule = (moduleKey: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleKey)) {
        next.delete(moduleKey);
      } else {
        next.add(moduleKey);
      }
      return next;
    });
  };

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
          const config = TYPE_CONFIG[item.contentType] || TYPE_CONFIG.article;
          const TypeIcon = config.icon;
          const rate = item.completionRate ?? item.completionPercent ?? 0;
          const isCourse = item.contentType === 'course';
          const hasModules = isCourse && item.modules && item.modules.length > 0;
          const isExpanded = expandedCourses.has(item.contentId);

          return (
            <div
              key={item.contentId}
              className="rounded-xl bg-[#faf8f6] dark:bg-[#11141b] border border-[#f0ede9]/60 dark:border-[#1e222a]/60 shadow-[0_1px_2px_0_rgba(0,0,0,0.02)] overflow-hidden transition-all"
            >
              {/* Main content row */}
              <div
                className={cn(
                  'p-3 flex items-center gap-3',
                  hasModules && 'cursor-pointer hover:bg-[#f5f3f0] dark:hover:bg-[#161a22]'
                )}
                onClick={() => hasModules && toggleCourse(item.contentId)}
              >
                {/* Left: Course image or icon */}
                {isCourse && item.coverImageUrl ? (
                  <img
                    src={item.coverImageUrl}
                    alt={item.title}
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <div className={cn('p-2 rounded-lg flex-shrink-0', config.bg)}>
                    <TypeIcon className={cn('w-4 h-4', config.color)} />
                  </div>
                )}

                {/* Middle: Title and progress bar */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
                    {item.title}
                  </p>
                  {/* Progress bar with member count (cohorts only) and percentage */}
                  <div className="flex items-center gap-2 mt-2">
                    {item.totalCount > 1 && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Users className="w-3 h-3 text-[#8c8c8c] dark:text-[#7d8190]" />
                        <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190] tabular-nums">
                          {item.completedCount}/{item.totalCount}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 h-3 bg-[#f3f1ef] dark:bg-[#262b35] rounded-full overflow-hidden shadow-inner">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className={cn(
                          'h-full rounded-full shadow-sm',
                          rate >= 100
                            ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                            : rate >= 50
                            ? 'bg-gradient-to-r from-brand-accent/80 to-brand-accent'
                            : rate >= 25
                            ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                            : 'bg-gradient-to-r from-[#d1ccc6] to-[#c4bfb8] dark:from-[#4a5060] dark:to-[#5a6070]'
                        )}
                      />
                    </div>
                    <span
                      className={cn(
                        'text-sm font-semibold font-albert w-10 text-right',
                        rate >= 80
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : rate >= 50
                          ? 'text-brand-accent'
                          : 'text-amber-600 dark:text-amber-400'
                      )}
                    >
                      {rate}%
                    </span>
                  </div>
                </div>

                {/* Right: Expand chevron for courses with modules */}
                {hasModules && (
                  <button
                    type="button"
                    className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[#e1ddd8] dark:hover:bg-[#262b35] transition-colors flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCourse(item.contentId);
                    }}
                  >
                    <ChevronRight
                      className={cn(
                        'w-5 h-5 text-[#a7a39e] dark:text-[#5f6470] transition-transform duration-200',
                        isExpanded && 'rotate-90'
                      )}
                    />
                  </button>
                )}
              </div>

              {/* Expandable module/lesson list */}
              {hasModules && (
                <div
                  className={cn(
                    'overflow-hidden transition-all duration-300 ease-out',
                    isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
                  )}
                >
                  <div className="border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50">
                    {item.modules!.map((module) => {
                      const moduleKey = `${item.contentId}-${module.moduleId}`;
                      const isModuleExpanded = expandedModules.has(moduleKey);
                      const lessonCount = module.lessons.length;
                      const completedLessons = module.lessons.filter(
                        (l) => l.completedCount === l.totalCount && l.totalCount > 0
                      ).length;

                      return (
                        <div key={module.moduleId}>
                          {/* Module header */}
                          <div
                            className={cn(
                              'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors',
                              'hover:bg-[#f5f3f0] dark:hover:bg-[#1d222b]'
                            )}
                            onClick={() => toggleModule(moduleKey)}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleModule(moduleKey);
                              }}
                              className={cn(
                                'w-6 h-6 flex items-center justify-center rounded-md transition-colors ml-4',
                                lessonCount > 0
                                  ? 'hover:bg-[#e1ddd8] dark:hover:bg-[#262b35]'
                                  : 'opacity-30 cursor-default'
                              )}
                              disabled={lessonCount === 0}
                            >
                              <ChevronRight
                                className={cn(
                                  'w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2] transition-transform duration-200',
                                  isModuleExpanded && 'rotate-90'
                                )}
                              />
                            </button>

                            <ModuleCheckbox completed={completedLessons} total={lessonCount} />

                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                                {module.title}
                              </span>
                            </div>

                            <CompletionBadge completed={completedLessons} total={lessonCount} />
                          </div>

                          {/* Lessons - animated expand */}
                          <div
                            className={cn(
                              'overflow-hidden transition-all duration-200 ease-out',
                              isModuleExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                            )}
                          >
                            {lessonCount > 0 ? (
                              <div className="border-t border-[#e1ddd8]/30 dark:border-[#262b35]/30">
                                {module.lessons.map((lesson) => {
                                  const isLessonComplete =
                                    lesson.completedCount === lesson.totalCount && lesson.totalCount > 0;

                                  return (
                                    <div
                                      key={lesson.lessonId}
                                      className={cn(
                                        'flex items-center gap-3 pl-[72px] pr-3 py-2 transition-colors',
                                        isLessonComplete
                                          ? 'bg-emerald-50/50 dark:bg-emerald-900/10'
                                          : 'bg-white dark:bg-[#11141b]'
                                      )}
                                    >
                                      <LessonCheckbox
                                        completed={lesson.completedCount}
                                        total={lesson.totalCount}
                                      />

                                      <span
                                        className={cn(
                                          'text-sm font-albert flex-1',
                                          isLessonComplete
                                            ? 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                                            : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                                        )}
                                      >
                                        {lesson.title}
                                      </span>

                                      <CompletionBadge
                                        completed={lesson.completedCount}
                                        total={lesson.totalCount}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="bg-[#faf8f6] dark:bg-[#0d0f13] border-t border-[#e1ddd8]/30 dark:border-[#262b35]/30 px-[72px] py-3">
                                <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] italic">
                                  No lessons in this module
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
