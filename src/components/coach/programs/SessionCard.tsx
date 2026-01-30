'use client';

import { useState, useMemo } from 'react';
import {
  Calendar,
  Check,
  ChevronDown,
  FileText,
  Loader2,
  RefreshCw,
  Video,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { UnifiedEvent } from '@/types';
import { MediaPlayer } from '@/components/video/MediaPlayer';
import { InlineRecordingUpload } from '@/components/scheduling/InlineRecordingUpload';
import { GenerateSummaryButton } from '@/components/scheduling/GenerateSummaryButton';

interface SessionCardProps {
  event: UnifiedEvent;
  hasSummary: boolean;
  hasRecording: boolean;
  recordingStatus?: string;
  isToday: boolean;
  onRemove: () => void;
  onViewSummary?: () => void;
  onSummaryGenerated?: (summaryId: string) => void;
  onRecordingFetched?: () => void;
}

/**
 * SessionCard Component
 *
 * Apple glass-style session card with dropdown drawer for recording/summary management.
 * Displays session info in collapsed state, expands to show player and actions.
 */
export function SessionCard({
  event,
  hasSummary,
  hasRecording,
  recordingStatus,
  isToday,
  onRemove,
  onViewSummary,
  onSummaryGenerated,
  onRecordingFetched,
}: SessionCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchMessage, setFetchMessage] = useState<string | null>(null);

  // Compute session state
  const sessionState = useMemo(() => {
    const eventDate = event.startDateTime ? new Date(event.startDateTime) : null;
    const now = new Date();
    const endTime = event.endDateTime
      ? new Date(event.endDateTime)
      : eventDate
        ? new Date(eventDate.getTime() + (event.durationMinutes || 60) * 60000)
        : null;

    const isPast = eventDate ? eventDate < now : false;
    const isCallInProgress = eventDate && endTime
      ? now >= eventDate && now <= endTime
      : false;

    // Check if this is a video call that could have automatic recording
    const isVideoCall = event.meetingProvider === 'zoom' ||
                        event.meetingProvider === 'google_meet' ||
                        event.meetingProvider === 'stream' ||
                        event.locationType === 'chat';

    // Check if call ended recently (within 15 minutes)
    const minutesSinceEnd = endTime ? (Date.now() - endTime.getTime()) / 60000 : Infinity;
    const isRecentlyEnded = isPast && isVideoCall && minutesSinceEnd < 15;

    const isProcessing = recordingStatus === 'processing';

    // Determine the display state
    if (isCallInProgress) {
      return 'in-progress';
    } else if (hasRecording) {
      return 'ready';
    } else if (isProcessing) {
      return 'processing';
    } else if (isPast && isVideoCall && isRecentlyEnded) {
      return 'finding';
    } else if (isPast && !hasRecording) {
      return 'no-recording';
    } else {
      return 'upcoming';
    }
  }, [event, hasRecording, recordingStatus]);

  // Format date for display
  const formattedDate = useMemo(() => {
    if (!event.startDateTime) return 'No date';
    const date = new Date(event.startDateTime);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [event.startDateTime]);

  // Handle fetch recording
  const handleFetchRecording = async () => {
    if (isFetching) return;
    setIsFetching(true);
    setFetchMessage(null);

    try {
      const response = await fetch(`/api/events/${event.id}/fetch-recording`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success && data.recordingUrl) {
        setFetchMessage('Recording found!');
        onRecordingFetched?.();
      } else {
        setFetchMessage(data.message || 'No recording found yet');
      }
    } catch {
      setFetchMessage('Failed to check for recording');
    } finally {
      setIsFetching(false);
    }
  };

  // Get the left icon based on state
  const getLeftIcon = () => {
    switch (sessionState) {
      case 'ready':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'in-progress':
      case 'finding':
      case 'processing':
        return <Loader2 className="w-4 h-4 text-brand-accent animate-spin" />;
      default:
        return <Calendar className="w-4 h-4 text-brand-accent" />;
    }
  };

  // Get recording status icon for right side
  const getRecordingStatusIcon = () => {
    if (hasRecording) {
      return (
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/30">
          <Video className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
        </div>
      );
    }
    if (sessionState === 'finding' || sessionState === 'processing' || isFetching) {
      return (
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800/50">
          <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin" />
        </div>
      );
    }
    return null;
  };

  // Card background based on state
  const cardBgClass = useMemo(() => {
    if (hasSummary) {
      return 'bg-green-50/80 dark:bg-green-900/20 border-green-200/60 dark:border-green-800/50';
    }
    if (isToday) {
      return 'bg-blue-50/80 dark:bg-blue-900/20 border-blue-200/60 dark:border-blue-800/50';
    }
    if (sessionState === 'finding' || sessionState === 'processing') {
      return 'bg-slate-50/80 dark:bg-slate-900/20 border-slate-200/60 dark:border-slate-700/50';
    }
    return 'bg-white/60 dark:bg-[#171b22]/60 border-[#e1ddd8]/50 dark:border-[#262b35]/50';
  }, [hasSummary, isToday, sessionState]);

  return (
    <div
      className={cn(
        'rounded-2xl backdrop-blur-xl border shadow-sm overflow-hidden transition-all duration-200',
        cardBgClass,
        isOpen && 'shadow-md'
      )}
    >
      {/* Header - Always visible */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
      >
        {/* Left icon */}
        <div className="flex-shrink-0">
          {getLeftIcon()}
        </div>

        {/* Title and date */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
            {event.title || `Call ${event.id.slice(0, 8)}...`}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
              {formattedDate}
            </span>
            {isToday && (
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                • Today
              </span>
            )}
            {hasSummary && (
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                • Summary ready
              </span>
            )}
          </div>
        </div>

        {/* Right side icons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Summary button/icon */}
          {hasSummary ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewSummary?.();
              }}
              className="flex items-center justify-center w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-800/40 transition-colors"
              title="View summary"
            >
              <FileText className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
            </button>
          ) : hasRecording && sessionState !== 'in-progress' ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Open the drawer so user can see the generate button
                if (!isOpen) setIsOpen(true);
              }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-brand-accent/10 hover:bg-brand-accent/20 transition-colors"
              title="Generate summary (1 credit)"
            >
              <FileText className="w-3 h-3 text-brand-accent" />
              <span className="text-[10px] font-medium text-brand-accent whitespace-nowrap">
                Get Summary
              </span>
            </button>
          ) : null}

          {/* Recording status icon */}
          {getRecordingStatusIcon()}

          {/* Remove button (shown on hover via group) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-[#a7a39e] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
            title="Unlink call"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Chevron */}
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex items-center justify-center w-6 h-6"
          >
            <ChevronDown className="w-4 h-4 text-[#a7a39e] dark:text-[#7d8190]" />
          </motion.div>
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-[#e1ddd8]/30 dark:border-[#262b35]/30">
              {/* Call in progress state */}
              {sessionState === 'in-progress' && (
                <div className="flex items-center gap-3 p-4 bg-blue-50/80 dark:bg-blue-900/30 rounded-xl">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-800/50">
                    <Video className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Call in progress
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      Recording will be available after the call ends
                    </p>
                  </div>
                </div>
              )}

              {/* Finding recording state */}
              {sessionState === 'finding' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 bg-slate-50/80 dark:bg-slate-800/30 rounded-xl">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700/50">
                      <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Finding recording...
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Recording may not be ready yet
                      </p>
                    </div>
                    <button
                      onClick={handleFetchRecording}
                      disabled={isFetching}
                      className="flex items-center justify-center w-8 h-8 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"
                      title="Check for recording"
                    >
                      {isFetching ? (
                        <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                  </div>
                  {fetchMessage && (
                    <p className="text-xs text-center text-[#8c8c8c] dark:text-[#7d8190]">
                      {fetchMessage}
                    </p>
                  )}
                  <InlineRecordingUpload
                    eventId={event.id}
                    onUploadComplete={onRecordingFetched}
                    variant="link"
                  />
                </div>
              )}

              {/* Processing recording state */}
              {sessionState === 'processing' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 bg-brand-accent/5 dark:bg-brand-accent/10 rounded-xl border border-brand-accent/20">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-accent/10">
                      <Loader2 className="w-5 h-5 text-brand-accent animate-spin" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                        Processing recording...
                      </p>
                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                        Usually ready within a few minutes
                      </p>
                    </div>
                    <button
                      onClick={handleFetchRecording}
                      disabled={isFetching}
                      className="flex items-center justify-center w-8 h-8 rounded-lg bg-white dark:bg-[#262b35] border border-[#e1ddd8] dark:border-[#3a3f4a] hover:bg-[#f7f5f3] dark:hover:bg-[#313746] disabled:opacity-50 transition-colors"
                      title="Check for recording"
                    >
                      {isFetching ? (
                        <Loader2 className="w-4 h-4 text-brand-accent animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                      )}
                    </button>
                  </div>
                  {fetchMessage && (
                    <p className="text-xs text-center text-[#8c8c8c] dark:text-[#7d8190]">
                      {fetchMessage}
                    </p>
                  )}
                  <InlineRecordingUpload
                    eventId={event.id}
                    onUploadComplete={onRecordingFetched}
                    variant="link"
                  />
                </div>
              )}

              {/* No recording (past call, not video) */}
              {sessionState === 'no-recording' && (
                <div className="space-y-3">
                  <InlineRecordingUpload
                    eventId={event.id}
                    onUploadComplete={onRecordingFetched}
                  />
                </div>
              )}

              {/* Recording ready - show player and generate summary option */}
              {sessionState === 'ready' && event.recordingUrl && (
                <div className="space-y-3">
                  <MediaPlayer
                    src={event.recordingUrl}
                    poster={event.coverImageUrl}
                    className="rounded-xl overflow-hidden"
                    aspectRatio="16:9"
                    isAudioOnly={event.isAudioOnly}
                  />
                  {/* Generate Summary button if no summary yet */}
                  {!hasSummary && onSummaryGenerated && (
                    <GenerateSummaryButton
                      eventId={event.id}
                      durationMinutes={event.durationMinutes || 60}
                      onGenerated={onSummaryGenerated}
                      className="mt-2"
                    />
                  )}
                </div>
              )}

              {/* Upcoming call */}
              {sessionState === 'upcoming' && (
                <div className="flex items-center gap-3 p-4 bg-[#f7f5f3]/80 dark:bg-[#1e222a]/80 rounded-xl">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-accent/10">
                    <Calendar className="w-5 h-5 text-brand-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                      Upcoming session
                    </p>
                    <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                      Recording will be available after the call
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
