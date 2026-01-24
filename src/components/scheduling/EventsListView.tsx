'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Calendar,
  Clock,
  User,
  Users,
  Video,
  PhoneIncoming,
  Globe,
  CheckCircle,
  AlertCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import type { UnifiedEvent } from '@/types';
import { useSchedulingEvents, usePendingProposals, useSchedulingActions } from '@/hooks/useScheduling';
import { EventDetailPopup } from './EventDetailPopup';
import { CounterProposeModal } from './CounterProposeModal';
import { RescheduleCallModal } from './RescheduleCallModal';
import { CallSummaryViewModal } from '@/components/coach/programs/CallSummaryViewModal';
import { useUser } from '@clerk/nextjs';
import { useOrgCredits } from '@/hooks/useOrgCredits';
import { cn } from '@/lib/utils';
import type { CallSummary } from '@/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export type EventTypeFilter = 'all' | 'coaching_1on1' | 'cohort_call' | 'squad_call' | 'community_event' | 'intake_call';

export const EVENT_TYPE_FILTER_OPTIONS: { value: EventTypeFilter; label: string }[] = [
  { value: 'all', label: 'All Events' },
  { value: 'coaching_1on1', label: '1:1 Calls' },
  { value: 'cohort_call', label: 'Group Calls' },
  { value: 'intake_call', label: 'Intake Calls' },
  { value: 'community_event', label: 'Community' },
];

const EVENT_TYPE_FILTERS: { value: EventTypeFilter; label: string; icon: typeof User }[] = [
  { value: 'all', label: 'All', icon: Calendar },
  { value: 'coaching_1on1', label: '1:1', icon: User },
  { value: 'cohort_call', label: 'Group', icon: Users },
  { value: 'intake_call', label: 'Intake', icon: PhoneIncoming },
  { value: 'community_event', label: 'Community', icon: Globe },
];

// Event type badge colors
const EVENT_TYPE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  coaching_1on1: { bg: 'bg-orange-100 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300', label: '1:1 Call' },
  cohort_call: { bg: 'bg-purple-100 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-300', label: 'Group Call' },
  squad_call: { bg: 'bg-blue-100 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300', label: 'Squad Call' },
  community_event: { bg: 'bg-green-100 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', label: 'Community' },
  intake_call: { bg: 'bg-teal-100 dark:bg-teal-900/20', text: 'text-teal-700 dark:text-teal-300', label: 'Intake Call' },
};

// Status colors
const STATUS_BADGE: Record<string, { bg: string; text: string; icon: typeof CheckCircle }> = {
  confirmed: { bg: 'bg-green-100 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', icon: CheckCircle },
  proposed: { bg: 'bg-yellow-100 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-300', icon: AlertCircle },
  pending_response: { bg: 'bg-yellow-100 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-300', icon: AlertCircle },
  counter_proposed: { bg: 'bg-orange-100 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300', icon: AlertCircle },
  declined: { bg: 'bg-red-100 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300', icon: XCircle },
  cancelled: { bg: 'bg-gray-100 dark:bg-gray-900/20', text: 'text-gray-500 dark:text-gray-400', icon: XCircle },
};

interface EventsListViewProps {
  mode?: 'coach' | 'user';
  /** Date range to fetch events for - passed from parent CalendarView */
  startDate: string;
  endDate: string;
  /** Event type filter - controlled by parent */
  typeFilter?: EventTypeFilter;
}

export function EventsListView({ mode = 'coach', startDate, endDate, typeFilter = 'all' }: EventsListViewProps) {
  const router = useRouter();
  const { user } = useUser();
  const currentUserId = user?.id;
  const isCoach = mode === 'coach';
  const { hasCredits: orgHasCredits } = useOrgCredits(isCoach);

  // Event detail popup states
  const [selectedEvent, setSelectedEvent] = useState<UnifiedEvent | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
  const [isRespondLoading, setIsRespondLoading] = useState(false);

  // Counter-propose modal states
  const [counterProposeEvent, setCounterProposeEvent] = useState<UnifiedEvent | null>(null);
  const [isCounterProposing, setIsCounterProposing] = useState(false);
  const [counterProposeError, setCounterProposeError] = useState<string | null>(null);

  // Reschedule modal states
  const [rescheduleEvent, setRescheduleEvent] = useState<UnifiedEvent | null>(null);

  // Cancel confirmation states
  const [cancelEventId, setCancelEventId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Call summary modal states
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [summaryData, setSummaryData] = useState<CallSummary | null>(null);
  const [isFetchingSummary, setIsFetchingSummary] = useState(false);

  const { respondToProposal, cancelEvent } = useSchedulingActions();

  // Fetch events using date range from parent
  const { events, isLoading, error, refetch } = useSchedulingEvents({
    startDate,
    endDate,
    role: mode === 'coach' ? 'host' : 'all',
  });

  // Pending proposals
  const { proposals, refetch: refetchProposals } = usePendingProposals();

  // Merge events with proposals
  const allEvents = useMemo(() => {
    const eventIds = new Set(events.map(e => e.id));
    const uniqueProposals = proposals.filter(p => !eventIds.has(p.id));
    return [...events, ...uniqueProposals];
  }, [events, proposals]);

  // Filter events by type
  const filteredEvents = useMemo(() => {
    if (typeFilter === 'all') return allEvents;
    return allEvents.filter(e => e.eventType === typeFilter);
  }, [allEvents, typeFilter]);

  // Sort by date (soonest first), pending first
  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      const aIsPending = a.schedulingStatus === 'proposed' || a.schedulingStatus === 'counter_proposed';
      const bIsPending = b.schedulingStatus === 'proposed' || b.schedulingStatus === 'counter_proposed';
      if (aIsPending && !bIsPending) return -1;
      if (!aIsPending && bIsPending) return 1;
      return new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime();
    });
  }, [filteredEvents]);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, UnifiedEvent[]> = {};
    for (const event of sortedEvents) {
      if (!event || !event.startDateTime) continue;
      const eventDate = new Date(event.startDateTime);
      const dateKey = eventDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(event);
    }
    return grouped;
  }, [sortedEvents]);

  // Handle event click
  const handleEventClick = useCallback((event: UnifiedEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEvent(event);
    setPopupPosition({ x: e.clientX, y: e.clientY + 8 });
  }, []);

  // Handle respond to proposal
  const handleRespond = useCallback(async (eventId: string, action: 'accept' | 'decline', selectedTimeId?: string) => {
    setIsRespondLoading(true);
    try {
      await respondToProposal({ eventId, action, selectedTimeId });
      setSelectedEvent(null);
      refetch();
      refetchProposals();
    } catch (err) {
      // Error handled by hook
    } finally {
      setIsRespondLoading(false);
    }
  }, [respondToProposal, refetch, refetchProposals]);

  // Handle counter-propose
  const handleCounterPropose = useCallback((eventId: string) => {
    const event = allEvents.find(e => e.id === eventId);
    if (event) {
      setSelectedEvent(null);
      setCounterProposeEvent(event);
      setCounterProposeError(null);
    }
  }, [allEvents]);

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

  // Handle reschedule button click
  const handleReschedule = useCallback(() => {
    if (selectedEvent) {
      setRescheduleEvent(selectedEvent);
      setSelectedEvent(null); // Close the popup when opening reschedule modal
    }
  }, [selectedEvent]);

  // Handle reschedule success
  const handleRescheduleSuccess = useCallback(() => {
    setRescheduleEvent(null);
    setSelectedEvent(null);
    refetch();
    refetchProposals();
  }, [refetch, refetchProposals]);

  // Handle cancel button click
  const handleCancelClick = useCallback(() => {
    if (selectedEvent) {
      setCancelEventId(selectedEvent.id);
      setCancelReason('');
    }
  }, [selectedEvent]);

  // Handle cancel confirmation
  const handleCancelConfirm = useCallback(async () => {
    if (!cancelEventId) return;

    setIsCancelling(true);
    try {
      await cancelEvent(cancelEventId, cancelReason.trim() || undefined);
      setCancelEventId(null);
      setCancelReason('');
      setSelectedEvent(null);
      refetch();
      refetchProposals();
    } catch (err) {
      console.error('Failed to cancel event:', err);
    } finally {
      setIsCancelling(false);
    }
  }, [cancelEventId, cancelReason, cancelEvent, refetch, refetchProposals]);

  // Handle view summary click
  const handleViewSummary = useCallback(async (summaryId: string) => {
    setIsFetchingSummary(true);
    try {
      const res = await fetch(`/api/coach/call-summaries/${summaryId}`);
      if (!res.ok) throw new Error('Failed to fetch summary');
      const data = await res.json();
      setSummaryData(data);
      setSummaryModalOpen(true);
    } catch (err) {
      console.error('Failed to fetch summary:', err);
    } finally {
      setIsFetchingSummary(false);
    }
  }, []);

  // Handle summary modal close
  const handleSummaryModalClose = useCallback(() => {
    setSummaryModalOpen(false);
    setSummaryData(null);
  }, []);

  // Format time
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  // Check if date is today
  const isToday = (dateStr: string) => {
    const today = new Date();
    const date = new Date(dateStr);
    return date.toDateString() === today.toDateString();
  };

  return (
    <div className="space-y-4">
      {/* Pending proposals alert */}
      {proposals.length > 0 && typeFilter === 'all' && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30 rounded-xl">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="font-albert font-medium text-yellow-800 dark:text-yellow-200">
                {proposals.length} pending proposal{proposals.length !== 1 ? 's' : ''} awaiting response
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Events list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      ) : sortedEvents.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">No events found</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            {typeFilter !== 'all' ? 'Try changing your filter or ' : ''}Schedule a call to get started
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(eventsByDate).map(([dateLabel, dayEvents]) => (
            <div key={dateLabel}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-px bg-[#e1ddd8] dark:bg-[#262b35]" />
                <span className={cn(
                  "text-sm font-medium whitespace-nowrap px-2",
                  dayEvents[0] && isToday(dayEvents[0].startDateTime)
                    ? "text-brand-accent font-semibold"
                    : "text-[#5f5a55] dark:text-[#b2b6c2]"
                )}>
                  {dayEvents[0] && isToday(dayEvents[0].startDateTime) ? 'Today' : dateLabel}
                </span>
                <div className="flex-1 h-px bg-[#e1ddd8] dark:bg-[#262b35]" />
              </div>

              {/* Events for this day */}
              <div className="space-y-2">
                {dayEvents.map((event) => {
                  const typeBadge = EVENT_TYPE_BADGE[event.eventType] || EVENT_TYPE_BADGE.community_event;
                  const statusBadge = event.schedulingStatus ? STATUS_BADGE[event.schedulingStatus] : null;
                  const StatusIcon = statusBadge?.icon || CheckCircle;
                  const isPending = event.schedulingStatus === 'proposed' || event.schedulingStatus === 'counter_proposed';
                  const displayTitle = event.title?.replace(/^Call request with\s*/i, '') || event.title;

                  return (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "bg-white dark:bg-[#171b22] border rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow",
                        isPending
                          ? "border-yellow-300 dark:border-yellow-700"
                          : "border-[#e1ddd8] dark:border-[#262b35]"
                      )}
                      onClick={(e) => handleEventClick(event, e)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          {/* Time column */}
                          <div className="flex-shrink-0 w-16 text-center">
                            <p className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                              {formatTime(event.startDateTime)}
                            </p>
                            {event.durationMinutes && (
                              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                                {event.durationMinutes} min
                              </p>
                            )}
                          </div>

                          {/* Vertical divider */}
                          <div className="w-px h-12 bg-[#e1ddd8] dark:bg-[#262b35]" />

                          {/* Event info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                                {displayTitle}
                              </h3>
                              <span className={cn(
                                "px-2 py-0.5 text-xs font-medium rounded-full",
                                typeBadge.bg,
                                typeBadge.text
                              )}>
                                {typeBadge.label}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 mt-1 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                              {event.hostName && (
                                <span className="flex items-center gap-1">
                                  <User className="w-3.5 h-3.5" />
                                  {event.hostName}
                                </span>
                              )}
                              {event.attendeeIds?.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <Users className="w-3.5 h-3.5" />
                                  {event.attendeeIds.length} attendee{event.attendeeIds.length !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status and actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {statusBadge && (
                            <span className={cn(
                              "flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full",
                              statusBadge.bg,
                              statusBadge.text
                            )}>
                              <StatusIcon className="w-3 h-3" />
                              {event.schedulingStatus?.replace('_', ' ')}
                            </span>
                          )}

                          {event.meetingLink && !isPending && (
                            <a
                              href={event.meetingLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-500/20 transition-colors"
                            >
                              <Video className="w-4 h-4" />
                              Join
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Pending actions */}
                      {isPending && event.proposedBy !== currentUserId && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#e1ddd8] dark:border-[#262b35]">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRespond(event.id, 'accept', event.proposedTimes?.[0]?.id);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Accept
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRespond(event.id, 'decline');
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                            Decline
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCounterPropose(event.id);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f3f1ef] dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] rounded-lg text-sm font-medium hover:bg-[#e8e4df] dark:hover:bg-[#313746] transition-colors"
                          >
                            <Clock className="w-4 h-4" />
                            Propose Different Time
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Event Detail Popup */}
      {selectedEvent && (
        <EventDetailPopup
          event={selectedEvent}
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onRespond={selectedEvent.proposedBy !== currentUserId ? handleRespond : undefined}
          onCounterPropose={selectedEvent.proposedBy !== currentUserId ? handleCounterPropose : undefined}
          isLoading={isRespondLoading || isFetchingSummary}
          position={popupPosition || undefined}
          isHost={isCoach}
          onEventUpdated={refetch}
          onReschedule={handleReschedule}
          onCancel={handleCancelClick}
          onViewSummary={handleViewSummary}
          isCancelling={isCancelling}
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

      {/* Reschedule Modal */}
      {rescheduleEvent && (
        <RescheduleCallModal
          isOpen={!!rescheduleEvent}
          onClose={() => setRescheduleEvent(null)}
          event={rescheduleEvent}
          onSuccess={handleRescheduleSuccess}
        />
      )}

      {/* Cancel Confirmation Dialog */}
      <AlertDialog
        open={!!cancelEventId}
        onOpenChange={(open) => {
          if (!open) {
            setCancelEventId(null);
            setCancelReason('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Event?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the event and notify all participants. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-2">
              Reason (optional)
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Let participants know why the event was cancelled..."
              className="w-full px-3 py-2 text-sm bg-[#f9f8f7] dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent resize-none"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Keep Event</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelConfirm}
              disabled={isCancelling}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isCancelling ? 'Cancelling...' : 'Cancel Event'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Call Summary Modal */}
      <CallSummaryViewModal
        isOpen={summaryModalOpen}
        onClose={handleSummaryModalClose}
        summary={summaryData}
      />
    </div>
  );
}
