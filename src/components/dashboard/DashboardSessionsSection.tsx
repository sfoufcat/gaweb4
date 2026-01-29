'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Calendar, Clock, Video } from 'lucide-react';
import { useUpcomingEvents } from '@/hooks/useEvents';
import { CalendarModal } from '@/components/scheduling/CalendarModal';
import type { UnifiedEvent } from '@/types';

interface DashboardSessionsSectionProps {
  maxDisplay?: number;
}

const EVENT_TYPE_BADGES = {
  squad_call: {
    label: 'Squad Call',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
  cohort_call: {
    label: 'Cohort Call',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  },
  community_call: {
    label: 'Community Call',
    color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  },
  community_event: {
    label: 'Community Event',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  },
  coaching_1on1: {
    label: 'Coaching',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
  intake_call: {
    label: 'Intake',
    color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  },
} as const;

// Helper to get the right badge for an event
function getEventBadge(event: UnifiedEvent): { label: string; color: string } {
  if (event.eventType === 'cohort_call') {
    return event.cohortId ? EVENT_TYPE_BADGES.cohort_call : EVENT_TYPE_BADGES.community_call;
  }
  return EVENT_TYPE_BADGES[event.eventType as keyof typeof EVENT_TYPE_BADGES] || {
    label: 'Session',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  };
}

function formatEventDateTime(startDateTime: string): { date: string; time: string } {
  const eventDate = new Date(startDateTime);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Check if today
  const isToday = eventDate.toDateString() === now.toDateString();
  const isTomorrow = eventDate.toDateString() === tomorrow.toDateString();

  let date: string;
  if (isToday) {
    date = 'Today';
  } else if (isTomorrow) {
    date = 'Tomorrow';
  } else {
    date = eventDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  const time = eventDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return { date, time };
}

function SessionCard({ event, isLast }: { event: UnifiedEvent; isLast: boolean }) {
  const { date, time } = formatEventDateTime(event.startDateTime);
  const badge = getEventBadge(event);

  return (
    <Link
      href={`/discover/events/${event.id}`}
      className={`flex items-center gap-3 p-3 rounded-2xl hover:bg-[#f3f1ef] dark:hover:bg-[#181d28] transition-colors ${
        !isLast ? 'border-b border-[#f3f1ef] dark:border-[#262b35]' : ''
      }`}
    >
      <div className="w-10 h-10 rounded-xl bg-brand-accent/10 flex items-center justify-center flex-shrink-0">
        <Video className="w-5 h-5 text-brand-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="font-albert text-[16px] font-medium text-text-primary tracking-[-0.3px] truncate">
            {event.title}
          </p>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${badge.color}`}>
            {badge.label}
          </span>
        </div>
        <div className="flex items-center gap-1 text-text-muted">
          <Clock className="w-3 h-3" />
          <span className="font-sans text-[11px] leading-[1.2]">
            {date}, {time}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function DashboardSessionsSection({
  maxDisplay = 4,
}: DashboardSessionsSectionProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const { events, loading } = useUpcomingEvents(maxDisplay + 2);

  // Filter to truly upcoming events
  const now = new Date();
  const upcomingEvents = events
    .filter((e) => new Date(e.startDateTime) >= now)
    .slice(0, maxDisplay);

  // Loading state
  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-albert text-[24px] text-text-primary leading-[1.3] tracking-[-1.5px]">
            Upcoming sessions
          </h2>
        </div>
        <div className="bg-white dark:bg-surface rounded-[20px] p-5 space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-text-primary/10" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-text-primary/10 rounded" />
                <div className="h-3 w-1/2 bg-text-primary/10 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-albert text-[24px] text-text-primary leading-[1.3] tracking-[-1.5px]">
          Upcoming sessions
        </h2>
        {upcomingEvents.length > 0 && (
          <button
            onClick={() => setIsCalendarOpen(true)}
            className="font-sans text-[12px] text-brand-accent hover:opacity-80 transition-opacity leading-[1.2]"
          >
            All
          </button>
        )}
      </div>

      {upcomingEvents.length === 0 ? (
        <div className="bg-white dark:bg-surface rounded-[20px] py-12 px-6 text-center min-h-[180px] flex flex-col items-center justify-center">
          <div className="w-12 h-12 bg-purple-50 dark:bg-purple-500/10 rounded-2xl flex items-center justify-center mb-4">
            <Calendar className="w-6 h-6 text-purple-500 dark:text-purple-400" />
          </div>
          <p className="font-albert text-[15px] text-text-secondary leading-[1.4]">
            No upcoming sessions
          </p>
          <button
            onClick={() => setIsCalendarOpen(true)}
            className="font-sans text-[13px] text-brand-accent hover:opacity-80 transition-opacity mt-2"
          >
            View calendar
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-surface rounded-[20px] p-2">
          {upcomingEvents.map((event, index) => (
            <SessionCard
              key={event.id}
              event={event}
              isLast={index === upcomingEvents.length - 1}
            />
          ))}
        </div>
      )}

      {/* Calendar Modal */}
      <CalendarModal
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
      />
    </div>
  );
}

export default DashboardSessionsSection;
