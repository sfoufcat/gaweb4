'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  BookOpen,
  GraduationCap,
  Download,
  Link2,
  ExternalLink,
  FileQuestion,
  Video,
} from 'lucide-react';
import type { WeeklyContentResponse } from '@/hooks/useProgramWeeklyContent';

interface WeeklyResourcesProps {
  courses: WeeklyContentResponse['courses'];
  articles: WeeklyContentResponse['articles'];
  downloads: WeeklyContentResponse['downloads'];
  links: WeeklyContentResponse['links'];
  events: WeeklyContentResponse['events'];
  enrollmentId?: string;
}

/**
 * WeeklyResources Component
 *
 * A consolidated resources section for the week.
 * Includes: Courses, Articles, Downloads, Links, Events
 *
 * Complements the Schedule:
 * - Schedule = when (timeline)
 * - Resources = what (materials)
 *
 * Uses horizontal scroll for courses and vertical cards for articles.
 */
export function WeeklyResources({
  courses,
  articles,
  downloads,
  links,
  events,
  enrollmentId,
}: WeeklyResourcesProps) {
  const hasContent =
    courses.length > 0 ||
    articles.length > 0 ||
    downloads.length > 0 ||
    links.length > 0 ||
    events.length > 0;

  if (!hasContent) return null;

  return (
    <div className="space-y-6">
      <h2 className="font-albert text-[24px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3]">
        Resources
      </h2>

      {/* Courses - Horizontal scroll */}
      {courses.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="font-sans text-[13px] font-medium text-text-muted dark:text-[#7d8190] uppercase tracking-wider">
              Courses
            </span>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {courses.map((course, idx) => (
              <Link
                key={course.id}
                href={`/discover/courses/${course.id}${enrollmentId ? `?enrollmentId=${enrollmentId}` : ''}`}
                className="flex-shrink-0 w-[200px] bg-white dark:bg-[#171b22] rounded-[16px] overflow-hidden hover:shadow-lg dark:hover:shadow-black/30 transition-shadow"
              >
                {/* Cover Image */}
                <div className="relative h-[100px] w-full bg-blue-50 dark:bg-blue-900/20">
                  {course.coverImageUrl ? (
                    <Image
                      src={course.coverImageUrl}
                      alt={course.title}
                      fill
                      className="object-cover"
                      sizes="200px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <GraduationCap className="w-8 h-8 text-blue-300 dark:text-blue-700" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-3">
                  <span className="font-sans text-[11px] text-text-muted dark:text-[#7d8190]">
                    {course.category || 'Course'}
                  </span>
                  <p className="font-albert text-[15px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.3px] leading-[1.3] mt-1 line-clamp-2">
                    {course.title}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* Articles - Vertical cards or horizontal scroll */}
      {articles.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="font-sans text-[13px] font-medium text-text-muted dark:text-[#7d8190] uppercase tracking-wider">
              Articles
            </span>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`/discover/articles/${article.id}`}
                className="flex-shrink-0 w-[200px] bg-white dark:bg-[#171b22] rounded-[16px] overflow-hidden hover:shadow-lg dark:hover:shadow-black/30 transition-shadow"
              >
                {/* Cover Image */}
                <div className="relative h-[100px] w-full bg-green-50 dark:bg-green-900/20">
                  {article.coverImageUrl ? (
                    <Image
                      src={article.coverImageUrl}
                      alt={article.title}
                      fill
                      className="object-cover"
                      sizes="200px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-8 h-8 text-green-300 dark:text-green-700" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-3">
                  <span className="font-sans text-[11px] text-text-muted dark:text-[#7d8190]">
                    {article.authorName}
                    {article.readingTimeMinutes && ` · ${article.readingTimeMinutes} min`}
                  </span>
                  <p className="font-albert text-[15px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.3px] leading-[1.3] mt-1 line-clamp-2">
                    {article.title}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* Events/Sessions */}
      {events.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="font-sans text-[13px] font-medium text-text-muted dark:text-[#7d8190] uppercase tracking-wider">
              Sessions
            </span>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/discover/events/${event.id}`}
                className="flex-shrink-0 w-[200px] bg-white dark:bg-[#171b22] rounded-[16px] p-4 hover:shadow-lg dark:hover:shadow-black/30 transition-shadow"
              >
                <span className="font-sans text-[11px] text-purple-600 dark:text-purple-400">
                  {event.date && new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {event.startTime && ` · ${event.startTime}`}
                </span>
                <p className="font-albert text-[15px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.3px] leading-[1.3] mt-2 line-clamp-2">
                  {event.title}
                </p>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* Downloads - Compact list */}
      {downloads.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="font-sans text-[13px] font-medium text-text-muted dark:text-[#7d8190] uppercase tracking-wider">
              Downloads
            </span>
          </div>

          <div className="space-y-2">
            {downloads.map((download) => (
              <a
                key={download.id}
                href={download.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-white dark:bg-[#171b22] rounded-[12px] hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] transition-colors"
              >
                <span className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Download className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </span>
                <div className="flex-1 min-w-0">
                  <span className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2] truncate block">
                    {download.title}
                  </span>
                  {download.fileType && (
                    <span className="font-sans text-[11px] text-text-muted dark:text-[#7d8190] uppercase">
                      {download.fileType}
                    </span>
                  )}
                </div>
                <ExternalLink className="w-4 h-4 text-text-muted dark:text-[#7d8190] flex-shrink-0" />
              </a>
            ))}
          </div>
        </motion.div>
      )}

      {/* Links - Pill chips */}
      {links.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <span className="font-sans text-[13px] font-medium text-text-muted dark:text-[#7d8190] uppercase tracking-wider">
              Links
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white dark:bg-[#171b22] rounded-full px-4 py-2 flex items-center gap-2 border border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-text-secondary dark:text-[#7d8190]" />
                <span className="font-sans text-[13px] font-medium text-text-secondary dark:text-[#b2b6c2]">
                  {link.title}
                </span>
              </a>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
