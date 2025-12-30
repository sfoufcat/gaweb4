'use client';

import { use, useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { MapPin, AlertCircle, CheckCircle } from 'lucide-react';
import { BackButton, ShareButton, AttendeeAvatars, RichContent, AddToCalendarButton, ContentLandingPage, ContentPurchaseSheet } from '@/components/discover';
import { Button } from '@/components/ui/button';
import type { DiscoverEvent, EventUpdate, EventAttendee } from '@/types/discover';

interface EventPageProps {
  params: Promise<{ id: string }>;
}

interface EventDetailData {
  event: DiscoverEvent & { coachName?: string; coachImageUrl?: string };
  updates: EventUpdate[];
  attendees: EventAttendee[];
  totalAttendees: number;
  isJoined: boolean;
  isOwned: boolean;
  includedInProgramName?: string;
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

  // Check if event is in the past
  const isPastEvent = useMemo(() => {
    if (!normalizedEvent) return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const eventDate = new Date(normalizedEvent.date);
    eventDate.setHours(0, 0, 0, 0);
    return eventDate < now;
  }, [normalizedEvent]);

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
    return <EventContent 
      event={event}
      normalizedEvent={normalizedEvent}
      updates={updates}
      attendees={attendees}
      totalAttendees={totalAttendees}
      isJoined={isJoined}
      isPastEvent={isPastEvent}
      justPurchased={justPurchased}
      includedInProgramName={includedInProgramName}
      onJoin={joinEvent}
      onLeave={leaveEvent}
      isJoining={isJoining}
    />;
  }

  // Show landing page for paid content
  if (event.purchaseType === 'landing_page') {
    return (
      <ContentLandingPage
        content={{
          id: event.id,
          type: 'event',
          title: event.title,
          description: event.shortDescription || event.longDescription,
          coverImageUrl: event.coverImageUrl,
          priceInCents: event.priceInCents || 0,
          currency: event.currency,
          coachName: event.coachName || event.hostName,
          coachImageUrl: event.coachImageUrl || event.hostAvatarUrl,
          keyOutcomes: event.keyOutcomes,
          features: event.features,
          testimonials: event.testimonials,
          faqs: event.faqs,
        }}
        isOwned={isOwned}
        includedInProgramName={includedInProgramName}
        onAccessContent={() => window.location.reload()}
      />
    );
  }

  // Default: Show simple purchase view (popup style)
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
  justPurchased,
  includedInProgramName,
  onJoin,
  onLeave,
  isJoining,
}: {
  event: DiscoverEvent & { coachName?: string; coachImageUrl?: string };
  normalizedEvent: ReturnType<typeof Object.assign> | null;
  updates: EventUpdate[];
  attendees: EventAttendee[];
  totalAttendees: number;
  isJoined: boolean;
  isPastEvent: boolean;
  justPurchased: boolean;
  includedInProgramName?: string;
  onJoin: () => void;
  onLeave: () => void;
  isJoining: boolean;
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
          <div className="flex flex-col gap-2">
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
          </div>

          {/* Event Actions - Different for past vs upcoming events */}
          {isPastEvent ? (
            // Past Event Actions
            hasRecording ? (
              <a
                href={normalizedEvent.recordingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-4 px-4 rounded-[32px] bg-earth-500 text-white font-sans font-bold text-base tracking-[-0.5px] leading-[1.4] text-center hover:bg-earth-600 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                View Recording
              </a>
            ) : (
              <div className="w-full py-4 px-4 rounded-[32px] bg-earth-100 dark:bg-[#1d222b] text-earth-500 dark:text-[#7d8190] font-sans font-bold text-base tracking-[-0.5px] leading-[1.4] text-center">
                Event has ended
              </div>
            )
          ) : (
            // Upcoming Event Actions
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

              {/* Meeting Link (only visible if joined) */}
              {isJoined && normalizedEvent.meetingLink && (
                <a
                  href={normalizedEvent.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 rounded-[20px] bg-earth-500 text-white font-sans font-bold text-base tracking-[-0.5px] leading-[1.4] text-center hover:bg-earth-600 transition-colors"
                >
                  Join Meeting →
                </a>
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

          {/* Attendees */}
          {(attendees.length > 0 || totalAttendees > 0) && (
            <AttendeeAvatars 
              attendees={attendees} 
              totalCount={totalAttendees} 
            />
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
