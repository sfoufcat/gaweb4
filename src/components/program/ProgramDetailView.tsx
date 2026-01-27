'use client';

import { useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Phone, ChevronDown, ExternalLink, Users, Loader2, Calendar, Clock, MapPin, Target, StickyNote, BookOpen, Download, Link2, FileQuestion } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import type { EnrolledProgramWithDetails } from '@/hooks/useMyPrograms';
import { useProgramContent } from '@/hooks/useProgramContent';
import { useProgramCoachingData } from '@/hooks/useProgramCoachingData';
import { RequestCallModal } from '@/components/scheduling';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { calculateCalendarWeeks, getCalendarWeekForDay, type CalendarWeek } from '@/lib/calendar-weeks';
import { useProgramWeeklyContent, type WeeklyContentResponse } from '@/hooks/useProgramWeeklyContent';
import { WeeklySection } from './WeeklySection';
import { ProgramSchedule } from './ProgramSchedule';
import { WeeklyOutcomes } from './WeeklyOutcomes';
import { CoachNotes } from './CoachNotes';
import { WeeklyResources } from './WeeklyResources';

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
  onRefresh?: () => void;
}

export function ProgramDetailView({
  program: enrolled,
  onBack,
  showBackButton = true,
  onRefresh,
}: ProgramDetailViewProps) {
  const router = useRouter();
  const { user } = useUser();
  const { isDemoMode, openSignupModal } = useDemoMode();
  const {
    program,
    progress,
    squad,
    squadMembers,
    enrollment,
    nextCall: prefetchedNextCall,
    coachingData: prefetchedCoachingData,
  } = enrolled;
  const isGroup = program.type === 'group';

  // Fetch additional coaching data for individual programs (credits, settings, etc.)
  // Note: nextCall and coachingData are pre-fetched via useMyPrograms to avoid UI flash
  const {
    coachingData: hookCoachingData,
    nextCall: hookNextCall,
    chatChannelId: hookChatChannelId,
    callCredits,
    callSettings,
    coach: coachingCoach,
    hasCoachingData: hookHasCoachingData,
    isLoading: coachingLoading,
  } = useProgramCoachingData();

  // Use pre-fetched data (immediate, no flash) or fall back to hook data
  const nextCall = prefetchedNextCall || hookNextCall;
  const storedChatChannelId = prefetchedCoachingData?.chatChannelId || hookChatChannelId;
  
  // For 1:1 programs: the coaching channel ID should be stored server-side.
  // We no longer compute a fallback here since it requires server-side hashing.
  // If no stored channel ID exists, the user should trigger channel creation via the API.
  const fallbackCoachingChannelId = null;
  
  // Use stored channel ID or fallback to computed one
  const chatChannelId = storedChatChannelId || fallbackCoachingChannelId;

  // Merge coaching data: prefer pre-fetched, fall back to hook data
  const coachingData = prefetchedCoachingData
    ? {
        focusAreas: prefetchedCoachingData.focusAreas,
        actionItems: prefetchedCoachingData.actionItems,
        resources: prefetchedCoachingData.resources,
      }
    : hookCoachingData;
  const hasCoachingData = !!(prefetchedCoachingData || hookHasCoachingData);
  
  // State for joining community
  const [isJoiningCommunity, setIsJoiningCommunity] = useState(false);
  const [joinCommunityError, setJoinCommunityError] = useState<string | null>(null);
  
  // State for request call modal
  const [showRequestCallModal, setShowRequestCallModal] = useState(false);
  
  // Check if community is available but not joined
  const showJoinCommunityCard = !isGroup && 
    program.clientCommunityEnabled && 
    program.clientCommunitySquadId && 
    !enrollment.joinedCommunity;
  
  // Handle joining community
  const handleJoinCommunity = async () => {
    // In demo mode, open signup modal instead
    if (isDemoMode) {
      openSignupModal();
      return;
    }
    
    setIsJoiningCommunity(true);
    setJoinCommunityError(null);
    
    try {
      const response = await fetch('/api/programs/join-community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programId: program.id }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to join community');
      }
      
      // Refresh data to show updated state
      if (onRefresh) {
        onRefresh();
      } else {
        // Fallback: reload page
        window.location.reload();
      }
    } catch (error) {
      console.error('Error joining community:', error);
      setJoinCommunityError(error instanceof Error ? error.message : 'Failed to join community');
    } finally {
      setIsJoiningCommunity(false);
    }
  };

  // Program-specific content - using SWR for caching between tab switches
  const {
    courses,
    articles,
    events,
    links,
    downloads,
    days,
    isLoading: contentLoading,
  } = useProgramContent(program.id);

  // Weekly content for the new Schedule section
  const {
    week: weeklyWeek,
    days: weeklyDays,
    events: weeklyEvents,
    courses: weeklyCourses,
    articles: weeklyArticles,
    downloads: weeklyDownloads,
    links: weeklyLinks,
    isLoading: weeklyContentLoading,
    mutate: mutateWeeklyContent,
  } = useProgramWeeklyContent(program.id);

  // Task toggle handler for program schedule
  const handleTaskToggle = useCallback(async (taskId: string, dayIndex: number, completed: boolean) => {
    if (!enrollment?.id || isDemoMode) {
      if (isDemoMode) {
        openSignupModal();
      }
      return;
    }

    // Find the day and task to get label and calendar date
    const day = weeklyDays.find(d => d.dayIndex === dayIndex);
    const task = day?.tasks.find(t => t.id === taskId);
    const label = task?.label || 'Task';
    const calendarDate = day?.calendarDate;

    // Optimistic update
    mutateWeeklyContent((current) => {
      if (!current) return current;
      return {
        ...current,
        days: current.days.map(d => {
          if (d.dayIndex !== dayIndex) return d;
          return {
            ...d,
            tasks: d.tasks.map(t => {
              if (t.id !== taskId) return t;
              return { ...t, completed };
            }),
          };
        }),
      };
    }, { revalidate: false });

    try {
      const response = await fetch(`/api/programs/${program.id}/tasks/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentId: enrollment.id,
          taskId,
          dayIndex,
          completed,
          label,
          calendarDate,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[TASK_TOGGLE] Error:', errorData.error);
        // Revert optimistic update on error
        mutateWeeklyContent();
      }
    } catch (error) {
      console.error('[TASK_TOGGLE] Network error:', error);
      // Revert optimistic update on error
      mutateWeeklyContent();
    }
  }, [enrollment?.id, program.id, weeklyDays, mutateWeeklyContent, isDemoMode, openSignupModal]);

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

  // Check if program hasn't started yet (pre-start state)
  const isPreStart = progress.currentDay < 1;
  
  // Calculate which days to show - use dynamic labels (Today, Tomorrow, weekday name)
  // On weekends with includeWeekends=false, show Monday, Tuesday, Wednesday instead
  const threeDayFocus = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ...
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Base day index: either current progress day or day 1 for pre-start preview
    const baseDayIndex = isPreStart ? 1 : progress.currentDay;

    // Check if we should skip weekends
    const skipWeekends = program.includeWeekends === false;
    const todayIsWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Helper to extract day data including linked resources
    const getDayData = (dayIndex: number) => {
      const day = days.find(d => d.dayIndex === dayIndex);
      return {
        tasks: day?.tasks || [],
        linkedArticleIds: day?.linkedArticleIds || [],
        linkedDownloadIds: day?.linkedDownloadIds || [],
        linkedLinkIds: day?.linkedLinkIds || [],
        linkedQuestionnaireIds: day?.linkedQuestionnaireIds || [],
      };
    };

    if (skipWeekends && todayIsWeekend) {
      // On weekend with weekends disabled: show Mon, Tue, Wed
      // Days until Monday: Sunday (0) = 1 day, Saturday (6) = 2 days
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 2;
      const mondayDayIndex = baseDayIndex + daysUntilMonday;

      return [
        {
          dayIndex: mondayDayIndex,
          label: 'Monday',
          ...getDayData(mondayDayIndex),
        },
        {
          dayIndex: mondayDayIndex + 1,
          label: 'Tuesday',
          ...getDayData(mondayDayIndex + 1),
        },
        {
          dayIndex: mondayDayIndex + 2,
          label: 'Wednesday',
          ...getDayData(mondayDayIndex + 2),
        },
      ];
    }

    // Normal weekday logic
    return [
      {
        dayIndex: baseDayIndex,
        label: 'Today',
        ...getDayData(baseDayIndex),
      },
      {
        dayIndex: baseDayIndex + 1,
        label: 'Tomorrow',
        ...getDayData(baseDayIndex + 1),
      },
      {
        dayIndex: baseDayIndex + 2,
        label: dayNames[(dayOfWeek + 2) % 7],
        ...getDayData(baseDayIndex + 2),
      },
    ];
  }, [progress.currentDay, days, isPreStart, program.includeWeekends]);

  // Check if any days have tasks
  const hasAnyTasks = threeDayFocus.some(day => day.tasks.length > 0);

  // Calculate calendar-aligned weeks
  const calendarWeeks = useMemo(() => {
    if (!enrollment?.startedAt) return [];
    const includeWeekends = program.includeWeekends !== false;
    return calculateCalendarWeeks(enrollment.startedAt, progress.totalDays, includeWeekends);
  }, [enrollment?.startedAt, progress.totalDays, program.includeWeekends]);

  // Get current calendar week
  const currentCalendarWeek = useMemo(() => {
    if (!enrollment?.startedAt || calendarWeeks.length === 0) return null;
    const includeWeekends = program.includeWeekends !== false;
    const currentDay = isPreStart ? 1 : progress.currentDay;
    return getCalendarWeekForDay(enrollment.startedAt, currentDay, progress.totalDays, includeWeekends);
  }, [enrollment?.startedAt, calendarWeeks.length, progress.currentDay, progress.totalDays, program.includeWeekends, isPreStart]);

  // Format week progress label
  const weekProgressLabel = currentCalendarWeek?.label || 'Week 1';
  const totalWeeks = calendarWeeks.length;

  // Get upcoming events
  const upcomingEvents = events.filter(e => new Date(e.date) >= new Date());

  // Calculate member count from squad (memberIds) or cohort
  const memberCount = squad?.memberIds?.length || 0;

  // Check if there's any content at all
  const hasContent = 
    courses.length > 0 || 
    articles.length > 0 || 
    events.length > 0 ||
    links.length > 0 ||
    downloads.length > 0 ||
    (program.defaultHabits && program.defaultHabits.length > 0);

  // Return null for smooth page fade-in while content is loading
  if (contentLoading) {
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="space-y-4">
        {/* Back Arrow + Title + Badges (inline) */}
        <div className="flex items-center gap-3 flex-wrap">
          {showBackButton && onBack && (
            <button
              onClick={onBack}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#f3f1ef] dark:hover:bg-[#171b22] transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-text-primary dark:text-[#f5f5f8]" />
            </button>
          )}
          <h1 className="font-albert text-[36px] font-normal text-text-primary dark:text-[#f5f5f8] tracking-[-2px] leading-[1.2]">
            {program.name}
          </h1>
        </div>

        {/* Description */}
        {program.description && (
          <p className="font-sans text-[16px] text-text-secondary dark:text-[#b2b6c2] leading-[1.4] tracking-[-0.3px]">
            {program.description}
          </p>
        )}

        {/* Cover Image */}
        <div className="relative h-[220px] w-full rounded-[20px] overflow-hidden bg-gray-200 dark:bg-gray-800">
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

      {/* Program Overview Section - Glass Card */}
      <div className="relative rounded-[20px] p-6 overflow-hidden bg-white/70 dark:bg-[#1c2026]/70 backdrop-blur-xl border border-white/50 dark:border-white/10 shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent dark:from-white/5 pointer-events-none" />
        <div className="relative space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="font-albert text-[20px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.3]">
              Program overview
            </h2>
            {/* Enrolled Badge - matches week badge style */}
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100/80 dark:bg-green-500/20 border border-green-200/60 dark:border-green-500/30">
              <span className="font-sans text-[12px] font-semibold text-green-700 dark:text-green-300 tracking-[-0.2px]">
                Enrolled
              </span>
            </span>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            {isGroup ? (
              /* Group Program Overview */
              <>
                {/* Stacked Avatars + Group Info */}
                <div className="flex items-center gap-3">
                  {squadMembers && squadMembers.length > 0 && (
                    <div className="flex items-center -space-x-3">
                      {squadMembers.slice(0, 3).map((member) => (
                        <div
                          key={member.id}
                          className="w-[38px] h-[38px] rounded-full border-2 border-white dark:border-[#1c2026] overflow-hidden bg-[#d4cfc9] dark:bg-[#7d8190]"
                        >
                          {member.imageUrl ? (
                            <Image
                              src={member.imageUrl}
                              alt={`${member.firstName} ${member.lastName}`}
                              width={38}
                              height={38}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-xs font-medium text-white">
                                {member.firstName?.[0] || member.lastName?.[0] || 'M'}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="font-sans text-[14px] font-medium text-text-primary dark:text-[#f5f5f8] leading-[20px]">
                      Group program
                    </span>
                    <span className="font-sans text-[12px] text-text-muted dark:text-[#7d8190] leading-[16px]">
                      {memberCount} member{memberCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Coach Avatar + Info */}
                <div className="flex items-center gap-3">
                  <div className="w-[38px] h-[38px] rounded-full overflow-hidden bg-brand-accent/10">
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
                        <span className="font-albert font-semibold text-sm text-brand-accent">
                          {program.coachName[0]}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-sans text-[14px] font-medium text-text-primary dark:text-[#f5f5f8] leading-[20px]">
                      {program.coachName}
                    </span>
                    <span className="font-sans text-[12px] text-text-muted dark:text-[#7d8190] leading-[16px]">
                      Program coach
                    </span>
                  </div>
                </div>
              </>
            ) : (
              /* 1:1 Program Overview */
              <>
                {/* Next Session Info */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-accent/10 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-brand-accent" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-sans text-[14px] font-medium text-text-primary dark:text-[#f5f5f8] leading-[20px]">
                      Next session
                    </span>
                    <span className="font-sans text-[12px] text-text-muted dark:text-[#7d8190] leading-[16px]">
                      {nextCall?.datetime ? (
                        new Date(nextCall.datetime).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })
                      ) : (
                        'Not scheduled'
                      )}
                    </span>
                  </div>
                </div>

                {/* Coach Avatar + Info */}
                <div className="flex items-center gap-3">
                  <div className="w-[38px] h-[38px] rounded-full overflow-hidden bg-brand-accent/10">
                    {(coachingCoach?.imageUrl || program.coachImageUrl) ? (
                      <Image
                        src={coachingCoach?.imageUrl || program.coachImageUrl || ''}
                        alt={coachingCoach?.name || program.coachName}
                        width={38}
                        height={38}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="font-albert font-semibold text-sm text-brand-accent">
                          {(coachingCoach?.name || program.coachName)?.[0] || 'C'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-sans text-[14px] font-medium text-text-primary dark:text-[#f5f5f8] leading-[20px]">
                      {coachingCoach?.name || program.coachName}
                    </span>
                    <span className="font-sans text-[12px] text-text-muted dark:text-[#7d8190] leading-[16px]">
                      Program coach
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Join Community Card (for 1:1 programs with community enabled but not joined) */}
      {showJoinCommunityCard && (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-[20px] p-5 space-y-3 border border-purple-100 dark:border-purple-800/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-albert text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.3]">
                Join the Community
              </h3>
              <p className="font-sans text-[13px] text-text-secondary dark:text-[#b2b6c2] leading-[1.4]">
                Connect with other participants in this program
              </p>
            </div>
          </div>
          
          <p className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2] leading-[1.5]">
            Get peer support, share experiences, and participate in group discussions with fellow program members.
          </p>
          
          {joinCommunityError && (
            <p className="font-sans text-[13px] text-red-600 dark:text-red-400">
              {joinCommunityError}
            </p>
          )}
          
          <button
            onClick={handleJoinCommunity}
            disabled={isJoiningCommunity}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 rounded-[32px] px-4 py-3 font-semibold text-[15px] text-white leading-[1.4] tracking-[-0.3px] shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            {isJoiningCommunity ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Joining...
              </>
            ) : (
              <>
                <Users className="w-4 h-4" />
                Join Community
              </>
            )}
          </button>
        </div>
      )}

      {/* Next Scheduled Call Card (for 1:1 programs) */}
      {!isGroup && (
        <div>
          <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-4 space-y-4">
            {nextCall?.datetime ? (
              <>
                {/* Has scheduled call */}
                <h3 className="font-albert text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.3]">
                  Next scheduled call
                </h3>
                
                <div className="font-sans text-[16px] text-text-secondary dark:text-[#b2b6c2] leading-[1.4] tracking-[-0.3px] space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <p>
                      {new Date(nextCall.datetime).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        timeZone: nextCall.timezone,
                      })} · {new Date(nextCall.datetime).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        timeZoneName: 'short',
                        timeZone: nextCall.timezone,
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <p>Location: {nextCall.location || 'Chat'}</p>
                  </div>
                  <p>Guided by: {coachingCoach?.name || program.coachName}</p>
                </div>

                {/* Call Credits Badge - when call is scheduled */}
                {callCredits && callCredits.monthlyAllowance > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-brand-accent/10 rounded-xl">
                    <Phone className="w-4 h-4 text-brand-accent" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                        {callCredits.creditsRemaining} of {callCredits.monthlyAllowance} calls remaining
                      </p>
                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                        Resets monthly
                      </p>
                    </div>
                  </div>
                )}

                {/* Add to calendar button */}
                <button className="w-full bg-white dark:bg-[#171b22] border border-[rgba(215,210,204,0.5)] rounded-[32px] px-4 py-4 font-bold text-[16px] text-[#2c2520] dark:text-[#f5f5f8] leading-[1.4] tracking-[-0.5px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.01] active:scale-[0.99] transition-all">
                  Add to calendar
                </button>
              </>
            ) : (
              <>
                {/* No call scheduled - show request option */}
                <h3 className="font-albert text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.3]">
                  Schedule a call
                </h3>
                
                <p className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2] leading-[1.5]">
                  No call scheduled yet. Request a 1:1 session with your coach.
                </p>

                {/* Call Credits Badge */}
                {callCredits && callCredits.monthlyAllowance > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-brand-accent/10 rounded-xl">
                    <Phone className="w-4 h-4 text-brand-accent" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                        {callCredits.creditsRemaining} of {callCredits.monthlyAllowance} calls remaining
                      </p>
                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                        Resets monthly
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Show call credits if available */}
                {callCredits && callCredits.monthlyAllowance > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-brand-accent" />
                    <span className="text-text-secondary dark:text-[#b2b6c2]">
                      {callCredits.creditsRemaining} of {callCredits.monthlyAllowance} calls remaining this month
                    </span>
                  </div>
                )}
                
                {/* Request call button */}
                <button
                  onClick={() => {
                    if (isDemoMode) {
                      openSignupModal();
                    } else {
                      setShowRequestCallModal(true);
                    }
                  }}
                  className="w-full bg-white dark:bg-[#171b22] border border-[rgba(215,210,204,0.5)] rounded-[32px] px-4 py-4 font-bold text-[16px] text-[#2c2520] dark:text-[#f5f5f8] leading-[1.4] tracking-[-0.5px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                >
                  <Calendar className="w-5 h-5" />
                  Request a Call
                </button>
              </>
            )}

            {/* Go to chat button */}
            <button
              onClick={() => {
                if (isDemoMode) {
                  openSignupModal();
                } else if (chatChannelId) {
                  router.push(`/chat?channel=${chatChannelId}`);
                } else {
                  router.push('/chat');
                }
              }}
              className="w-full bg-brand-accent border border-[rgba(215,210,204,0.5)] rounded-[32px] px-4 py-4 font-bold text-[16px] text-brand-accent-foreground leading-[1.4] tracking-[-0.5px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.01] active:scale-[0.99] transition-all"
            >
              Go to chat
            </button>
          </div>
        </div>
      )}
      
      {/* Request Call Modal */}
      {!isGroup && (
        <RequestCallModal
          isOpen={showRequestCallModal}
          onClose={() => setShowRequestCallModal(false)}
          coachName={coachingCoach?.name || program.coachName}
          isPaid={callSettings?.pricingModel === 'per_call' || callSettings?.pricingModel === 'both'}
          priceInCents={callSettings?.pricePerCallCents || 0}
          enrollmentId={enrollment?.id}
          onSuccess={() => {
            setShowRequestCallModal(false);
            if (onRefresh) {
              onRefresh();
            }
          }}
        />
      )}

      {/* Coaching Data Sections (for 1:1 programs) - Focus, Action Items, Resources */}
      {!isGroup && hasCoachingData && (
        <div className="space-y-4">
          {/* Current Focus */}
          {coachingData?.focusAreas && coachingData.focusAreas.length > 0 && (
            <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-brand-accent" />
                <h3 className="font-albert text-[16px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px]">
                  Current Focus
                </h3>
              </div>
              <ul className="space-y-2">
                {coachingData.focusAreas.map((focus, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-brand-accent shrink-0" />
                    <span className="font-sans text-[15px] text-text-secondary dark:text-[#b2b6c2]">{focus}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Notes */}
          {coachingData?.actionItems && coachingData.actionItems.length > 0 && (
            <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-4">
              <div className="flex items-center gap-2 mb-3">
                <StickyNote className="w-5 h-5 text-brand-accent" />
                <h3 className="font-albert text-[16px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px]">
                  Notes
                </h3>
              </div>
              <ul className="space-y-2">
                {coachingData.actionItems.map((item) => (
                  <li key={item.id} className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-brand-accent shrink-0" />
                    <span className="font-sans text-[15px] text-text-secondary dark:text-[#b2b6c2]">
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Resources */}
          {coachingData?.resources && coachingData.resources.length > 0 && (
            <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-4">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-5 h-5 text-brand-accent" />
                <h3 className="font-albert text-[16px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px]">
                  Resources
                </h3>
              </div>
              <ul className="space-y-3">
                {coachingData.resources.map((resource) => (
                  <li key={resource.id}>
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 group"
                    >
                      <ExternalLink className="w-4 h-4 text-brand-accent mt-0.5 shrink-0" />
                      <div>
                        <span className="font-sans text-[15px] text-brand-accent group-hover:underline">
                          {resource.title}
                        </span>
                        {resource.description && (
                          <p className="font-sans text-[13px] text-text-muted dark:text-[#7d8190] mt-0.5">
                            {resource.description}
                          </p>
                        )}
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
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

      {/* Weekly Section - Theme, Description, Prompt */}
      {weeklyWeek && (
        <WeeklySection week={weeklyWeek} totalWeeks={calendarWeeks.length} />
      )}

      {/* Schedule Section - Replaces 3 Day Focus */}
      {weeklyDays.length > 0 && (
        <div className="mt-8">
          <ProgramSchedule
            days={weeklyDays}
            week={weeklyWeek}
            events={weeklyEvents}
            courses={weeklyCourses}
            articles={weeklyArticles}
            downloads={weeklyDownloads}
            links={weeklyLinks}
            enrollmentId={enrollment?.id}
            onTaskToggle={handleTaskToggle}
          />
        </div>
      )}

      {/* Weekly Outcomes */}
      {weeklyWeek && (
        <div className="mt-6">
          <WeeklyOutcomes week={weeklyWeek} />
        </div>
      )}

      {/* Coach Notes */}
      {weeklyWeek && (
        <div className="mt-6">
          <CoachNotes week={weeklyWeek} coachName={program.coachName} />
        </div>
      )}

      {/* Resources Section - Show weekly resources if available, otherwise program-level resources */}
      {(() => {
        // Prefer weekly resources, fall back to program-level
        const displayCourses = weeklyCourses.length > 0 ? weeklyCourses : courses;
        const displayArticles = weeklyArticles.length > 0 ? weeklyArticles : articles;
        const displayDownloads = weeklyDownloads.length > 0 ? weeklyDownloads : downloads;
        const displayLinks = weeklyLinks.length > 0 ? weeklyLinks : links;
        const displayEvents = weeklyEvents;

        const hasAnyResources = displayCourses.length > 0 || displayArticles.length > 0 || displayDownloads.length > 0 || displayLinks.length > 0 || displayEvents.length > 0;

        if (!hasAnyResources) return null;

        return (
          <div className="mt-8">
            <WeeklyResources
              courses={displayCourses}
              articles={displayArticles}
              downloads={displayDownloads}
              links={displayLinks}
              events={displayEvents}
              enrollmentId={enrollment?.id}
            />
          </div>
        );
      })()}

      {/* Legacy 3 Day Focus Section - Fallback when no weekly content */}
      {hasAnyTasks && !weeklyWeek && (
        <div className="mt-8 mb-10 space-y-4">
          <h2 className="font-albert text-[24px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3]">
            {isPreStart ? 'Program preview' : '3 day focus'}
          </h2>

          {/* Detached accordion cards */}
          <div className="space-y-3">
            {threeDayFocus.map((dayFocus, idx) => {
              const isExpanded = expandedDays.has(dayFocus.dayIndex);
              const hasTasks = dayFocus.tasks.length > 0;
              const isToday = dayFocus.label === 'Today';

              return (
                <div 
                  key={dayFocus.dayIndex}
                  className={`
                    bg-white dark:bg-[#171b22] rounded-[16px] overflow-hidden
                    border border-transparent
                    transition-all duration-200 ease-out
                    ${hasTasks ? 'hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:border-[#e8e4df] dark:hover:border-[#2a303c]' : 'opacity-60'}
                    ${isExpanded ? 'shadow-[0_4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border-[#e8e4df] dark:border-[#2a303c]' : ''}
                  `}
                >
                  <button
                    onClick={() => hasTasks && toggleDay(dayFocus.dayIndex)}
                    className={`w-full px-5 py-4 flex items-center justify-between ${
                      !hasTasks ? 'cursor-default' : 'cursor-pointer'
                    }`}
                    disabled={!hasTasks}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-albert text-[17px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] leading-[1.3]">
                        {dayFocus.label}
                      </span>
                      {isToday && hasTasks && (
                        <span className="px-2 py-0.5 rounded-full bg-brand-accent/10 dark:bg-brand-accent/15 text-[11px] font-medium text-brand-accent">
                          {dayFocus.tasks.length} task{dayFocus.tasks.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {!isToday && hasTasks && (
                        <span className="text-[12px] text-text-muted dark:text-[#7d8190]">
                          {dayFocus.tasks.length} task{dayFocus.tasks.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {hasTasks ? (
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                      >
                        <ChevronDown className="w-5 h-5 text-[#a7a39e] dark:text-[#7d8190]" />
                      </motion.div>
                    ) : (
                      <span className="text-[12px] text-text-muted dark:text-[#7d8190] italic">No tasks</span>
                    )}
                  </button>

                  <AnimatePresence initial={false}>
                    {isExpanded && hasTasks && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 pt-1">
                          {/* Tasks */}
                          <div className="space-y-2.5">
                            {dayFocus.tasks.map((task, i) => (
                              <div 
                                key={task.id || i}
                                className="flex items-start gap-3 group"
                              >
                                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#f3f1ef] dark:bg-[#262b35] flex items-center justify-center mt-0.5">
                                  <span className="text-[11px] font-medium text-[#a7a39e] dark:text-[#7d8190]">
                                    {i + 1}
                                  </span>
                                </span>
                                <span className="font-sans text-[15px] text-text-secondary dark:text-[#b2b6c2] leading-[1.5] tracking-[-0.2px]">
                                  {task.title}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Linked Resources */}
                          {(dayFocus.linkedArticleIds.length > 0 || 
                            dayFocus.linkedDownloadIds.length > 0 || 
                            dayFocus.linkedLinkIds.length > 0 ||
                            dayFocus.linkedQuestionnaireIds.length > 0) && (
                            <div className="mt-4 pt-4 border-t border-[#e8e4df] dark:border-[#262b35]">
                              <span className="text-[12px] font-medium text-text-muted dark:text-[#7d8190] uppercase tracking-wider mb-2 block">
                                Resources
                              </span>
                              <div className="space-y-2">
                                {/* Articles */}
                                {dayFocus.linkedArticleIds.map(articleId => {
                                  const article = articles.find(a => a.id === articleId);
                                  if (!article) return null;
                                  return (
                                    <Link
                                      key={articleId}
                                      href={`/discover/articles/${articleId}`}
                                      className="flex items-center gap-2 p-2 rounded-lg bg-[#f3f1ef] dark:bg-[#262b35] hover:bg-[#ebe7e2] dark:hover:bg-[#2d333f] transition-colors"
                                    >
                                      <BookOpen className="w-4 h-4 text-brand-accent flex-shrink-0" />
                                      <span className="text-sm text-text-secondary dark:text-[#b2b6c2] truncate">
                                        {article.title}
                                      </span>
                                    </Link>
                                  );
                                })}

                                {/* Downloads */}
                                {dayFocus.linkedDownloadIds.map(downloadId => {
                                  const download = downloads.find(d => d.id === downloadId);
                                  if (!download) return null;
                                  return (
                                    <a
                                      key={downloadId}
                                      href={download.fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 p-2 rounded-lg bg-[#f3f1ef] dark:bg-[#262b35] hover:bg-[#ebe7e2] dark:hover:bg-[#2d333f] transition-colors"
                                    >
                                      <Download className="w-4 h-4 text-brand-accent flex-shrink-0" />
                                      <span className="text-sm text-text-secondary dark:text-[#b2b6c2] truncate">
                                        {download.title}
                                      </span>
                                    </a>
                                  );
                                })}

                                {/* Links */}
                                {dayFocus.linkedLinkIds.map(linkId => {
                                  const link = links.find(l => l.id === linkId);
                                  if (!link) return null;
                                  return (
                                    <a
                                      key={linkId}
                                      href={link.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 p-2 rounded-lg bg-[#f3f1ef] dark:bg-[#262b35] hover:bg-[#ebe7e2] dark:hover:bg-[#2d333f] transition-colors"
                                    >
                                      <Link2 className="w-4 h-4 text-brand-accent flex-shrink-0" />
                                      <span className="text-sm text-text-secondary dark:text-[#b2b6c2] truncate">
                                        {link.title}
                                      </span>
                                      <ExternalLink className="w-3 h-3 text-text-muted dark:text-[#7d8190] flex-shrink-0 ml-auto" />
                                    </a>
                                  );
                                })}

                                {/* Questionnaires */}
                                {dayFocus.linkedQuestionnaireIds.map(questionnaireId => (
                                  <Link
                                    key={questionnaireId}
                                    href={`/q/${questionnaireId}`}
                                    className="flex items-center gap-2 p-2 rounded-lg bg-[#f3f1ef] dark:bg-[#262b35] hover:bg-[#ebe7e2] dark:hover:bg-[#2d333f] transition-colors"
                                  >
                                    <FileQuestion className="w-4 h-4 text-brand-accent flex-shrink-0" />
                                    <span className="text-sm text-text-secondary dark:text-[#b2b6c2] truncate">
                                      Questionnaire
                                    </span>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
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



    </div>
  );
}
