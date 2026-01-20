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
    weekday: 'long',
    month: 'long',
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
        // Get the first share URL from recordings
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
    <div className="flex flex-col h-full bg-[#faf8f6] dark:bg-[#0f1117]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8e4df] dark:border-[#262b35]">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#1d222b] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[#1a1a1a] dark:text-white" />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-[#1a1a1a] dark:text-white font-albert">
              Edit Past Event
            </h1>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Past
            </span>
          </div>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={saving || !title.trim()}
          className="bg-earth-500 hover:bg-earth-600 text-white font-medium px-6"
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">

          {/* Recording Link Section - Prominent at top */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border border-violet-200/50 dark:border-violet-800/30">
            <div className="absolute top-0 right-0 w-32 h-32 bg-violet-200/30 dark:bg-violet-800/20 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/10 dark:bg-violet-500/20">
                  <Play className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#1a1a1a] dark:text-white font-albert">
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
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white dark:bg-[#1d222b] border border-[#e8e4df] dark:border-[#3a3f4b] text-[#1a1a1a] dark:text-white placeholder:text-[#9a958f] dark:placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
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
                    Preview recording
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Event Details Section */}
          <div className="space-y-6">
            <h3 className="text-sm font-medium text-[#6b7280] dark:text-[#9ca3af] uppercase tracking-wider">
              Event Details
            </h3>

            {/* Cover Image (if exists) */}
            {event.coverImageUrl && (
              <div className="relative aspect-[2/1] rounded-xl overflow-hidden bg-[#f3f1ef] dark:bg-[#1d222b]">
                <Image
                  src={event.coverImageUrl}
                  alt={event.title}
                  fill
                  className="object-cover"
                />
              </div>
            )}

            {/* Title - Editable */}
            <div>
              <label className="block text-sm font-medium text-[#6b7280] dark:text-[#9ca3af] mb-2">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white dark:bg-[#1d222b] border border-[#e8e4df] dark:border-[#3a3f4b] text-[#1a1a1a] dark:text-white focus:outline-none focus:ring-2 focus:ring-earth-500/30 focus:border-earth-500 font-albert text-lg"
              />
            </div>

            {/* Schedule - Read only */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-[#1d222b] border border-[#e8e4df] dark:border-[#3a3f4b]">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#f3f1ef] dark:bg-[#262b35]">
                  <Calendar className="w-5 h-5 text-[#6b7280] dark:text-[#9ca3af]" />
                </div>
                <div>
                  <p className="text-xs text-[#9a958f] dark:text-[#6b7280]">Date</p>
                  <p className="text-sm font-medium text-[#1a1a1a] dark:text-white">
                    {formatDateDisplay(event.date)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-[#1d222b] border border-[#e8e4df] dark:border-[#3a3f4b]">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#f3f1ef] dark:bg-[#262b35]">
                  <Clock className="w-5 h-5 text-[#6b7280] dark:text-[#9ca3af]" />
                </div>
                <div>
                  <p className="text-xs text-[#9a958f] dark:text-[#6b7280]">Time</p>
                  <p className="text-sm font-medium text-[#1a1a1a] dark:text-white">
                    {eventTime} {event.timezone && `(${event.timezone})`}
                  </p>
                </div>
              </div>
            </div>

            {/* Host - Read only */}
            {event.hostName && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-[#1d222b] border border-[#e8e4df] dark:border-[#3a3f4b]">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#f3f1ef] dark:bg-[#262b35] overflow-hidden">
                  {event.hostAvatarUrl ? (
                    <Image
                      src={event.hostAvatarUrl}
                      alt={event.hostName}
                      width={40}
                      height={40}
                      className="object-cover"
                    />
                  ) : (
                    <User className="w-5 h-5 text-[#6b7280] dark:text-[#9ca3af]" />
                  )}
                </div>
                <div>
                  <p className="text-xs text-[#9a958f] dark:text-[#6b7280]">Host</p>
                  <p className="text-sm font-medium text-[#1a1a1a] dark:text-white">
                    {event.hostName}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Info message */}
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Note:</strong> This event has already passed. You can only edit the title and add a recording link. Other details are preserved from the original event.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
