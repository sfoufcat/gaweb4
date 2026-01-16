'use client';

import React from 'react';
import { BookOpen, CheckCircle, Circle, GraduationCap, FileText, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LessonProgress {
  lessonId: string;
  title: string;
  completed: boolean;
  completedAt?: string;
}

interface ModuleProgress {
  moduleId: string;
  title: string;
  lessons: LessonProgress[];
}

interface ArticleProgress {
  articleId: string;
  title: string;
  completed: boolean;
  completedAt?: string;
}

interface CurrentWeekContentProps {
  weekNumber: number;
  modules: ModuleProgress[];
  articles: ArticleProgress[];
  onViewContent?: (type: 'course' | 'article', id: string) => void;
  className?: string;
}

export function CurrentWeekContent({
  weekNumber,
  modules,
  articles,
  onViewContent,
  className,
}: CurrentWeekContentProps) {
  const hasContent = modules.length > 0 || articles.length > 0;

  // Calculate totals
  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const completedLessons = modules.reduce(
    (sum, m) => sum + m.lessons.filter((l) => l.completed).length,
    0
  );
  const completedArticles = articles.filter((a) => a.completed).length;

  if (!hasContent) {
    return (
      <div className={cn('bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] p-6', className)}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
            <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Week {weekNumber} Content
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-[#f3f1ef] dark:bg-[#262b35] flex items-center justify-center mb-3">
            <BookOpen className="w-6 h-6 text-[#a7a39e] dark:text-[#5f6470]" />
          </div>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            No content assigned this week
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] p-6', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
            <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Week {weekNumber} Content
            </h3>
            <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
              {completedLessons + completedArticles}/{totalLessons + articles.length} completed
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Courses/Modules */}
        {modules.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <GraduationCap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Courses
              </span>
            </div>
            <div className="space-y-2">
              {modules.map((module) => {
                const completedInModule = module.lessons.filter((l) => l.completed).length;
                const isComplete = completedInModule === module.lessons.length;

                return (
                  <div
                    key={module.moduleId}
                    className="p-3 rounded-xl bg-[#faf8f6] dark:bg-[#11141b] border border-[#f0ede9] dark:border-[#1e222a]"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
                          isComplete
                            ? 'bg-emerald-100 dark:bg-emerald-900/30'
                            : 'bg-[#e1ddd8] dark:bg-[#262b35]'
                        )}
                      >
                        {isComplete ? (
                          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Circle className="w-4 h-4 text-[#a7a39e] dark:text-[#5f6470]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            'text-sm font-medium font-albert truncate',
                            isComplete
                              ? 'text-emerald-700 dark:text-emerald-400 line-through'
                              : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                          )}
                        >
                          {module.title}
                        </p>
                        <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
                          {completedInModule}/{module.lessons.length} lessons
                        </p>
                      </div>
                      {onViewContent && (
                        <button
                          onClick={() => onViewContent('course', module.moduleId)}
                          className="p-1.5 rounded-lg hover:bg-[#e1ddd8] dark:hover:bg-[#262b35] transition-colors"
                        >
                          <ChevronRight className="w-4 h-4 text-[#8c8c8c] dark:text-[#7d8190]" />
                        </button>
                      )}
                    </div>

                    {/* Lessons */}
                    {module.lessons.length > 0 && (
                      <div className="mt-2 pl-9 space-y-1">
                        {module.lessons.map((lesson) => (
                          <div
                            key={lesson.lessonId}
                            className="flex items-center gap-2"
                          >
                            {lesson.completed ? (
                              <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                            ) : (
                              <Circle className="w-3 h-3 text-[#c4c0bc] dark:text-[#4a4f5a] flex-shrink-0" />
                            )}
                            <span
                              className={cn(
                                'text-xs truncate',
                                lesson.completed
                                  ? 'text-[#a7a39e] dark:text-[#5f6470] line-through'
                                  : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                              )}
                            >
                              {lesson.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Articles */}
        {articles.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Articles
              </span>
            </div>
            <div className="space-y-2">
              {articles.map((article) => (
                <button
                  key={article.articleId}
                  onClick={() => onViewContent?.('article', article.articleId)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#faf8f6] dark:bg-[#11141b] border border-[#f0ede9] dark:border-[#1e222a] hover:border-blue-200 dark:hover:border-blue-800/50 transition-colors text-left group"
                >
                  <div
                    className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
                      article.completed
                        ? 'bg-emerald-100 dark:bg-emerald-900/30'
                        : 'bg-[#e1ddd8] dark:bg-[#262b35]'
                    )}
                  >
                    {article.completed ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Circle className="w-4 h-4 text-[#a7a39e] dark:text-[#5f6470]" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'flex-1 text-sm font-medium font-albert truncate group-hover:text-brand-accent transition-colors',
                      article.completed
                        ? 'text-emerald-700 dark:text-emerald-400 line-through'
                        : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                    )}
                  >
                    {article.title}
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#8c8c8c] dark:text-[#7d8190] opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
