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

type ResourceType = 'course' | 'article' | 'download' | 'link' | 'event';

interface ResourceItem {
  id: string;
  type: ResourceType;
  title: string;
  href: string;
  external?: boolean;
  imageUrl?: string;
  subtitle?: string;
}

/**
 * WeeklyResources Component
 *
 * A unified resources section showing all resource types together.
 * Each resource displays:
 * - Type label badge (Course, Article, Download, Link, Event)
 * - Title
 * - Optional image for courses/articles
 *
 * Horizontal scroll for card-based resources, vertical for links/downloads.
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

  // Combine courses and articles into card-based resources
  const cardResources: ResourceItem[] = [
    ...courses.map(course => ({
      id: course.id,
      type: 'course' as ResourceType,
      title: course.title,
      href: `/discover/courses/${course.id}${enrollmentId ? `?enrollmentId=${enrollmentId}` : ''}`,
      imageUrl: course.coverImageUrl,
      subtitle: course.category,
    })),
    ...articles.map(article => ({
      id: article.id,
      type: 'article' as ResourceType,
      title: article.title,
      href: `/discover/articles/${article.id}`,
      imageUrl: article.coverImageUrl,
      subtitle: article.authorName + (article.readingTimeMinutes ? ` · ${article.readingTimeMinutes} min` : ''),
    })),
    ...events.map(event => ({
      id: event.id,
      type: 'event' as ResourceType,
      title: event.title,
      href: `/discover/events/${event.id}`,
      subtitle: event.date ? new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + (event.startTime ? ` · ${event.startTime}` : '') : undefined,
    })),
  ];

  // Combine downloads and links into list-based resources
  const listResources: ResourceItem[] = [
    ...downloads.map(download => ({
      id: download.id,
      type: 'download' as ResourceType,
      title: download.title,
      href: download.fileUrl,
      external: true,
      subtitle: download.fileType?.toUpperCase(),
    })),
    ...links.map(link => ({
      id: link.id,
      type: 'link' as ResourceType,
      title: link.title,
      href: link.url,
      external: true,
      subtitle: link.description,
    })),
  ];

  const getTypeConfig = (type: ResourceType) => {
    switch (type) {
      case 'course':
        return {
          label: 'Course',
          icon: GraduationCap,
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          textColor: 'text-blue-600 dark:text-blue-400',
        };
      case 'article':
        return {
          label: 'Article',
          icon: BookOpen,
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          textColor: 'text-green-600 dark:text-green-400',
        };
      case 'event':
        return {
          label: 'Session',
          icon: Video,
          bgColor: 'bg-purple-50 dark:bg-purple-900/20',
          textColor: 'text-purple-600 dark:text-purple-400',
        };
      case 'download':
        return {
          label: 'Download',
          icon: Download,
          bgColor: 'bg-amber-50 dark:bg-amber-900/20',
          textColor: 'text-amber-600 dark:text-amber-400',
        };
      case 'link':
        return {
          label: 'Link',
          icon: Link2,
          bgColor: 'bg-slate-50 dark:bg-slate-900/20',
          textColor: 'text-slate-600 dark:text-slate-400',
        };
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <h2 className="font-albert text-[24px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3]">
        Resources
      </h2>

      {/* Card-based resources (courses, articles, events) - horizontal scroll */}
      {cardResources.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {cardResources.map((resource) => {
            const config = getTypeConfig(resource.type);
            const Icon = config.icon;

            return (
              <Link
                key={`${resource.type}-${resource.id}`}
                href={resource.href}
                className="flex-shrink-0 w-[200px] bg-white dark:bg-[#171b22] rounded-[16px] overflow-hidden hover:shadow-lg dark:hover:shadow-black/30 transition-shadow"
              >
                {/* Cover Image or Icon Placeholder */}
                <div className={`relative h-[100px] w-full ${config.bgColor}`}>
                  {resource.imageUrl ? (
                    <Image
                      src={resource.imageUrl}
                      alt={resource.title}
                      fill
                      className="object-cover"
                      sizes="200px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon className={`w-8 h-8 ${config.textColor} opacity-50`} />
                    </div>
                  )}
                  {/* Type Badge */}
                  <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full ${config.bgColor} backdrop-blur-sm`}>
                    <span className={`font-sans text-[10px] font-semibold ${config.textColor} uppercase tracking-wide`}>
                      {config.label}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-3">
                  {resource.subtitle && (
                    <span className="font-sans text-[11px] text-text-muted dark:text-[#7d8190] block mb-1">
                      {resource.subtitle}
                    </span>
                  )}
                  <p className="font-albert text-[15px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.3px] leading-[1.3] line-clamp-2">
                    {resource.title}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* List-based resources (downloads, links) */}
      {listResources.length > 0 && (
        <div className="space-y-2">
          {listResources.map((resource) => {
            const config = getTypeConfig(resource.type);
            const Icon = config.icon;

            return (
              <a
                key={`${resource.type}-${resource.id}`}
                href={resource.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-white dark:bg-[#171b22] rounded-[12px] hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] transition-colors group"
              >
                <span className={`w-9 h-9 rounded-lg ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${config.textColor}`} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-sans text-[10px] font-semibold ${config.textColor} uppercase tracking-wide`}>
                      {config.label}
                    </span>
                    {resource.subtitle && (
                      <>
                        <span className="text-text-muted dark:text-[#7d8190]">·</span>
                        <span className="font-sans text-[11px] text-text-muted dark:text-[#7d8190]">
                          {resource.subtitle}
                        </span>
                      </>
                    )}
                  </div>
                  <span className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2] truncate block mt-0.5">
                    {resource.title}
                  </span>
                </div>
                <ExternalLink className="w-4 h-4 text-text-muted dark:text-[#7d8190] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
