'use client';

import { useState, useMemo, useCallback } from 'react';
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
} from 'lucide-react';
import { useSchedulingEvents, useSchedulingActions, usePendingProposals } from '@/hooks/useScheduling';
import type { UnifiedEvent } from '@/types';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Event type labels and icons
const EVENT_TYPE_INFO: Record<string, { label: string; icon: typeof Video; color: string }> = {
  coaching_1on1: { label: '1-on-1 Call', icon: User, color: 'text-brand-accent' },
  squad_call: { label: 'Squad Call', icon: Users, color: 'text-blue-500' },
  workshop: { label: 'Workshop', icon: Video, color: 'text-purple-500' },
  community_event: { label: 'Event', icon: Calendar, color: 'text-green-500' },
};

interface EventItemProps {
  event: UnifiedEvent;
  onRespond?: (eventId: string, action: 'accept' | 'decline') => void;
}

function EventItem({ event, onRespond }: EventItemProps) {
  const typeInfo = EVENT_TYPE_INFO[event.eventType] || EVENT_TYPE_INFO.coaching_1on1;
  const Icon = typeInfo.icon;

  const startTime = new Date(event.startDateTime);
  const endTime = event.endDateTime ? new Date(event.endDateTime) : null;

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

  const needsResponse = event.schedulingStatus === 'proposed' || event.schedulingStatus === 'counter_proposed';
  const isConfirmed = event.schedulingStatus === 'confirmed' || event.status === 'confirmed';

  // Generate ICS file for calendar download
  const generateICS = () => {
    const endDateTime = event.endDateTime || new Date(startTime.getTime() + (event.durationMinutes || 60) * 60 * 1000).toISOString();
    
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//GrowthAddicts//Scheduling//EN',
      'BEGIN:VEVENT',
      `UID:${event.id}@growthaddicts.com`,
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

  return (
    <div className="p-4 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg bg-[#f3f1ef] dark:bg-[#262b35] ${typeInfo.color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8] line-clamp-1">
                {event.title}
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
            {needsResponse && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 rounded-full text-xs">
                <AlertCircle className="w-3 h-3" />
                Pending
              </span>
            )}
          </div>

          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatDate(startTime)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {formatTime(startTime)}
                {endTime && ` - ${formatTime(endTime)}`}
              </span>
            </div>
            {event.locationLabel && (
              <div className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                <MapPin className="w-3.5 h-3.5" />
                <span>{event.locationLabel}</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mt-3">
            {needsResponse && onRespond && (
              <>
                <button
                  onClick={() => onRespond(event.id, 'accept')}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600 transition-colors"
                >
                  <CheckCircle className="w-3 h-3" />
                  Accept
                </button>
                <button
                  onClick={() => onRespond(event.id, 'decline')}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-colors"
                >
                  <XCircle className="w-3 h-3" />
                  Decline
                </button>
              </>
            )}
            {isConfirmed && (
              <>
                {event.meetingLink && (
                  <a
                    href={event.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 bg-brand-accent text-white rounded-lg text-xs font-medium hover:bg-brand-accent/90 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Join Call
                  </a>
                )}
                <button
                  onClick={generateICS}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#f3f1ef] dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] rounded-lg text-xs font-medium hover:bg-[#e8e4df] dark:hover:bg-[#313746] transition-colors"
                >
                  <Download className="w-3 h-3" />
                  Add to Calendar
                </button>
              </>
            )}
          </div>
        </div>
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
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { respondToProposal, isLoading: respondLoading } = useSchedulingActions();

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
  const { proposals } = usePendingProposals();

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

  // Handle respond to proposal
  const handleRespond = useCallback(async (eventId: string, action: 'accept' | 'decline') => {
    try {
      await respondToProposal({ eventId, action });
      refetch();
    } catch (err) {
      // Error handled by hook
    }
  }, [respondToProposal, refetch]);

  // Group events by upcoming status
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return events
      .filter(e => new Date(e.startDateTime) >= now)
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
          <div className="p-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
            <h3 className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-500" />
              Pending Responses ({proposals.length})
            </h3>
            <div className="space-y-3">
              {proposals.map(event => (
                <EventItem
                  key={event.id}
                  event={event}
                  onRespond={handleRespond}
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
              <div className="text-center py-8">
                <div className="w-14 h-14 bg-[#f3f1ef] dark:bg-[#11141b] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-7 h-7 text-text-muted" />
                </div>
                <p className="font-sans text-[15px] text-text-secondary">
                  No upcoming events
                </p>
                <p className="font-sans text-[13px] text-text-muted mt-1">
                  Your scheduled calls and events will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map(event => (
                  <EventItem
                    key={event.id}
                    event={event}
                    onRespond={handleRespond}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Past Events - show only in non-compact view */}
        {!compact && !isLoading && !error && pastEvents.length > 0 && (
          <div className="p-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
            <h3 className="font-albert font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-3">
              Past Events
            </h3>
            <div className="space-y-3 opacity-60">
              {pastEvents.slice(0, 5).map(event => (
                <EventItem key={event.id} event={event} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CalendarContent;




