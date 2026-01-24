'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Video,
  XCircle,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

interface RescheduleClientProps {
  tokenId?: string;
  event?: {
    id: string;
    title: string;
    startDateTime: string;
    timezone: string;
    durationMinutes?: number;
  };
  config?: {
    id: string;
    name: string;
    slug: string;
    duration: number;
    rescheduleDeadlineHours?: number;
  };
  organization?: {
    name: string;
    logoUrl?: string;
    plan?: 'starter' | 'pro' | 'scale';
  };
  coach?: {
    name: string;
    email?: string;
  };
  coachTimezone?: string;
  deadline?: {
    canMakeChanges: boolean;
    deadlineTime: string;
    cancelDeadlineHours: number;
  };
  orgSlug?: string;
  error?: {
    code?: string;
    message?: string;
  };
}

interface TimeSlot {
  start: string;
  end: string;
  duration: number;
}

type Step = 'calendar' | 'confirmation';

export function RescheduleClient({
  tokenId,
  event,
  config,
  organization,
  coach,
  coachTimezone,
  deadline,
  orgSlug,
  error,
}: RescheduleClientProps) {
  // Step navigation
  const [step, setStep] = useState<Step>('calendar');

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  // Booking state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // User timezone
  const userTimezone = useMemo(() => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, []);

  // Fetch slots when date is selected
  // NOTE: This hook must be before any conditional returns to follow React hooks rules
  useEffect(() => {
    if (!selectedDate || !tokenId) return;

    const fetchSlots = async () => {
      setIsLoadingSlots(true);
      setFormError(null);

      try {
        const startDate = new Date(selectedDate);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(selectedDate);
        endDate.setHours(23, 59, 59, 999);

        // Use token-based slots API for reschedule
        const response = await fetch(
          `/api/public/intake/token/${tokenId}/slots?` +
            `startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch available times');
        }

        const data = await response.json();
        setSlots(data.slots || []);
      } catch (err) {
        console.error('Error fetching slots:', err);
        setFormError('Failed to load available times');
      } finally {
        setIsLoadingSlots(false);
      }
    };

    fetchSlots();
  }, [selectedDate, tokenId]);

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-[#1d222b] rounded-2xl shadow-sm p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
            {error.code === 'NO_TOKEN' ? 'Invalid Link' : 'Error'}
          </h1>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            {error.message || 'Something went wrong. Please try again.'}
          </p>
        </div>
      </div>
    );
  }

  // Deadline passed
  if (deadline && !deadline.canMakeChanges) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-[#1d222b] rounded-2xl shadow-sm p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-yellow-500" />
          </div>
          <h1 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
            Reschedule Deadline Passed
          </h1>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
            The reschedule window for this appointment has closed (
            {deadline.cancelDeadlineHours} hours before the appointment).
          </p>
          {coach?.email && (
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              Please contact {coach.name} at{' '}
              <a href={`mailto:${coach.email}`} className="text-brand-accent hover:underline">
                {coach.email}
              </a>{' '}
              if you need to make changes.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const isDateSelected = (date: Date) => {
    if (!selectedDate) return false;
    return (
      date.getFullYear() === selectedDate.getFullYear() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getDate() === selectedDate.getDate()
    );
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: userTimezone,
    });
  };

  const formatDateTime = (dateString: string, timezone: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
      timeZoneName: 'short',
    });
  };

  const handleSelectSlot = async (slot: TimeSlot) => {
    if (!tokenId) return;

    setSelectedSlot(slot);
    setIsSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch(`/api/public/intake/token/${tokenId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDateTime: slot.start,
          endDateTime: slot.end,
          timezone: userTimezone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reschedule');
      }

      setStep('confirmation');
    } catch (err) {
      console.error('Error rescheduling:', err);
      setFormError(err instanceof Error ? err.message : 'Failed to reschedule. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const days = getDaysInMonth(currentMonth);
  const monthYear = currentMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  // Confirmation screen
  if (step === 'confirmation') {
    return (
      <div className="fixed inset-0 bg-app-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-[#1d222b] rounded-2xl shadow-sm p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
            Appointment Rescheduled
          </h1>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
            Your appointment has been successfully moved to the new time.
          </p>
          {selectedSlot && (
            <div className="bg-app-bg rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 text-[#1a1a1a] dark:text-[#f5f5f8] justify-center">
                <Calendar className="w-4 h-4" />
                <span className="font-albert">
                  {formatDateTime(selectedSlot.start, userTimezone)}
                </span>
              </div>
            </div>
          )}
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            You will receive a confirmation email shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-app-bg flex items-center justify-center p-4 overflow-auto">
      <div className="max-w-2xl mx-auto w-full my-auto">
        {/* Header */}
        <div className="text-center mb-8">
          {organization?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={organization.logoUrl}
              alt={organization?.name || coach?.name || 'Coach'}
              className="h-12 mx-auto mb-4"
            />
          ) : (
            <div className="mb-4">
              <span className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                {organization?.name || coach?.name || 'your coach'}
              </span>
            </div>
          )}
          <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Reschedule {config?.name}
          </h1>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-2">
            Select a new date and time for your appointment
          </p>

          {/* Current appointment */}
          {event && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-yellow-700 dark:text-yellow-400 text-sm">
              <Clock className="w-4 h-4" />
              <span className="line-through">
                Current: {formatDateTime(event.startDateTime, event.timezone)}
              </span>
            </div>
          )}

          <div className="flex items-center justify-center gap-4 mt-4 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {config?.duration || 60} min
            </span>
            <span className="flex items-center gap-1">
              <Video className="h-4 w-4" />
              Video call
            </span>
          </div>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mt-2 font-albert">
            with {coach?.name || organization?.name || 'your coach'}
          </p>
        </div>

        {/* Error */}
        {formError && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg font-albert">
            {formError}
          </div>
        )}

        {/* Calendar */}
        <div className="bg-white dark:bg-[#1d222b] rounded-xl shadow-sm overflow-hidden">
          <div className="p-6">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() =>
                  setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
                }
                className="p-2 hover:bg-[#faf8f6] dark:hover:bg-[#11141b] rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
              </button>
              <span className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                {monthYear}
              </span>
              <button
                onClick={() =>
                  setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
                }
                className="p-2 hover:bg-[#faf8f6] dark:hover:bg-[#11141b] rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((date, idx) => (
                <button
                  key={idx}
                  disabled={!date || isDateDisabled(date)}
                  onClick={() => date && setSelectedDate(date)}
                  className={`
                    aspect-square flex items-center justify-center text-sm font-albert rounded-lg transition-colors
                    ${!date ? 'invisible' : ''}
                    ${date && isDateDisabled(date) ? 'text-[#c9c5c0] dark:text-[#4a4f5a] cursor-not-allowed' : ''}
                    ${date && !isDateDisabled(date) && !isDateSelected(date) ? 'text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#faf8f6] dark:hover:bg-[#11141b]' : ''}
                    ${date && isDateSelected(date) ? 'bg-brand-accent text-white' : ''}
                  `}
                >
                  {date?.getDate()}
                </button>
              ))}
            </div>
          </div>

          {/* Time slots */}
          {selectedDate && (
            <div className="border-t border-[#e5e5e5] dark:border-[#2d333b] p-6">
              <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-4 font-albert">
                Available times on{' '}
                {selectedDate.toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </h3>

              {isLoadingSlots ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-accent" />
                </div>
              ) : slots.length === 0 ? (
                <p className="text-center text-[#5f5a55] dark:text-[#b2b6c2] py-8 font-albert">
                  No available times on this date
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {slots.map((slot, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectSlot(slot)}
                      disabled={isSubmitting}
                      className={`
                        px-4 py-3 rounded-lg border font-albert text-sm transition-colors
                        ${selectedSlot?.start === slot.start
                          ? 'border-brand-accent bg-brand-accent/10 text-brand-accent'
                          : 'border-[#e5e5e5] dark:border-[#2d333b] text-[#1a1a1a] dark:text-[#f5f5f8] hover:border-brand-accent'
                        }
                        disabled:opacity-50 disabled:cursor-not-allowed
                      `}
                    >
                      {isSubmitting && selectedSlot?.start === slot.start ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      ) : (
                        formatTime(slot.start)
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Powered by - only show for starter plans */}
        {organization?.plan === 'starter' && (
          <div className="mt-6 text-center">
            <p className="text-xs text-[#a7a39e] dark:text-[#6b7280]">
              Powered by Coachful
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
