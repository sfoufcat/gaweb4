'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  BookOpen,
  GraduationCap,
  Video,
  Download,
  Link2,
  ClipboardList,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import type { WeeklyContentResponse } from '@/hooks/useProgramWeeklyContent';
import type { ProgramTaskTemplate, WeekResourceAssignment } from '@/types';
import { getResourcesForDay, getLessonsForDay } from '@/lib/program-utils-client';

interface ProgramScheduleProps {
  days: WeeklyContentResponse['days'];
  week: WeeklyContentResponse['week'];
  resourceAssignments: WeekResourceAssignment[];
  events: WeeklyContentResponse['events'];
  courses: WeeklyContentResponse['courses'];
  articles: WeeklyContentResponse['articles'];
  downloads: WeeklyContentResponse['downloads'];
  links: WeeklyContentResponse['links'];
  enrollmentId?: string;
  onTaskToggle?: (taskId: string, dayIndex: number, completed: boolean) => void;
}

export function ProgramSchedule({
  days,
  week,
  resourceAssignments,
  events,
  courses,
  articles,
  downloads,
  links,
  enrollmentId,
  onTaskToggle,
}: ProgramScheduleProps) {
  // Partial week info - which days are active (not blurred)
  // actualStartDayOfWeek: 1=Mon, 2=Tue, etc. (>1 means partial start)
  // actualEndDayOfWeek: 5=Fri, etc. (<5 means partial end for 5-day programs)
  const actualStartDayOfWeek = week?.actualStartDayOfWeek ?? 1;
  const actualEndDayOfWeek = week?.actualEndDayOfWeek ?? 5;

  // Find first active day for default selection
  const [selectedIdx, setSelectedIdx] = useState<number>(() => {
    const todayIdx = days.findIndex(d => d.isToday);
    if (todayIdx >= 0) return todayIdx;
    // If no today, select first active day (respecting partial week)
    const firstActiveIdx = actualStartDayOfWeek - 1;
    return Math.max(0, firstActiveIdx);
  });

  if (days.length === 0) return null;

  const selectedDay = days[selectedIdx];

  // Helpers
  const getEvent = (id: string) => events.find(e => e.id === id);
  const getCourse = (id: string) => courses.find(c => c.id === id);
  const getArticle = (id: string) => articles.find(a => a.id === id);
  const getDownload = (id: string) => downloads.find(d => d.id === id);
  const getLink = (id: string) => links.find(l => l.id === id);

  // Check legacy linked resource IDs (backward compat)
  const hasLinkedResources = (day: WeeklyContentResponse['days'][0]) =>
    (day.linkedEventIds?.length ?? 0) > 0 ||
    (day.linkedCourseIds?.length ?? 0) > 0 ||
    (day.linkedArticleIds?.length ?? 0) > 0 ||
    (day.linkedDownloadIds?.length ?? 0) > 0 ||
    (day.linkedLinkIds?.length ?? 0) > 0 ||
    (day.linkedQuestionnaireIds?.length ?? 0) > 0;

  // Check resourceAssignments for the selected day (new cadence-based system)
  const selectedDayOfWeek = selectedDay.dayIndex;
  const selectedDayResources = getResourcesForDay({ resourceAssignments }, selectedDayOfWeek);
  const hasAssignedResources = selectedDayResources.length > 0;

  const hasContent = selectedDay.tasks.length > 0 || hasLinkedResources(selectedDay) || hasAssignedResources;

  // Get month name for header
  const selectedDate = selectedDay.calendarDate ? new Date(selectedDay.calendarDate) : new Date();
  const monthYear = selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4">
      {/* Header with month */}
      <div className="flex items-center justify-between">
        <h2 className="font-albert text-xl font-semibold text-text-primary dark:text-white tracking-tight">
          Schedule
        </h2>
        <div className="flex items-center gap-1.5 text-sm text-text-muted dark:text-zinc-400">
          <Calendar className="w-4 h-4" />
          <span>{monthYear}</span>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/60 dark:border-zinc-800 shadow-sm overflow-hidden">
        {/* Day selector row */}
        <div className="flex border-b border-zinc-100 dark:border-zinc-800/80">
          {days.slice(0, 7).map((day, idx) => {
            const isSelected = idx === selectedIdx;
            const date = day.calendarDate ? new Date(day.calendarDate) : null;
            const dayNum = date?.getDate() || '';
            const dayName = day.isToday ? 'Today' : day.dayName.slice(0, 3);
            // Check both legacy linked resources and new resourceAssignments for content indicator
            const dayOfWeek = day.dayIndex;
            const dayAssignedResources = getResourcesForDay({ resourceAssignments }, dayOfWeek);
            const hasItems = day.tasks.length > 0 || hasLinkedResources(day) || dayAssignedResources.length > 0;
            
            // Check if this day is inactive (outside the partial week range)
            // day.dayIndex is 1-based within the week (1=Mon, 2=Tue, etc.)
            const isInactive = day.dayIndex < actualStartDayOfWeek || day.dayIndex > actualEndDayOfWeek;

            return (
              <button
                key={day.dayIndex}
                onClick={() => !isInactive && setSelectedIdx(idx)}
                disabled={isInactive}
                className={`
                  flex-1 relative py-3.5 flex flex-col items-center gap-2
                  transition-all duration-200
                  ${isInactive ? 'opacity-30 cursor-not-allowed' : ''}
                  ${!isInactive && day.isPast && !day.isToday ? 'opacity-40' : ''}
                `}
              >
                {/* Day name */}
                <span className={`
                  text-[10px] font-semibold uppercase tracking-wider
                  ${isInactive
                    ? 'text-zinc-300 dark:text-zinc-600'
                    : day.isToday
                      ? 'text-brand-accent'
                      : 'text-zinc-400 dark:text-zinc-500'
                  }
                `}>
                  {dayName}
                </span>

                {/* Date number */}
                <div className="relative">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    text-[16px] font-semibold transition-all duration-200
                    ${isInactive
                      ? 'text-zinc-300 dark:text-zinc-600'
                      : day.isToday
                        ? 'bg-brand-accent text-white'
                        : isSelected
                          ? 'bg-brand-accent/20 dark:bg-brand-accent/25 text-brand-accent'
                          : 'text-zinc-700 dark:text-zinc-300'
                    }
                  `}>
                    {dayNum}
                  </div>
                  {/* Content indicator (only when not selected) */}
                  {hasItems && !day.isToday && !isInactive && !isSelected && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-accent/50" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Content area */}
        <div className="px-5 py-4 min-h-[120px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedIdx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              {hasContent ? (
                <div>
                  {/* Tasks */}
                  {selectedDay.tasks.length > 0 && (
                    <div>
                      {selectedDay.tasks.map((task, i) => (
                        <TaskItem
                          key={task.id || i}
                          task={task}
                          dayIndex={selectedDay.dayIndex}
                          onToggle={onTaskToggle}
                        />
                      ))}
                    </div>
                  )}

                  {/* Resources */}
                  {(hasLinkedResources(selectedDay) || hasAssignedResources) && (
                    <div className={selectedDay.tasks.length > 0 ? "mt-6" : ""}>
                      <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-2">
                        Resources
                      </p>
                    <div className="-space-y-1">
                      {selectedDay.linkedEventIds?.map(eventId => {
                        const event = getEvent(eventId);
                        if (!event) return null;
                        return (
                          <ResourceCard
                            key={eventId}
                            icon={<Video className="w-4 h-4 text-brand-accent" />}
                            label={event.title}
                            sublabel={event.startTime}
                            href={`/discover/events/${eventId}`}
                          />
                        );
                      })}

                      {/* Use resourceAssignments if available, fallback to linkedCourseIds */}
                      {(() => {
                        const courseAssignments = selectedDayResources.filter(r => r.resourceType === 'course');

                        // If we have resourceAssignments, use them (shows specific lessons)
                        if (courseAssignments.length > 0) {
                          return courseAssignments.map(assignment => {
                            const course = getCourse(assignment.resourceId);
                            if (!course) return null;

                            // Get lessons for this specific day
                            const lessonsForDay = getLessonsForDay(assignment, selectedDayOfWeek, course);
                            const hasLessons = lessonsForDay.length > 0;

                            // Build URL - link to first lesson if lessons exist for this day
                            const baseUrl = hasLessons
                              ? `/discover/courses/${assignment.resourceId}/lessons/${lessonsForDay[0].id}`
                              : `/discover/courses/${assignment.resourceId}`;
                            const courseHref = enrollmentId ? `${baseUrl}?enrollmentId=${enrollmentId}` : baseUrl;

                            return (
                              <ResourceCard
                                key={assignment.id}
                                icon={<GraduationCap className="w-4 h-4 text-brand-accent" />}
                                label={course.title}
                                sublabel={hasLessons ? `${lessonsForDay.length} lesson${lessonsForDay.length > 1 ? 's' : ''} today` : undefined}
                                href={courseHref}
                              />
                            );
                          });
                        }

                        // Fallback to legacy linkedCourseIds
                        return selectedDay.linkedCourseIds?.map(courseId => {
                          const course = getCourse(courseId);
                          if (!course) return null;
                          return (
                            <ResourceCard
                              key={courseId}
                              icon={<GraduationCap className="w-4 h-4 text-brand-accent" />}
                              label={course.title}
                              href={`/discover/courses/${courseId}${enrollmentId ? `?enrollmentId=${enrollmentId}` : ''}`}
                            />
                          );
                        });
                      })()}

                      {/* Articles - use resourceAssignments, fallback to linkedArticleIds */}
                      {(() => {
                        const articleAssignments = selectedDayResources.filter(r => r.resourceType === 'article');
                        if (articleAssignments.length > 0) {
                          return articleAssignments.map(assignment => {
                            const article = getArticle(assignment.resourceId);
                            if (!article) return null;
                            return (
                              <ResourceCard
                                key={assignment.id}
                                icon={<BookOpen className="w-4 h-4 text-brand-accent" />}
                                label={article.title}
                                sublabel={article.readingTimeMinutes ? `${article.readingTimeMinutes} min read` : undefined}
                                href={`/discover/articles/${assignment.resourceId}`}
                              />
                            );
                          });
                        }
                        // Fallback to legacy linkedArticleIds
                        return selectedDay.linkedArticleIds?.map(articleId => {
                          const article = getArticle(articleId);
                          if (!article) return null;
                          return (
                            <ResourceCard
                              key={articleId}
                              icon={<BookOpen className="w-4 h-4 text-brand-accent" />}
                              label={article.title}
                              sublabel={article.readingTimeMinutes ? `${article.readingTimeMinutes} min read` : undefined}
                              href={`/discover/articles/${articleId}`}
                            />
                          );
                        });
                      })()}

                      {/* Downloads - use resourceAssignments, fallback to linkedDownloadIds */}
                      {(() => {
                        const downloadAssignments = selectedDayResources.filter(r => r.resourceType === 'download');
                        if (downloadAssignments.length > 0) {
                          return downloadAssignments.map(assignment => {
                            const download = getDownload(assignment.resourceId);
                            if (!download) return null;
                            return (
                              <ResourceCard
                                key={assignment.id}
                                icon={<Download className="w-4 h-4 text-brand-accent" />}
                                label={download.title}
                                href={download.fileUrl}
                                external
                              />
                            );
                          });
                        }
                        // Fallback to legacy linkedDownloadIds
                        return selectedDay.linkedDownloadIds?.map(downloadId => {
                          const download = getDownload(downloadId);
                          if (!download) return null;
                          return (
                            <ResourceCard
                              key={downloadId}
                              icon={<Download className="w-4 h-4 text-brand-accent" />}
                              label={download.title}
                              href={download.fileUrl}
                              external
                            />
                          );
                        });
                      })()}

                      {/* Links - use resourceAssignments, fallback to linkedLinkIds */}
                      {(() => {
                        const linkAssignments = selectedDayResources.filter(r => r.resourceType === 'link');
                        if (linkAssignments.length > 0) {
                          return linkAssignments.map(assignment => {
                            const link = getLink(assignment.resourceId);
                            if (!link) return null;
                            return (
                              <ResourceCard
                                key={assignment.id}
                                icon={<Link2 className="w-4 h-4 text-brand-accent" />}
                                label={link.title}
                                href={link.url}
                                external
                              />
                            );
                          });
                        }
                        // Fallback to legacy linkedLinkIds
                        return selectedDay.linkedLinkIds?.map(linkId => {
                          const link = getLink(linkId);
                          if (!link) return null;
                          return (
                            <ResourceCard
                              key={linkId}
                              icon={<Link2 className="w-4 h-4 text-brand-accent" />}
                              label={link.title}
                              href={link.url}
                              external
                            />
                          );
                        });
                      })()}

                      {/* Questionnaires - use resourceAssignments, fallback to linkedQuestionnaireIds */}
                      {(() => {
                        const questionnaireAssignments = selectedDayResources.filter(r => r.resourceType === 'questionnaire');
                        if (questionnaireAssignments.length > 0) {
                          return questionnaireAssignments.map(assignment => (
                            <ResourceCard
                              key={assignment.id}
                              icon={<ClipboardList className="w-4 h-4 text-brand-accent" />}
                              label={assignment.title || 'Questionnaire'}
                              href={`/q/${assignment.resourceId}`}
                            />
                          ));
                        }
                        // Fallback to legacy linkedQuestionnaireIds
                        return selectedDay.linkedQuestionnaireIds?.map(qId => (
                          <ResourceCard
                            key={qId}
                            icon={<ClipboardList className="w-4 h-4 text-brand-accent" />}
                            label="Questionnaire"
                            href={`/q/${qId}`}
                            />
                        ));
                      })()}
                    </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center min-h-[80px]">
                  <p className="text-sm text-zinc-400 dark:text-zinc-500">
                    No tasks for this day
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

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
        w-full flex items-center gap-3 py-2 text-left
        transition-all duration-200 group
        ${onToggle ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
      `}
    >
      {/* Checkbox matching DailyFocus style */}
      <div className={`
        w-6 h-6 rounded-md border flex items-center justify-center flex-shrink-0
        transition-all duration-300 bg-white dark:bg-[#181d26]
        ${isCompleted
          ? 'border-brand-accent'
          : 'border-[#e1ddd8] dark:border-[#262b35]'
        }
      `}>
        {isCompleted && (
          <div className="w-4 h-4 bg-brand-accent rounded-sm" />
        )}
      </div>
      <span className={`
        font-albert text-[16px] font-medium tracking-[-0.3px] leading-snug flex-1
        transition-all duration-300
        ${isCompleted
          ? 'text-text-muted dark:text-[#7d8190] line-through'
          : 'text-text-primary dark:text-[#f5f5f8]'
        }
      `}>
        {task.label}
      </span>
    </button>
  );
}

function ResourceCard({
  icon,
  label,
  sublabel,
  href,
  external,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  href: string;
  external?: boolean;
}) {
  const Component = external ? 'a' : Link;
  const props = external
    ? { href, target: '_blank', rel: 'noopener noreferrer' }
    : { href };

  return (
    <Component
      {...props}
      className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-zinc-100/80 dark:hover:bg-zinc-800/50 transition-colors group"
    >
      <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200 truncate">
          {label}
        </p>
        {sublabel && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            {sublabel}
          </p>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-zinc-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Component>
  );
}
