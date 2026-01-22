'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  X,
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
  Send,
  RefreshCw,
} from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { useSchedulingEvents, useSchedulingActions, usePendingProposals } from '@/hooks/useScheduling';
import { RescheduleCallModal } from './RescheduleCallModal';
import { CounterProposeModal } from './CounterProposeModal';
import type { UnifiedEvent } from '@/types';

interface UserCalendarPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Group events by date (YYYY-MM-DD)
function groupEventsByDate(events: UnifiedEvent[]): Map<string, UnifiedEvent[]> {
  const grouped = new Map<string, UnifiedEvent[]>();
  for (const event of events) {
    // Safety check: skip events without valid startDateTime
    if (!event || !event.startDateTime) {
      console.error('[groupEventsByDate] Skipping event with missing startDateTime:', event?.id);
      continue;
    }
    const dateKey = new Date(event.startDateTime).toISOString().split('T')[0];
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
      <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] whitespace-nowrap">
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
  community_event: { label: 'Event', icon: Calendar, color: 'text-green-500' },
};

interface EventItemProps {
  event: UnifiedEvent;
  currentUserId?: string;
  onRespond?: (eventId: string, action: 'accept' | 'decline', selectedTimeId?: string) => Promise<boolean>;
  onCancel?: (eventId: string, reason?: string) => void;
  onReschedule?: (event: UnifiedEvent) => void;
  onCounterPropose?: (eventId: string) => void;
  isMyRequest?: boolean; // True if this is user's own pending request
  hideDate?: boolean;
}

function EventItem({ event, currentUserId, onRespond, onCancel, onReschedule, onCounterPropose, isMyRequest, hideDate }: EventItemProps) {
  const [acceptedTimeId, setAcceptedTimeId] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Safety check: return null if event or startDateTime is missing
  if (!event || !event.startDateTime) {
    console.error('[EventItem] Invalid event data:', event);
    return null;
  }

  const typeInfo = EVENT_TYPE_INFO[event.eventType] || EVENT_TYPE_INFO.coaching_1on1;
  const Icon = typeInfo.icon;

  const startTime = new Date(event.startDateTime);
  const endTime = event.endDateTime ? new Date(event.endDateTime) : null;

  // Get pending proposed times (not declined)
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
    } catch (err) {
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
    } catch (err) {
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
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                {typeInfo.label}
              </p>
            </div>
            {isConfirmed && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-full text-xs">
                <CheckCircle className="w-3 h-3" />
                Confirmed
              </span>
            )}
            {isMyRequest && needsResponse && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-xs">
                <Send className="w-3 h-3" />
                Awaiting Response
              </span>
            )}
            {!isMyRequest && needsResponse && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 rounded-full text-xs">
                <AlertCircle className="w-3 h-3" />
                Pending
              </span>
            )}
          </div>

          {/* Date/time details - always show for non-pending or for own requests */}
          {(isMyRequest || !needsResponse || pendingProposedTimes.length === 0) && (
            <div className="mt-2 space-y-1">
              {!hideDate && (
                <div className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{formatDate(startTime)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {formatTime(startTime)}
                    {endTime && ` - ${formatTime(endTime)}`}
                  </span>
                </div>
                {isConfirmed && (
                  <button
                    onClick={generateICS}
                    className="p-1.5 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-lg transition-colors"
                    title="Add to Calendar"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
              </div>
              {event.locationLabel && (
                <div className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{event.locationLabel}</span>
                </div>
              )}
            </div>
          )}

          {/* Show all proposed times for user's own requests */}
          {isMyRequest && needsResponse && pendingProposedTimes.length > 1 && (
            <div className="mt-2 space-y-1">
              <p className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2]">
                Your proposed times:
              </p>
              {pendingProposedTimes.map((time) => (
                <div key={time.id} className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{formatProposedTime(time)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Action buttons for non-confirmed states - My Request cancel button */}
          {!isConfirmed && isMyRequest && needsResponse && onCancel && (
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={() => onCancel(event.id)}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#f3f1ef] dark:bg-[#262b35] text-red-600 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <XCircle className="w-3 h-3" />
                Cancel Request
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Proposed times section - OUTSIDE flex container for full width */}
      {!isMyRequest && needsResponse && pendingProposedTimes.length > 0 && (
        <div className="mt-4 space-y-3">
          {/* Error state */}
          {acceptError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-2xl animate-in fade-in shake duration-300">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400">{acceptError}</p>
            </div>
          )}

          {/* Success state after accepting */}
          {isSuccess && acceptedTimeId ? (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
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
              {pendingProposedTimes.length === 1 && onRespond && (
                <>
                  <div className="p-4 bg-gradient-to-r from-[#f9f8f7] to-[#f5f4f2] dark:from-[#262b35] dark:to-[#2a303b] rounded-2xl border border-[#e1ddd8] dark:border-[#363c49]">
                    <div className="flex items-center gap-3 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] mb-3">
                      <div className="p-2 bg-white dark:bg-[#1e222a] rounded-xl shadow-sm">
                        <Calendar className="w-4 h-4 text-brand-accent" />
                      </div>
                      <span className="font-medium">{formatProposedTime(pendingProposedTimes[0])}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleDecline}
                        disabled={isAccepting}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl text-sm font-semibold shadow-md hover:shadow-lg hover:from-red-600 hover:to-rose-600 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl text-sm font-semibold shadow-md hover:shadow-lg hover:from-green-600 hover:to-emerald-600 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
                      className="w-full text-center text-sm text-brand-accent hover:underline py-1"
                    >
                      Suggest different time →
                    </button>
                  )}
                </>
              )}

              {/* MULTIPLE proposed times - individual Accept buttons + Decline All */}
              {pendingProposedTimes.length > 1 && (
                <>
                  <p className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2]">
                    {pendingProposedTimes.length} proposed times:
                  </p>
                  <div className="space-y-2">
                    {pendingProposedTimes.map((time, index) => (
                      <div
                        key={time.id}
                        className="group p-4 bg-gradient-to-r from-[#f9f8f7] to-[#f5f4f2] dark:from-[#262b35] dark:to-[#2a303b] rounded-2xl border border-[#e1ddd8] dark:border-[#363c49] transition-all duration-300 hover:shadow-md hover:border-brand-accent/30 animate-in fade-in slide-in-from-left-2"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <div className="flex items-center gap-3 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] mb-3">
                          <div className="p-2 bg-white dark:bg-[#1e222a] rounded-xl shadow-sm">
                            <Calendar className="w-4 h-4 text-brand-accent" />
                          </div>
                          <span className="font-medium">{formatProposedTime(time)}</span>
                        </div>
                        {onRespond && (
                          <button
                            onClick={() => handleAccept(time.id)}
                            disabled={isAccepting}
                            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl text-sm font-semibold shadow-md hover:shadow-lg hover:from-green-600 hover:to-emerald-600 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md"
                          >
                            {isAccepting && acceptedTimeId === time.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            Accept
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Decline All Button */}
                  {onRespond && (
                    <button
                      onClick={handleDecline}
                      disabled={isAccepting}
                      className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl text-sm font-semibold shadow-md hover:shadow-lg hover:from-red-600 hover:to-rose-600 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                    >
                      {isAccepting && !acceptedTimeId ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      Decline All
                    </button>
                  )}

                  {/* Counter-propose link for multiple times */}
                  {onCounterPropose && (
                    <button
                      onClick={() => onCounterPropose(event.id)}
                      className="w-full text-center text-sm text-brand-accent hover:underline py-1"
                    >
                      Suggest different time →
                    </button>
                  )}
                </>
              )}
            </>
          )}
          {event.locationLabel && !isSuccess && (
            <div className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2] mt-3 pl-1">
              <MapPin className="w-4 h-4" />
              <span>{event.locationLabel}</span>
            </div>
          )}
        </div>
      )}

      {/* Confirmed event actions - OUTSIDE flex container for full width */}
      {isConfirmed && (
        <div className="mt-4 space-y-2">
          {event.meetingLink && (
            <a
              href={event.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-[#a07855] dark:bg-[#b8896a] text-white rounded-xl text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all duration-200"
            >
              <ExternalLink className="w-4 h-4" />
              Join Call
            </a>
          )}
          <div className="grid grid-cols-2 gap-2">
            {onReschedule && (
              <button
                onClick={() => onReschedule(event)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#f3f1ef] dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] rounded-xl text-sm font-medium hover:bg-[#e8e4df] dark:hover:bg-[#313746] hover:shadow-sm active:scale-95 transition-all duration-200"
              >
                <RefreshCw className="w-4 h-4" />
                Reschedule
              </button>
            )}
            {onCancel && (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#f3f1ef] dark:bg-[#262b35] text-red-600 dark:text-red-400 rounded-xl text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 hover:shadow-sm active:scale-95 transition-all duration-200"
              >
                <XCircle className="w-4 h-4" />
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Cancel confirmation dialog - OUTSIDE flex container for full width */}
      {showCancelConfirm && (
        <div className="mt-3 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl">
          <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-3">
            Are you sure you want to cancel this call?
          </p>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Reason for cancellation (optional)"
            rows={2}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-[#1e222a] border border-red-200 dark:border-red-800/30 rounded-lg text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#a7a39e] focus:outline-none focus:ring-2 focus:ring-red-500 resize-none mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowCancelConfirm(false);
                setCancelReason('');
              }}
              className="flex-1 px-4 py-2 text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
            >
              Keep Call
            </button>
            <button
              onClick={() => {
                onCancel?.(event.id, cancelReason || undefined);
                setShowCancelConfirm(false);
                setCancelReason('');
              }}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
            >
              Cancel Call
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * UserCalendarPanel
 * 
 * A slide-out panel showing the user's upcoming events including:
 * - Scheduled calls with coach
 * - Squad calls
 * - Purchased discover events
 * - Pending proposals to respond to
 */
export function UserCalendarPanel({ isOpen, onClose }: UserCalendarPanelProps) {
  const { user } = useUser();
  const currentUserId = user?.id;
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [counterProposeEvent, setCounterProposeEvent] = useState<UnifiedEvent | null>(null);
  const [rescheduleEvent, setRescheduleEvent] = useState<UnifiedEvent | null>(null);
  const [isCounterProposing, setIsCounterProposing] = useState(false);
  const [counterProposeError, setCounterProposeError] = useState<string | null>(null);
  const { respondToProposal, cancelEvent, isLoading: respondLoading } = useSchedulingActions();

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

  // Fetch pending proposals and my requests
  const { proposals, myRequests, refetch: refetchProposals } = usePendingProposals();

  // Navigation
  const navigateMonth = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setCurrentMonth(new Date());
      return;
    }

    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + (direction === 'prev' ? -1 : 1));
    setCurrentMonth(newDate);
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
    } catch (err) {
      return false;
    }
  }, [respondToProposal, refetch, refetchProposals]);

  // Handle cancel request (for pending requests)
  const handleCancelRequest = useCallback(async (eventId: string) => {
    if (!confirm('Are you sure you want to cancel this call request?')) return;
    try {
      await respondToProposal({ eventId, action: 'decline' });
      refetch();
      refetchProposals();
    } catch {
      // Error handled by hook
    }
  }, [respondToProposal, refetch, refetchProposals]);

  // Handle cancel confirmed event
  const handleCancelConfirmed = useCallback(async (eventId: string, reason?: string) => {
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
    // Find the event from proposals or myRequests
    const event = proposals.find(e => e.id === eventId) || myRequests.find(e => e.id === eventId);
    if (event) {
      setCounterProposeEvent(event);
      setCounterProposeError(null);
    }
  }, [proposals, myRequests]);

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

  // Create a set of myRequest IDs for quick lookup
  const myRequestIds = useMemo(() => new Set(myRequests.map(r => r.id)), [myRequests]);

  // Group events by upcoming status - includes user's own pending requests
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    // Combine regular events with user's pending requests
    const allEvents = [...events, ...myRequests];
    // Deduplicate by event ID (in case an event appears in both)
    const uniqueEvents = allEvents.reduce((acc, event) => {
      if (!acc.find(e => e.id === event.id)) {
        acc.push(event);
      }
      return acc;
    }, [] as UnifiedEvent[]);
    return uniqueEvents
      // Filter out events with missing startDateTime
      .filter(e => e && e.startDateTime && new Date(e.startDateTime) >= now)
      .sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime());
  }, [events, myRequests]);

  const pastEvents = useMemo(() => {
    const now = new Date();
    return events
      // Filter out events with missing startDateTime
      .filter(e => e && e.startDateTime && new Date(e.startDateTime) < now)
      .sort((a, b) => new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime());
  }, [events]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white dark:bg-[#171b22] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-accent/10 rounded-lg">
              <Calendar className="w-5 h-5 text-brand-accent" />
            </div>
            <div>
              <h2 className="font-albert text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                My Calendar
              </h2>
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                {upcomingEvents.length} upcoming event{upcomingEvents.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between px-6 py-3 bg-[#f9f8f7] dark:bg-[#1e222a] border-b border-[#e1ddd8] dark:border-[#262b35]">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
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
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Pending Proposals - need to respond */}
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
                  <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
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
              <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl text-red-600 dark:text-red-400">
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
                <p className="text-center text-[#a7a39e] dark:text-[#7d8190] py-8">
                  No upcoming events this month.
                </p>
              ) : (
                <div>
                  {Array.from(groupEventsByDate(upcomingEvents)).map(([dateKey, dateEvents]) => (
                    <div key={dateKey}>
                      <DateSeparator date={new Date(dateKey + 'T00:00:00')} />
                      <div className="space-y-3">
                        {dateEvents.map(event => {
                          const isMyRequest = myRequestIds.has(event.id);
                          return (
                            <EventItem
                              key={event.id}
                              event={event}
                              currentUserId={currentUserId}
                              onRespond={handleRespond}
                              onCancel={isMyRequest ? handleCancelRequest : handleCancelConfirmed}
                              onReschedule={handleReschedule}
                              isMyRequest={isMyRequest}
                              hideDate
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Past Events */}
          {!isLoading && !error && pastEvents.length > 0 && (
            <div className="p-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
              <h3 className="font-albert font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-3">
                Past Events
              </h3>
              <div className="opacity-60">
                {Array.from(groupEventsByDate(pastEvents.slice(0, 5))).map(([dateKey, dateEvents]) => (
                  <div key={dateKey}>
                    <DateSeparator date={new Date(dateKey + 'T00:00:00')} />
                    <div className="space-y-3">
                      {dateEvents.map(event => (
                        <EventItem key={event.id} event={event} currentUserId={currentUserId} hideDate />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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
    </>
  );
}

