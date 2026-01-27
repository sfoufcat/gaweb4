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
  FileQuestion,
  ChevronRight,
  Calendar,
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
  const [selectedIdx, setSelectedIdx] = useState<number>(() => {
    const todayIdx = days.findIndex(d => d.isToday);
    return todayIdx >= 0 ? todayIdx : 0;
  });

  if (days.length === 0) return null;

  const selectedDay = days[selectedIdx];

  // Helpers
  const getEvent = (id: string) => events.find(e => e.id === id);
  const getCourse = (id: string) => courses.find(c => c.id === id);
  const getArticle = (id: string) => articles.find(a => a.id === id);
  const getDownload = (id: string) => downloads.find(d => d.id === id);
  const getLink = (id: string) => links.find(l => l.id === id);

  const hasResources = (day: WeeklyContentResponse['days'][0]) =>
    (day.linkedEventIds?.length ?? 0) > 0 ||
    (day.linkedCourseIds?.length ?? 0) > 0 ||
    (day.linkedArticleIds?.length ?? 0) > 0 ||
    (day.linkedDownloadIds?.length ?? 0) > 0 ||
    (day.linkedLinkIds?.length ?? 0) > 0 ||
    (day.linkedQuestionnaireIds?.length ?? 0) > 0;

  const hasContent = selectedDay.tasks.length > 0 || hasResources(selectedDay);

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
            const hasItems = day.tasks.length > 0 || hasResources(day);

            return (
              <button
                key={day.dayIndex}
                onClick={() => setSelectedIdx(idx)}
                className={`
                  flex-1 relative py-3.5 flex flex-col items-center gap-2
                  transition-all duration-200
                  ${day.isPast && !day.isToday ? 'opacity-40' : ''}
                `}
              >
                {/* Day name */}
                <span className={`
                  text-[10px] font-semibold uppercase tracking-wider
                  ${day.isToday
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
                    ${day.isToday
                      ? 'bg-brand-accent text-white'
                      : isSelected
                        ? 'bg-brand-accent/10 text-brand-accent'
                        : 'text-zinc-700 dark:text-zinc-300'
                    }
                  `}>
                    {dayNum}
                  </div>
                  {/* Content indicator */}
                  {hasItems && !day.isToday && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-accent/60" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Content area */}
        <div className="p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedIdx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              {hasContent ? (
                <div className="space-y-3">
                  {/* Tasks */}
                  {selectedDay.tasks.length > 0 && (
                    <div className="space-y-2">
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
                  {hasResources(selectedDay) && (
                    <div className="space-y-2">
                      {selectedDay.linkedEventIds?.map(eventId => {
                        const event = getEvent(eventId);
                        if (!event) return null;
                        return (
                          <ResourceCard
                            key={eventId}
                            icon={<Video className="w-4 h-4" />}
                            label={event.title}
                            sublabel={event.startTime}
                            href={`/discover/events/${eventId}`}
                            color="purple"
                          />
                        );
                      })}

                      {selectedDay.linkedCourseIds?.map(courseId => {
                        const course = getCourse(courseId);
                        if (!course) return null;
                        return (
                          <ResourceCard
                            key={courseId}
                            icon={<GraduationCap className="w-4 h-4" />}
                            label={course.title}
                            href={`/discover/courses/${courseId}${enrollmentId ? `?enrollmentId=${enrollmentId}` : ''}`}
                            color="blue"
                          />
                        );
                      })}

                      {selectedDay.linkedArticleIds?.map(articleId => {
                        const article = getArticle(articleId);
                        if (!article) return null;
                        return (
                          <ResourceCard
                            key={articleId}
                            icon={<BookOpen className="w-4 h-4" />}
                            label={article.title}
                            sublabel={article.readingTimeMinutes ? `${article.readingTimeMinutes} min read` : undefined}
                            href={`/discover/articles/${articleId}`}
                            color="green"
                          />
                        );
                      })}

                      {selectedDay.linkedDownloadIds?.map(downloadId => {
                        const download = getDownload(downloadId);
                        if (!download) return null;
                        return (
                          <ResourceCard
                            key={downloadId}
                            icon={<Download className="w-4 h-4" />}
                            label={download.title}
                            href={download.fileUrl}
                            external
                            color="amber"
                          />
                        );
                      })}

                      {selectedDay.linkedLinkIds?.map(linkId => {
                        const link = getLink(linkId);
                        if (!link) return null;
                        return (
                          <ResourceCard
                            key={linkId}
                            icon={<Link2 className="w-4 h-4" />}
                            label={link.title}
                            href={link.url}
                            external
                            color="slate"
                          />
                        );
                      })}

                      {selectedDay.linkedQuestionnaireIds?.map(qId => (
                        <ResourceCard
                          key={qId}
                          icon={<FileQuestion className="w-4 h-4" />}
                          label="Questionnaire"
                          href={`/q/${qId}`}
                          color="pink"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    No tasks scheduled
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
        w-full flex items-center gap-3 py-2.5 text-left
        transition-all duration-200 group
        ${onToggle ? 'cursor-pointer' : 'cursor-default'}
      `}
    >
      <div className={`
        w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0
        transition-all duration-200
        ${isCompleted
          ? 'bg-brand-accent text-white'
          : 'border-2 border-zinc-300 dark:border-zinc-600 group-hover:border-brand-accent/50'
        }
      `}>
        {isCompleted && (
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6L5 8.5L9.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <span className={`
        text-[15px] leading-snug flex-1
        ${isCompleted
          ? 'text-zinc-400 dark:text-zinc-500 line-through'
          : 'text-zinc-800 dark:text-zinc-100'
        }
      `}>
        {task.label}
      </span>
    </button>
  );
}

const colorMap = {
  purple: {
    bg: 'bg-violet-50/80 dark:bg-violet-950/30 hover:bg-violet-100/80 dark:hover:bg-violet-950/50',
    icon: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    text: 'text-violet-900 dark:text-violet-100',
  },
  blue: {
    bg: 'bg-blue-50/80 dark:bg-blue-950/30 hover:bg-blue-100/80 dark:hover:bg-blue-950/50',
    icon: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    text: 'text-blue-900 dark:text-blue-100',
  },
  green: {
    bg: 'bg-emerald-50/80 dark:bg-emerald-950/30 hover:bg-emerald-100/80 dark:hover:bg-emerald-950/50',
    icon: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    text: 'text-emerald-900 dark:text-emerald-100',
  },
  amber: {
    bg: 'bg-amber-50/80 dark:bg-amber-950/30 hover:bg-amber-100/80 dark:hover:bg-amber-950/50',
    icon: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    text: 'text-amber-900 dark:text-amber-100',
  },
  slate: {
    bg: 'bg-slate-50/80 dark:bg-slate-800/30 hover:bg-slate-100/80 dark:hover:bg-slate-800/50',
    icon: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
    text: 'text-slate-900 dark:text-slate-100',
  },
  pink: {
    bg: 'bg-pink-50/80 dark:bg-pink-950/30 hover:bg-pink-100/80 dark:hover:bg-pink-950/50',
    icon: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
    text: 'text-pink-900 dark:text-pink-100',
  },
};

function ResourceCard({
  icon,
  label,
  sublabel,
  href,
  external,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  href: string;
  external?: boolean;
  color: keyof typeof colorMap;
}) {
  const colors = colorMap[color];
  const Component = external ? 'a' : Link;
  const props = external
    ? { href, target: '_blank', rel: 'noopener noreferrer' }
    : { href };

  return (
    <Component
      {...props}
      className={`
        flex items-center gap-3 p-3 rounded-xl
        transition-all duration-200 active:scale-[0.98]
        border border-transparent hover:border-zinc-200/50 dark:hover:border-zinc-700/50
        ${colors.bg}
      `}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors.icon}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-medium truncate ${colors.text}`}>
          {label}
        </p>
        {sublabel && (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {sublabel}
          </p>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 flex-shrink-0 opacity-60" />
    </Component>
  );
}
