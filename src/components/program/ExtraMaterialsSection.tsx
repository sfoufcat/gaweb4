'use client';

/**
 * ExtraMaterialsSection Component
 *
 * Displays additional content in tabbed format:
 * Courses, Articles, Downloads, Links
 */

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  FileText,
  Download,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import type {
  DiscoverCourse,
  DiscoverArticle,
  DiscoverDownload,
  DiscoverLink,
} from '@/types/discover';

interface ExtraMaterialsSectionProps {
  courses?: DiscoverCourse[];
  articles?: DiscoverArticle[];
  downloads?: DiscoverDownload[];
  links?: DiscoverLink[];
}

type TabType = 'courses' | 'articles' | 'downloads' | 'links';

export function ExtraMaterialsSection({
  courses = [],
  articles = [],
  downloads = [],
  links = [],
}: ExtraMaterialsSectionProps) {
  // Determine available tabs
  const tabs: { id: TabType; label: string; count: number; icon: React.ReactNode }[] = [];

  if (courses.length > 0) {
    tabs.push({
      id: 'courses',
      label: 'Courses',
      count: courses.length,
      icon: <BookOpen className="w-4 h-4" />,
    });
  }
  if (articles.length > 0) {
    tabs.push({
      id: 'articles',
      label: 'Articles',
      count: articles.length,
      icon: <FileText className="w-4 h-4" />,
    });
  }
  if (downloads.length > 0) {
    tabs.push({
      id: 'downloads',
      label: 'Downloads',
      count: downloads.length,
      icon: <Download className="w-4 h-4" />,
    });
  }
  if (links.length > 0) {
    tabs.push({
      id: 'links',
      label: 'Links',
      count: links.length,
      icon: <ExternalLink className="w-4 h-4" />,
    });
  }

  const [activeTab, setActiveTab] = useState<TabType>(tabs[0]?.id || 'courses');

  // If no content, don't render
  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h2 className="font-albert text-[24px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3]">
        Extra Materials
      </h2>

      {/* Tab Bar */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-full text-[14px] font-medium
              transition-colors shrink-0
              ${
                activeTab === tab.id
                  ? 'bg-brand-accent text-white'
                  : 'bg-[#f3f1ef] dark:bg-[#171b22] text-text-secondary dark:text-[#b2b6c2] hover:bg-[#e8e4df] dark:hover:bg-[#262b35]'
              }
            `}
          >
            {tab.icon}
            {tab.label}
            <span className="text-[12px] opacity-70">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {/* Courses */}
          {activeTab === 'courses' && (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {courses.map((course) => (
                <Link
                  key={course.id}
                  href={`/discover/courses/${course.id}`}
                  className="flex-shrink-0 w-[200px] bg-white dark:bg-[#171b22] rounded-[16px] overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {/* Course Thumbnail */}
                  <div className="relative h-[100px] bg-[#f3f1ef] dark:bg-[#262b35]">
                    {course.coverImageUrl ? (
                      <Image
                        src={course.coverImageUrl}
                        alt={course.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen className="w-8 h-8 text-[#d4cfc9] dark:text-[#7d8190]" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <span className="font-sans text-[12px] text-text-muted dark:text-[#7d8190]">
                      {course.category || 'Course'}
                    </span>
                    <p className="font-albert text-[16px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] leading-[1.3] mt-1 line-clamp-2">
                      {course.title}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Articles */}
          {activeTab === 'articles' && (
            <div className="grid grid-cols-2 gap-3">
              {articles.slice(0, 4).map((article) => (
                <Link
                  key={article.id}
                  href={`/discover/articles/${article.id}`}
                  className="bg-white dark:bg-[#171b22] rounded-[16px] overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Article Thumbnail */}
                  <div className="relative h-[80px] bg-[#f3f1ef] dark:bg-[#262b35]">
                    {article.coverImageUrl ? (
                      <Image
                        src={article.coverImageUrl}
                        alt={article.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText className="w-6 h-6 text-[#d4cfc9] dark:text-[#7d8190]" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-albert text-[14px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.3px] leading-[1.3] line-clamp-2">
                      {article.title}
                    </p>
                    <p className="font-sans text-[11px] text-text-muted dark:text-[#7d8190] mt-1">
                      {article.authorName}
                      {article.readingTimeMinutes && ` · ${article.readingTimeMinutes} min`}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Downloads */}
          {activeTab === 'downloads' && (
            <div className="space-y-2">
              {downloads.map((download) => (
                <a
                  key={download.id}
                  href={download.fileUrl}
                  download
                  className="flex items-center gap-3 p-4 bg-white dark:bg-[#171b22] rounded-[12px] hover:bg-[#f9f8f7] dark:hover:bg-[#1a1f28] transition-colors group"
                >
                  <div className="w-10 h-10 rounded-[8px] bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                    <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-[15px] font-medium text-text-primary dark:text-[#f5f5f8] leading-[1.4]">
                      {download.title}
                    </p>
                    <p className="font-sans text-[12px] text-text-muted dark:text-[#7d8190] mt-0.5">
                      {download.fileType?.toUpperCase() || 'File'}
                      {download.fileSize && ` · ${formatFileSize(download.fileSize)}`}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#d4cfc9] dark:text-[#7d8190] group-hover:text-brand-accent transition-colors" />
                </a>
              ))}
            </div>
          )}

          {/* Links */}
          {activeTab === 'links' && (
            <div className="flex flex-wrap gap-2">
              {links.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#171b22] rounded-full border border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#f3f1ef] dark:hover:bg-[#1a1f28] transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-text-secondary dark:text-[#7d8190]" />
                  <span className="font-sans text-[14px] font-medium text-text-secondary dark:text-[#7d8190]">
                    {link.title}
                  </span>
                </a>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
