'use client';

import { use, useMemo } from 'react';
import Image from 'next/image';
import { MapPin } from 'lucide-react';
import { useEvent } from '@/hooks/useDiscover';
import { BackButton, ShareButton, AttendeeAvatars, RichContent, AddToCalendarButton } from '@/components/discover';

interface EventPageProps {
  params: Promise<{ id: string }>;
}

export default function EventDetailPage({ params }: EventPageProps) {
  const { id } = use(params);
  const { event, updates, attendees, totalAttendees, isJoined, joinEvent, leaveEvent, loading } = useEvent(id);

  // Normalize event data to handle both old and new schema
  const normalizedEvent = useMemo(() => {
    if (!event) return null;

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
  }, [event]);

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

  const hasRecording = isPastEvent && normalizedEvent?.recordingUrl;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-bg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary" />
      </div>
    );
  }

  if (!normalizedEvent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-bg">
        <div className="text-text-secondary">Event not found</div>
      </div>
    );
  }

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
                onClick={isJoined ? leaveEvent : joinEvent}
                className={`
                  w-full py-4 px-4 rounded-[32px] font-sans font-bold text-base tracking-[-0.5px] leading-[1.4]
                  transition-all
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
                
                {normalizedEvent.bulletPoints && normalizedEvent.bulletPoints.length > 0 && normalizedEvent.bulletPoints.some(p => p?.trim()) && (
                  <>
                    <p className="mt-4">By the end of the session, you&apos;ll:</p>
                    <ul className="list-none space-y-1">
                      {normalizedEvent.bulletPoints.filter(p => p?.trim()).map((point, index) => (
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
