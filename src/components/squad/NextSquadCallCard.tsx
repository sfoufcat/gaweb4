'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import useSWR from 'swr';
import { Calendar, MessageCircle, Download, Pencil, Video } from 'lucide-react';
import type { Squad, UnifiedEvent } from '@/types';
import { SquadCallEditForm } from './SquadCallEditForm';
import { useChatSheet } from '@/contexts/ChatSheetContext';

/**
 * NextSquadCallCard Component
 * 
 * Displays the next scheduled squad call for squads with coaches.
 * Uses the unified events API to fetch event data.
 * Shows:
 * - Date & time in squad timezone and user's local timezone
 * - Location (e.g., "Squad chat", "Zoom")
 * - Guided by: Coach name + profile picture
 * - "Add to calendar" button (downloads .ics file)
 * - "Go to chat" button
 * - Edit button (for coaches only)
 * 
 * Only renders for squads with hasCoach === true.
 */

export interface CoachInfo {
  firstName: string;
  lastName: string;
  imageUrl: string;
}

interface NextSquadCallCardProps {
  squad: Squad;
  isCoach?: boolean; // If true, shows edit button
  onCallUpdated?: () => void; // Callback when call is updated/created
  coachInfo?: CoachInfo; // Coach details for "Guided by" display
}

interface EventsResponse {
  events: UnifiedEvent[];
}

/**
 * Formats a date in a specific timezone
 */
function formatDateInTimezone(date: Date, timezone: string): { date: string; time: string; tzAbbrev: string } {
  try {
    // Format date parts
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
    
    // Get timezone abbreviation
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
    // Fallback if timezone is invalid
    return {
      date: date.toLocaleDateString('en-US', { day: 'numeric', month: 'long' }),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      tzAbbrev: 'UTC',
    };
  }
}

/**
 * Get user's local timezone
 */
function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

export function NextSquadCallCard({ squad, isCoach = false, onCallUpdated, coachInfo }: NextSquadCallCardProps) {
  const router = useRouter();
  const { openChatSheet } = useChatSheet();
  const [showEditModal, setShowEditModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const userTimezone = getUserTimezone();
  
  // Detect mobile for chat sheet vs navigation
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Only show for squads with a coach
  const hasCoach = !!squad.coachId;
  
  // Fetch upcoming confirmed event for this squad using unified events API
  // Note: We don't filter by eventType to catch both squad_calls and regular events attached to this squad
  const { data, mutate } = useSWR<EventsResponse>(
    hasCoach ? `/api/events?squadId=${squad.id}&status=confirmed&upcoming=true&limit=1` : null,
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    },
    { revalidateOnFocus: false }
  );
  
  // Get the next confirmed event
  const event = data?.events?.[0] ?? null;
  const hasScheduledCall = event != null;
  const callTimezone = event?.timezone || squad.timezone || 'UTC';
  const sameTimezone = callTimezone === userTimezone;
  
  // Parse and format the call time
  const callTimeInfo = useMemo(() => {
    if (!event?.startDateTime) return null;
    
    const callDate = new Date(event.startDateTime);
    
    // Format in squad/coach timezone
    const squadTime = formatDateInTimezone(callDate, callTimezone);
    
    // Format in user's local timezone
    const userTime = formatDateInTimezone(callDate, userTimezone);
    
    return {
      squadTime,
      userTime,
      sameTimezone,
    };
  }, [event?.startDateTime, callTimezone, userTimezone, sameTimezone]);
  
  // Don't render for squads without a coach
  if (!hasCoach) {
    return null;
  }
  
  const handleAddToCalendar = async () => {
    if (!event) return;
    
    // Trigger ICS download using unified events API
    const link = document.createElement('a');
    link.href = `/api/events/${event.id}/calendar.ics`;
    link.download = 'squad-call.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleGoToChat = () => {
    if (squad.chatChannelId) {
      if (isMobile) {
        // On mobile, open chat sheet slideup
        openChatSheet(squad.chatChannelId);
      } else {
        // On desktop, navigate to full chat page
        router.push(`/chat?channel=${squad.chatChannelId}`);
      }
    }
  };
  
  const handleEditSuccess = () => {
    setShowEditModal(false);
    // Revalidate the events data
    mutate();
    if (onCallUpdated) {
      onCallUpdated();
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
            Next community call
          </h3>
        </div>
        
        {/* Edit button for coaches */}
        {isCoach && (
          <button
            onClick={() => setShowEditModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-brand-accent hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] rounded-full transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            {hasScheduledCall ? 'Edit' : 'Schedule'}
          </button>
        )}
      </div>
      
      {hasScheduledCall && callTimeInfo ? (
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          {/* Left: Call Details */}
          <div className="space-y-2">
            {/* Date & Time */}
            <p className="font-albert text-[15px] text-text-primary">
              <span className="font-medium">{callTimeInfo.squadTime.date}</span>
              {' · '}
              <span>{callTimeInfo.squadTime.time} {callTimeInfo.squadTime.tzAbbrev}</span>
              {!callTimeInfo.sameTimezone && (
                <span className="text-text-secondary">
                  {' '}({callTimeInfo.userTime.time} your time)
                </span>
              )}
              {callTimeInfo.sameTimezone && (
                <span className="text-text-secondary text-[13px]">
                  {' '}(same as your time)
                </span>
              )}
            </p>
            
            {/* Location - show link or "Available soon" based on time */}
            {(() => {
              const eventStart = new Date(event.startDateTime);
              const now = new Date();
              const oneHourBefore = new Date(eventStart.getTime() - 60 * 60 * 1000);
              const showLink = event.meetingLink && now >= oneHourBefore;

              return (
                <p className="font-albert text-[14px] text-text-secondary">
                  <span className="font-medium text-text-primary">Location:</span>{' '}
                  {showLink ? (
                    <a
                      href={event.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-accent hover:underline"
                    >
                      {event.locationLabel || 'Join link'}
                    </a>
                  ) : (
                    <span>Available soon</span>
                  )}
                </p>
              );
            })()}
            
            {/* Guided by (Coach info) */}
            {coachInfo && (
              <div className="flex items-center gap-1.5 font-albert text-[14px] text-text-secondary">
                <span className="font-medium text-text-primary">Guided by:</span>
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
            
            {/* Optional Title */}
            {event.title && event.title !== 'Squad coaching call' && (
              <p className="font-albert text-[13px] text-text-secondary italic">
                {event.title}
              </p>
            )}
          </div>
          
          {/* Right: Action Buttons */}
          <div className="flex flex-col items-start gap-2 shrink-0">
            <div className="flex flex-row gap-3">
              <button
                onClick={handleAddToCalendar}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#f3f1ef] dark:bg-[#11141b] hover:bg-[#e9e5e0] dark:hover:bg-[#171b22] rounded-full font-albert text-[14px] font-medium text-text-primary dark:text-[#f5f5f8] transition-colors"
              >
                <Download className="w-4 h-4" />
                Add to calendar
              </button>
              <button
                onClick={() => {
                  if (event.meetingLink) {
                    const eventStart = new Date(event.startDateTime);
                    const oneHourBefore = new Date(eventStart.getTime() - 60 * 60 * 1000);
                    if (new Date() >= oneHourBefore) {
                      window.open(event.meetingLink, '_blank');
                    }
                  }
                }}
                disabled={!event.meetingLink || new Date() < new Date(new Date(event.startDateTime).getTime() - 60 * 60 * 1000)}
                className={`inline-flex items-center justify-center px-4 py-2.5 rounded-full font-albert text-[14px] font-medium transition-colors ${
                  event.meetingLink && new Date() >= new Date(new Date(event.startDateTime).getTime() - 60 * 60 * 1000)
                    ? 'bg-brand-accent hover:bg-brand-accent/90 text-white cursor-pointer'
                    : 'bg-brand-accent opacity-60 text-white cursor-not-allowed'
                }`}
              >
                Join Call
              </button>
            </div>
            {(!event.meetingLink || new Date() < new Date(new Date(event.startDateTime).getTime() - 60 * 60 * 1000)) && (
              <span className="w-full text-[12px] text-text-secondary sm:text-right">
                Link available 1 hr before call
              </span>
            )}
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="font-albert text-[14px] text-text-secondary">
            No upcoming community call scheduled yet.
          </p>
          
          <div className="flex flex-row gap-3 shrink-0">
            <button
              disabled
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#f3f1ef] dark:bg-[#11141b] rounded-full font-albert text-[14px] font-medium text-text-secondary/60 dark:text-[#7d8190]/60 cursor-not-allowed"
              title="No call scheduled"
            >
              <Download className="w-4 h-4" />
              Add to calendar
            </button>

            <button
              disabled
              className="inline-flex items-center justify-center px-4 py-2.5 bg-brand-accent opacity-60 rounded-full font-albert text-[14px] font-medium text-white cursor-not-allowed"
            >
              Join Call
            </button>
          </div>
        </div>
      )}
    </div>
    
    {/* Edit Modal */}
    {isCoach && (
      <SquadCallEditForm
        squad={squad}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={handleEditSuccess}
      />
    )}
    </>
  );
}

