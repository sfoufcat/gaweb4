'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Circle,
  Calendar,
  Phone,
  Repeat,
  BookOpen,
  FileText,
  Download,
  ExternalLink,
  CheckCircle2,
  Clock,
  Video,
  FileQuestion,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  ProgramDay,
  ProgramInstanceDay,
  ProgramTaskTemplate,
  ProgramInstanceTask,
  ProgramHabitTemplate,
  ProgramInstanceWeek,
  ProgramWeek,
  UnifiedEvent,
  WeekResourceAssignment,
  ContentProgress,
  DayCourseAssignment,
} from '@/types';
import type { DiscoverCourse, DiscoverArticle } from '@/types/discover';
import {
  getResourcesForDay,
  getResourcesByType,
  getCallsForDay,
  getLessonsForDay,
} from '@/lib/program-utils-client';

// Accept either ProgramDay or ProgramInstanceDay
type DayData = ProgramDay | ProgramInstanceDay;
type TaskData = ProgramTaskTemplate | ProgramInstanceTask;

// Week type can be either template or instance (both have resourceAssignments)
type WeekData = ProgramWeek | ProgramInstanceWeek;

// Content completion data for showing "X/Y completed" badges
interface ContentCompletionData {
  completedCount: number;
  totalCount: number;
}

interface DayPreviewPopupProps {
  isOpen: boolean;
  onClose: () => void;
  dayNumber: number; // 1-based day number within the week
  day: DayData | null;
  habits?: ProgramHabitTemplate[]; // Program-level habits
  weekNumber: number;
  // New props for enhanced content display
  week?: WeekData;
  events?: UnifiedEvent[]; // All events for filtering
  calendarDate?: string; // ISO date (YYYY-MM-DD) for this day
  dayOfWeek?: number; // 1-7 for resource filtering
  // Resource lookups (pass actual content data)
  courses?: Record<string, DiscoverCourse>;
  articles?: Record<string, DiscoverArticle>;
  // Progress tracking
  contentProgress?: ContentProgress[];
  // Content completion data by resourceId (for showing "X/Y completed" badges)
  contentCompletion?: Map<string, ContentCompletionData>;
}

export function DayPreviewPopup({
  isOpen,
  onClose,
  dayNumber,
  day,
  habits = [],
  weekNumber,
  week,
  events = [],
  calendarDate,
  dayOfWeek,
  courses = {},
  articles = {},
  contentProgress = [],
  contentCompletion,
}: DayPreviewPopupProps) {
  const [mounted, setMounted] = useState(false);

  // Mount portal after initial render
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Get day's resources using helper
  const dayResources = useMemo(() => {
    if (!week || !dayOfWeek) return [];
    return getResourcesForDay(week, dayOfWeek);
  }, [week, dayOfWeek]);

  // Get day's calls using helper
  const dayCalls = useMemo(() => {
    if (!week || !calendarDate) return [];
    return getCallsForDay(week, calendarDate, events);
  }, [week, calendarDate, events]);

  // Filter resources by type
  // For courses, check both resourceAssignments (unified format) and courseAssignments (legacy format)
  const courseAssignments = useMemo(() => {
    const fromResources = getResourcesByType(dayResources, 'course');
    if (fromResources.length > 0) {
      return fromResources;
    }
    // Check if there are ANY course resources in the week (just not for this day)
    // If so, don't fall back to legacy format - the user is using the new format
    const allCourseResources = (week?.resourceAssignments || []).filter(
      (r) => r.resourceType === 'course'
    );
    if (allCourseResources.length > 0) {
      // Using new format but no courses for this specific day
      return [];
    }
    // Fallback: Convert week.courseAssignments (DayCourseAssignment[]) to WeekResourceAssignment format
    // These are week-level assignments (no day-specific tagging in legacy format)
    const legacyCourses = (week as ProgramWeek)?.courseAssignments || [];
    return legacyCourses.map((ca: DayCourseAssignment, index: number): WeekResourceAssignment => ({
      id: `legacy-course-${ca.courseId}`,
      resourceType: 'course',
      resourceId: ca.courseId,
      dayTag: 'week', // Legacy format doesn't have day tags, treat as week-level
      isRequired: false,
      order: index,
      moduleIds: ca.moduleIds,
      lessonIds: ca.lessonIds,
    }));
  }, [dayResources, week]);
  const articleAssignments = useMemo(
    () => getResourcesByType(dayResources, 'article'),
    [dayResources]
  );
  const downloadAssignments = useMemo(
    () => getResourcesByType(dayResources, 'download'),
    [dayResources]
  );
  const linkAssignments = useMemo(
    () => getResourcesByType(dayResources, 'link'),
    [dayResources]
  );
  const questionnaireAssignments = useMemo(
    () => getResourcesByType(dayResources, 'questionnaire'),
    [dayResources]
  );

  // Helper to check if content is completed
  const isContentCompleted = (
    contentType: string,
    contentId: string,
    lessonId?: string
  ): boolean => {
    return contentProgress.some(
      (p) =>
        p.contentType === contentType &&
        p.contentId === contentId &&
        (!lessonId || p.lessonId === lessonId) &&
        p.status === 'completed'
    );
  };

  // Format call time
  const formatCallTime = (dateTime: string): string => {
    try {
      const date = new Date(dateTime);
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '';
    }
  };

  if (!mounted || !day) return null;

  // Separate focus tasks from backlog
  const focusTasks = (day.tasks || []).filter((t) => t.isPrimary !== false);
  const backlogTasks = (day.tasks || []).filter((t) => t.isPrimary === false);

  // Get the source label for a task
  const getSourceLabel = (task: TaskData) => {
    const dayTag = 'dayTag' in task ? task.dayTag : undefined;
    if (dayTag === 'daily') return 'daily';
    if (dayTag === 'spread') return 'spread';
    if (typeof dayTag === 'number') return `day ${dayTag}`;
    return 'auto';
  };

  // Get day tag label for display
  const getDayTagLabel = (assignment: WeekResourceAssignment): string => {
    const tag = assignment.dayTag;
    if (tag === 'week') return 'week-level';
    if (tag === 'daily') return 'daily';
    if (typeof tag === 'number') {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return days[tag - 1] || `day ${tag}`;
    }
    return '';
  };

  const content = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
          {/* Backdrop - blurs the sidebar and content */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Popup - slides up on mobile, scales in on desktop */}
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{
              duration: 0.25,
              ease: [0.25, 0.1, 0.25, 1],
            }}
            className="relative w-full sm:max-w-md max-h-[85vh] sm:max-h-[80vh] overflow-hidden bg-white dark:bg-[#1e222a] rounded-t-2xl sm:rounded-2xl shadow-2xl border border-[#e1ddd8] dark:border-[#262b35]"
          >
            {/* Mobile drag handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[#d1cdc8] dark:bg-[#3a4150]" />
            </div>

            <div className="overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#e1ddd8]/60 dark:border-[#262b35]/60 bg-[#f7f5f3] dark:bg-[#11141b]">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-accent/10 text-brand-accent">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                      Day {dayNumber} Preview
                    </h3>
                    <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">
                      {weekNumber === 0 ? 'Onboarding' : weekNumber === -1 ? 'Closing' : `Week ${weekNumber}`} &middot; {day.title || `Day ${dayNumber}`}
                      {calendarDate && ` &middot; ${calendarDate}`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 text-[#8c8c8c] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] hover:bg-[#e1ddd8]/40 dark:hover:bg-[#262b35]/40 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
                {/* Focus Tasks */}
                <section>
                  <h4 className="text-xs font-semibold text-[#8c8c8c] dark:text-[#7d8190] uppercase tracking-wider mb-3 font-albert">
                    Focus Tasks
                  </h4>
                  {focusTasks.length === 0 ? (
                    <p className="text-sm text-[#a7a39e] dark:text-[#7d8190] italic">
                      No focus tasks for this day
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {focusTasks.map((task, idx) => (
                        <div
                          key={task.id || idx}
                          className="flex items-start gap-3 p-3 bg-[#f7f5f3] dark:bg-[#11141b] rounded-xl"
                        >
                          <Circle className="w-4 h-4 text-[#c4c0bb] dark:text-[#4a4f5c] mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                              {task.label}
                            </p>
                            <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-0.5">
                              {getSourceLabel(task)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Scheduled Calls */}
                {dayCalls.length > 0 && (
                  <section>
                    <h4 className="text-xs font-semibold text-[#8c8c8c] dark:text-[#7d8190] uppercase tracking-wider mb-3 font-albert">
                      Scheduled Calls
                    </h4>
                    <div className="space-y-2">
                      {dayCalls.map((call) => (
                        <div
                          key={call.id}
                          className="flex items-center gap-3 p-3 bg-brand-accent/5 rounded-xl border border-brand-accent/20"
                        >
                          <Phone className="w-4 h-4 text-brand-accent flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                              {call.title}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Clock className="w-3 h-3 text-[#a7a39e] dark:text-[#7d8190]" />
                              <p className="text-xs text-[#a7a39e] dark:text-[#7d8190]">
                                {formatCallTime(call.startDateTime)}
                                {call.durationMinutes && ` · ${call.durationMinutes} min`}
                              </p>
                            </div>
                          </div>
                          {call.callSummaryId && (
                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Legacy Sessions placeholder (fallback if no week data) */}
                {!week &&
                  (() => {
                    const eventCount =
                      'linkedEventIds' in day && day.linkedEventIds
                        ? day.linkedEventIds.length
                        : 'scheduledItems' in day && day.scheduledItems
                          ? day.scheduledItems.length
                          : 0;
                    if (eventCount === 0) return null;
                    return (
                      <section>
                        <h4 className="text-xs font-semibold text-[#8c8c8c] dark:text-[#7d8190] uppercase tracking-wider mb-3 font-albert">
                          Sessions
                        </h4>
                        <div className="flex items-center gap-3 p-3 bg-brand-accent/5 rounded-xl border border-brand-accent/20">
                          <Phone className="w-4 h-4 text-brand-accent flex-shrink-0" />
                          <p className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                            {eventCount} scheduled session{eventCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </section>
                    );
                  })()}

                {/* Courses */}
                {courseAssignments.length > 0 && (
                  <section>
                    <h4 className="text-xs font-semibold text-[#8c8c8c] dark:text-[#7d8190] uppercase tracking-wider mb-3 font-albert">
                      Courses
                    </h4>
                    <div className="space-y-2">
                      {courseAssignments.map((assignment) => {
                        const course = courses[assignment.resourceId];
                        const completion = contentCompletion?.get(assignment.resourceId);
                        const completed = completion
                          ? completion.completedCount === completion.totalCount && completion.totalCount > 0
                          : isContentCompleted('course', assignment.resourceId);

                        // Get lessons for this specific day (if using spread or specific days)
                        const lessonsForDay = dayOfWeek && course
                          ? getLessonsForDay(assignment, dayOfWeek, course)
                          : [];
                        const hasLessonMapping = assignment.lessonDayMapping && Object.keys(assignment.lessonDayMapping).length > 0;
                        const isWeekLevel = assignment.dayTag === 'week';

                        return (
                          <div
                            key={assignment.id}
                            className="flex items-start gap-3 p-3 bg-[#f7f5f3] dark:bg-[#11141b] rounded-xl"
                          >
                            <Video className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                                {assignment.title || course?.title || 'Course'}
                              </p>
                              {/* Show specific lessons for this day */}
                              {hasLessonMapping && lessonsForDay.length > 0 ? (
                                <div className="mt-1.5 space-y-1">
                                  {lessonsForDay.map((lesson) => (
                                    <p key={lesson.id} className="text-xs text-[#6b6560] dark:text-[#9ca3af] flex items-center gap-1.5">
                                      <span className="w-1 h-1 rounded-full bg-purple-400 flex-shrink-0" />
                                      {lesson.title}
                                    </p>
                                  ))}
                                </div>
                              ) : isWeekLevel ? (
                                <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-0.5">
                                  Self-paced
                                  {assignment.isRequired && ' · Required'}
                                </p>
                              ) : (
                                <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-0.5">
                                  {getDayTagLabel(assignment)}
                                  {assignment.isRequired && ' · Required'}
                                </p>
                              )}
                            </div>
                            {/* Completion badge or checkmark */}
                            {completion && completion.totalCount > 0 ? (
                              <span
                                className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                                  completion.completedCount === completion.totalCount
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                    : completion.completedCount > 0
                                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                    : 'bg-[#f3f1ef] dark:bg-[#262b35] text-[#8c8c8c] dark:text-[#7d8190]'
                                }`}
                              >
                                {completion.completedCount}/{completion.totalCount}
                              </span>
                            ) : completed ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Articles */}
                {articleAssignments.length > 0 && (
                  <section>
                    <h4 className="text-xs font-semibold text-[#8c8c8c] dark:text-[#7d8190] uppercase tracking-wider mb-3 font-albert">
                      Articles
                    </h4>
                    <div className="space-y-2">
                      {articleAssignments.map((assignment) => {
                        const article = articles[assignment.resourceId];
                        const completion = contentCompletion?.get(assignment.resourceId);
                        const completed = completion
                          ? completion.completedCount === completion.totalCount && completion.totalCount > 0
                          : isContentCompleted('article', assignment.resourceId);
                        return (
                          <div
                            key={assignment.id}
                            className="flex items-start gap-3 p-3 bg-[#f7f5f3] dark:bg-[#11141b] rounded-xl"
                          >
                            <FileText className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                                {assignment.title || article?.title || 'Article'}
                              </p>
                              <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-0.5">
                                {getDayTagLabel(assignment)}
                                {assignment.isRequired && ' · Required'}
                              </p>
                            </div>
                            {/* Completion badge or checkmark */}
                            {completion && completion.totalCount > 0 ? (
                              <span
                                className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                                  completion.completedCount === completion.totalCount
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                    : 'bg-[#f3f1ef] dark:bg-[#262b35] text-[#8c8c8c] dark:text-[#7d8190]'
                                }`}
                              >
                                {completion.completedCount}/{completion.totalCount}
                              </span>
                            ) : completed ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Downloads */}
                {downloadAssignments.length > 0 && (
                  <section>
                    <h4 className="text-xs font-semibold text-[#8c8c8c] dark:text-[#7d8190] uppercase tracking-wider mb-3 font-albert">
                      Downloads
                    </h4>
                    <div className="space-y-2">
                      {downloadAssignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          className="flex items-center gap-3 p-3 bg-[#f7f5f3] dark:bg-[#11141b] rounded-xl"
                        >
                          <Download className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                              {assignment.title || 'Download'}
                            </p>
                            <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-0.5">
                              {getDayTagLabel(assignment)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Links */}
                {linkAssignments.length > 0 && (
                  <section>
                    <h4 className="text-xs font-semibold text-[#8c8c8c] dark:text-[#7d8190] uppercase tracking-wider mb-3 font-albert">
                      Links
                    </h4>
                    <div className="space-y-2">
                      {linkAssignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          className="flex items-center gap-3 p-3 bg-[#f7f5f3] dark:bg-[#11141b] rounded-xl"
                        >
                          <ExternalLink className="w-4 h-4 text-orange-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                              {assignment.title || 'Link'}
                            </p>
                            <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-0.5">
                              {getDayTagLabel(assignment)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Forms/Questionnaires */}
                {questionnaireAssignments.length > 0 && (
                  <section>
                    <h4 className="text-xs font-semibold text-[#8c8c8c] dark:text-[#7d8190] uppercase tracking-wider mb-3 font-albert">
                      Forms
                    </h4>
                    <div className="space-y-2">
                      {questionnaireAssignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          className="flex items-center gap-3 p-3 bg-[#f7f5f3] dark:bg-[#11141b] rounded-xl"
                        >
                          <FileQuestion className="w-4 h-4 text-pink-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                              {assignment.title || 'Form'}
                            </p>
                            <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-0.5">
                              {getDayTagLabel(assignment)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Habits */}
                {habits.length > 0 && (
                  <section>
                    <h4 className="text-xs font-semibold text-[#8c8c8c] dark:text-[#7d8190] uppercase tracking-wider mb-3 font-albert">
                      Habits
                    </h4>
                    <div className="space-y-2">
                      {habits.map((habit, idx) => (
                        <div
                          key={`habit-${idx}`}
                          className="flex items-center gap-3 p-3 bg-[#f7f5f3] dark:bg-[#11141b] rounded-xl"
                        >
                          <Repeat className="w-4 h-4 text-brand-accent flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                              {habit.title}
                            </p>
                            {habit.frequency && (
                              <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-0.5">
                                {habit.frequency}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Backlog */}
                {backlogTasks.length > 0 && (
                  <section>
                    <h4 className="text-xs font-semibold text-[#8c8c8c] dark:text-[#7d8190] uppercase tracking-wider mb-3 font-albert">
                      Backlog
                    </h4>
                    <div className="space-y-2">
                      {backlogTasks.map((task, idx) => (
                        <div
                          key={task.id || idx}
                          className="flex items-start gap-3 p-3 bg-[#f7f5f3]/60 dark:bg-[#11141b]/60 rounded-xl opacity-70"
                        >
                          <Circle className="w-4 h-4 text-[#c4c0bb] dark:text-[#4a4f5c] mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                            {task.label}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Day prompt if exists */}
                {day.dailyPrompt && (
                  <section>
                    <h4 className="text-xs font-semibold text-[#8c8c8c] dark:text-[#7d8190] uppercase tracking-wider mb-3 font-albert">
                      Day Prompt
                    </h4>
                    <div className="p-3 bg-[#f7f5f3] dark:bg-[#11141b] rounded-xl">
                      <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert whitespace-pre-wrap">
                        {day.dailyPrompt}
                      </p>
                    </div>
                  </section>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3 border-t border-[#e1ddd8]/60 dark:border-[#262b35]/60 bg-[#f7f5f3]/50 dark:bg-[#11141b]/50">
                <p className="text-xs text-center text-[#a7a39e] dark:text-[#7d8190] font-albert">
                  This is a preview of the computed day. Edit tasks in the Week Editor.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  // Use portal to render at document body level
  return createPortal(content, document.body);
}
