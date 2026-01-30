'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { addMonths, subMonths } from 'date-fns';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Video,
  Users,
  User,
  MapPin,
  ExternalLink,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Download,
  RefreshCw,
  UserMinus,
  PhoneIncoming,
  PlayCircle,
  FileText,
} from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { useSchedulingEvents, useSchedulingActions, usePendingProposals } from '@/hooks/useScheduling';
import { useOrgCredits } from '@/hooks/useOrgCredits';
import { RescheduleCallModal } from './RescheduleCallModal';
import { CounterProposeModal } from './CounterProposeModal';
import { EventDetailPopup } from './EventDetailPopup';
import type { UnifiedEvent } from '@/types';
import { isWithinOneHourBefore } from '@/lib/utils';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Group events by date (YYYY-MM-DD) using local timezone
function groupEventsByDate(events: UnifiedEvent[]): Map<string, UnifiedEvent[]> {
  const grouped = new Map<string, UnifiedEvent[]>();
  for (const event of events) {
    // Use local date, not UTC date, so events display on the correct calendar day
    const eventDate = new Date(event.startDateTime);
    const dateKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`;
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(event);
  }
  return grouped;
}

// Date separator with lines on both sides
function DateSeparator({ date }: { date: Date }) {
  const formatted = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 h-px bg-[#e1ddd8] dark:bg-[#262b35]" />
      <span className="font-albert text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] whitespace-nowrap">
        {formatted}
      </span>
      <div className="flex-1 h-px bg-[#e1ddd8] dark:bg-[#262b35]" />
    </div>
  );
}

// Event type labels and icons
const EVENT_TYPE_INFO: Record<string, { label: string; icon: typeof Video; color: string }> = {
  coaching_1on1: { label: '1-on-1 Call', icon: User, color: 'text-brand-accent' },
  squad_call: { label: 'Squad Call', icon: Users, color: 'text-blue-500' },
  community_event: { label: 'Community Event', icon: Calendar, color: 'text-green-500' },
  intake_call: { label: 'Intake Call', icon: PhoneIncoming, color: 'text-teal-500' },
  cohort_call: { label: 'Group Call', icon: Users, color: 'text-purple-500' },
  community_call: { label: 'Community Call', icon: Users, color: 'text-emerald-500' },
};

interface EventItemProps {
  event: UnifiedEvent;
  currentUserId?: string;
  onRespond?: (eventId: string, action: 'accept' | 'decline', selectedTimeId?: string) => Promise<boolean>;
  onCancel?: (eventId: string, reason?: string) => void;
  onReschedule?: (event: UnifiedEvent) => void;
  onCounterPropose?: (eventId: string) => void;
  hideDate?: boolean;
  hasOrgCredits?: boolean; // If false, show warning for coaches on in-app calls
  isCoach?: boolean; // Whether current user is a coach
}

function EventItem({ event, currentUserId, onRespond, onCancel, onReschedule, onCounterPropose, hideDate, hasOrgCredits = true, isCoach = false }: EventItemProps) {
  const [acceptedTimeId, setAcceptedTimeId] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const typeInfo = EVENT_TYPE_INFO[event.eventType] || EVENT_TYPE_INFO.coaching_1on1;
  const Icon = typeInfo.icon;

  const startTime = new Date(event.startDateTime);
  const endTime = event.endDateTime ? new Date(event.endDateTime) : null;

  // Get pending proposed times
  const pendingProposedTimes = event.proposedTimes?.filter(t => t.status === 'pending') || [];

  // Strip "Call request with" prefix from title for cleaner display
  const displayTitle = event.title?.replace(/^Call request with\s*/i, '') || event.title;

  // Handle accepting a specific time
  const handleAccept = async (timeId: string) => {
    if (!onRespond) return;

    setIsAccepting(true);
    setAcceptedTimeId(timeId);
    setAcceptError(null);

    try {
      const success = await onRespond(event.id, 'accept', timeId);
      if (success) {
        setIsSuccess(true);
      } else {
        setAcceptError('Failed to accept. Please try again.');
        setAcceptedTimeId(null);
      }
    } catch {
      setAcceptError('Failed to accept. Please try again.');
      setAcceptedTimeId(null);
    } finally {
      setIsAccepting(false);
    }
  };

  // Handle declining all times
  const handleDecline = async () => {
    if (!onRespond) return;

    setIsAccepting(true);
    setAcceptError(null);

    try {
      await onRespond(event.id, 'decline');
    } catch {
      setAcceptError('Failed to decline. Please try again.');
    } finally {
      setIsAccepting(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatProposedTime = (time: { startDateTime: string; endDateTime: string }) => {
    const start = new Date(time.startDateTime);
    const end = new Date(time.endDateTime);
    return `${formatDate(start)} at ${formatTime(start)} - ${formatTime(end)}`;
  };

  const needsResponse = event.schedulingStatus === 'proposed' || event.schedulingStatus === 'counter_proposed';
  const isConfirmed = event.schedulingStatus === 'confirmed' || event.status === 'confirmed';

  // Generate ICS file for calendar download
  const generateICS = () => {
    const endDateTime = event.endDateTime || new Date(startTime.getTime() + (event.durationMinutes || 60) * 60 * 1000).toISOString();
    
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Coachful//Scheduling//EN',
      'BEGIN:VEVENT',
      `UID:${event.id}@coachful.co`,
      `DTSTART:${startTime.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTEND:${new Date(endDateTime).toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${event.description || ''}`,
      `LOCATION:${event.meetingLink || event.locationLabel || ''}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${event.title.replace(/[^a-z0-9]/gi, '_')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Get avatar URL and initials for display
  // For 1:1 coaching calls, show the "other person" (coach sees client, client sees coach)
  const isCoaching1on1 = event.eventType === 'coaching_1on1';
  const isViewerHost = isCoaching1on1 && currentUserId === event.hostUserId;
  const avatarUrl = isCoaching1on1
    ? (isViewerHost ? event.clientAvatarUrl : event.hostAvatarUrl)
    : event.hostAvatarUrl;

  // For 1:1 calls, show the other person's name in display title
  let finalDisplayTitle = displayTitle;
  if (isCoaching1on1) {
    const otherPersonName = isViewerHost
      ? (event.clientName || displayTitle)
      : (event.hostName || displayTitle);
    finalDisplayTitle = otherPersonName;
  }

  const initials = finalDisplayTitle
    ? finalDisplayTitle.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <div className="p-5 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#262b35] rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="flex items-start gap-4">
        {/* Avatar or fallback icon */}
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={finalDisplayTitle}
            className="w-11 h-11 rounded-xl object-cover shadow-sm"
          />
        ) : (
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br from-[#f3f1ef] to-[#ebe8e4] dark:from-[#262b35] dark:to-[#2a303c] flex items-center justify-center shadow-sm`}>
            {event.eventType === 'coaching_1on1' ? (
              <span className="text-sm font-semibold text-[#5f5a55] dark:text-[#b2b6c2]">{initials}</span>
            ) : (
              <Icon className={`w-5 h-5 ${typeInfo.color}`} />
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8] line-clamp-1">
                {finalDisplayTitle}
              </p>
              <p className="font-albert text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                {typeInfo.label}
              </p>
            </div>
            {isConfirmed && (
              <span className="flex items-center gap-1 px-2.5 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-full text-xs font-albert font-medium">
                <CheckCircle className="w-3.5 h-3.5" />
                Confirmed
              </span>
            )}
            {needsResponse && !isSuccess && (
              <span className="flex items-center gap-1 px-2.5 py-1 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 rounded-full text-xs font-albert font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                Pending
              </span>
            )}
          </div>

          <div className="mt-2 space-y-1">
            {!hideDate && (
              <div className="flex items-center gap-2 font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                <Calendar className="w-3.5 h-3.5" />
                <span>{formatDate(startTime)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {formatTime(startTime)}
                  {endTime && ` - ${formatTime(endTime)}`}
                </span>
              </div>
              {isConfirmed && (
                <button
                  onClick={generateICS}
                  className="p-1.5 text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-lg transition-colors"
                  title="Add to Calendar"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
            </div>
            {/* Location - smart detection like EventDetailPopup */}
            {(event.locationLabel || event.meetingLink) && (
              <div className="flex items-center gap-2 font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                <MapPin className="w-3.5 h-3.5" />
                <span>
                  {event.locationType === 'chat' ? (
                    'In-App Call'
                  ) : event.meetingProvider === 'zoom' ? (
                    'Zoom'
                  ) : event.meetingProvider === 'google_meet' ? (
                    'Google Meet'
                  ) : event.meetingProvider === 'stream' ? (
                    'In-App Call'
                  ) : event.meetingLink ? (
                    // Extract platform from URL or show domain for custom links
                    event.meetingLink.includes('zoom') ? 'Zoom' :
                    event.meetingLink.includes('meet.google') ? 'Google Meet' :
                    event.meetingLink.includes('teams') ? 'Microsoft Teams' :
                    (() => {
                      try {
                        return new URL(event.meetingLink).hostname.replace('www.', '');
                      } catch {
                        return 'External Link';
                      }
                    })()
                  ) : (
                    event.locationLabel
                  )}
                </span>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Proposed times section - OUTSIDE flex container for full width */}
      {needsResponse && onRespond && (
        <div className="mt-4 space-y-3">
          {/* Error state */}
          {acceptError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-2xl animate-in fade-in duration-300">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400">{acceptError}</p>
            </div>
          )}

          {/* Success state */}
          {isSuccess && acceptedTimeId ? (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800/30 rounded-2xl shadow-sm">
                <div className="p-2 bg-green-500 rounded-full animate-in zoom-in duration-300">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-semibold text-green-700 dark:text-green-300">
                    Call Confirmed!
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-0.5">
                    {formatProposedTime(pendingProposedTimes.find(t => t.id === acceptedTimeId) || pendingProposedTimes[0])}
                  </p>
                </div>
              </div>
            </div>
          ) : !isSuccess && (
            <>
              {/* SINGLE proposed time - side-by-side Decline/Accept */}
              {pendingProposedTimes.length === 1 && (
                <>
                  <div className="p-4 bg-gradient-to-r from-[#f9f8f7] to-[#f5f4f2] dark:from-[#262b35] dark:to-[#2a303b] rounded-2xl border border-[#e1ddd8] dark:border-[#363c49]">
                    <div className="flex items-center gap-3 font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8] mb-3">
                      <div className="p-2 bg-white dark:bg-[#1e222a] rounded-xl shadow-sm">
                        <Calendar className="w-4 h-4 text-brand-accent" />
                      </div>
                      <span className="font-medium">{formatProposedTime(pendingProposedTimes[0])}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleDecline}
                        disabled={isAccepting}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl font-albert text-sm font-semibold shadow-md hover:shadow-lg hover:from-red-600 hover:to-rose-600 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isAccepting && !acceptedTimeId ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                        Decline
                      </button>
                      <button
                        onClick={() => handleAccept(pendingProposedTimes[0].id)}
                        disabled={isAccepting}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-albert text-sm font-semibold shadow-md hover:shadow-lg hover:from-green-600 hover:to-emerald-600 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isAccepting && acceptedTimeId === pendingProposedTimes[0].id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        Accept
                      </button>
                    </div>
                  </div>
                  {/* Counter-propose link for single time */}
                  {onCounterPropose && (
                    <button
                      onClick={() => onCounterPropose(event.id)}
                      className="w-full text-center font-albert text-sm text-brand-accent hover:underline py-1"
                    >
                      Suggest different time →
                    </button>
                  )}
                </>
              )}

              {/* MULTIPLE proposed times - individual Accept buttons + Decline All */}
              {pendingProposedTimes.length > 1 && (
                <>
                  <p className="font-albert text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2]">
                    {pendingProposedTimes.length} proposed times:
                  </p>
                  <div className="space-y-2">
                    {pendingProposedTimes.map((time, index) => (
                      <div
                        key={time.id}
                        className="group p-4 bg-gradient-to-r from-[#f9f8f7] to-[#f5f4f2] dark:from-[#262b35] dark:to-[#2a303b] rounded-2xl border border-[#e1ddd8] dark:border-[#363c49] transition-all duration-300 hover:shadow-md hover:border-brand-accent/30 animate-in fade-in slide-in-from-left-2"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <div className="flex items-center gap-3 font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8] mb-3">
                          <div className="p-2 bg-white dark:bg-[#1e222a] rounded-xl shadow-sm">
                            <Calendar className="w-4 h-4 text-brand-accent" />
                          </div>
                          <span className="font-medium">{formatProposedTime(time)}</span>
                        </div>
                        <button
                          onClick={() => handleAccept(time.id)}
                          disabled={isAccepting}
                          className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-albert text-sm font-semibold shadow-md hover:shadow-lg hover:from-green-600 hover:to-emerald-600 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md"
                        >
                          {isAccepting && acceptedTimeId === time.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                          Accept
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Decline All Button */}
                  <button
                    onClick={handleDecline}
                    disabled={isAccepting}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl font-albert text-sm font-semibold shadow-md hover:shadow-lg hover:from-red-600 hover:to-rose-600 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                  >
                    {isAccepting && !acceptedTimeId ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    Decline All
                  </button>

                  {/* Counter-propose link for multiple times */}
                  {onCounterPropose && (
                    <button
                      onClick={() => onCounterPropose(event.id)}
                      className="w-full text-center font-albert text-sm text-brand-accent hover:underline py-1"
                    >
                      Suggest different time →
                    </button>
                  )}
                </>
              )}

              {/* Fallback if no proposed times */}
              {pendingProposedTimes.length === 0 && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleDecline}
                    disabled={isAccepting}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl font-albert text-sm font-semibold shadow-md hover:shadow-lg hover:from-red-600 hover:to-rose-600 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAccepting && !acceptedTimeId ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    Decline
                  </button>
                  <button
                    onClick={() => handleAccept(event.proposedTimes?.[0]?.id || '')}
                    disabled={isAccepting}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-albert text-sm font-semibold shadow-md hover:shadow-lg hover:from-green-600 hover:to-emerald-600 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAccepting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Accept
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Confirmed event actions - OUTSIDE flex container for full width */}
      {isConfirmed && (
        <div className="mt-4 space-y-2">
          {/* Join button or "Link will appear" message */}
          {(() => {
            const locationLower = event.locationLabel?.toLowerCase() || '';
            const isInAppCall = event.locationType === 'chat' ||
                               event.meetingProvider === 'stream' ||
                               locationLower.includes('in-app') ||
                               locationLower.includes('in app') ||
                               locationLower === 'chat';
            const hasExternalLink = !!event.meetingLink;
            const hasJoinableCall = hasExternalLink || isInAppCall;
            const withinTimeWindow = isWithinOneHourBefore(event.startDateTime);

            if (hasExternalLink && withinTimeWindow) {
              return (
                <a
                  href={event.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-accent text-white rounded-xl font-albert text-sm font-semibold shadow-md hover:shadow-lg hover:opacity-90 active:scale-95 transition-all duration-200"
                >
                  <ExternalLink className="w-4 h-4" />
                  Join Call
                </a>
              );
            }

            if (isInAppCall && !hasExternalLink && withinTimeWindow) {
              return (
                <Link
                  href={`/call/event-${event.id}`}
                  className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-accent text-white rounded-xl font-albert text-sm font-semibold shadow-md hover:shadow-lg hover:opacity-90 active:scale-95 transition-all duration-200"
                >
                  <Video className="w-4 h-4" />
                  Join Call
                </Link>
              );
            }

            if (hasJoinableCall && !withinTimeWindow) {
              return (
                <p className="text-center font-albert text-sm text-text-muted">
                  Link will appear 1 hour before the call
                </p>
              );
            }

            return null;
          })()}
          {/* Community events: Remove RSVP. Group calls: no actions. Individual: Reschedule + Cancel */}
          {event.eventType === 'community_event' ? (
            // Community event - Remove RSVP option
            onCancel && (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#f3f1ef] dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] rounded-xl font-albert text-sm font-medium hover:bg-[#e8e4df] dark:hover:bg-[#313746] hover:shadow-sm active:scale-95 transition-all duration-200"
              >
                <UserMinus className="w-4 h-4" />
                Remove RSVP
              </button>
            )
          ) : ['squad_call', 'cohort_call'].includes(event.eventType) ? (
            // Group calls (squad/cohort) - no action buttons, just Join
            null
          ) : (
            // Individual events (coaching_1on1, intake_call) - Reschedule + Cancel options
            <div className="grid grid-cols-2 gap-2">
              {onReschedule && (
                <button
                  onClick={() => onReschedule(event)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#f3f1ef] dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] rounded-xl font-albert text-sm font-medium hover:bg-[#e8e4df] dark:hover:bg-[#313746] hover:shadow-sm active:scale-95 transition-all duration-200"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reschedule
                </button>
              )}
              {onCancel && (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#f3f1ef] dark:bg-[#262b35] text-red-600 dark:text-red-400 rounded-xl font-albert text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 hover:shadow-sm active:scale-95 transition-all duration-200"
                >
                  <XCircle className="w-4 h-4" />
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cancel/Remove RSVP confirmation dialog - OUTSIDE flex container for full width */}
      {showCancelConfirm && (() => {
        const isCommunityEvent = event.eventType === 'community_event';
        return (
          <div className="mt-3 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl">
            <p className="font-albert text-sm font-medium text-red-700 dark:text-red-300 mb-3">
              {isCommunityEvent ? 'Remove your RSVP from this event?' : 'Are you sure you want to cancel this call?'}
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder={isCommunityEvent ? 'Reason (optional)' : 'Reason for cancellation (optional)'}
              rows={2}
              className="w-full px-3 py-2 font-albert text-sm bg-white dark:bg-[#1e222a] border border-red-200 dark:border-red-800/30 rounded-lg text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#a7a39e] focus:outline-none focus:ring-2 focus:ring-red-500 resize-none mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowCancelConfirm(false);
                  setCancelReason('');
                }}
                className="flex-1 px-4 py-2 font-albert text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
              >
                {isCommunityEvent ? 'Keep RSVP' : 'Keep Call'}
              </button>
              <button
                onClick={() => {
                  onCancel?.(event.id, cancelReason || undefined);
                  setShowCancelConfirm(false);
                  setCancelReason('');
                }}
                className="flex-1 px-4 py-2 font-albert text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
              >
                {isCommunityEvent ? 'Remove RSVP' : 'Cancel Call'}
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// Compact past event item with Recording link
interface PastEventItemProps {
  event: UnifiedEvent;
}

function PastEventItem({ event }: PastEventItemProps) {
  if (!event || !event.startDateTime) return null;

  const typeInfo = EVENT_TYPE_INFO[event.eventType] || EVENT_TYPE_INFO.coaching_1on1;
  const Icon = typeInfo.icon;
  const startTime = new Date(event.startDateTime);
  const hasRecording = !!event.recordingUrl;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Strip "Call request with" prefix
  const displayTitle = event.title?.replace(/^Call request with\s*/i, '') || event.title || 'Event';

  return (
    <div className="flex items-center justify-between p-3 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br from-[#f3f1ef] to-[#ebe8e4] dark:from-[#262b35] dark:to-[#2a303c] flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-4 h-4 ${typeInfo.color}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-albert font-medium text-sm text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
            {displayTitle}
          </p>
          <p className="font-albert text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
            {formatDate(startTime)} at {formatTime(startTime)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
        <Link
          href={`/discover/events/${event.id}`}
          className="flex items-center gap-1 px-2 py-1.5 text-xs font-albert font-medium text-brand-accent hover:bg-brand-accent/10 rounded-lg transition-colors"
        >
          <PlayCircle className="w-3.5 h-3.5" />
          {hasRecording ? 'Recording' : 'Details'}
        </Link>
      </div>
    </div>
  );
}

interface CalendarContentProps {
  /** Whether to show compact version for panel/sheet */
  compact?: boolean;
}

/**
 * CalendarContent
 * 
 * Shared content component for the calendar panel/sheet showing:
 * - Scheduled calls with coach
 * - Squad calls
 * - Purchased discover events
 * - Pending proposals to respond to
 */
export function CalendarContent({ compact = false }: CalendarContentProps) {
  const { user } = useUser();
  const currentUserId = user?.id;
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [rescheduleEvent, setRescheduleEvent] = useState<UnifiedEvent | null>(null);
  const [selectedPastEvent, setSelectedPastEvent] = useState<UnifiedEvent | null>(null);
  const [counterProposeEvent, setCounterProposeEvent] = useState<UnifiedEvent | null>(null);
  const [isCounterProposing, setIsCounterProposing] = useState(false);
  const [counterProposeError, setCounterProposeError] = useState<string | null>(null);
  const { respondToProposal, cancelEvent, isLoading: respondLoading } = useSchedulingActions();

  // Check if user is a coach and get org credits status
  const userRole = (user?.publicMetadata as { orgRole?: string })?.orgRole;
  const isCoach = userRole === 'coach' || userRole === 'super_coach' || userRole === 'admin' || userRole === 'super_admin';
  const { hasCredits: hasOrgCredits } = useOrgCredits(isCoach);

  // Calculate date range for current month view
  const dateRange = useMemo(() => {
    const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }, [currentMonth]);

  // Fetch events for the month
  const { events, isLoading, error, refetch } = useSchedulingEvents({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    role: 'all',
  });

  // Fetch pending proposals
  const { proposals, refetch: refetchProposals } = usePendingProposals();

  // Navigation
  const navigateMonth = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setCurrentMonth(new Date());
      return;
    }

    setCurrentMonth(direction === 'prev' ? subMonths(currentMonth, 1) : addMonths(currentMonth, 1));
  };

  // Handle respond to proposal - returns true on success, false on failure
  const handleRespond = useCallback(async (eventId: string, action: 'accept' | 'decline', selectedTimeId?: string): Promise<boolean> => {
    try {
      await respondToProposal({ eventId, action, selectedTimeId });
      // Small delay to let the UI show success state before refetching
      setTimeout(() => {
        refetch();
        refetchProposals();
      }, 1500);
      return true;
    } catch {
      return false;
    }
  }, [respondToProposal, refetch, refetchProposals]);

  // Handle cancel confirmed event
  const handleCancel = useCallback(async (eventId: string, reason?: string) => {
    try {
      await cancelEvent(eventId, reason);
      refetch();
      refetchProposals();
    } catch {
      // Error handled by hook
    }
  }, [cancelEvent, refetch, refetchProposals]);

  // Handle reschedule
  const handleReschedule = useCallback((event: UnifiedEvent) => {
    setRescheduleEvent(event);
  }, []);

  // Handle reschedule success
  const handleRescheduleSuccess = useCallback(() => {
    setRescheduleEvent(null);
    refetch();
    refetchProposals();
  }, [refetch, refetchProposals]);

  // Handle counter-propose - open modal to suggest different times
  const handleCounterPropose = useCallback((eventId: string) => {
    const event = proposals.find(e => e.id === eventId);
    if (event) {
      setCounterProposeEvent(event);
      setCounterProposeError(null);
    }
  }, [proposals]);

  // Handle counter-propose submission
  const handleCounterProposeSubmit = useCallback(async (
    proposedTimes: Array<{ startDateTime: string; endDateTime: string }>,
    message?: string
  ) => {
    if (!counterProposeEvent) return;

    setIsCounterProposing(true);
    setCounterProposeError(null);

    try {
      await respondToProposal({
        eventId: counterProposeEvent.id,
        action: 'counter',
        counterTimes: proposedTimes,
        message,
      });
      setCounterProposeEvent(null);
      refetch();
      refetchProposals();
    } catch (err) {
      setCounterProposeError(err instanceof Error ? err.message : 'Failed to submit counter-proposal');
      throw err;
    } finally {
      setIsCounterProposing(false);
    }
  }, [counterProposeEvent, respondToProposal, refetch, refetchProposals]);

  // Group events by upcoming status
  // Exclude proposed/counter_proposed events as they're shown in "Pending Proposals" section
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const pendingStatuses = ['proposed', 'counter_proposed'];
    return events
      .filter(e => new Date(e.startDateTime) >= now && !pendingStatuses.includes(e.schedulingStatus || ''))
      .sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime());
  }, [events]);

  const pastEvents = useMemo(() => {
    const now = new Date();
    return events
      .filter(e => new Date(e.startDateTime) < now)
      .sort((a, b) => new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime());
  }, [events]);

  return (
    <div className="flex flex-col h-full">
      {/* Month Navigation */}
      <div className="flex items-center justify-between px-5 py-3 bg-[#f9f8f7] dark:bg-[#1e222a] border-b border-[#e1ddd8] dark:border-[#262b35]">
        <button
          onClick={() => navigateMonth('prev')}
          className="p-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-text-primary" />
        </button>
        <div className="flex items-center gap-2">
          <span className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
            {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </span>
          <button
            onClick={() => navigateMonth('today')}
            className="px-2 py-1 text-xs font-medium text-brand-accent hover:bg-brand-accent/10 rounded transition-colors"
          >
            Today
          </button>
        </div>
        <button
          onClick={() => navigateMonth('next')}
          className="p-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-text-primary" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Pending Proposals */}
        {proposals.length > 0 && (
          <div className="p-5 border-b border-[#e1ddd8] dark:border-[#262b35] bg-gradient-to-b from-amber-50/50 to-transparent dark:from-amber-900/10 dark:to-transparent">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl shadow-md">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-albert font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                  Pending Responses
                </h3>
                <p className="font-albert text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                  {proposals.length} call{proposals.length > 1 ? 's' : ''} waiting for your response
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {proposals.map(event => (
                <EventItem
                  key={event.id}
                  event={event}
                  currentUserId={currentUserId}
                  onRespond={handleRespond}
                  onCounterPropose={handleCounterPropose}
                  hasOrgCredits={hasOrgCredits}
                  isCoach={isCoach}
                />
              ))}
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-brand-accent animate-spin" />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="p-4">
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl font-albert text-red-600 dark:text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Upcoming Events */}
        {!isLoading && !error && (
          <div className="p-4">
            <h3 className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-3">
              Upcoming Events
            </h3>
            {upcomingEvents.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-14 h-14 bg-[#f3f1ef] dark:bg-[#11141b] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-7 h-7 text-text-muted" />
                </div>
                <p className="font-albert text-[15px] text-text-secondary">
                  No upcoming events
                </p>
                <p className="font-albert text-[13px] text-text-muted mt-1">
                  Your scheduled calls and events will appear here
                </p>
              </div>
            ) : (
              <div>
                {Array.from(groupEventsByDate(upcomingEvents)).map(([dateKey, dateEvents]) => (
                  <div key={dateKey}>
                    <DateSeparator date={new Date(dateKey + 'T00:00:00')} />
                    <div className="space-y-3">
                      {dateEvents.map(event => (
                        <EventItem
                          key={event.id}
                          event={event}
                          currentUserId={currentUserId}
                          onRespond={handleRespond}
                          onCancel={handleCancel}
                          onReschedule={handleReschedule}
                          hideDate
                          hasOrgCredits={hasOrgCredits}
                          isCoach={isCoach}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Past Events - show with Recording/Details links */}
        {!isLoading && !error && pastEvents.length > 0 && (
          <div className="p-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
            <h3 className="font-albert font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-3">
              Past Events
            </h3>
            <div className="space-y-2">
              {pastEvents.slice(0, 5).map(event => (
                <PastEventItem
                  key={event.id}
                  event={event}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reschedule Modal */}
      {rescheduleEvent && (
        <RescheduleCallModal
          isOpen={!!rescheduleEvent}
          onClose={() => setRescheduleEvent(null)}
          event={rescheduleEvent}
          onSuccess={handleRescheduleSuccess}
        />
      )}

      {/* Counter-Propose Modal */}
      {counterProposeEvent && (
        <CounterProposeModal
          isOpen={!!counterProposeEvent}
          onClose={() => setCounterProposeEvent(null)}
          event={counterProposeEvent}
          onSubmit={handleCounterProposeSubmit}
          isLoading={isCounterProposing}
          error={counterProposeError}
        />
      )}

      {/* Past Event Detail Popup */}
      {selectedPastEvent && (
        <EventDetailPopup
          event={selectedPastEvent}
          isOpen={!!selectedPastEvent}
          onClose={() => setSelectedPastEvent(null)}
        />
      )}
    </div>
  );
}

export default CalendarContent;













