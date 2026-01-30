'use client';

import { useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import type { DiscoverEvent } from '@/types/discover';
import { Button } from '@/components/ui/button';
import { InlineRecordingUpload } from '@/components/scheduling/InlineRecordingUpload';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Video,
  ExternalLink,
  Loader2,
  Play,
  Link as LinkIcon,
  Check,
  User,
  Globe,
  Upload,
  X,
} from 'lucide-react';

// Provider icons
function ZoomIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M4.585 6.836A2.5 2.5 0 0 1 7.085 4.5h9.83a2.5 2.5 0 0 1 2.5 2.336l.5 8a2.5 2.5 0 0 1-2.5 2.664h-9.83a2.5 2.5 0 0 1-2.5-2.664l.5-8zm12.665 2.414l3.25-2.167v9.834l-3.25-2.167V9.25z" />
    </svg>
  );
}

function GoogleMeetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  );
}

function StreamIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
    </svg>
  );
}

// Helper functions
function formatTime12Hour(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export interface PastEventEditorProps {
  event: DiscoverEvent;
  onClose: () => void;
  onSave: () => void;
  apiEndpoint: string;
}

export function PastEventEditor({
  event,
  onClose,
  onSave,
  apiEndpoint,
}: PastEventEditorProps) {
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(event.title || '');
  const [recordingUrl, setRecordingUrl] = useState(event.recordingUrl || '');
  const [fetchingRecording, setFetchingRecording] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);

  // Determine recording states
  const hasRecording = !!recordingUrl;
  const isEncoding = event.recordingStatus === 'encoding';
  const videoCallProviders = ['zoom', 'google_meet', 'stream'];
  const isVideoCallProvider = event.meetingProvider && videoCallProviders.includes(event.meetingProvider);

  // Check if this is a recent call that might still be fetching recordings
  const isRecentVideoCall = useMemo(() => {
    if (!event.endTime || !event.date || !isVideoCallProvider) return false;

    // Parse end datetime
    const endDateTime = new Date(`${event.date}T${event.endTime}`);
    const now = new Date();
    const minutesAgo = (now.getTime() - endDateTime.getTime()) / 60000;

    return minutesAgo > 0 && minutesAgo < 90;
  }, [event.date, event.endTime, isVideoCallProvider]);

  const showWaitingState = !hasRecording && !isEncoding && isRecentVideoCall;
  const showUploadOptions = !hasRecording && !isEncoding && !isRecentVideoCall;

  // Determine which auto-fetch options are available
  const canFetchFromZoom = event.meetingProvider === 'zoom' && event.externalMeetingId;
  const canFetchFromGoogleDrive = event.meetingProvider === 'google_meet' && event.externalMeetingId;

  const handleFetchFromZoom = useCallback(async () => {
    if (!event.externalMeetingId) return;

    setFetchingRecording(true);
    setFetchError(null);

    try {
      const response = await fetch(`/api/coach/integrations/zoom/recordings?meetingId=${event.externalMeetingId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch recording');
      }

      if (data.recordingUrl) {
        setRecordingUrl(data.recordingUrl);
      } else if (data.recordings && data.recordings.length > 0) {
        const recording = data.recordings[0];
        setRecordingUrl(recording.shareUrl || recording.downloadUrl || '');
      } else {
        setFetchError('No recording found for this meeting');
      }
    } catch (err) {
      console.error('Error fetching Zoom recording:', err);
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch recording');
    } finally {
      setFetchingRecording(false);
    }
  }, [event.externalMeetingId]);

  const handleFetchFromGoogleDrive = useCallback(async () => {
    if (!event.externalMeetingId) return;

    setFetchingRecording(true);
    setFetchError(null);

    try {
      const response = await fetch(`/api/coach/integrations/google-drive/recordings?eventId=${event.externalMeetingId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch recording');
      }

      if (data.recordingUrl) {
        setRecordingUrl(data.recordingUrl);
      } else {
        setFetchError('No recording found in Google Drive');
      }
    } catch (err) {
      console.error('Error fetching Google Drive recording:', err);
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch recording');
    } finally {
      setFetchingRecording(false);
    }
  }, [event.externalMeetingId]);

  const handleSubmit = async () => {
    setSaving(true);
    setSavedSuccess(false);

    try {
      const payload = {
        title: title.trim(),
        recordingUrl: recordingUrl.trim() || null,
      };

      const response = await fetch(`${apiEndpoint}/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save event');
      }

      setSavedSuccess(true);
      setTimeout(() => {
        onSave();
        onClose();
      }, 500);
    } catch (err) {
      console.error('Error saving event:', err);
      alert(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadComplete = useCallback(() => {
    // Recording uploaded, refresh the event data
    onSave();
  }, [onSave]);

  const handleRecordingUploaded = useCallback((url: string) => {
    setRecordingUrl(url);
  }, []);

  // Get provider icon for waiting state
  const ProviderIcon = useMemo(() => {
    switch (event.meetingProvider) {
      case 'zoom':
        return ZoomIcon;
      case 'google_meet':
        return GoogleMeetIcon;
      case 'stream':
        return StreamIcon;
      default:
        return Video;
    }
  }, [event.meetingProvider]);

  const providerName = useMemo(() => {
    switch (event.meetingProvider) {
      case 'zoom':
        return 'Zoom';
      case 'google_meet':
        return 'Google Meet';
      case 'stream':
        return 'app call';
      default:
        return 'video call';
    }
  }, [event.meetingProvider]);

  // Format the event time
  const eventTime = event.startTime && event.endTime
    ? `${formatTime12Hour(event.startTime)} – ${formatTime12Hour(event.endTime)}`
    : event.startTime
      ? formatTime12Hour(event.startTime)
      : '';

  return (
    <div className="flex flex-col h-full min-h-screen bg-[#faf8f6] dark:bg-[#0d0f14]">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-[#e1ddd8] dark:border-[#262b35] bg-[#faf8f6]/80 dark:bg-[#0d0f14]/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="p-2 -ml-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-white hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
              Edit Past Event
            </h1>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Past
            </span>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={saving || !title.trim()}
            className="bg-brand-accent hover:bg-brand-accent/90 text-white font-albert"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : savedSuccess ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Saved
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row gap-6">

            {/* Left Column - Main Content */}
            <div className="flex-1 space-y-6">

              {/* Recording Section - Prominent */}
              <div className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 rounded-2xl border border-violet-200/50 dark:border-violet-800/30 p-5 sm:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/10 dark:bg-violet-500/20">
                    <Play className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-[#1a1a1a] dark:text-white font-albert">
                      Event Recording
                    </h2>
                    <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">
                      {hasRecording ? 'Recording available for attendees' : 'Add a recording link for attendees to watch'}
                    </p>
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  {/* State 1: Has Recording - Show preview */}
                  {hasRecording && (
                    <motion.div
                      key="has-recording"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3"
                    >
                      <div className="flex items-center gap-3 p-3 bg-white dark:bg-[#171b22] rounded-xl border border-[#e1ddd8] dark:border-[#262b35]">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                          <Play className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#1a1a1a] dark:text-white truncate">
                            Recording available
                          </p>
                          <a
                            href={recordingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-violet-600 dark:text-violet-400 hover:underline truncate block"
                          >
                            {recordingUrl}
                          </a>
                        </div>
                        <a
                          href={recordingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                        </a>
                      </div>
                      <button
                        onClick={() => {
                          setRecordingUrl('');
                          setShowLinkInput(false);
                        }}
                        className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] hover:text-red-600 dark:hover:text-red-400 hover:underline"
                      >
                        Remove recording
                      </button>
                    </motion.div>
                  )}

                  {/* State 2: Encoding - Show processing state */}
                  {isEncoding && (
                    <motion.div
                      key="encoding"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-3 p-4 bg-white dark:bg-[#171b22] rounded-xl border border-[#e1ddd8] dark:border-[#262b35]"
                    >
                      <Loader2 className="w-5 h-5 animate-spin text-violet-600 dark:text-violet-400" />
                      <div>
                        <p className="text-sm font-medium text-[#1a1a1a] dark:text-white">
                          Processing video...
                        </p>
                        <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                          This may take a few minutes
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {/* State 3: Waiting for recording (recent call) */}
                  {showWaitingState && !showLinkInput && (
                    <motion.div
                      key="waiting"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center gap-3 p-4 bg-white dark:bg-[#171b22] rounded-xl border border-amber-200/50 dark:border-amber-800/30">
                        <div className="relative">
                          <ProviderIcon className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                          <div className="absolute -bottom-1 -right-1 w-3 h-3">
                            <Loader2 className="w-3 h-3 animate-spin text-amber-600 dark:text-amber-400" />
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#1a1a1a] dark:text-white">
                            Looking for {providerName} recording...
                          </p>
                          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                            Recordings usually appear within 15-30 minutes
                          </p>
                        </div>
                      </div>

                      {/* Manual options while waiting */}
                      <div className="space-y-3">
                        <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                          Can&apos;t wait? Add manually:
                        </p>
                        <InlineRecordingUpload
                          eventId={event.id}
                          onUploadComplete={handleUploadComplete}
                          onRecordingUploaded={handleRecordingUploaded}
                          variant="default"
                        />
                        <div className="flex justify-center">
                          <button
                            onClick={() => setShowLinkInput(true)}
                            className="inline-flex items-center gap-1.5 text-sm text-[#5f5a55] dark:text-[#b2b6c2] hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                          >
                            <LinkIcon className="w-4 h-4" />
                            Add from link
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* State 4: No recording, not waiting - Show upload + link below */}
                  {showUploadOptions && !showLinkInput && (
                    <motion.div
                      key="upload-options"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3"
                    >
                      <InlineRecordingUpload
                        eventId={event.id}
                        onUploadComplete={handleUploadComplete}
                        onRecordingUploaded={handleRecordingUploaded}
                        variant="default"
                      />
                      <div className="flex justify-center">
                        <button
                          onClick={() => setShowLinkInput(true)}
                          className="inline-flex items-center gap-1.5 text-sm text-[#5f5a55] dark:text-[#b2b6c2] hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                        >
                          <LinkIcon className="w-4 h-4" />
                          Add from link
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Link input expanded (for both waiting and non-waiting states) */}
                  {(showUploadOptions || showWaitingState) && showLinkInput && (
                    <motion.div
                      key="link-input"
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.98 }}
                      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                      className="space-y-3"
                    >
                      <div className="relative">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9a958f] dark:text-[#6b7280]" />
                        <input
                          type="url"
                          value={recordingUrl}
                          onChange={(e) => {
                            setRecordingUrl(e.target.value);
                            setFetchError(null);
                          }}
                          placeholder="Paste recording URL (YouTube, Vimeo, Zoom, etc.)"
                          className="w-full pl-10 pr-10 py-3 rounded-xl bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] text-[#1a1a1a] dark:text-white placeholder:text-[#9a958f] dark:placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 font-albert"
                          autoFocus
                        />
                        <button
                          onClick={() => {
                            setShowLinkInput(false);
                            setRecordingUrl('');
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded transition-colors"
                        >
                          <X className="w-4 h-4 text-[#9a958f] dark:text-[#6b7280]" />
                        </button>
                      </div>

                      {/* Auto-fetch buttons */}
                      {(canFetchFromZoom || canFetchFromGoogleDrive) && (
                        <div className="flex flex-wrap gap-2">
                          {canFetchFromZoom && (
                            <button
                              onClick={handleFetchFromZoom}
                              disabled={fetchingRecording}
                              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50"
                            >
                              {fetchingRecording ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Video className="w-4 h-4" />
                              )}
                              Fetch from Zoom
                            </button>
                          )}
                          {canFetchFromGoogleDrive && (
                            <button
                              onClick={handleFetchFromGoogleDrive}
                              disabled={fetchingRecording}
                              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30 transition-colors disabled:opacity-50"
                            >
                              {fetchingRecording ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z" />
                                </svg>
                              )}
                              Fetch from Google Drive
                            </button>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error message */}
                {fetchError && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-600 dark:text-red-400 mt-3"
                  >
                    {fetchError}
                  </motion.p>
                )}
              </div>

              {/* Event Details */}
              <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e8e4df] dark:border-[#262b35] overflow-hidden">
                {/* Cover Image */}
                {event.coverImageUrl && (
                  <div className="relative aspect-[2/1] bg-[#f3f1ef] dark:bg-[#1e222a]">
                    <Image
                      src={event.coverImageUrl}
                      alt={event.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}

                {/* Title */}
                <div className="p-5 sm:p-6">
                  <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wider mb-2 font-albert">
                    Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[#faf8f6] dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] text-[#1a1a1a] dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-accent/30 focus:border-brand-accent font-albert text-lg"
                  />
                </div>
              </div>

              {/* Mobile-only: Date, Time, Timezone in one card + Host separately */}
              <div className="lg:hidden space-y-3">
                {/* Date & Time Card - Combined */}
                <div className="bg-white dark:bg-[#171b22] rounded-xl border border-[#e8e4df] dark:border-[#262b35] p-4">
                  <h3 className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wider mb-3 font-albert">
                    Date & Time
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-xs text-[#9a958f] dark:text-[#6b7280]">Date</p>
                        <p className="text-sm font-medium text-[#1a1a1a] dark:text-white font-albert">
                          {formatDateDisplay(event.date)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-xs text-[#9a958f] dark:text-[#6b7280]">Time</p>
                        <p className="text-sm font-medium text-[#1a1a1a] dark:text-white font-albert">
                          {eventTime}
                        </p>
                      </div>
                    </div>

                    {event.timezone && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
                          <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-xs text-[#9a958f] dark:text-[#6b7280]">Timezone</p>
                          <p className="text-sm font-medium text-[#1a1a1a] dark:text-white font-albert">
                            {event.timezone}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Host Card - Separate */}
                {event.hostName && (
                  <div className="flex items-center gap-3 p-4 bg-white dark:bg-[#171b22] rounded-xl border border-[#e8e4df] dark:border-[#262b35]">
                    {event.hostAvatarUrl ? (
                      <Image
                        src={event.hostAvatarUrl}
                        alt={event.hostName}
                        width={40}
                        height={40}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-brand-accent/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-brand-accent" />
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-[#9a958f] dark:text-[#6b7280]">Host</p>
                      <p className="text-sm font-medium text-[#1a1a1a] dark:text-white font-albert">
                        {event.hostName}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Info message */}
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30">
                <p className="text-sm text-amber-800 dark:text-amber-200 font-albert">
                  <strong>Note:</strong> This event has already passed. You can only edit the title and add a recording link.
                </p>
              </div>
            </div>

            {/* Right Sidebar - Desktop only */}
            <div className="hidden lg:block lg:w-[300px] xl:w-[340px] space-y-5 flex-shrink-0">

              {/* Date & Time */}
              <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e8e4df] dark:border-[#262b35] p-5">
                <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-4">
                  Date & Time
                </h3>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-[#9a958f] dark:text-[#6b7280]">Date</p>
                      <p className="text-sm font-medium text-[#1a1a1a] dark:text-white font-albert">
                        {formatDateDisplay(event.date)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-xs text-[#9a958f] dark:text-[#6b7280]">Time</p>
                      <p className="text-sm font-medium text-[#1a1a1a] dark:text-white font-albert">
                        {eventTime}
                      </p>
                    </div>
                  </div>

                  {event.timezone && (
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
                        <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xs text-[#9a958f] dark:text-[#6b7280]">Timezone</p>
                        <p className="text-sm font-medium text-[#1a1a1a] dark:text-white font-albert">
                          {event.timezone}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Host */}
              {event.hostName && (
                <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e8e4df] dark:border-[#262b35] p-5">
                  <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-4">
                    Host
                  </h3>

                  <div className="flex items-center gap-3">
                    {event.hostAvatarUrl ? (
                      <Image
                        src={event.hostAvatarUrl}
                        alt={event.hostName}
                        width={48}
                        height={48}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-brand-accent/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-brand-accent">
                          {(event.hostName || '').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2) || 'H'}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                        {event.hostName}
                      </p>
                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">Event Host</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
