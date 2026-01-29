'use client';

import { use, useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { MapPin, AlertCircle, CheckCircle, CalendarClock, XCircle, Video, PlayCircle, CalendarCheck, ExternalLink } from 'lucide-react';
import { BackButton, ShareButton, AttendeeAvatars, RichContent, AddToCalendarButton, ContentPurchaseSheet } from '@/components/discover';
import { Button } from '@/components/ui/button';
import { MediaPlayer } from '@/components/video/MediaPlayer';
import { RescheduleCallModal } from '@/components/scheduling/RescheduleCallModal';
import { useSchedulingActions } from '@/hooks/useScheduling';
import type { DiscoverEvent, EventUpdate, EventAttendee } from '@/types/discover';
import type { UnifiedEvent } from '@/types';

interface EventPageProps {
  params: Promise<{ id: string }>;
}

interface EventDetailData {
  event: DiscoverEvent & { coachName?: string; coachImageUrl?: string; eventType?: string };
  updates: EventUpdate[];
  attendees: EventAttendee[];
  totalAttendees: number;
  isJoined: boolean;
  isOwned: boolean;
  includedInProgramName?: string;
}

// Helper function to check if within 1 hour before event
function isWithinOneHourBefore(datetime: string | Date): boolean {
  const eventTime = new Date(datetime);
  const now = new Date();
  const oneHourBefore = new Date(eventTime.getTime() - 60 * 60 * 1000);
  return now >= oneHourBefore && now < eventTime;
}

export default function EventDetailPage({ params }: EventPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  
  const [data, setData] = useState<EventDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [showPurchaseSheet, setShowPurchaseSheet] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const { cancelEvent } = useSchedulingActions();
  const justPurchased = searchParams.get('purchased') === 'true';

  // Fetch event data
  const fetchEvent = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/discover/events/${id}`);
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Event not found');
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching event:', err);
      setError(err instanceof Error ? err.message : 'Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  // Join/leave event handlers
  const joinEvent = useCallback(async () => {
    if (!data || !isSignedIn) return;
    
    setIsJoining(true);
    
    // Build current user attendee for optimistic update
    const currentUserAttendee: EventAttendee | null = user ? {
      userId: user.id,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      avatarUrl: user.imageUrl || undefined,
    } : null;
    
    // Optimistic update
    setData(prev => prev ? {
      ...prev,
      isJoined: true,
      totalAttendees: prev.totalAttendees + 1,
      attendees: currentUserAttendee 
        ? [currentUserAttendee, ...prev.attendees.filter(a => a.userId !== user?.id)]
        : prev.attendees,
    } : null);
    
    try {
      const response = await fetch(`/api/discover/events/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join' }),
      });
      
      if (!response.ok) {
        // Revert on failure
        await fetchEvent();
      }
    } catch {
      // Revert on error
      await fetchEvent();
    } finally {
      setIsJoining(false);
    }
  }, [id, data, isSignedIn, user, fetchEvent]);

  const leaveEvent = useCallback(async () => {
    if (!data) return;
    
    setIsJoining(true);
    
    // Optimistic update
    setData(prev => prev ? {
      ...prev,
      isJoined: false,
      totalAttendees: Math.max(0, prev.totalAttendees - 1),
      attendees: user 
        ? prev.attendees.filter(a => a.userId !== user.id)
        : prev.attendees,
    } : null);
    
    try {
      const response = await fetch(`/api/discover/events/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave' }),
      });
      
      if (!response.ok) {
        // Revert on failure
        await fetchEvent();
      }
    } catch {
      // Revert on error
      await fetchEvent();
    } finally {
      setIsJoining(false);
    }
  }, [id, data, user, fetchEvent]);

  // Cancel event handler (for 1:1 events)
  const handleCancel = useCallback(async () => {
    if (!data?.event || isCancelling) return;

    if (!confirm('Are you sure you want to cancel this call?')) return;

    setIsCancelling(true);
    try {
      await cancelEvent(id);
      router.push('/calendar');
    } catch (err) {
      console.error('Failed to cancel event:', err);
      alert('Failed to cancel event. Please try again.');
    } finally {
      setIsCancelling(false);
    }
  }, [id, data, isCancelling, cancelEvent, router]);

  // Convert DiscoverEvent to UnifiedEvent for RescheduleCallModal
  // Only the fields actually used by the modal are populated
  const unifiedEvent = useMemo(() => {
    if (!data?.event) return null;
    const e = data.event;
    return {
      id: e.id,
      title: e.title,
      startDateTime: e.startDateTime || `${e.date}T${e.startTime}`,
      endDateTime: e.endDateTime || `${e.date}T${e.endTime}`,
      durationMinutes: e.durationMinutes || 30,
      locationType: e.locationType === 'online' ? 'online' : e.locationType === 'in_person' ? 'in_person' : 'chat',
      locationLabel: e.locationLabel || '',
      meetingLink: e.meetingLink,
      timezone: e.timezone || 'America/New_York',
      attendeeIds: e.attendeeIds || [],
      hostUserId: '',
      organizationId: e.organizationId || '',
      eventType: ((e as { eventType?: string }).eventType || 'community_event') as UnifiedEvent['eventType'],
      // Required fields with sensible defaults
      scope: 'private' as const,
      participantModel: 'invite_only' as const,
      approvalType: 'none' as const,
      status: 'confirmed' as const,
      isRecurring: false,
      createdByUserId: '',
      hostName: e.hostName || e.coachName || '',
      isCoachLed: true,
      sendChatReminders: false,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    } as UnifiedEvent;
  }, [data]);

  // Normalize event data to handle both old and new schema
  const normalizedEvent = useMemo(() => {
    if (!data?.event) return null;
    const event = data.event;

    // Extract date from either startDateTime or date field
    let eventDate = event.date;
    let startTime = event.startTime;
    let endTime = event.endTime;
    let timezone = event.timezone;

    // Handle UnifiedEvent format (startDateTime is ISO string)
    if (event.startDateTime) {
      try {
        const startDT = new Date(event.startDateTime);
        const tz = event.timezone || 'UTC';
        
        // Format date
        const dateFormatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: tz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        eventDate = dateFormatter.format(startDT);
        
        // Format times
        const timeFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        startTime = timeFormatter.format(startDT);
        
        if (event.endDateTime) {
          const endDT = new Date(event.endDateTime);
          endTime = timeFormatter.format(endDT);
        } else if (event.durationMinutes) {
          const endDT = new Date(startDT.getTime() + event.durationMinutes * 60000);
          endTime = timeFormatter.format(endDT);
        }
      } catch (e) {
        console.error('Error parsing dates:', e);
      }
    }

    // Get timezone abbreviation for display
    const tzAbbr = getTimezoneAbbr(timezone || 'UTC');

    return {
      ...event,
      date: eventDate,
      startTime: startTime || '00:00',
      endTime: endTime || '00:00',
      timezoneAbbr: tzAbbr,
      meetingLink: event.meetingLink || event.zoomLink,
      description: event.longDescription || event.shortDescription || '',
    };
  }, [data?.event]);

  // Get timezone abbreviation
  function getTimezoneAbbr(timezone: string): string {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'short',
      });
      const parts = formatter.formatToParts(new Date());
      const tzPart = parts.find(p => p.type === 'timeZoneName');
      return tzPart?.value || timezone;
    } catch {
      return timezone;
    }
  }

  // Event status: past, in progress, or upcoming
  const eventStatus = useMemo(() => {
    if (!normalizedEvent) return 'upcoming';
    const now = new Date();

    const startDateTime = data?.event?.startDateTime
      ? new Date(data.event.startDateTime)
      : new Date(`${normalizedEvent.date}T${normalizedEvent.startTime || '00:00'}`);

    const endDateTime = data?.event?.endDateTime
      ? new Date(data.event.endDateTime)
      : new Date(`${normalizedEvent.date}T${normalizedEvent.endTime || '23:59'}`);

    if (now > endDateTime) return 'past';
    if (now >= startDateTime && now <= endDateTime) return 'in_progress';
    return 'upcoming';
  }, [normalizedEvent, data?.event?.startDateTime, data?.event?.endDateTime]);

  const isPastEvent = eventStatus === 'past';
  const isInProgress = eventStatus === 'in_progress';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf8f6] dark:bg-[#05070b] pb-24 lg:pb-8">
        {/* Header Section Skeleton */}
        <section className="px-4 py-5">
          <div className="flex flex-col gap-3">
            {/* Navigation Row */}
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-full bg-[#e1ddd8]/50 dark:bg-[#262b35] animate-pulse" />
              <div className="w-9 h-9 rounded-full bg-[#e1ddd8]/50 dark:bg-[#262b35] animate-pulse" />
            </div>

            {/* Cover Image Skeleton */}
            <div className="h-[220px] rounded-[20px] bg-[#e1ddd8]/50 dark:bg-[#262b35] animate-pulse" />

            {/* Event Info Skeleton */}
            <div className="flex flex-col gap-2">
              <div className="h-8 w-3/4 bg-[#e1ddd8]/50 dark:bg-[#262b35] rounded-lg animate-pulse" />
              <div className="h-5 w-1/2 bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg animate-pulse" />
              <div className="h-5 w-1/3 bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg animate-pulse" />
            </div>

            {/* Action Button Skeleton */}
            <div className="h-14 w-full rounded-[32px] bg-[#e1ddd8]/50 dark:bg-[#262b35] animate-pulse" />
          </div>
        </section>

        {/* Content Section Skeleton */}
        <section className="px-4 pt-3 pb-6">
          <div className="flex flex-col gap-4">
            <div className="h-7 w-32 bg-[#e1ddd8]/50 dark:bg-[#262b35] rounded-lg animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg animate-pulse" />
              <div className="h-4 w-5/6 bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg animate-pulse" />
              <div className="h-4 w-4/6 bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg animate-pulse" />
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen px-4 py-8 bg-[#faf8f6] dark:bg-[#05070b]">
        <BackButton />
        <div className="text-center mt-12">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-text-primary font-albert mb-2">
            {error || 'Event not found'}
          </h2>
          <Button
            onClick={() => router.push('/discover')}
            className="mt-4 bg-brand-accent hover:bg-brand-accent/90 text-white"
          >
            Back to Discover
          </Button>
        </div>
      </div>
    );
  }

  const { event, updates, attendees, totalAttendees, isJoined, isOwned, includedInProgramName } = data;

  // If user owns this content or it's free, show full event content
  if (isOwned || justPurchased || !event.priceInCents || event.priceInCents === 0) {
    // Show the full event content
    return (
      <>
        <EventContent
          event={event}
          normalizedEvent={normalizedEvent}
          updates={updates}
          attendees={attendees}
          totalAttendees={totalAttendees}
          isJoined={isJoined}
          isPastEvent={isPastEvent}
          isInProgress={isInProgress}
          justPurchased={justPurchased}
          includedInProgramName={includedInProgramName}
          onJoin={joinEvent}
          onLeave={leaveEvent}
          isJoining={isJoining}
          onReschedule={event.eventType === 'coaching_1on1' ? () => setShowRescheduleModal(true) : undefined}
          onCancel={event.eventType === 'coaching_1on1' ? handleCancel : undefined}
        />

        {/* Reschedule Modal for 1:1 events */}
        {unifiedEvent && event.eventType === 'coaching_1on1' && (
          <RescheduleCallModal
            isOpen={showRescheduleModal}
            onClose={() => setShowRescheduleModal(false)}
            event={unifiedEvent}
            onSuccess={() => {
              setShowRescheduleModal(false);
              fetchEvent();
            }}
          />
        )}
      </>
    );
  }

  // Show simple purchase view (popup style)
  return (
    <div className="min-h-screen bg-[#faf8f6] dark:bg-[#05070b] pb-24 lg:pb-8">
      {/* Header */}
      <section className="px-4 py-5">
        <BackButton />
      </section>

      {/* Event Preview */}
      <section className="px-4">
        <div className="bg-white dark:bg-[#171b22] rounded-3xl p-6 border border-[#e1ddd8] dark:border-[#262b35]">
          {/* Cover Image */}
          {event.coverImageUrl && (
            <div className="relative h-[180px] rounded-2xl overflow-hidden mb-4">
              <Image
                src={event.coverImageUrl}
                alt={event.title}
                fill
                className="object-cover"
                priority
              />
            </div>
          )}

          <h1 className="font-albert text-[24px] font-semibold text-text-primary tracking-[-1px] mb-2">
            {event.title}
          </h1>
          
          {event.shortDescription && (
            <RichContent 
              content={event.shortDescription}
              className="font-albert text-[15px] text-text-secondary leading-[1.6] mb-4"
            />
          )}

          {event.hostName && (
            <p className="text-sm text-text-muted mb-4">
              Hosted by {event.hostName}
            </p>
          )}

          <div className="border-t border-[#e1ddd8] dark:border-[#262b35] pt-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl font-bold text-text-primary">
                ${((event.priceInCents || 0) / 100).toFixed(2)}
              </span>
              <span className="text-sm text-text-secondary">one-time</span>
            </div>

            <Button
              onClick={() => {
                if (!isSignedIn) {
                  router.push(`/sign-in?redirect=${encodeURIComponent(window.location.pathname)}`);
                  return;
                }
                setShowPurchaseSheet(true);
              }}
              className="w-full py-3 bg-brand-accent hover:bg-brand-accent/90 text-white font-semibold rounded-xl"
            >
              {!isSignedIn ? 'Sign in to purchase' : 'Purchase Event Access'}
            </Button>
          </div>
        </div>
      </section>

      {/* Purchase Sheet */}
      <ContentPurchaseSheet
        open={showPurchaseSheet}
        onOpenChange={setShowPurchaseSheet}
        content={{
          id: event.id,
          type: 'event',
          title: event.title,
          description: event.shortDescription || event.longDescription,
          coverImageUrl: event.coverImageUrl,
          priceInCents: event.priceInCents || 0,
          currency: event.currency,
          coachName: event.coachName || event.hostName,
        }}
        onPurchaseComplete={() => {
          // Refetch to get updated access
          fetchEvent();
        }}
      />
    </div>
  );
}

// Extracted component for full event content (when user has access)
function EventContent({
  event,
  normalizedEvent,
  updates,
  attendees,
  totalAttendees,
  isJoined,
  isPastEvent,
  isInProgress,
  justPurchased,
  includedInProgramName,
  onJoin,
  onLeave,
  isJoining,
  onReschedule,
  onCancel,
}: {
  event: DiscoverEvent & { coachName?: string; coachImageUrl?: string; eventType?: string };
  normalizedEvent: ReturnType<typeof Object.assign> | null;
  updates: EventUpdate[];
  attendees: EventAttendee[];
  totalAttendees: number;
  isJoined: boolean;
  isPastEvent: boolean;
  isInProgress: boolean;
  justPurchased: boolean;
  includedInProgramName?: string;
  onJoin: () => void;
  onLeave: () => void;
  isJoining: boolean;
  onReschedule?: () => void;
  onCancel?: () => void;
}) {
  if (!normalizedEvent) return null;

  const hasRecording = isPastEvent && normalizedEvent?.recordingUrl;

  // Format date: "October 20, 2025 — 18:00–20:00 CET"
  const formatEventDateTime = () => {
    try {
      const date = new Date(normalizedEvent.date);
      if (isNaN(date.getTime())) return '';
      
      const month = date.toLocaleString('en-US', { month: 'long' });
      const day = date.getDate();
      const year = date.getFullYear();
      
      const startTime = normalizedEvent.startTime || '';
      const endTime = normalizedEvent.endTime || '';
      const tz = normalizedEvent.timezoneAbbr || '';
      
      if (!startTime || !endTime) {
        return `${month} ${day}, ${year}`;
      }
      
      return `${month} ${day}, ${year} — ${startTime}–${endTime} ${tz}`;
    } catch {
      return normalizedEvent.date || '';
    }
  };

  // Format update timestamp
  const formatUpdateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return `Today, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    if (diffDays === 1) return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const dateTimeStr = formatEventDateTime();

  return (
    <div className="min-h-screen bg-app-bg pb-24 lg:pb-8">
      {/* Success message if just purchased */}
      {justPurchased && (
        <section className="px-4 pt-4">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold font-albert text-[14px]">
                Purchase successful! You now have access to this event.
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Header Section */}
      <section className="px-4 py-5">
        <div className="flex flex-col gap-3">
          {/* Navigation Row */}
          <div className="flex items-center justify-between">
            <BackButton />
            <ShareButton title={normalizedEvent.title} />
          </div>

          {/* Cover Image */}
          {normalizedEvent.coverImageUrl && (
            <div className="relative h-[220px] rounded-[20px] overflow-hidden">
              <Image
                src={normalizedEvent.coverImageUrl}
                alt={normalizedEvent.title}
                fill
                className="object-cover"
                priority
              />
            </div>
          )}

          {/* Event Info */}
          <div className={`flex flex-col gap-2 ${!normalizedEvent.coverImageUrl ? 'mt-4' : ''}`}>
            {/* Status Badge */}
            <div className="flex items-center gap-2">
              {isPastEvent ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-earth-100 text-earth-600 dark:bg-earth-900/30 dark:text-earth-400">
                  Past
                </span>
              ) : isInProgress ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse" />
                  In Progress
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  Upcoming
                </span>
              )}
            </div>

            <h1 className="font-albert font-medium text-2xl text-text-primary tracking-[-1.5px] leading-[1.3]">
              {normalizedEvent.title}
            </h1>
            {dateTimeStr && (
              <p className="font-sans text-base text-text-secondary tracking-[-0.3px] leading-[1.2]">
                {dateTimeStr}
              </p>
            )}
            {normalizedEvent.locationLabel && (
              <p className="font-sans text-base text-text-secondary tracking-[-0.3px] leading-[1.2] flex items-center gap-1.5">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                {normalizedEvent.locationLabel}
              </p>
            )}
            {includedInProgramName && (
              <p className="text-sm text-text-muted">
                Included in {includedInProgramName}
              </p>
            )}

            {/* Attendees - show right after event info for 1:1 calls */}
            {(attendees.length > 0 || totalAttendees > 0) && (
              <div className="mt-2">
                <AttendeeAvatars
                  attendees={attendees}
                  totalCount={totalAttendees}
                />
              </div>
            )}
          </div>

          {/* Event Actions - Different for past vs upcoming events */}
          {isPastEvent ? (
            // Past Event Actions - Show recording or ended message
            <div className="space-y-4 mt-2">
              {hasRecording ? (
                <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden">
                  {/* Recording header */}
                  <div className="px-4 py-3 border-b border-[#e1ddd8] dark:border-[#262b35]">
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <PlayCircle className="w-4 h-4" />
                      <span>Call Recording</span>
                    </div>
                  </div>
                  {/* Player */}
                  <div className="p-4">
                    <MediaPlayer
                      src={normalizedEvent.recordingUrl}
                      className="w-full"
                    />
                  </div>
                  {/* Open in new tab link */}
                  <div className="px-4 pb-4 pt-0">
                    <a
                      href={normalizedEvent.recordingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 text-sm text-earth-500 hover:text-earth-600 dark:text-earth-400 dark:hover:text-earth-300 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open in New Tab
                    </a>
                  </div>
                </div>
              ) : (
                <div className="bg-earth-50 dark:bg-[#1d222b] rounded-2xl p-6 text-center border border-[#e1ddd8] dark:border-[#262b35]">
                  <CalendarCheck className="w-8 h-8 text-earth-400 dark:text-earth-500 mx-auto mb-2" />
                  <p className="text-text-secondary text-sm font-medium">This call has ended</p>
                  <p className="text-text-muted text-xs mt-1">No recording available</p>
                </div>
              )}
            </div>
          ) : (
            // Upcoming Event Actions
            (() => {
              const is1on1Event = event.eventType === 'coaching_1on1';
              const isInAppCall = normalizedEvent.locationType === 'chat';
              const hasExternalLink = !!normalizedEvent.meetingLink;
              const canJoinNow = event.startDateTime && isWithinOneHourBefore(event.startDateTime);

              // For 1:1 events: show Reschedule, Cancel, and Join (within 1 hour)
              if (is1on1Event) {
                return (
                  <div className="space-y-4 mt-6">
                    {/* Reschedule and Cancel buttons */}
                    <div className="flex gap-3">
                      {onReschedule && (
                        <button
                          onClick={onReschedule}
                          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-[20px] bg-white border border-[rgba(215,210,204,0.5)] text-text-primary font-sans font-bold text-sm hover:bg-earth-50 transition-colors"
                        >
                          <CalendarClock className="w-4 h-4" />
                          Reschedule
                        </button>
                      )}
                      {onCancel && (
                        <button
                          onClick={onCancel}
                          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-[20px] bg-white border border-red-200 text-red-600 font-sans font-bold text-sm hover:bg-red-50 transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                          Cancel
                        </button>
                      )}
                    </div>

                    {/* Join Call button (shows 1 hour before) */}
                    {canJoinNow ? (
                      hasExternalLink ? (
                        <a
                          href={normalizedEvent.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-4 px-4 rounded-[32px] bg-brand-accent text-white font-sans font-bold text-base tracking-[-0.5px] leading-[1.4] text-center hover:bg-brand-accent/90 transition-colors flex items-center justify-center gap-2"
                        >
                          <Video className="w-5 h-5" />
                          Join Call
                        </a>
                      ) : isInAppCall ? (
                        <Link
                          href={`/call/event-${event.id}`}
                          className="w-full py-4 px-4 rounded-[32px] bg-brand-accent text-white font-sans font-bold text-base tracking-[-0.5px] leading-[1.4] text-center hover:bg-brand-accent/90 transition-colors flex items-center justify-center gap-2"
                        >
                          <Video className="w-5 h-5" />
                          Join Call
                        </Link>
                      ) : null
                    ) : (hasExternalLink || isInAppCall) ? (
                      <p className="text-center text-sm text-[#5f5a55] dark:text-[#b2b6c2] py-2">
                        Link will appear 1 hour before the call
                      </p>
                    ) : null}

                    {/* Add to Calendar */}
                    <div className="flex justify-center">
                      <AddToCalendarButton
                        title={normalizedEvent.title}
                        description={normalizedEvent.shortDescription || normalizedEvent.description}
                        location={normalizedEvent.locationLabel || normalizedEvent.meetingLink}
                        startDateTime={event?.startDateTime || new Date(`${normalizedEvent.date}T${normalizedEvent.startTime}`).toISOString()}
                        endDateTime={event?.endDateTime || new Date(`${normalizedEvent.date}T${normalizedEvent.endTime}`).toISOString()}
                        timezone={event?.timezone}
                      />
                    </div>
                  </div>
                );
              }

              // For group events: show RSVP toggle
              return (
                <>
                  <button
                    onClick={isJoined ? onLeave : onJoin}
                    disabled={isJoining}
                    className={`
                      w-full py-4 px-4 rounded-[32px] font-sans font-bold text-base tracking-[-0.5px] leading-[1.4]
                      transition-all disabled:opacity-50
                      ${isJoined
                        ? 'bg-earth-100 text-earth-700 border border-earth-300'
                        : 'bg-white border border-[rgba(215,210,204,0.5)] text-button-primary hover:bg-earth-50'
                      }
                    `}
                  >
                    {isJoined ? 'You\'re in ✓' : 'Join event'}
                  </button>

                  {/* Meeting Link (only visible if joined AND within 1 hour) */}
                  {isJoined && canJoinNow && normalizedEvent.meetingLink && (
                    <a
                      href={normalizedEvent.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 px-4 rounded-[20px] bg-earth-500 text-white font-sans font-bold text-base tracking-[-0.5px] leading-[1.4] text-center hover:bg-earth-600 transition-colors"
                    >
                      Join Meeting →
                    </a>
                  )}

                  {/* In-app call (only visible if joined and within 1 hour) */}
                  {isJoined && isInAppCall && !hasExternalLink && canJoinNow && (
                    <Link
                      href={`/call/event-${event.id}`}
                      className="w-full py-3 px-4 rounded-[20px] bg-earth-500 text-white font-sans font-bold text-base tracking-[-0.5px] leading-[1.4] text-center hover:bg-earth-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <Video className="w-5 h-5" />
                      Join Call
                    </Link>
                  )}

                  {/* Link will appear message (joined but not within 1 hour) */}
                  {isJoined && !canJoinNow && (normalizedEvent.meetingLink || isInAppCall) && (
                    <p className="text-center text-sm text-[#5f5a55] dark:text-[#b2b6c2] py-2">
                      Link will appear 1 hour before the call
                    </p>
                  )}

                  {/* Add to Calendar (only visible if joined) */}
                  {isJoined && (
                    <div className="flex justify-center">
                      <AddToCalendarButton
                        title={normalizedEvent.title}
                        description={normalizedEvent.shortDescription || normalizedEvent.description}
                        location={normalizedEvent.locationLabel || normalizedEvent.meetingLink}
                        startDateTime={event?.startDateTime || new Date(`${normalizedEvent.date}T${normalizedEvent.startTime}`).toISOString()}
                        endDateTime={event?.endDateTime || new Date(`${normalizedEvent.date}T${normalizedEvent.endTime}`).toISOString()}
                        timezone={event?.timezone}
                      />
                    </div>
                  )}
                </>
              );
            })()
          )}
        </div>
      </section>

      {/* Timeline Section */}
      <section className="px-4 pt-3 pb-6">
        <div className="flex flex-col gap-4">
          {/* About Event */}
          {normalizedEvent.description && (
            <div className="flex flex-col gap-3">
              <h2 className="font-albert font-medium text-2xl text-text-primary tracking-[-1.5px] leading-[1.3]">
                About event
              </h2>
              <div className="font-sans text-base text-text-secondary tracking-[-0.3px] leading-[1.2] space-y-2">
                <RichContent content={normalizedEvent.description} />
                
                {normalizedEvent.bulletPoints && normalizedEvent.bulletPoints.length > 0 && normalizedEvent.bulletPoints.some((p: string) => p?.trim()) && (
                  <>
                    <p className="mt-4">By the end of the session, you&apos;ll:</p>
                    <ul className="list-none space-y-1">
                      {normalizedEvent.bulletPoints.filter((p: string) => p?.trim()).map((point: string, index: number) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-earth-500">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                
                {normalizedEvent.hostName && (
                  <p className="mt-4">
                    Hosted by <span className="font-medium">{normalizedEvent.hostName}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Additional Info - Only show if at least one field has content */}
          {normalizedEvent.additionalInfo && (
            normalizedEvent.additionalInfo.type || 
            normalizedEvent.additionalInfo.language || 
            normalizedEvent.additionalInfo.difficulty
          ) && (
            <div className="flex flex-col gap-3">
              <h2 className="font-albert font-medium text-2xl text-text-primary tracking-[-1.5px] leading-[1.3]">
                Additional Info
              </h2>
              <div className="font-sans text-base text-text-secondary tracking-[-0.3px] leading-[1.2] space-y-2">
                {normalizedEvent.additionalInfo.type && (
                  <p>Event Type: {normalizedEvent.additionalInfo.type}</p>
                )}
                {normalizedEvent.additionalInfo.language && (
                  <p>Language: {normalizedEvent.additionalInfo.language}</p>
                )}
                {normalizedEvent.additionalInfo.difficulty && (
                  <p>Difficulty: {normalizedEvent.additionalInfo.difficulty}</p>
                )}
              </div>
            </div>
          )}

          {/* Updates */}
          {updates.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-albert font-medium text-2xl text-text-primary tracking-[-1.5px] leading-[1.3]">
                  Updates
                </h2>
                <button className="font-sans text-sm text-text-secondary leading-[1.2] hover:text-text-primary transition-colors">
                  View all
                </button>
              </div>
              
              {/* Update Cards */}
              <div className="flex flex-col gap-3">
                {updates.map((update) => (
                  <div 
                    key={update.id}
                    className="bg-white rounded-[20px] p-4"
                  >
                    <div className="flex flex-col gap-2">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <span className="font-sans text-xs text-text-secondary leading-[1.2]">
                          {update.authorName}
                        </span>
                        <span className="font-sans text-xs text-text-muted leading-[1.2]">
                          {formatUpdateTime(update.createdAt)}
                        </span>
                      </div>
                      
                      {/* Title */}
                      <h3 className="font-albert font-semibold text-lg text-text-primary tracking-[-1px] leading-[1.3]">
                        {update.title}
                      </h3>
                      
                      {/* Content */}
                      <p className="font-sans text-base text-text-secondary tracking-[-0.3px] leading-[1.2]">
                        {update.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
