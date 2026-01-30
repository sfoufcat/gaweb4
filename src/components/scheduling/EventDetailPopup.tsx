'use client';

import { useCallback, useEffect, useRef, useState, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Clock,
  Calendar,
  User,
  Users,
  Video,
  CheckCircle,
  XCircle,
  CalendarClock,
  Loader2,
  ExternalLink,
  Edit2,
  Link as LinkIcon,
  Save,
  CalendarX2,
  FileText,
  PlayCircle,
  PhoneIncoming,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import type { UnifiedEvent, CallSummary } from '@/types';
import { InlineRecordingUpload } from './InlineRecordingUpload';
import { InlineSummaryPreview } from './InlineSummaryPreview';
import { GenerateSummaryButton } from './GenerateSummaryButton';
import { FillWeekFromSummaryButton } from './FillWeekFromSummaryButton';
import { MeetingProviderSelector, type MeetingProviderType } from './MeetingProviderSelector';
import { MediaPlayer } from '@/components/video/MediaPlayer';
import { normalizeUrl } from '@/lib/url-utils';
import { isWithinOneHourBefore } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface EventDetailPopupProps {
  event: UnifiedEvent;
  isOpen: boolean;
  onClose: () => void;
  onRespond?: (eventId: string, action: 'accept' | 'decline', selectedTimeId?: string) => void;
  onCounterPropose?: (eventId: string) => void;
  isLoading?: boolean;
  /** Position for desktop popup (near clicked element) - x,y are the click coordinates */
  position?: { x: number; y: number };
  /** Whether the current user is the host/coach (can edit meeting link) */
  isHost?: boolean;
  /** Callback when event is updated (e.g., meeting link changed) */
  onEventUpdated?: () => void;
  /** Callback to open reschedule modal */
  onReschedule?: () => void;
  /** Callback to initiate cancel flow */
  onCancel?: () => void;
  /** Callback to view call summary */
  onViewSummary?: (summaryId: string) => void;
  /** Whether a cancel operation is in progress */
  isCancelling?: boolean;
  /** Callback to edit event (for community/cohort events) */
  onEdit?: (event: UnifiedEvent) => void;
  /** Pre-fetched inline summary for display */
  inlineSummary?: CallSummary | null;
  /** Callback when recording is uploaded and summary is generated */
  onRecordingUploaded?: (eventId: string, summaryId: string) => void;
  /** Whether the org has video call credits (for showing warning on in-app calls) */
  hasOrgCredits?: boolean;
}

/**
 * EventDetailPopup
 *
 * A popup/slideup that shows full event details and actions.
 * - Desktop: Appears as a positioned popup near the clicked event
 * - Mobile: Slides up from the bottom as a sheet
 */
export function EventDetailPopup({
  event,
  isOpen,
  onClose,
  onRespond,
  onCounterPropose,
  isLoading = false,
  position,
  isHost = false,
  onEventUpdated,
  onReschedule,
  onCancel,
  onViewSummary,
  isCancelling = false,
  onEdit,
  inlineSummary,
  onRecordingUploaded,
  hasOrgCredits = true,
}: EventDetailPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [computedPosition, setComputedPosition] = useState<{ top: number; left: number } | null>(null);
  const isDesktop = useMediaQuery('(min-width: 640px)');

  // Meeting link editing state
  const [isEditingLink, setIsEditingLink] = useState(false);
  const [meetingLinkInput, setMeetingLinkInput] = useState(event.meetingLink || '');
  const [isSavingLink, setIsSavingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Recording refresh state
  const [isFetchingRecording, setIsFetchingRecording] = useState(false);
  const [fetchRecordingMessage, setFetchRecordingMessage] = useState<string | null>(null);

  // Provider selector state for editing
  const getInitialProvider = (): MeetingProviderType => {
    if (event.locationType === 'chat' || event.meetingProvider === 'stream') return 'in_app';
    if (event.meetingProvider === 'zoom') return 'zoom';
    if (event.meetingProvider === 'google_meet') return 'google_meet';
    return 'manual';
  };
  const [selectedProvider, setSelectedProvider] = useState<MeetingProviderType>(getInitialProvider);

  // Determine if in-app option should be available (1:1 and intake calls only)
  const allowInAppOption = event.eventType === 'coaching_1on1' || event.eventType === 'intake_call';

  // Update input when event changes
  useEffect(() => {
    setMeetingLinkInput(event.meetingLink || '');
    setSelectedProvider(getInitialProvider());
  }, [event.meetingLink, event.meetingProvider, event.locationType]);

  // Determine if event is in the past
  const isPastEvent = useMemo(() => {
    const endTime = event.endDateTime
      ? new Date(event.endDateTime)
      : new Date(new Date(event.startDateTime).getTime() + (event.durationMinutes || 60) * 60000);
    return endTime < new Date();
  }, [event.startDateTime, event.endDateTime, event.durationMinutes]);

  // Computed states for action visibility
  // isConfirmed: true for scheduled events with schedulingStatus=confirmed OR regular events with status=confirmed (no schedulingStatus)
  const isConfirmed = event.schedulingStatus === 'confirmed' ||
                     (event.status === 'confirmed' && !event.schedulingStatus);
  const isCanceled = event.status === 'canceled' || event.schedulingStatus === 'cancelled';
  const canReschedule = !isPastEvent && isConfirmed && !isCanceled && isHost;
  const canCancel = !isPastEvent && !isCanceled;
  const hasSummary = !!event.callSummaryId;
  const hasRecording = !!event.recordingUrl;

  // Save meeting link/provider
  const handleSaveMeetingLink = useCallback(async () => {
    if (isSavingLink) return;

    setIsSavingLink(true);
    setLinkError(null);

    try {
      // Build update payload based on selected provider
      const updatePayload: {
        meetingLink?: string | null;
        meetingProvider?: string;
        locationType?: string;
      } = {};

      if (selectedProvider === 'in_app') {
        updatePayload.locationType = 'chat';
        updatePayload.meetingProvider = 'stream';
        updatePayload.meetingLink = null;
      } else if (selectedProvider === 'zoom') {
        updatePayload.locationType = 'online';
        updatePayload.meetingProvider = 'zoom';
        // Note: For Zoom with connection, link is auto-generated on call creation
        // For editing existing events, keep the current link or use manual
        updatePayload.meetingLink = normalizeUrl(meetingLinkInput) || null;
      } else if (selectedProvider === 'google_meet') {
        updatePayload.locationType = 'online';
        updatePayload.meetingProvider = 'google_meet';
        updatePayload.meetingLink = normalizeUrl(meetingLinkInput) || null;
      } else {
        // Manual
        updatePayload.locationType = 'online';
        updatePayload.meetingProvider = 'manual';
        updatePayload.meetingLink = normalizeUrl(meetingLinkInput) || null;
      }

      const response = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save meeting link');
      }

      setIsEditingLink(false);
      onEventUpdated?.();
    } catch (error) {
      setLinkError(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setIsSavingLink(false);
    }
  }, [event.id, meetingLinkInput, selectedProvider, isSavingLink, onEventUpdated]);

  // Fetch recording from Stream (fallback when webhook didn't fire)
  const handleFetchRecording = useCallback(async () => {
    if (isFetchingRecording) return;

    setIsFetchingRecording(true);
    setFetchRecordingMessage(null);

    try {
      const response = await fetch(`/api/events/${event.id}/fetch-recording`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success && data.recordingUrl) {
        setFetchRecordingMessage('Recording found!');
        onEventUpdated?.();
      } else {
        setFetchRecordingMessage(data.message || 'No recording found');
      }
    } catch (error) {
      setFetchRecordingMessage(error instanceof Error ? error.message : 'Failed to fetch');
    } finally {
      setIsFetchingRecording(false);
    }
  }, [event.id, isFetchingRecording, onEventUpdated]);

  // Calculate optimal position after popup renders (so we know its size)
  useLayoutEffect(() => {
    if (!isOpen || !position || !popupRef.current) {
      setComputedPosition(null);
      return;
    }

    const popup = popupRef.current;
    const popupRect = popup.getBoundingClientRect();
    const popupWidth = popupRect.width || 384; // sm:w-96 = 384px fallback
    const popupHeight = popupRect.height || 400; // estimated height

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 16; // Minimum distance from viewport edges

    // Start with position below and aligned with click point
    let top = position.y;
    let left = position.x;

    // Adjust horizontal position to keep popup in viewport
    // Try to center the popup horizontally on the click point
    left = position.x - (popupWidth / 2);

    // Keep within horizontal bounds
    if (left + popupWidth > viewportWidth - padding) {
      left = viewportWidth - popupWidth - padding;
    }
    if (left < padding) {
      left = padding;
    }

    // Adjust vertical position
    // If popup would go below viewport, position it above the click point
    if (top + popupHeight > viewportHeight - padding) {
      // Position above - subtract estimated event height (40px) and popup height
      top = position.y - popupHeight - 50;
    }

    // If still outside top of viewport, just position at top with padding
    if (top < padding) {
      top = padding;
    }

    setComputedPosition({ top, left });
  }, [isOpen, position]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      // Delay to prevent immediate close on the click that opened the popup
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  const isPending = event.schedulingStatus === 'proposed' || event.schedulingStatus === 'counter_proposed';
  const pendingProposedTimes = event.proposedTimes?.filter(t => t.status === 'pending') || [];

  // Strip "Call request with" prefix from title for cleaner display
  const displayTitle = event.title?.replace(/^Call request with\s*/i, '') || event.title;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatProposedTime = (time: { startDateTime: string; endDateTime: string }) => {
    const start = new Date(time.startDateTime);
    const end = new Date(time.endDateTime);
    return `${formatDate(time.startDateTime)} at ${formatTime(start)} - ${formatTime(end)}`;
  };

  const handleAccept = useCallback((timeId?: string) => {
    if (onRespond) {
      onRespond(event.id, 'accept', timeId);
    }
  }, [event.id, onRespond]);

  const handleDecline = useCallback(() => {
    if (onRespond) {
      onRespond(event.id, 'decline');
    }
  }, [event.id, onRespond]);

  const handleCounterPropose = useCallback(() => {
    if (onCounterPropose) {
      onCounterPropose(event.id);
    }
  }, [event.id, onCounterPropose]);

  if (!isOpen) return null;

  // Use portal to render outside any backdrop-blur containers that break fixed positioning
  if (typeof document === 'undefined') return null;

  // Safety check for required event properties
  if (!event || !event.startDateTime) {
    console.error('[EventDetailPopup] Invalid event data:', event);
    return null;
  }

  return createPortal(
    <>
      {/* Backdrop - only visible on mobile */}
      <div
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm sm:hidden animate-backdrop-fade-in"
        onClick={onClose}
      />

      {/* Desktop: Positioned popup / Mobile: Bottom sheet */}
      <div
        ref={popupRef}
        className={`
          fixed z-[60] bg-white dark:bg-[#171b22] rounded-2xl shadow-2xl overflow-hidden
          sm:w-96 sm:max-h-[70vh]
          w-full max-h-[85vh] bottom-0 left-0 right-0 rounded-b-none
          sm:bottom-auto sm:left-auto sm:right-auto sm:rounded-2xl
          animate-modal-slide-up sm:animate-modal-zoom-in
        `}
        style={isDesktop ? (computedPosition ? {
          top: `${computedPosition.top}px`,
          left: `${computedPosition.left}px`,
        } : position ? {
          // Fallback: center on desktop until position is computed
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        } : undefined) : undefined}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22]">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {isPending && (
                <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-medium rounded-full">
                  Pending
                </span>
              )}
              <h3 className="font-albert text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                {displayTitle}
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Edit button - only for community/cohort events when host */}
            {isHost && onEdit && !isPastEvent && !isPending &&
             (event.eventType === 'community_event' || event.eventType === 'cohort_call') && (
              <button
                onClick={() => {
                  onEdit(event);
                  onClose();
                }}
                className="flex-shrink-0 p-2 text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
                title="Edit event"
              >
                <Edit2 className="w-5 h-5" />
              </button>
            )}
{/* X button - desktop only */}
            {isDesktop && (
              <button
                onClick={onClose}
                className="flex-shrink-0 p-2 text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[calc(85vh-130px)] sm:max-h-[calc(70vh-130px)]">
          {/* Event Type Badge */}
          <div className="flex items-center gap-2">
            {event.eventType === 'coaching_1on1' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                <User className="w-3.5 h-3.5" />
                1-on-1 Call
              </span>
            ) : event.eventType === 'squad_call' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                <Users className="w-3.5 h-3.5" />
                Squad Event
              </span>
            ) : event.eventType === 'cohort_call' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                <Users className="w-3.5 h-3.5" />
                Group Call
              </span>
            ) : event.eventType === 'intake_call' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">
                <PhoneIncoming className="w-3.5 h-3.5" />
                Intake Call
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                <Video className="w-3.5 h-3.5" />
                Community Event
              </span>
            )}
          </div>

          {/* Scheduled Time (for confirmed events) */}
          {!isPending && (
            <div className="flex items-center gap-3 text-[#5f5a55] dark:text-[#b2b6c2]">
              <Clock className="w-4 h-4" />
              <span className="text-sm">
                {formatDate(event.startDateTime)} at {formatTime(new Date(event.startDateTime))}
                {event.endDateTime && ` - ${formatTime(new Date(event.endDateTime))}`}
              </span>
            </div>
          )}

          {/* Duration */}
          {event.durationMinutes && (
            <div className="flex items-center gap-3 text-[#5f5a55] dark:text-[#b2b6c2]">
              <CalendarClock className="w-4 h-4" />
              <span className="text-sm">{event.durationMinutes} minutes</span>
            </div>
          )}

          {/* Location Section (for confirmed events) */}
          {!isPending && (
            <div className="space-y-2">
              {isEditingLink ? (
                // Editing mode - show provider selector
                <div className="space-y-3">
                  <MeetingProviderSelector
                    allowInApp={allowInAppOption}
                    value={selectedProvider}
                    onChange={setSelectedProvider}
                    manualLink={meetingLinkInput}
                    onManualLinkChange={setMeetingLinkInput}
                    savedMeetingLink={event.meetingLink}
                    label="Meeting Location"
                  />
                  {linkError && (
                    <p className="text-xs text-red-500">{linkError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsEditingLink(false);
                        setMeetingLinkInput(event.meetingLink || '');
                        setSelectedProvider(getInitialProvider());
                        setLinkError(null);
                      }}
                      disabled={isSavingLink}
                      className="flex-1 px-3 py-2 text-sm bg-[#f3f1ef] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] rounded-lg hover:bg-[#e8e4df] dark:hover:bg-[#313746] disabled:opacity-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveMeetingLink}
                      disabled={isSavingLink}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 disabled:opacity-50 transition-colors"
                    >
                      {isSavingLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                // Location display with action icons on same row
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-[#5f5a55] dark:text-[#b2b6c2]">
                    <LinkIcon className="w-4 h-4" />
                    <span className="text-sm">
                      {event.locationType === 'chat' ? (
                        'In-App Call'
                      ) : event.meetingProvider === 'zoom' ? (
                        'Zoom'
                      ) : event.meetingProvider === 'google_meet' ? (
                        'Google Meet'
                      ) : event.meetingProvider === 'stream' ? (
                        'In-App Call'
                      ) : event.locationLabel ? (
                        event.locationLabel
                      ) : event.meetingLink ? (
                        // Extract platform from URL
                        event.meetingLink.includes('zoom') ? 'Zoom' :
                        event.meetingLink.includes('meet.google') ? 'Google Meet' :
                        event.meetingLink.includes('teams') ? 'Microsoft Teams' :
                        'External Meeting'
                      ) : (
                        'Location not set'
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {event.meetingLink && (
                      <a
                        href={event.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-[#5f5a55] hover:text-brand-accent dark:text-[#b2b6c2] dark:hover:text-brand-accent hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-lg transition-colors"
                        title="Open meeting link"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    {isHost && (
                      <button
                        onClick={() => setIsEditingLink(true)}
                        className="p-2 text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-lg transition-colors"
                        title={event.meetingLink ? "Edit meeting link" : "Add meeting link"}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}



              {/* No link placeholder for non-hosts */}
              {!isEditingLink && !event.meetingLink && !isHost && event.locationType !== 'chat' && event.meetingProvider !== 'stream' && (
                <div className="flex items-center gap-2 px-4 py-2 bg-[#f3f1ef] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] rounded-lg font-albert text-sm">
                  <LinkIcon className="w-4 h-4" />
                  Meeting link will be shared soon
                </div>
              )}
            </div>
          )}

          {/* Proposed Times Section (for pending events) */}
          {isPending && pendingProposedTimes.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                Proposed Time{pendingProposedTimes.length > 1 ? 's' : ''}
              </p>

              {pendingProposedTimes.length === 1 ? (
                // Single proposed time - show time with side-by-side Accept/Decline
                <>
                  <div className="flex items-center gap-3 p-3 bg-[#f9f8f7] dark:bg-[#1e222a] rounded-xl">
                    <Calendar className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                    <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                      {formatProposedTime(pendingProposedTimes[0])}
                    </span>
                  </div>

                  {onRespond && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleDecline}
                        disabled={isLoading}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-[#f3f1ef] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] rounded-xl font-albert font-medium text-sm hover:bg-[#e8e4df] dark:hover:bg-[#313746] disabled:opacity-50 transition-colors"
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        Decline
                      </button>
                      <button
                        onClick={() => handleAccept(pendingProposedTimes[0].id)}
                        disabled={isLoading}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-xl font-albert font-medium text-sm hover:bg-green-600 disabled:opacity-50 transition-colors"
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Accept
                      </button>
                    </div>
                  )}
                </>
              ) : (
                // Multiple proposed times - show each with individual Accept button
                <>
                  {pendingProposedTimes.map((time) => (
                    <div
                      key={time.id}
                      className="flex items-center justify-between p-3 bg-[#f9f8f7] dark:bg-[#1e222a] rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                        <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                          {formatProposedTime(time)}
                        </span>
                      </div>
                      {onRespond && (
                        <button
                          onClick={() => handleAccept(time.id)}
                          disabled={isLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 disabled:opacity-50 transition-colors"
                        >
                          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                          Accept
                        </button>
                      )}
                    </div>
                  ))}

                  {onRespond && (
                    <button
                      onClick={handleDecline}
                      disabled={isLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500 text-white rounded-xl font-albert font-medium text-sm hover:bg-red-600 disabled:opacity-50 transition-colors"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      Decline All
                    </button>
                  )}
                </>
              )}

              {/* Counter-propose button */}
              {onCounterPropose && (
                <button
                  onClick={handleCounterPropose}
                  disabled={isLoading}
                  className="w-full text-center text-sm text-brand-accent hover:underline py-2 disabled:opacity-50"
                >
                  Suggest different time →
                </button>
              )}
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="pt-2 border-t border-[#e1ddd8] dark:border-[#262b35]">
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                {event.description}
              </p>
            </div>
          )}

          {/* Past Event Actions */}
          {isPastEvent && !isPending && (
            <div className="pt-3 mt-3 border-t border-[#e1ddd8] dark:border-[#262b35] space-y-2">
              {/* Inline Summary Preview (if summary exists and pre-fetched) */}
              {hasSummary && inlineSummary && onViewSummary && (
                <InlineSummaryPreview
                  summary={inlineSummary}
                  onViewFull={() => onViewSummary(event.callSummaryId!)}
                />
              )}

              {/* View Summary Button (fallback if no inline summary data) */}
              {hasSummary && !inlineSummary && onViewSummary && (
                <button
                  onClick={() => onViewSummary(event.callSummaryId!)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#f3f1ef] dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] rounded-xl font-albert font-medium text-sm hover:bg-[#e8e4df] dark:hover:bg-[#313746] transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  View Call Summary
                </button>
              )}

              {/* Recording Player (audio or video) */}
              {hasRecording && event.recordingUrl && (
                <div className="space-y-2">
                  <MediaPlayer
                    src={event.recordingUrl}
                    className="w-full"
                    isAudioOnly={event.isAudioOnly}
                    compact
                  />
                  <a
                    href={event.recordingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1 text-xs text-[#5f5a55] dark:text-[#b2b6c2] hover:text-brand-accent transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View Full Recording
                  </a>
                </div>
              )}

              {/* Generate Summary Button (recording exists but no summary, host only) */}
              {hasRecording && !hasSummary && isHost && (
                <GenerateSummaryButton
                  eventId={event.id}
                  durationMinutes={event.durationMinutes || 60}
                  onGenerated={(summaryId) => {
                    onRecordingUploaded?.(event.id, summaryId);
                  }}
                />
              )}

              {/* Fill Week from Summary Button (has summary, program context, host only) */}
              {hasSummary && event.programId && event.instanceId && isHost && (
                <FillWeekFromSummaryButton
                  eventId={event.id}
                  onFilled={() => {
                    onEventUpdated?.();
                  }}
                />
              )}

              {/* Upload Recording Option (host only, no recording and no summary) */}
              {!hasRecording && !hasSummary && isHost && (
                <div className="space-y-2">
                  <InlineRecordingUpload
                    eventId={event.id}
                    onUploadComplete={() => {
                      // Trigger event refresh - recording is now linked
                      onEventUpdated?.();
                    }}
                  />
                  {/* Refresh Recording from Stream */}
                  <button
                    onClick={handleFetchRecording}
                    disabled={isFetchingRecording}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-[#5f5a55] dark:text-[#b2b6c2] text-sm hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isFetchingRecording ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    {isFetchingRecording ? 'Checking...' : 'Fetch Recording from Call'}
                  </button>
                  {fetchRecordingMessage && (
                    <p className="text-xs text-center text-[#5f5a55] dark:text-[#b2b6c2]">
                      {fetchRecordingMessage}
                    </p>
                  )}
                </div>
              )}

              {/* No summary message (non-host only, no recording) */}
              {!hasSummary && !hasRecording && !isHost && (
                <div className="flex items-center justify-center gap-2 px-4 py-3 text-[#5f5a55] dark:text-[#b2b6c2] text-sm">
                  <FileText className="w-4 h-4" />
                  No summary available
                </div>
              )}

              {/* Recording available message (non-host, has recording but no summary) */}
              {hasRecording && !hasSummary && !isHost && (
                <div className="flex items-center justify-center gap-2 px-4 py-3 text-[#5f5a55] dark:text-[#b2b6c2] text-sm">
                  <FileText className="w-4 h-4" />
                  No summary available yet
                </div>
              )}
            </div>
          )}

          {/* Future Event Actions (Reschedule/Cancel) */}
          {!isPastEvent && !isPending && (canReschedule || canCancel) && (
            <div className="pt-3 mt-3 border-t border-[#e1ddd8] dark:border-[#262b35] space-y-2">
              <div className="flex gap-2">
                {/* Reschedule Button */}
                {canReschedule && onReschedule && (
                  <button
                    onClick={onReschedule}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#f3f1ef] dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] rounded-xl font-albert font-medium text-sm hover:bg-[#e8e4df] dark:hover:bg-[#313746] transition-colors"
                  >
                    <CalendarClock className="w-4 h-4" />
                    Reschedule
                  </button>
                )}

                {/* Cancel Button */}
                {canCancel && onCancel && (
                  <button
                    onClick={onCancel}
                    disabled={isCancelling}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-albert font-medium text-sm hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 transition-colors"
                  >
                    {isCancelling ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CalendarX2 className="w-4 h-4" />
                    )}
                    {isHost ? 'Cancel' : 'Leave'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer for non-pending future events with meeting link or in-app call */}
        {/* Coaches always see join button, users only within 1 hour */}
        {!isPending && !isPastEvent && (() => {
          const hasExternalLink = !!event.meetingLink;
          const isInAppCall = event.locationType === 'chat' || event.meetingProvider === 'stream';
          const withinTimeWindow = isHost || isWithinOneHourBefore(event.startTime);
          const canJoinInApp = isInAppCall && !hasExternalLink && withinTimeWindow;

          if (hasExternalLink && withinTimeWindow) {
            return (
              <div className="sticky bottom-0 px-5 py-4 border-t border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22]">
                <a
                  href={event.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center px-4 py-3 bg-brand-accent text-white rounded-xl font-albert font-medium hover:bg-brand-accent/90 transition-colors"
                >
                  Join Meeting
                </a>
              </div>
            );
          }

          if (canJoinInApp) {
            return (
              <div className="sticky bottom-0 px-5 py-4 border-t border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22]">
                <Link
                  href={`/call/event-${event.id}`}
                  className="block w-full text-center px-4 py-3 bg-brand-accent text-white rounded-xl font-albert font-medium hover:bg-brand-accent/90 transition-colors"
                >
                  Join Call
                </Link>
              </div>
            );
          }

          return null;
        })()}
      </div>
    </>,
    document.body
  );
}
