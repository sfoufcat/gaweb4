'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import useSWR from 'swr';
import { Calendar, MessageCircle, Download, Pencil } from 'lucide-react';
import type { UnifiedEvent } from '@/types';
import { ScheduleCohortEventModal } from '@/components/scheduling/ScheduleCohortEventModal';
import { useChatSheet } from '@/contexts/ChatSheetContext';

/**
 * CohortSessionCard Component
 *
 * Displays the next scheduled cohort session for cohort (group) programs.
 * Uses the unified events API to fetch cohort_call events by cohortId.
 * Shows:
 * - Date & time in event timezone and user's local timezone
 * - Location (e.g., "Zoom", "Google Meet")
 * - Hosted by: Coach name + profile picture
 * - "Add to calendar" button (downloads .ics file)
 * - "Go to chat" button (if chat channel exists)
 * - Schedule/Edit button (for coaches only)
 */

export interface CoachInfo {
  firstName: string;
  lastName: string;
  imageUrl: string;
}

interface CohortSessionCardProps {
  cohortId: string;
  programId?: string;
  programName?: string;
  cohortName?: string;
  chatChannelId?: string;
  isCoach?: boolean;
  coachInfo?: CoachInfo;
  onSessionUpdated?: () => void;
}

interface EventsResponse {
  events: UnifiedEvent[];
}

/**
 * Formats a date in a specific timezone
 */
function formatDateInTimezone(date: Date, timezone: string): { date: string; time: string; tzAbbrev: string } {
  try {
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      day: 'numeric',
      month: 'long',
    });

    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const tzFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    });
    const tzParts = tzFormatter.formatToParts(date);
    const tzAbbrev = tzParts.find(p => p.type === 'timeZoneName')?.value || timezone;

    return {
      date: dateFormatter.format(date),
      time: timeFormatter.format(date),
      tzAbbrev,
    };
  } catch {
    return {
      date: date.toLocaleDateString('en-US', { day: 'numeric', month: 'long' }),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      tzAbbrev: 'UTC',
    };
  }
}

function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

export function CohortSessionCard({
  cohortId,
  programId,
  programName = 'Program',
  cohortName = 'Cohort',
  chatChannelId,
  isCoach = false,
  coachInfo,
  onSessionUpdated,
}: CohortSessionCardProps) {
  const router = useRouter();
  const { openChatSheet } = useChatSheet();
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const userTimezone = getUserTimezone();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch upcoming cohort_call event for this cohort
  const { data, mutate } = useSWR<EventsResponse>(
    cohortId ? `/api/events?cohortId=${cohortId}&eventType=cohort_call&status=confirmed&upcoming=true&limit=1` : null,
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    },
    { revalidateOnFocus: false }
  );

  const event = data?.events?.[0] ?? null;
  const hasScheduledSession = event != null;
  const sessionTimezone = event?.timezone || 'UTC';
  const sameTimezone = sessionTimezone === userTimezone;

  const sessionTimeInfo = useMemo(() => {
    if (!event?.startDateTime) return null;

    const sessionDate = new Date(event.startDateTime);
    const eventTime = formatDateInTimezone(sessionDate, sessionTimezone);
    const userTime = formatDateInTimezone(sessionDate, userTimezone);

    return {
      eventTime,
      userTime,
      sameTimezone,
    };
  }, [event?.startDateTime, sessionTimezone, userTimezone, sameTimezone]);

  const handleAddToCalendar = async () => {
    if (!event) return;

    const link = document.createElement('a');
    link.href = `/api/events/${event.id}/calendar.ics`;
    link.download = 'cohort-session.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGoToChat = () => {
    if (chatChannelId) {
      if (isMobile) {
        openChatSheet(chatChannelId);
      } else {
        router.push(`/chat?channel=${chatChannelId}`);
      }
    }
  };

  const handleScheduleSuccess = () => {
    setShowScheduleModal(false);
    mutate();
    if (onSessionUpdated) {
      onSessionUpdated();
    }
  };

  return (
    <>
      <div className="bg-white/80 dark:bg-[#171b22]/80 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-5 shadow-sm mb-6">
        {/* Card Title */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-accent" />
            <h3 className="font-albert text-[16px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px]">
              Next session
            </h3>
          </div>

          {/* Schedule/Edit button for coaches */}
          {isCoach && (
            <button
              onClick={() => setShowScheduleModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-brand-accent hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] rounded-full transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              {hasScheduledSession ? 'Edit' : 'Schedule'}
            </button>
          )}
        </div>

        {hasScheduledSession && sessionTimeInfo ? (
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            {/* Left: Session Details */}
            <div className="space-y-2">
              {/* Date & Time */}
              <p className="font-albert text-[15px] text-text-primary">
                <span className="font-medium">{sessionTimeInfo.eventTime.date}</span>
                {' · '}
                <span>{sessionTimeInfo.eventTime.time} {sessionTimeInfo.eventTime.tzAbbrev}</span>
                {!sessionTimeInfo.sameTimezone && (
                  <span className="text-text-secondary">
                    {' '}({sessionTimeInfo.userTime.time} your time)
                  </span>
                )}
                {sessionTimeInfo.sameTimezone && (
                  <span className="text-text-secondary text-[13px]">
                    {' '}(same as your time)
                  </span>
                )}
              </p>

              {/* Location */}
              {event.locationLabel && (
                <p className="font-albert text-[14px] text-text-secondary">
                  <span className="font-medium text-text-primary">Location:</span>{' '}
                  {event.locationLabel.startsWith('http') ? (
                    <a
                      href={event.locationLabel}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-accent hover:underline"
                    >
                      {event.locationLabel}
                    </a>
                  ) : (
                    event.locationLabel
                  )}
                </p>
              )}

              {/* Hosted by (Coach info) */}
              {coachInfo && (
                <div className="flex items-center gap-1.5 font-albert text-[14px] text-text-secondary">
                  <span className="font-medium text-text-primary">Hosted by:</span>
                  <span>{coachInfo.firstName} {coachInfo.lastName}</span>
                  {coachInfo.imageUrl ? (
                    <Image
                      src={coachInfo.imageUrl}
                      alt=""
                      width={20}
                      height={20}
                      className="rounded-full object-cover shrink-0"
                      unoptimized
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-brand-accent flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-medium text-white">
                        {coachInfo.firstName.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Session Title */}
              {event.title && (
                <p className="font-albert text-[13px] text-text-secondary italic">
                  {event.title}
                </p>
              )}
            </div>

            {/* Right: Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 shrink-0">
              <button
                onClick={handleAddToCalendar}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#f3f1ef] dark:bg-[#11141b] hover:bg-[#e9e5e0] dark:hover:bg-[#171b22] rounded-full font-albert text-[14px] font-medium text-text-primary dark:text-[#f5f5f8] transition-colors"
              >
                <Download className="w-4 h-4" />
                Add to calendar
              </button>

              {chatChannelId && (
                <button
                  onClick={handleGoToChat}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-accent hover:bg-brand-accent/90 rounded-full font-albert text-[14px] font-medium text-white transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Go to chat
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="font-albert text-[14px] text-text-secondary">
              No upcoming session scheduled yet.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 shrink-0">
              <button
                disabled
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#f3f1ef] dark:bg-[#11141b] rounded-full font-albert text-[14px] font-medium text-text-secondary/60 dark:text-[#7d8190]/60 cursor-not-allowed"
                title="No session scheduled"
              >
                <Download className="w-4 h-4" />
                Add to calendar
              </button>

              {chatChannelId && (
                <button
                  onClick={handleGoToChat}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-accent hover:bg-brand-accent/90 rounded-full font-albert text-[14px] font-medium text-white transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Go to chat
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Schedule Modal for Coaches */}
      {isCoach && programId && (
        <ScheduleCohortEventModal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          cohort={{ id: cohortId, name: cohortName }}
          programId={programId}
          programName={programName}
          onSuccess={handleScheduleSuccess}
        />
      )}
    </>
  );
}
