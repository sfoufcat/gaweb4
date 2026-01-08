'use client';

import { useCallback, useEffect, useRef, useState, useLayoutEffect } from 'react';
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
} from 'lucide-react';
import type { UnifiedEvent } from '@/types';

interface EventDetailPopupProps {
  event: UnifiedEvent;
  isOpen: boolean;
  onClose: () => void;
  onRespond?: (eventId: string, action: 'accept' | 'decline', selectedTimeId?: string) => void;
  onCounterPropose?: (eventId: string) => void;
  isLoading?: boolean;
  /** Position for desktop popup (near clicked element) - x,y are the click coordinates */
  position?: { x: number; y: number };
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
}: EventDetailPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [computedPosition, setComputedPosition] = useState<{ top: number; left: number } | null>(null);

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
        style={computedPosition ? {
          top: `${computedPosition.top}px`,
          left: `${computedPosition.left}px`,
        } : position ? {
          // Fallback: center on desktop until position is computed
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        } : undefined}
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
          <button
            onClick={onClose}
            className="flex-shrink-0 p-2 text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[calc(85vh-130px)] sm:max-h-[calc(70vh-130px)]">
          {/* Event Type */}
          <div className="flex items-center gap-3 text-[#5f5a55] dark:text-[#b2b6c2]">
            {event.eventType === 'coaching_1on1' ? (
              <>
                <User className="w-4 h-4" />
                <span className="text-sm">1-on-1 Coaching Call</span>
              </>
            ) : event.eventType === 'squad_call' ? (
              <>
                <Users className="w-4 h-4" />
                <span className="text-sm">Squad Call</span>
              </>
            ) : (
              <>
                <Video className="w-4 h-4" />
                <span className="text-sm">{event.eventType?.replace(/_/g, ' ')}</span>
              </>
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

          {/* Meeting Link (for confirmed events) */}
          {!isPending && event.meetingLink && (
            <a
              href={event.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-brand-accent/10 text-brand-accent rounded-lg font-albert font-medium text-sm hover:bg-brand-accent/20 transition-colors"
            >
              <Video className="w-4 h-4" />
              Join Meeting
              <ExternalLink className="w-3 h-3 ml-auto" />
            </a>
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
        </div>

        {/* Footer for non-pending events */}
        {!isPending && event.meetingLink && (
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
        )}
      </div>
    </>,
    document.body
  );
}
