'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Video,
  Check,
} from 'lucide-react';
import type { FunnelStepConfigScheduling, IntakeCallConfig } from '@/types';

interface SchedulingStepProps {
  config: FunnelStepConfigScheduling;
  onComplete: (data: Record<string, unknown>) => void;
  onBack?: () => void;
  data: Record<string, unknown>;
  isFirstStep: boolean;
  organizationId: string;
  flowSessionId: string;
}

interface TimeSlot {
  start: string;
  end: string;
  duration: number;
}

interface IntakeConfigPublic {
  id: string;
  name: string;
  slug: string;
  description?: string;
  duration: number;
}

export function SchedulingStep({
  config,
  onComplete,
  onBack,
  data,
  isFirstStep,
  organizationId,
  flowSessionId,
}: SchedulingStepProps) {
  // State
  const [intakeConfig, setIntakeConfig] = useState<IntakeConfigPublic | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // User timezone
  const userTimezone = useMemo(() => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, []);

  // Check if user has already booked (from previous step data)
  const alreadyBooked = data.scheduledCall ? true : false;

  // Fetch intake config on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setIsLoadingConfig(true);
        const response = await fetch(`/api/coach/intake-configs/${config.intakeCallConfigId}`);
        if (!response.ok) throw new Error('Failed to load scheduling config');
        const result = await response.json();
        setIntakeConfig(result.config);
      } catch (err) {
        console.error('Error fetching intake config:', err);
        setError('Failed to load scheduling options');
      } finally {
        setIsLoadingConfig(false);
      }
    };

    if (config.intakeCallConfigId) {
      fetchConfig();
    }
  }, [config.intakeCallConfigId]);

  // Fetch slots when date is selected
  useEffect(() => {
    if (!selectedDate || !intakeConfig) return;

    const fetchSlots = async () => {
      setIsLoadingSlots(true);
      setError(null);

      try {
        const startDate = new Date(selectedDate);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(selectedDate);
        endDate.setHours(23, 59, 59, 999);

        // Use the funnel-specific slots endpoint
        const response = await fetch(
          `/api/funnel/scheduling/slots?` +
            `intakeConfigId=${config.intakeCallConfigId}&` +
            `startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
        );

        if (!response.ok) throw new Error('Failed to fetch available times');

        const result = await response.json();
        setSlots(result.slots || []);
      } catch (err) {
        console.error('Error fetching slots:', err);
        setError('Failed to load available times');
      } finally {
        setIsLoadingSlots(false);
      }
    };

    fetchSlots();
  }, [selectedDate, intakeConfig, config.intakeCallConfigId]);

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

  const handleSelectSlot = async (slot: TimeSlot) => {
    setSelectedSlot(slot);
    setIsBooking(true);
    setError(null);

    try {
      // Get user info from flow data
      const userName = data.name || data.firstName || 'User';
      const userEmail = data.email || '';

      const response = await fetch('/api/funnel/scheduling/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flowSessionId,
          intakeCallConfigId: config.intakeCallConfigId,
          startDateTime: slot.start,
          endDateTime: slot.end,
          name: userName,
          email: userEmail,
          timezone: userTimezone,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to book');
      }

      const result = await response.json();

      // Complete the step with the booking data
      onComplete({
        scheduledCall: {
          eventId: result.event.id,
          startDateTime: slot.start,
          endDateTime: slot.end,
          meetingUrl: result.event.meetingUrl,
        },
      });
    } catch (err) {
      console.error('Error booking:', err);
      setError(err instanceof Error ? err.message : 'Failed to book. Please try again.');
      setSelectedSlot(null);
    } finally {
      setIsBooking(false);
    }
  };

  // If already booked, show confirmation and allow proceeding
  if (alreadyBooked) {
    const scheduled = data.scheduledCall as {
      startDateTime: string;
      endDateTime: string;
      meetingUrl?: string;
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-auto text-center px-4"
      >
        <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
          <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>

        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Call Scheduled!
        </h2>

        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg mb-6">
          <p className="font-medium text-gray-900 dark:text-white">
            {new Date(scheduled.startDateTime).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            {formatTime(scheduled.startDateTime)} - {formatTime(scheduled.endDateTime)}
          </p>
        </div>

        <button
          onClick={() => onComplete({})}
          className="w-full py-3 rounded-lg font-medium text-white transition-colors"
          style={{ backgroundColor: 'var(--funnel-primary, var(--brand-accent-light))' }}
        >
          Continue
        </button>
      </motion.div>
    );
  }

  // Loading state
  if (isLoadingConfig) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Error state - no config
  if (!intakeConfig) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 dark:text-red-400">{error || 'Scheduling not available'}</p>
      </div>
    );
  }

  const days = getDaysInMonth(currentMonth);
  const monthYear = currentMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-lg mx-auto px-4"
    >
      {/* Back button */}
      {!isFirstStep && onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      )}

      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {config.heading || 'Schedule Your Call'}
        </h2>
        {config.subheading && (
          <p className="text-gray-600 dark:text-gray-400 mt-2">{config.subheading}</p>
        )}
        <div className="flex items-center justify-center gap-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {intakeConfig.duration} min
          </span>
          <span className="flex items-center gap-1">
            <Video className="h-4 w-4" />
            Video call
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Calendar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h3 className="font-semibold text-gray-900 dark:text-white">{monthYear}</h3>
          <button
            onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
            <div
              key={day}
              className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((date, i) => (
            <div key={i} className="aspect-square">
              {date && (
                <button
                  onClick={() => !isDateDisabled(date) && setSelectedDate(date)}
                  disabled={isDateDisabled(date)}
                  className={`w-full h-full flex items-center justify-center rounded-lg text-sm transition-colors ${
                    isDateSelected(date)
                      ? 'text-white'
                      : isDateDisabled(date)
                      ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
                  }`}
                  style={
                    isDateSelected(date)
                      ? { backgroundColor: 'var(--funnel-primary, var(--brand-accent-light))' }
                      : {}
                  }
                >
                  {date.getDate()}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Time slots */}
        {selectedDate && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3 text-sm">
              {selectedDate.toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </h4>

            {isLoadingSlots ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : slots.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4 text-sm">
                No available times for this date
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map(slot => (
                  <button
                    key={slot.start}
                    onClick={() => handleSelectSlot(slot)}
                    disabled={isBooking}
                    className={`px-2 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg transition-colors ${
                      selectedSlot?.start === slot.start
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10'
                    } ${isBooking ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isBooking && selectedSlot?.start === slot.start ? (
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    ) : (
                      formatTime(slot.start)
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
          Times shown in {userTimezone}
        </p>
      </div>
    </motion.div>
  );
}
