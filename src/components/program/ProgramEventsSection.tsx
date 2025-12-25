'use client';

/**
 * ProgramEventsSection Component
 * 
 * Displays upcoming events for a program, including:
 * - Program-scoped events
 * - Squad calls with visibility: 'program_wide'
 * - Workshops and webinars associated with the program
 * 
 * Uses the unified events API for consistent event handling.
 */

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CalendarPlus, Clock, MapPin, Users, ChevronRight, Video } from 'lucide-react';
import { useProgramEvents } from '@/hooks/useEvents';
import type { UnifiedEvent } from '@/types';

interface ProgramEventsSectionProps {
  programId: string;
  squadId?: string;
  maxDisplay?: number;
  showTitle?: boolean;
}

export function ProgramEventsSection({
  programId,
  squadId,
  maxDisplay = 5,
  showTitle = true,
}: ProgramEventsSectionProps) {
  const { events, loading, error } = useProgramEvents(programId, { 
    upcoming: true, 
    limit: maxDisplay + 5 // Fetch a few extra in case of filtering
  });

  // Filter to upcoming events only (API should handle this, but double-check)
  const now = new Date();
  const upcomingEvents = events
    .filter(e => new Date(e.startDateTime) >= now)
    .slice(0, maxDisplay);

  if (loading) {
    return (
      <div className="space-y-4">
        {showTitle && (
          <h2 className="font-albert text-[24px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3]">
            Upcoming events
          </h2>
        )}
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="flex-shrink-0 w-[260px] bg-white dark:bg-[#171b22] rounded-[20px] p-4 animate-pulse"
            >
              <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
              <div className="h-5 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
              <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || upcomingEvents.length === 0) {
    return null; // Don't show section if no events
  }

  return (
    <div className="space-y-4">
      {showTitle && (
        <div className="flex items-center justify-between">
          <h2 className="font-albert text-[24px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3]">
            Upcoming events
          </h2>
          {events.length > maxDisplay && (
            <Link
              href={`/discover/events?program=${programId}`}
              className="text-sm font-medium text-accent hover:text-accent/80 flex items-center gap-1 transition-colors"
            >
              View all
              <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {upcomingEvents.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}

/**
 * Individual event card for the horizontal scroll
 */
function EventCard({ event }: { event: UnifiedEvent }) {
  // Format date and time
  const eventDate = new Date(event.startDateTime);
  const dateStr = eventDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
  const timeStr = eventDate.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });

  // Determine the link based on event type
  const eventLink = event.eventType === 'squad_call'
    ? `/squad?event=${event.id}`
    : `/discover/events/${event.id}`;

  // Get event type badge
  const getEventTypeBadge = () => {
    switch (event.eventType) {
      case 'squad_call':
        return { label: 'Squad Call', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' };
      case 'workshop':
        return { label: 'Workshop', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' };
      case 'community_event':
        return { label: 'Event', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' };
      case 'coaching_1on1':
        return { label: 'Coaching', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' };
      default:
        return { label: 'Event', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' };
    }
  };

  const badge = getEventTypeBadge();

  return (
    <Link
      href={eventLink}
      className="flex-shrink-0 w-[260px] bg-white dark:bg-[#171b22] rounded-[20px] p-4 hover:shadow-lg transition-all group"
    >
      {/* Date and Type Row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-text-muted dark:text-[#7d8190]">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-sans text-[12px] leading-[1.2]">
            {dateStr}, {timeStr}
          </span>
        </div>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.color}`}>
          {badge.label}
        </span>
      </div>

      {/* Title */}
      <p className="font-albert text-[17px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] leading-[1.3] line-clamp-2 h-[44px] group-hover:text-accent transition-colors">
        {event.title}
      </p>

      {/* Location */}
      <div className="flex items-center gap-1.5 mt-2 text-text-secondary dark:text-[#b2b6c2]">
        {event.locationType === 'online' ? (
          <Video className="w-3.5 h-3.5" />
        ) : (
          <MapPin className="w-3.5 h-3.5" />
        )}
        <span className="font-sans text-[12px] leading-[1.2] truncate">
          {event.locationLabel}
        </span>
      </div>

      {/* Host */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#f3f1ef] dark:border-[#262b35]">
        {event.hostAvatarUrl ? (
          <Image
            src={event.hostAvatarUrl}
            alt={event.hostName}
            width={24}
            height={24}
            className="w-6 h-6 rounded-full object-cover"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center">
            <span className="text-[10px] font-medium text-accent">
              {event.hostName[0]}
            </span>
          </div>
        )}
        <span className="font-sans text-[12px] text-text-secondary dark:text-[#b2b6c2] truncate">
          {event.hostName}
        </span>
      </div>
    </Link>
  );
}

/**
 * Larger event card for featured display
 */
export function FeaturedEventCard({ event }: { event: UnifiedEvent }) {
  const eventDate = new Date(event.startDateTime);
  const dateStr = eventDate.toLocaleDateString('en-US', { 
    weekday: 'long',
    month: 'long', 
    day: 'numeric' 
  });
  const timeStr = eventDate.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  });

  const eventLink = event.eventType === 'squad_call'
    ? `/squad?event=${event.id}`
    : `/discover/events/${event.id}`;

  return (
    <Link
      href={eventLink}
      className="block bg-white dark:bg-[#171b22] rounded-[24px] p-5 hover:shadow-xl transition-all group overflow-hidden"
    >
      {/* Cover Image (if available) */}
      {event.coverImageUrl && (
        <div className="relative h-[140px] w-full rounded-[16px] overflow-hidden mb-4 -mx-1">
          <Image
            src={event.coverImageUrl}
            alt={event.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}

      {/* Date/Time Badge */}
      <div className="flex items-center gap-2 mb-3">
        <div className="bg-accent/10 rounded-full px-3 py-1.5 flex items-center gap-1.5">
          <CalendarPlus className="w-4 h-4 text-accent" />
          <span className="font-sans text-[13px] font-medium text-accent">
            {dateStr}
          </span>
        </div>
        <span className="font-sans text-[13px] text-text-secondary dark:text-[#b2b6c2]">
          {timeStr}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-albert text-[22px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.3] group-hover:text-accent transition-colors mb-2">
        {event.title}
      </h3>

      {/* Description */}
      {event.description && (
        <p className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2] leading-[1.5] line-clamp-2 mb-4">
          {event.description}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-[#f3f1ef] dark:border-[#262b35]">
        <div className="flex items-center gap-2">
          {event.hostAvatarUrl ? (
            <Image
              src={event.hostAvatarUrl}
              alt={event.hostName}
              width={32}
              height={32}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
              <span className="text-sm font-medium text-accent">
                {event.hostName[0]}
              </span>
            </div>
          )}
          <div>
            <span className="font-sans text-[13px] font-medium text-text-primary dark:text-[#f5f5f8] block">
              {event.hostName}
            </span>
            <span className="font-sans text-[11px] text-text-muted dark:text-[#7d8190]">
              Host
            </span>
          </div>
        </div>

        {/* Attendee count */}
        {event.attendeeIds.length > 0 && (
          <div className="flex items-center gap-1.5 text-text-secondary dark:text-[#b2b6c2]">
            <Users className="w-4 h-4" />
            <span className="font-sans text-[13px]">
              {event.attendeeIds.length} attending
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

export default ProgramEventsSection;

