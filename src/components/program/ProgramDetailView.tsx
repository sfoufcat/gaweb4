'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Users, User, Calendar, Clock, ChevronRight, BookOpen, FileText, ExternalLink, Download } from 'lucide-react';
import type { EnrolledProgramWithDetails } from '@/hooks/useMyPrograms';
import type { DiscoverCourse, DiscoverArticle, DiscoverEvent } from '@/types/discover';
import { CourseCard } from '@/components/discover/CourseCard';
import { ArticleCard } from '@/components/discover/ArticleCard';
import { EventCard } from '@/components/discover/EventCard';

/**
 * ProgramDetailView Component
 * 
 * Shows full details of a single enrolled program:
 * - Header with program info and progress
 * - Coach info
 * - Next session / upcoming events (for group programs)
 * - Program habits (3-day focus)
 * - Program content sections (courses, articles, downloads, links)
 */

interface ProgramDetailViewProps {
  program: EnrolledProgramWithDetails;
  onBack?: () => void;
  showBackButton?: boolean;
}

// Types for program-specific content
interface ProgramLink {
  id: string;
  title: string;
  url: string;
  description?: string;
}

interface ProgramDownload {
  id: string;
  title: string;
  fileUrl: string;
  fileType?: string;
  fileSize?: string;
}

interface ProgramContent {
  courses: DiscoverCourse[];
  articles: DiscoverArticle[];
  events: DiscoverEvent[];
  links: ProgramLink[];
  downloads: ProgramDownload[];
  isLoading: boolean;
}

export function ProgramDetailView({ 
  program: enrolled, 
  onBack,
  showBackButton = true,
}: ProgramDetailViewProps) {
  const router = useRouter();
  const { program, progress, cohort, enrollment } = enrolled;
  const isGroup = program.type === 'group';

  // Program-specific content
  const [content, setContent] = useState<ProgramContent>({
    courses: [],
    articles: [],
    events: [],
    links: [],
    downloads: [],
    isLoading: true,
  });

  // Fetch program-specific content
  useEffect(() => {
    const fetchContent = async () => {
      try {
        const response = await fetch(`/api/programs/${program.id}/content`);
        if (response.ok) {
          const data = await response.json();
          setContent({
            courses: data.courses || [],
            articles: data.articles || [],
            events: data.events || [],
            links: data.links || [],
            downloads: data.downloads || [],
            isLoading: false,
          });
        }
      } catch (error) {
        console.error('Error fetching program content:', error);
      } finally {
        setContent(prev => ({ ...prev, isLoading: false }));
      }
    };

    fetchContent();
  }, [program.id]);

  // Format date helper
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // Get upcoming events
  const upcomingEvents = content.events.filter(e => new Date(e.date) >= new Date());

  return (
    <div className="space-y-6">
      {/* Back Button */}
      {showBackButton && onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-text-secondary dark:text-[#7d8190] hover:text-text-primary dark:hover:text-[#f5f5f8] transition-colors mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-albert text-[16px] font-medium">Back to programs</span>
        </button>
      )}

      {/* Program Header Card */}
      <div className="bg-white dark:bg-[#171b22] rounded-[24px] overflow-hidden">
        {/* Cover Image */}
        <div className="relative h-[200px] w-full bg-[#f3f1ef] dark:bg-[#262b35]">
          {program.coverImageUrl ? (
            <Image
              src={program.coverImageUrl}
              alt={program.name}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {isGroup ? (
                <Users className="w-16 h-16 text-[#d4cfc9] dark:text-[#7d8190]" />
              ) : (
                <User className="w-16 h-16 text-[#d4cfc9] dark:text-[#7d8190]" />
              )}
            </div>
          )}

          {/* Progress overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-black/20">
            <div
              className="h-full bg-white dark:bg-[#f5f5f8] transition-all"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>

          {/* Program type badge */}
          <div className="absolute top-4 left-4">
            <div
              className={`rounded-full px-4 py-1.5 flex items-center gap-2 ${
                isGroup
                  ? 'bg-blue-500/90 backdrop-blur-sm'
                  : 'bg-purple-500/90 backdrop-blur-sm'
              }`}
            >
              {isGroup ? (
                <Users className="w-4 h-4 text-white" />
              ) : (
                <User className="w-4 h-4 text-white" />
              )}
              <span className="font-sans text-[14px] font-medium text-white">
                {isGroup ? 'Group Program' : '1:1 Coaching'}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Title */}
          <h1 className="font-albert text-[28px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.2] mb-2">
            {program.name}
          </h1>

          {/* Coach info */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#f3f1ef] dark:bg-[#262b35] overflow-hidden">
              {program.coachImageUrl ? (
                <Image
                  src={program.coachImageUrl}
                  alt={program.coachName}
                  width={40}
                  height={40}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="font-albert font-semibold text-sm text-text-secondary dark:text-[#7d8190]">
                    {program.coachName[0]}
                  </span>
                </div>
              )}
            </div>
            <div>
              <p className="font-albert text-[16px] font-medium text-text-primary dark:text-[#f5f5f8]">
                {program.coachName}
              </p>
              <p className="font-sans text-[13px] text-text-secondary dark:text-[#b2b6c2]">
                Your coach
              </p>
            </div>
          </div>

          {/* Progress Stats */}
          <div className="grid grid-cols-3 gap-4 py-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
            <div className="text-center">
              <p className="font-albert text-[24px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px]">
                {progress.currentDay}
              </p>
              <p className="font-sans text-[12px] text-text-secondary dark:text-[#b2b6c2]">
                Current Day
              </p>
            </div>
            <div className="text-center border-x border-[#e1ddd8] dark:border-[#262b35]">
              <p className="font-albert text-[24px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px]">
                {progress.totalDays}
              </p>
              <p className="font-sans text-[12px] text-text-secondary dark:text-[#b2b6c2]">
                Total Days
              </p>
            </div>
            <div className="text-center">
              <p className="font-albert text-[24px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px]">
                {progress.percentage}%
              </p>
              <p className="font-sans text-[12px] text-text-secondary dark:text-[#b2b6c2]">
                Complete
              </p>
            </div>
          </div>

          {/* Cohort info if applicable */}
          {cohort && (
            <div className="flex items-center gap-2 mt-4 py-3 px-4 bg-[#f3f1ef] dark:bg-[#11141b] rounded-[12px]">
              <Calendar className="w-4 h-4 text-text-secondary dark:text-[#7d8190]" />
              <span className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2]">
                {cohort.name}
              </span>
              {cohort.startDate && (
                <>
                  <span className="text-text-muted dark:text-[#7d8190]">·</span>
                  <span className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2]">
                    Started {formatDate(cohort.startDate)}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Program Description */}
      {program.description && (
        <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-5">
          <h2 className="font-albert text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] mb-3">
            About this program
          </h2>
          <p className="font-sans text-[15px] text-text-secondary dark:text-[#b2b6c2] leading-[1.6]">
            {program.description}
          </p>
        </div>
      )}

      {/* Upcoming Events / Sessions (for group programs) */}
      {isGroup && upcomingEvents.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-albert text-[20px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px]">
            Upcoming Sessions
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {upcomingEvents.slice(0, 4).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      )}

      {/* Schedule 1:1 Session (for individual programs) */}
      {!isGroup && (
        <button
          onClick={() => router.push('/my-coach')}
          className="w-full bg-[#2c2520] dark:bg-[#f5f5f8] text-white dark:text-[#05070b] rounded-[16px] p-5 flex items-center justify-between hover:scale-[1.01] active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/10 dark:bg-[#05070b]/10 flex items-center justify-center">
              <Calendar className="w-6 h-6" />
            </div>
            <div className="text-left">
              <p className="font-albert text-[18px] font-semibold tracking-[-0.5px]">
                Schedule your next session
              </p>
              <p className="font-sans text-[14px] opacity-80">
                Book a 1:1 call with {program.coachName}
              </p>
            </div>
          </div>
          <ChevronRight className="w-6 h-6 opacity-60" />
        </button>
      )}

      {/* Program Habits */}
      {program.defaultHabits && program.defaultHabits.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-albert text-[20px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px]">
              Program Habits
            </h2>
            <Link
              href="/habits"
              className="font-albert text-[14px] text-text-secondary dark:text-[#7d8190] hover:text-text-primary dark:hover:text-[#f5f5f8] transition-colors"
            >
              View all →
            </Link>
          </div>
          <div className="space-y-2">
            {program.defaultHabits.slice(0, 3).map((habit, index) => (
              <Link
                key={habit.id || index}
                href={`/habits`}
                className="block bg-white dark:bg-[#171b22] rounded-[16px] p-4 hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] transition-colors"
              >
                <p className="font-albert text-[16px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px]">
                  {habit.title}
                </p>
                {habit.description && (
                  <p className="font-sans text-[13px] text-text-secondary dark:text-[#b2b6c2] mt-1">
                    {habit.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Program Content - Courses */}
      {content.courses.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-albert text-[20px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px]">
              Courses
            </h2>
            <Link
              href="/discover?tab=courses"
              className="font-albert text-[14px] text-text-secondary dark:text-[#7d8190] hover:text-text-primary dark:hover:text-[#f5f5f8] transition-colors flex items-center gap-1"
            >
              <BookOpen className="w-4 h-4" />
              <span>See all</span>
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {content.courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </div>
      )}

      {/* Program Content - Articles */}
      {content.articles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-albert text-[20px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px]">
              Articles & Resources
            </h2>
            <Link
              href="/discover?tab=articles"
              className="font-albert text-[14px] text-text-secondary dark:text-[#7d8190] hover:text-text-primary dark:hover:text-[#f5f5f8] transition-colors flex items-center gap-1"
            >
              <FileText className="w-4 h-4" />
              <span>See all</span>
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {content.articles.slice(0, 4).map((article) => (
              <ArticleCard key={article.id} article={article} variant="grid" />
            ))}
          </div>
        </div>
      )}

      {/* Program Content - Links */}
      {content.links.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-albert text-[20px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px]">
            Useful Links
          </h2>
          <div className="space-y-2">
            {content.links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-white dark:bg-[#171b22] rounded-[16px] p-4 hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-[#f3f1ef] dark:bg-[#262b35] flex items-center justify-center">
                  <ExternalLink className="w-5 h-5 text-text-secondary dark:text-[#7d8190]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-albert text-[16px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] truncate">
                    {link.title}
                  </p>
                  {link.description && (
                    <p className="font-sans text-[13px] text-text-secondary dark:text-[#b2b6c2] truncate">
                      {link.description}
                    </p>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-text-secondary dark:text-[#7d8190] flex-shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Program Content - Downloads */}
      {content.downloads.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-albert text-[20px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px]">
            Downloads
          </h2>
          <div className="space-y-2">
            {content.downloads.map((download) => (
              <a
                key={download.id}
                href={download.fileUrl}
                download
                className="flex items-center gap-3 bg-white dark:bg-[#171b22] rounded-[16px] p-4 hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-albert text-[16px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] truncate">
                    {download.title}
                  </p>
                  <p className="font-sans text-[13px] text-text-secondary dark:text-[#b2b6c2]">
                    {download.fileType && <span className="uppercase">{download.fileType}</span>}
                    {download.fileSize && <span> · {download.fileSize}</span>}
                  </p>
                </div>
                <Download className="w-5 h-5 text-text-secondary dark:text-[#7d8190] flex-shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Loading state for content */}
      {content.isLoading && (
        <div className="space-y-4">
          <div className="h-6 w-32 bg-[#e1ddd8] dark:bg-[#262b35] rounded-lg animate-pulse" />
          <div className="flex gap-3 overflow-x-auto">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-[180px] h-[180px] flex-shrink-0 bg-white dark:bg-[#171b22] rounded-[20px] animate-pulse"
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state for no content */}
      {!content.isLoading && 
       content.courses.length === 0 && 
       content.articles.length === 0 && 
       content.events.length === 0 &&
       content.links.length === 0 &&
       content.downloads.length === 0 && (
        <div className="text-center py-8">
          <p className="font-sans text-[16px] text-text-secondary dark:text-[#b2b6c2]">
            Program content will be available as you progress through the program.
          </p>
        </div>
      )}
    </div>
  );
}

