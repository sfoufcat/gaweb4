'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Phone, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import type { EnrolledProgramWithDetails } from '@/hooks/useMyPrograms';
import type { DiscoverCourse, DiscoverArticle, DiscoverEvent } from '@/types/discover';
import { ArticleCard } from '@/components/discover/ArticleCard';

/**
 * ProgramDetailView Component
 * 
 * Matches Figma designs for program detail screens.
 * Shows full details of a single enrolled program:
 * - Header with back arrow, title, description, enrolled badge, progress pill, cover image
 * - Program overview (group: real member avatars + members + coach; 1:1: phone + next session + coach)
 * - Next scheduled call card (for 1:1)
 * - Upcoming events (for group)
 * - 3-day focus accordion (connected, with real tasks)
 * - Program habits (horizontal scroll)
 * - Courses (horizontal scroll)
 * - Articles
 * - Links (pill chips)
 * - Downloads
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

interface ProgramDayTask {
  id: string;
  title: string;
  type: 'course' | 'article' | 'habit' | 'task' | 'event';
  completed?: boolean;
}

interface ProgramDay {
  dayIndex: number;
  tasks: ProgramDayTask[];
}

interface ProgramContent {
  courses: DiscoverCourse[];
  articles: DiscoverArticle[];
  events: DiscoverEvent[];
  links: ProgramLink[];
  downloads: ProgramDownload[];
  days: ProgramDay[];
  isLoading: boolean;
}

export function ProgramDetailView({ 
  program: enrolled, 
  onBack,
  showBackButton = true,
}: ProgramDetailViewProps) {
  const router = useRouter();
  const { program, progress, squad, squadMembers } = enrolled;
  const isGroup = program.type === 'group';

  // Program-specific content
  const [content, setContent] = useState<ProgramContent>({
    courses: [],
    articles: [],
    events: [],
    links: [],
    downloads: [],
    days: [],
    isLoading: true,
  });

  // 3-day focus accordion state - all collapsed by default
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());

  // Toggle a day's expansion
  const toggleDay = (dayIndex: number) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayIndex)) {
        next.delete(dayIndex);
      } else {
        next.add(dayIndex);
      }
      return next;
    });
  };

  // Calculate which days to show (today, tomorrow, day after)
  const threeDayFocus = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ...
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    const currentDayIndex = progress.currentDay;
    
    return [
      {
        dayIndex: currentDayIndex,
        label: 'Today',
        tasks: content.days.find(d => d.dayIndex === currentDayIndex)?.tasks || [],
      },
      {
        dayIndex: currentDayIndex + 1,
        label: 'Tomorrow',
        tasks: content.days.find(d => d.dayIndex === currentDayIndex + 1)?.tasks || [],
      },
      {
        dayIndex: currentDayIndex + 2,
        label: dayNames[(dayOfWeek + 2) % 7],
        tasks: content.days.find(d => d.dayIndex === currentDayIndex + 2)?.tasks || [],
      },
    ];
  }, [progress.currentDay, content.days]);

  // Check if any days have tasks
  const hasAnyTasks = threeDayFocus.some(day => day.tasks.length > 0);

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
            days: data.days || [],
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

  // Format week progress
  const weekProgress = Math.ceil(progress.currentDay / 7);
  const totalWeeks = Math.ceil(progress.totalDays / 7);

  // Get upcoming events
  const upcomingEvents = content.events.filter(e => new Date(e.date) >= new Date());

  // Calculate member count from squad (memberIds) or cohort
  const memberCount = squad?.memberIds?.length || 0;

  // Check if there's any content at all
  const hasContent = 
    content.courses.length > 0 || 
    content.articles.length > 0 || 
    content.events.length > 0 ||
    content.links.length > 0 ||
    content.downloads.length > 0 ||
    (program.defaultHabits && program.defaultHabits.length > 0);

  return (
    <div className="space-y-5">
      {/* Header Section */}
      <div className="space-y-4">
        {/* Back Arrow + Title */}
        {showBackButton && onBack && (
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#f3f1ef] dark:hover:bg-[#171b22] transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-text-primary dark:text-[#f5f5f8]" />
            </button>
            <h1 className="font-albert text-[36px] font-normal text-text-primary dark:text-[#f5f5f8] tracking-[-2px] leading-[1.2]">
              {program.name}
            </h1>
          </div>
        )}

        {!showBackButton && (
          <h1 className="font-albert text-[36px] font-normal text-text-primary dark:text-[#f5f5f8] tracking-[-2px] leading-[1.2]">
            {program.name}
          </h1>
        )}

        {/* Description */}
        {program.description && (
          <p className="font-sans text-[16px] text-text-secondary dark:text-[#b2b6c2] leading-[1.4] tracking-[-0.3px]">
            {program.description}
          </p>
        )}

        {/* Badges Row: Enrolled + Progress - Both same height */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Enrolled Badge */}
          <div className="bg-[rgba(76,175,80,0.15)] h-7 px-3 rounded-full flex items-center">
            <span className="font-sans text-[13px] font-medium text-[#4caf50] leading-none">
              Enrolled
            </span>
          </div>

          {/* Progress Pill */}
          <div className="bg-[#f3f1ef] dark:bg-[#11141b] h-7 px-3 rounded-full flex items-center gap-2">
            <svg className="w-4 h-4 text-text-secondary dark:text-[#7d8190]" viewBox="0 0 15 14" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M1 9.5V13h3.5V9.5H1zm5-4V13h3.5V5.5H6zm5-4V13h3V1.5h-3z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-sans text-[13px] font-medium text-text-secondary dark:text-[#7d8190] leading-none">
              Week {weekProgress}/{totalWeeks}
            </span>
          </div>
        </div>

        {/* Cover Image */}
        <div className="relative h-[220px] w-full rounded-[20px] overflow-hidden bg-[#f3f1ef] dark:bg-[#262b35]">
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
              <span className="font-albert text-[48px] font-bold text-[#d4cfc9] dark:text-[#7d8190]">
                {program.name[0]}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Program Overview Section */}
      <div className="py-5 space-y-4">
        <h2 className="font-albert text-[24px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3]">
          Program overview
        </h2>

        <div className="flex items-center gap-2 flex-wrap">
          {isGroup ? (
            /* Group Program Overview */
            <>
              {/* Stacked Avatars - Real member photos */}
              <div className="flex items-center -space-x-2">
                {(squadMembers && squadMembers.length > 0 
                  ? squadMembers.slice(0, 3) 
                  : [null, null, null]
                ).map((member, i) => (
                  <div
                    key={member?.id || i}
                    className="w-8 h-8 rounded-full border-2 border-white dark:border-[#05070b] overflow-hidden bg-[#d4cfc9] dark:bg-[#7d8190]"
                  >
                    {member?.imageUrl ? (
                      <Image
                        src={member.imageUrl}
                        alt={`${member.firstName} ${member.lastName}`}
                        width={32}
                        height={32}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-xs font-medium text-white">
                          {member?.firstName?.[0] || '?'}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Group Info */}
              <div className="flex flex-col ml-1">
                <span className="font-sans text-[14px] font-medium text-text-primary dark:text-[#f5f5f8] leading-[20px] tracking-[0.1px]">
                  Group program
                </span>
                <span className="font-sans text-[11px] text-text-secondary dark:text-[#7d8190] leading-[16px] tracking-[0.5px]">
                  {memberCount} member{memberCount !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Coach Avatar */}
              <div className="w-[38px] h-[38px] rounded-full overflow-hidden bg-[#f3f1ef] dark:bg-[#262b35] ml-2">
                {program.coachImageUrl ? (
                  <Image
                    src={program.coachImageUrl}
                    alt={program.coachName}
                    width={38}
                    height={38}
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

              {/* Coach Info */}
              <div className="flex flex-col">
                <span className="font-sans text-[14px] font-medium text-text-primary dark:text-[#f5f5f8] leading-[20px] tracking-[0.1px]">
                  {program.coachName}
                </span>
                <span className="font-sans text-[11px] text-text-secondary dark:text-[#7d8190] leading-[16px] tracking-[0.5px]">
                  Program coach
                </span>
              </div>
            </>
          ) : (
            /* 1:1 Program Overview */
            <>
              {/* Phone Icon */}
              <Phone className="w-6 h-6 text-text-primary dark:text-[#f5f5f8]" />

              {/* Next Session Info */}
              <div className="flex flex-col ml-1" style={{ width: '162px' }}>
                <span className="font-sans text-[14px] font-medium text-text-primary dark:text-[#f5f5f8] leading-[20px] tracking-[0.1px]">
                  Next session
                </span>
                <span className="font-sans text-[11px] text-text-secondary dark:text-[#7d8190] leading-[16px] tracking-[0.5px]">
                  December 4 · 4:00PM
                </span>
              </div>

              {/* Coach Avatar */}
              <div className="w-[38px] h-[38px] rounded-full overflow-hidden bg-[#f3f1ef] dark:bg-[#262b35]">
                {program.coachImageUrl ? (
                  <Image
                    src={program.coachImageUrl}
                    alt={program.coachName}
                    width={38}
                    height={38}
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

              {/* Coach Info */}
              <div className="flex flex-col">
                <span className="font-sans text-[14px] font-medium text-text-primary dark:text-[#f5f5f8] leading-[20px] tracking-[0.1px]">
                  {program.coachName}
                </span>
                <span className="font-sans text-[11px] text-text-secondary dark:text-[#7d8190] leading-[16px] tracking-[0.5px]">
                  One-on-one coach
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Next Scheduled Call Card (for 1:1 programs) */}
      {!isGroup && (
        <div>
          <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-4 space-y-4">
            <h3 className="font-albert text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.3]">
              Next scheduled call
            </h3>
            
            <div className="font-sans text-[16px] text-text-secondary dark:text-[#b2b6c2] leading-[1.4] tracking-[-0.3px] space-y-2">
              <p>December 4 · 10:00 AM EST (4:00 PM your time)</p>
              <p>Location: Chat</p>
              <p>Guided by: {program.coachName}</p>
            </div>

            {/* Add to calendar button */}
            <button className="w-full bg-white dark:bg-[#171b22] border border-[rgba(215,210,204,0.5)] rounded-[32px] px-4 py-4 font-bold text-[16px] text-[#2c2520] dark:text-[#f5f5f8] leading-[1.4] tracking-[-0.5px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.01] active:scale-[0.99] transition-all">
              Add to calendar
            </button>

            {/* Go to chat button */}
            <button
              onClick={() => router.push('/chat')}
              className="w-full bg-[#a07855] border border-[rgba(215,210,204,0.5)] rounded-[32px] px-4 py-4 font-bold text-[16px] text-white leading-[1.4] tracking-[-0.5px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.01] active:scale-[0.99] transition-all"
            >
              Go to chat
            </button>
          </div>
        </div>
      )}

      {/* Upcoming Events (for group programs) */}
      {isGroup && upcomingEvents.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-albert text-[24px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3]">
            Upcoming events
          </h2>
          
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {upcomingEvents.slice(0, 5).map((event) => (
              <Link
                key={event.id}
                href={`/discover/events/${event.id}`}
                className="flex-shrink-0 w-[180px] bg-white dark:bg-[#171b22] rounded-[20px] p-4 hover:shadow-lg transition-shadow"
              >
                <span className="font-sans text-[12px] text-text-muted dark:text-[#7d8190] leading-[1.2]">
                  {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, {event.startTime}
                </span>
                <p className="font-albert text-[18px] font-semibold text-text-secondary dark:text-[#b2b6c2] tracking-[-1px] leading-[1.3] mt-2 line-clamp-2 h-[45px] overflow-hidden">
                  {event.title}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 3 Day Focus Section - Connected Accordion */}
      {hasAnyTasks && (
        <div className="space-y-3">
          <h2 className="font-albert text-[24px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3]">
            3 day focus
          </h2>

          {/* Single connected accordion container */}
          <div className="bg-white dark:bg-[#171b22] rounded-[20px] overflow-hidden divide-y divide-[#f3f1ef] dark:divide-[#262b35]">
            {threeDayFocus.map((dayFocus, idx) => {
              const isExpanded = expandedDays.has(dayFocus.dayIndex);
              const hasTasks = dayFocus.tasks.length > 0;
              const isFirst = idx === 0;
              const isLast = idx === threeDayFocus.length - 1;

              return (
                <div key={dayFocus.dayIndex}>
                  <button
                    onClick={() => hasTasks && toggleDay(dayFocus.dayIndex)}
                    className={`w-full p-4 flex items-center justify-between ${
                      !hasTasks ? 'opacity-50 cursor-default' : 'cursor-pointer hover:bg-[#f9f8f6] dark:hover:bg-[#1a1f28]'
                    }`}
                    disabled={!hasTasks}
                  >
                    <span className="font-albert text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.3]">
                      {dayFocus.label}
                    </span>
                    {hasTasks && (
                      <ChevronDown 
                        className={`w-5 h-5 text-text-secondary dark:text-[#7d8190] transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`} 
                      />
                    )}
                    {!hasTasks && (
                      <span className="text-xs text-text-muted dark:text-[#7d8190]">No tasks</span>
                    )}
                  </button>

                  {isExpanded && hasTasks && (
                    <div className="px-4 pb-4">
                      <ol className="font-sans text-[15px] text-text-secondary dark:text-[#b2b6c2] leading-[1.5] tracking-[-0.3px] list-decimal pl-6 space-y-2">
                        {dayFocus.tasks.map((task, i) => (
                          <li key={task.id || i}>{task.title}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Program Habits (horizontal scroll) */}
      {program.defaultHabits && program.defaultHabits.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-albert text-[24px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3]">
            Program habits
          </h2>
          
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {program.defaultHabits.map((habit, index) => {
              // Map frequency to display text
              const frequencyLabel = habit.frequency === 'daily' ? 'Everyday' : 
                habit.frequency === 'weekday' ? '5 times a week' : 
                '3 times a week';

              return (
                <Link
                  key={index}
                  href="/habits"
                  className="flex-shrink-0 w-[180px] bg-[rgba(255,255,255,0.7)] dark:bg-[#171b22] rounded-[20px] p-4 hover:shadow-lg transition-shadow"
                >
                  <span className="font-sans text-[12px] text-text-muted dark:text-[#7d8190] leading-[1.2]">
                    {frequencyLabel}
                  </span>
                  <p className="font-albert text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.3] mt-2.5 line-clamp-2">
                    {habit.title}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Courses (horizontal scroll) */}
      {content.courses.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-albert text-[24px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3]">
            Courses
          </h2>
          
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {content.courses.map((course) => (
              <Link
                key={course.id}
                href={`/discover/courses/${course.id}`}
                className="flex-shrink-0 w-[180px] bg-[rgba(255,255,255,0.7)] dark:bg-[#171b22] rounded-[20px] p-4 hover:shadow-lg transition-shadow"
              >
                <span className="font-sans text-[12px] text-text-muted dark:text-[#7d8190] leading-[1.2]">
                  {course.category || 'Course'}
                </span>
                <p className="font-albert text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.3] mt-6 line-clamp-2">
                  {course.title}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Articles */}
      {content.articles.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-albert text-[24px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3]">
            Articles
          </h2>
          
          <div className="space-y-2">
            {content.articles.slice(0, 3).map((article) => (
              <ArticleCard key={article.id} article={article} variant="grid" />
            ))}
          </div>
        </div>
      )}

      {/* Links (pill chips) */}
      {content.links.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-albert text-[24px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3]">
            Links
          </h2>
          
          <div className="flex flex-wrap gap-2">
            {content.links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white dark:bg-[#171b22] rounded-full px-4 py-2 flex items-center gap-2 border border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-text-secondary dark:text-[#7d8190]" />
                <span className="font-sans text-[14px] font-medium text-text-secondary dark:text-[#7d8190]">
                  {link.title}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Downloads (horizontal scroll) */}
      {content.downloads.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-albert text-[24px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3]">
            Downloads
          </h2>
          
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {content.downloads.map((download) => (
              <a
                key={download.id}
                href={download.fileUrl}
                download
                className="flex-shrink-0 w-[180px] bg-[rgba(255,255,255,0.7)] dark:bg-[#171b22] rounded-[20px] p-4 hover:shadow-lg transition-shadow"
              >
                <span className="font-sans text-[12px] text-text-muted dark:text-[#7d8190] leading-[1.2]">
                  {download.fileType?.toUpperCase() || 'File'}
                </span>
                <p className="font-albert text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.3] mt-6 line-clamp-2">
                  {download.title}
                </p>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Loading state for content */}
      {content.isLoading && (
        <div className="space-y-4">
          <div className="h-6 w-32 bg-text-primary/10 rounded-lg animate-pulse" />
          <div className="flex gap-3 overflow-x-auto">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-[180px] h-[120px] flex-shrink-0 bg-text-primary/5 rounded-[20px] animate-pulse"
              />
            ))}
          </div>
        </div>
      )}

      {/* No content message - only if completely empty */}
      {!content.isLoading && !hasContent && !hasAnyTasks && (
        <div className="text-center py-8">
          <p className="font-sans text-[16px] text-text-secondary dark:text-[#b2b6c2]">
            No program content available yet.
          </p>
        </div>
      )}
    </div>
  );
}
