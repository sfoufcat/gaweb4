'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Phone, ChevronDown, ExternalLink, Users, Loader2, Calendar, Clock, MapPin } from 'lucide-react';
import type { EnrolledProgramWithDetails } from '@/hooks/useMyPrograms';
import { useProgramContent } from '@/hooks/useProgramContent';
import { useProgramCoachingData } from '@/hooks/useProgramCoachingData';
import { ArticleCard } from '@/components/discover/ArticleCard';
import { ProgramSkeleton } from '@/components/program/ProgramSkeleton';
import { RequestCallModal } from '@/components/scheduling';
import { useDemoMode } from '@/contexts/DemoModeContext';

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
  const { isDemoMode, openSignupModal } = useDemoMode();
  const { program, progress, squad, squadMembers, enrollment } = enrolled;
  const isGroup = program.type === 'group';
  
  // Fetch coaching data for individual programs
  const {
    nextCall,
    chatChannelId,
    callCredits,
    callSettings,
    coach: coachingCoach,
    hasCoachingData,
    isLoading: coachingLoading,
  } = useProgramCoachingData();
  
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
  
  // Calculate which days to show - always use dynamic labels (Today, Tomorrow, weekday name)
  const threeDayFocus = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ...
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Base day index: either current progress day or day 1 for pre-start preview
    const baseDayIndex = isPreStart ? 1 : progress.currentDay;
    
    // Always use dynamic labels (Today, Tomorrow, weekday name)
    return [
      {
        dayIndex: baseDayIndex,
        label: 'Today',
        tasks: days.find(d => d.dayIndex === baseDayIndex)?.tasks || [],
      },
      {
        dayIndex: baseDayIndex + 1,
        label: 'Tomorrow',
        tasks: days.find(d => d.dayIndex === baseDayIndex + 1)?.tasks || [],
      },
      {
        dayIndex: baseDayIndex + 2,
        label: dayNames[(dayOfWeek + 2) % 7],
        tasks: days.find(d => d.dayIndex === baseDayIndex + 2)?.tasks || [],
      },
    ];
  }, [progress.currentDay, days, isPreStart]);

  // Check if any days have tasks
  const hasAnyTasks = threeDayFocus.some(day => day.tasks.length > 0);

  // Format week progress
  const weekProgress = Math.ceil(progress.currentDay / 7);
  const totalWeeks = Math.ceil(progress.totalDays / 7);

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

  // Show full-page skeleton while content is loading
  // Hide pill menu in skeleton since parent already renders it
  if (contentLoading) {
    return <ProgramSkeleton showPillMenu={false} />;
  }

  return (
    <div className="space-y-8">
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

      {/* Program Overview Section */}
      <div className="py-5 space-y-4">
        <h2 className="font-albert text-[24px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3]">
          Program overview
        </h2>

        <div className="flex items-center gap-2 flex-wrap">
          {isGroup ? (
            /* Group Program Overview */
            <>
              {/* Stacked Avatars - Only show actual members (1-3) */}
              {squadMembers && squadMembers.length > 0 && (
                <div className="flex items-center -space-x-3">
                  {squadMembers.slice(0, 3).map((member) => (
                    <div
                      key={member.id}
                      className="w-[38px] h-[38px] rounded-full border-2 border-white dark:border-[#05070b] overflow-hidden bg-[#d4cfc9] dark:bg-[#7d8190]"
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

              {/* Group Info */}
              <div className="flex flex-col ml-2">
                <span className="font-sans text-[14px] font-medium text-text-primary dark:text-[#f5f5f8] leading-[20px] tracking-[0.1px]">
                  Group program
                </span>
                <span className="font-sans text-[11px] text-text-secondary dark:text-[#7d8190] leading-[16px] tracking-[0.5px]">
                  {memberCount} member{memberCount !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Coach Avatar */}
              <div className="w-[38px] h-[38px] rounded-full overflow-hidden bg-gray-200 dark:bg-gray-800 ml-2">
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

              {/* Coach Avatar */}
              <div className="w-[38px] h-[38px] rounded-full overflow-hidden bg-gray-200 dark:bg-gray-800">
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
                    <span className="font-albert font-semibold text-sm text-text-secondary dark:text-[#7d8190]">
                      {(coachingCoach?.name || program.coachName)?.[0] || 'C'}
                    </span>
                  </div>
                )}
              </div>

              {/* Coach Info */}
              <div className="flex flex-col">
                <span className="font-sans text-[14px] font-medium text-text-primary dark:text-[#f5f5f8] leading-[20px] tracking-[0.1px]">
                  {coachingCoach?.name || program.coachName}
                </span>
                <span className="font-sans text-[11px] text-text-secondary dark:text-[#7d8190] leading-[16px] tracking-[0.5px]">
                  One-on-one coach
                </span>
              </div>
            </>
          )}
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
          onSuccess={() => {
            setShowRequestCallModal(false);
            if (onRefresh) {
              onRefresh();
            }
          }}
        />
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

      {/* 3 Day Focus Section - Detached Cards */}
      {hasAnyTasks && (
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

      {/* Courses (horizontal scroll) */}
      {courses.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-albert text-[24px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3]">
            Courses
          </h2>
          
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {courses.map((course) => (
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
      {articles.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-albert text-[24px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3]">
            Articles
          </h2>
          
          {articles.length === 1 ? (
            /* Full-width single article with large cover image */
            <Link href={`/discover/articles/${articles[0].id}`}>
              <div className="bg-white dark:bg-[#171b22] rounded-[20px] overflow-hidden hover:shadow-md dark:hover:shadow-black/30 transition-shadow cursor-pointer">
                {/* Cover Image */}
                <div className="relative h-[200px] w-full bg-earth-100 dark:bg-[#262b35]">
                  {articles[0].coverImageUrl ? (
                    <Image
                      src={articles[0].coverImageUrl}
                      alt={articles[0].title}
                      fill
                      className="object-cover"
                      sizes="100vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-12 h-12 text-earth-300 dark:text-[#7d8190]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                      </svg>
                    </div>
                  )}
                </div>
                
                {/* Content */}
                <div className="p-4 flex flex-col gap-1.5">
                  <h3 className="font-albert font-semibold text-lg text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] leading-[1.3]">
                    {articles[0].title}
                  </h3>
                  <p className="font-sans text-sm text-text-muted dark:text-[#7d8190]">
                    {articles[0].authorName}
                    {articles[0].readingTimeMinutes && ` · ${articles[0].readingTimeMinutes} min`}
                  </p>
                </div>
              </div>
            </Link>
          ) : (
            /* Grid layout for multiple articles */
            <div className="grid grid-cols-2 gap-3">
              {articles.slice(0, 4).map((article) => (
                <ArticleCard key={article.id} article={article} variant="grid" />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Links (pill chips) */}
      {links.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-albert text-[24px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3]">
            Links
          </h2>
          
          <div className="flex flex-wrap gap-2">
            {links.map((link) => (
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
      {downloads.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-albert text-[24px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3]">
            Downloads
          </h2>
          
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {downloads.map((download) => (
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


      {/* No content message - only if completely empty */}
      {!contentLoading && !hasContent && !hasAnyTasks && (
        <div className="text-center py-8">
          <p className="font-sans text-[16px] text-text-secondary dark:text-[#b2b6c2]">
            No program content available yet.
          </p>
        </div>
      )}
    </div>
  );
}
