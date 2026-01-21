'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  Calendar,
  BookOpen,
  GraduationCap,
  Video,
  ChevronDown,
  Download,
  Link2,
  FileQuestion,
} from 'lucide-react';
import type { WeeklyContentResponse } from '@/hooks/useProgramWeeklyContent';
import type { ProgramTaskTemplate } from '@/types';

interface ProgramScheduleProps {
  days: WeeklyContentResponse['days'];
  events: WeeklyContentResponse['events'];
  courses: WeeklyContentResponse['courses'];
  articles: WeeklyContentResponse['articles'];
  downloads: WeeklyContentResponse['downloads'];
  links: WeeklyContentResponse['links'];
  enrollmentId?: string;
  onTaskToggle?: (taskId: string, dayIndex: number, completed: boolean) => void;
}

/**
 * ProgramSchedule Component
 *
 * A horizontal scrollable timeline showing the week's schedule.
 * Each day shows:
 * - Day name and date
 * - Tasks for that day
 * - Linked resources (courses, articles, events)
 *
 * Features:
 * - Horizontal scroll with momentum
 * - Today is highlighted
 * - Past days are subtly dimmed
 * - Resources show as compact pills/icons
 */
export function ProgramSchedule({
  days,
  events,
  courses,
  articles,
  downloads,
  links,
  enrollmentId,
  onTaskToggle,
}: ProgramScheduleProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  if (days.length === 0) return null;

  // Find index of today's card to scroll to
  const todayIndex = days.findIndex(d => d.isToday);

  // Helper to format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Get resource by ID helpers
  const getEvent = (id: string) => events.find(e => e.id === id);
  const getCourse = (id: string) => courses.find(c => c.id === id);
  const getArticle = (id: string) => articles.find(a => a.id === id);
  const getDownload = (id: string) => downloads.find(d => d.id === id);
  const getLink = (id: string) => links.find(l => l.id === id);

  return (
    <div className="space-y-4">
      <h2 className="font-albert text-[24px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3]">
        Schedule
      </h2>

      {/* Horizontal scroll container */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide scroll-smooth"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {days.map((day, idx) => {
          const isExpanded = expandedDay === day.dayIndex;
          const hasContent =
            day.tasks.length > 0 ||
            (day.linkedEventIds?.length ?? 0) > 0 ||
            (day.linkedCourseIds?.length ?? 0) > 0 ||
            (day.linkedArticleIds?.length ?? 0) > 0;

          // Count total items for the day
          const totalItems =
            day.tasks.length +
            (day.linkedEventIds?.length ?? 0) +
            (day.linkedCourseIds?.length ?? 0) +
            (day.linkedArticleIds?.length ?? 0) +
            (day.linkedDownloadIds?.length ?? 0) +
            (day.linkedLinkIds?.length ?? 0);

          return (
            <motion.div
              key={day.dayIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.05 }}
              className={`
                flex-shrink-0 w-[200px]
                bg-white dark:bg-[#171b22]
                rounded-[16px]
                border transition-all duration-200
                scroll-snap-align-start
                ${day.isToday
                  ? 'border-brand-accent shadow-[0_2px_12px_rgba(160,120,85,0.15)] dark:shadow-[0_2px_12px_rgba(184,137,106,0.2)]'
                  : 'border-transparent hover:border-[#e8e4df] dark:hover:border-[#2a303c]'
                }
                ${day.isPast && !day.isToday ? 'opacity-60' : ''}
              `}
              style={{ scrollSnapAlign: 'start' }}
            >
              {/* Day Header */}
              <button
                onClick={() => hasContent && setExpandedDay(isExpanded ? null : day.dayIndex)}
                disabled={!hasContent}
                className={`
                  w-full p-4 text-left
                  ${hasContent ? 'cursor-pointer' : 'cursor-default'}
                `}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`
                        font-albert text-[15px] font-semibold tracking-[-0.3px]
                        ${day.isToday
                          ? 'text-brand-accent'
                          : 'text-text-primary dark:text-[#f5f5f8]'
                        }
                      `}>
                        {day.isToday ? 'Today' : day.dayName}
                      </span>
                      {day.isToday && (
                        <span className="w-2 h-2 rounded-full bg-brand-accent animate-pulse" />
                      )}
                    </div>
                    <span className="font-sans text-[12px] text-text-muted dark:text-[#7d8190]">
                      {formatDate(day.calendarDate)}
                    </span>
                  </div>

                  {hasContent && (
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-4 h-4 text-text-muted dark:text-[#7d8190]" />
                    </motion.div>
                  )}
                </div>

                {/* Preview badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {day.tasks.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f3f1ef] dark:bg-[#262b35] text-[11px] font-medium text-text-secondary dark:text-[#b2b6c2]">
                      <Circle className="w-3 h-3" />
                      {day.tasks.length}
                    </span>
                  )}
                  {(day.linkedEventIds?.length ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-[11px] font-medium text-purple-600 dark:text-purple-400">
                      <Video className="w-3 h-3" />
                      {day.linkedEventIds?.length}
                    </span>
                  )}
                  {(day.linkedCourseIds?.length ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                      <GraduationCap className="w-3 h-3" />
                      {day.linkedCourseIds?.length}
                    </span>
                  )}
                  {(day.linkedArticleIds?.length ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-[11px] font-medium text-green-600 dark:text-green-400">
                      <BookOpen className="w-3 h-3" />
                      {day.linkedArticleIds?.length}
                    </span>
                  )}
                  {!hasContent && (
                    <span className="text-[12px] text-text-muted dark:text-[#7d8190] italic">
                      Rest day
                    </span>
                  )}
                </div>
              </button>

              {/* Expanded Content */}
              <AnimatePresence>
                {isExpanded && hasContent && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-0 space-y-3">
                      {/* Divider */}
                      <div className="h-px bg-[#e8e4df] dark:bg-[#262b35]" />

                      {/* Tasks */}
                      {day.tasks.length > 0 && (
                        <div className="space-y-2">
                          {day.tasks.map((task, i) => (
                            <TaskItem
                              key={task.id || i}
                              task={task}
                              dayIndex={day.dayIndex}
                              onToggle={onTaskToggle}
                            />
                          ))}
                        </div>
                      )}

                      {/* Events/Sessions */}
                      {day.linkedEventIds?.map(eventId => {
                        const event = getEvent(eventId);
                        if (!event) return null;
                        return (
                          <ResourceLink
                            key={eventId}
                            icon={<Video className="w-4 h-4" />}
                            label={event.title}
                            subLabel={event.startTime}
                            href={`/discover/events/${eventId}`}
                            colorClass="text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30"
                          />
                        );
                      })}

                      {/* Courses */}
                      {day.linkedCourseIds?.map(courseId => {
                        const course = getCourse(courseId);
                        if (!course) return null;
                        return (
                          <ResourceLink
                            key={courseId}
                            icon={<GraduationCap className="w-4 h-4" />}
                            label={course.title}
                            href={`/discover/courses/${courseId}${enrollmentId ? `?enrollmentId=${enrollmentId}` : ''}`}
                            colorClass="text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30"
                          />
                        );
                      })}

                      {/* Articles */}
                      {day.linkedArticleIds?.map(articleId => {
                        const article = getArticle(articleId);
                        if (!article) return null;
                        return (
                          <ResourceLink
                            key={articleId}
                            icon={<BookOpen className="w-4 h-4" />}
                            label={article.title}
                            subLabel={article.readingTimeMinutes ? `${article.readingTimeMinutes} min` : undefined}
                            href={`/discover/articles/${articleId}`}
                            colorClass="text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30"
                          />
                        );
                      })}

                      {/* Downloads */}
                      {day.linkedDownloadIds?.map(downloadId => {
                        const download = getDownload(downloadId);
                        if (!download) return null;
                        return (
                          <ResourceLink
                            key={downloadId}
                            icon={<Download className="w-4 h-4" />}
                            label={download.title}
                            href={download.fileUrl}
                            external
                            colorClass="text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30"
                          />
                        );
                      })}

                      {/* Links */}
                      {day.linkedLinkIds?.map(linkId => {
                        const link = getLink(linkId);
                        if (!link) return null;
                        return (
                          <ResourceLink
                            key={linkId}
                            icon={<Link2 className="w-4 h-4" />}
                            label={link.title}
                            href={link.url}
                            external
                            colorClass="text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/30"
                          />
                        );
                      })}

                      {/* Questionnaires */}
                      {day.linkedQuestionnaireIds?.map(qId => (
                        <ResourceLink
                          key={qId}
                          icon={<FileQuestion className="w-4 h-4" />}
                          label="Questionnaire"
                          href={`/q/${qId}`}
                          colorClass="text-pink-600 dark:text-pink-400 bg-pink-100 dark:bg-pink-900/30"
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// Task item component
function TaskItem({
  task,
  dayIndex,
  onToggle,
}: {
  task: ProgramTaskTemplate;
  dayIndex: number;
  onToggle?: (taskId: string, dayIndex: number, completed: boolean) => void;
}) {
  const isCompleted = task.completed || false;

  const handleClick = () => {
    if (task.id && onToggle) {
      onToggle(task.id, dayIndex, !isCompleted);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={!onToggle}
      className={`
        w-full flex items-start gap-2.5 text-left group
        ${onToggle ? 'cursor-pointer' : 'cursor-default'}
      `}
    >
      {isCompleted ? (
        <CheckCircle2 className="w-4 h-4 text-brand-accent flex-shrink-0 mt-0.5" />
      ) : (
        <Circle className={`
          w-4 h-4 flex-shrink-0 mt-0.5 transition-colors
          text-text-muted dark:text-[#7d8190]
          ${onToggle ? 'group-hover:text-brand-accent' : ''}
        `} />
      )}
      <span className={`
        font-sans text-[13px] leading-[1.4]
        ${isCompleted
          ? 'text-text-muted dark:text-[#7d8190] line-through'
          : 'text-text-secondary dark:text-[#b2b6c2]'
        }
      `}>
        {task.label}
      </span>
    </button>
  );
}

// Resource link component
function ResourceLink({
  icon,
  label,
  subLabel,
  href,
  external,
  colorClass,
}: {
  icon: React.ReactNode;
  label: string;
  subLabel?: string;
  href: string;
  external?: boolean;
  colorClass: string;
}) {
  const Component = external ? 'a' : Link;
  const props = external
    ? { href, target: '_blank', rel: 'noopener noreferrer' }
    : { href };

  return (
    <Component
      {...props}
      className={`
        flex items-center gap-2 p-2 rounded-lg
        transition-colors
        hover:bg-[#f3f1ef] dark:hover:bg-[#262b35]
      `}
    >
      <span className={`w-6 h-6 rounded-md flex items-center justify-center ${colorClass}`}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <span className="font-sans text-[13px] text-text-secondary dark:text-[#b2b6c2] truncate block">
          {label}
        </span>
        {subLabel && (
          <span className="font-sans text-[11px] text-text-muted dark:text-[#7d8190]">
            {subLabel}
          </span>
        )}
      </div>
    </Component>
  );
}
