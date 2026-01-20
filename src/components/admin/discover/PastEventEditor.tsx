'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import type { DiscoverEvent } from '@/types/discover';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';

// Helper functions
function formatTime12Hour(time: string): string {
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
                      Add a recording link for attendees to watch
                    </p>
                  </div>
                </div>

                {/* Recording URL input */}
                <div className="space-y-3">
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
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] text-[#1a1a1a] dark:text-white placeholder:text-[#9a958f] dark:placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 font-albert"
                    />
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

                  {/* Error message */}
                  {fetchError && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {fetchError}
                    </p>
                  )}

                  {/* Preview link */}
                  {recordingUrl && (
                    <a
                      href={recordingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View recording
                    </a>
                  )}
                </div>
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

              {/* Mobile-only: Date, Time, Host info */}
              <div className="lg:hidden space-y-3">
                <div className="flex items-center gap-3 p-4 bg-white dark:bg-[#171b22] rounded-xl border border-[#e8e4df] dark:border-[#262b35]">
                  <Calendar className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
                  <div>
                    <p className="text-xs text-[#9a958f] dark:text-[#6b7280]">Date</p>
                    <p className="text-sm font-medium text-[#1a1a1a] dark:text-white font-albert">
                      {formatDateDisplay(event.date)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-white dark:bg-[#171b22] rounded-xl border border-[#e8e4df] dark:border-[#262b35]">
                  <Clock className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
                  <div>
                    <p className="text-xs text-[#9a958f] dark:text-[#6b7280]">Time</p>
                    <p className="text-sm font-medium text-[#1a1a1a] dark:text-white font-albert">
                      {eventTime}
                    </p>
                  </div>
                </div>

                {event.timezone && (
                  <div className="flex items-center gap-3 p-4 bg-white dark:bg-[#171b22] rounded-xl border border-[#e8e4df] dark:border-[#262b35]">
                    <Globe className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
                    <div>
                      <p className="text-xs text-[#9a958f] dark:text-[#6b7280]">Timezone</p>
                      <p className="text-sm font-medium text-[#1a1a1a] dark:text-white font-albert">
                        {event.timezone}
                      </p>
                    </div>
                  </div>
                )}

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
                          {event.hostName.split(' ').map(n => n[0]).join('').slice(0, 2)}
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
