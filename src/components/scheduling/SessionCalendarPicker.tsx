'use client';

import * as React from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
  isBefore,
  startOfDay,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AvailableSlot {
  start: string; // ISO string
  end: string;   // ISO string
}

export interface SessionCalendarPickerProps {
  /** The selected date value (YYYY-MM-DD string) */
  value?: string | null;
  /** Called when the date changes */
  onChange?: (date: string) => void;
  /** Available time slots (used to determine which dates are available) */
  availableSlots?: AvailableSlot[];
  /** Whether slots are loading */
  isLoading?: boolean;
  /** Minimum selectable date (defaults to today) */
  minDate?: Date;
  /** Maximum selectable date */
  maxDate?: Date;
  /** Additional class names */
  className?: string;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/**
 * SessionCalendarPicker - A visual month-grid calendar for scheduling sessions.
 * Shows available dates highlighted based on coach availability.
 */
export function SessionCalendarPicker({
  value,
  onChange,
  availableSlots = [],
  isLoading = false,
  minDate = new Date(),
  maxDate,
  className,
}: SessionCalendarPickerProps) {
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    if (value) {
      const date = new Date(value + 'T00:00:00');
      return isNaN(date.getTime()) ? new Date() : date;
    }
    return new Date();
  });

  // Parse the value to a Date object
  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    const parsed = new Date(value + 'T00:00:00');
    return isNaN(parsed.getTime()) ? undefined : parsed;
  }, [value]);

  // Get dates that have available slots
  const availableDates = React.useMemo(() => {
    const dates = new Set<string>();
    for (const slot of availableSlots) {
      const date = new Date(slot.start).toISOString().split('T')[0];
      dates.add(date);
    }
    return dates;
  }, [availableSlots]);

  // Get all days for the calendar grid (Monday start)
  const calendarDays = React.useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });

    // Calculate padding for Monday start (0 = Monday, 6 = Sunday)
    let startDay = start.getDay() - 1;
    if (startDay < 0) startDay = 6; // Sunday becomes 6
    const paddingBefore: (Date | null)[] = Array(startDay).fill(null);

    // Add padding days after
    const totalCells = Math.ceil((days.length + startDay) / 7) * 7;
    const paddingAfter: (Date | null)[] = Array(totalCells - days.length - startDay).fill(null);

    return [...paddingBefore, ...days, ...paddingAfter];
  }, [currentMonth]);

  // Check if a date has available slots
  const hasAvailability = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return availableDates.has(dateStr);
  };

  // Check if a date is disabled (before min date or after max date)
  const isDateDisabled = (date: Date) => {
    if (minDate && isBefore(startOfDay(date), startOfDay(minDate))) return true;
    if (maxDate && isBefore(startOfDay(maxDate), startOfDay(date))) return true;
    return false;
  };

  // Handle date selection
  const handleSelect = (date: Date) => {
    if (isDateDisabled(date) || !hasAvailability(date)) return;
    if (onChange) {
      const dateStr = format(date, 'yyyy-MM-dd');
      onChange(dateStr);
    }
  };

  // Navigate months
  const goToPreviousMonth = () => setCurrentMonth((prev) => subMonths(prev, 1));
  const goToNextMonth = () => setCurrentMonth((prev) => addMonths(prev, 1));

  // Check if previous month navigation should be disabled
  const isPrevMonthDisabled = minDate && isBefore(endOfMonth(subMonths(currentMonth, 1)), startOfDay(minDate));

  return (
    <div className={cn('bg-white dark:bg-[#11141b] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden', className)}>
      {/* Header with month/year and navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#e8e4df] dark:border-[#262b35]">
        <button
          type="button"
          onClick={goToPreviousMonth}
          disabled={isPrevMonthDisabled}
          className={cn(
            'p-2 rounded-xl transition-colors',
            isPrevMonthDisabled
              ? 'text-[#d1cdc8] dark:text-[#3a4150] cursor-not-allowed'
              : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f5f3f0] dark:hover:bg-[#1f242d]'
          )}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>

        <button
          type="button"
          onClick={goToNextMonth}
          className="p-2 rounded-xl text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f5f3f0] dark:hover:bg-[#1f242d] transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="p-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2 text-[#5f5a55] dark:text-[#b2b6c2]">
              <div className="w-5 h-5 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-albert">Loading availability...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="h-8 flex items-center justify-center text-xs font-medium text-[#8a8580] dark:text-[#6b7280] uppercase tracking-wide"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1 justify-items-center">
              {calendarDays.map((day, index) => {
                if (!day) {
                  return <div key={`empty-${index}`} className="h-9" />;
                }

                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isCurrentDay = isToday(day);
                const isDisabled = isDateDisabled(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isAvailable = hasAvailability(day);

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => handleSelect(day)}
                    disabled={isDisabled || !isAvailable}
                    className={cn(
                      'h-9 w-9 rounded-full text-sm font-medium transition-all duration-150',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-[#11141b]',
                      // Outside current month - always muted
                      !isCurrentMonth && 'text-[#d1cdc8] dark:text-[#3a4150] cursor-default',
                      // Current month but not available
                      isCurrentMonth && !isAvailable && !isDisabled && 'text-[#a7a39e] dark:text-[#5f6470] cursor-default',
                      // Current month and available (not selected)
                      isCurrentMonth && isAvailable && !isSelected && !isDisabled && [
                        'text-[#1a1a1a] dark:text-[#f5f5f8]',
                        'bg-brand-accent/10 dark:bg-brand-accent/15',
                        'hover:bg-brand-accent/20 dark:hover:bg-brand-accent/25',
                      ],
                      // Today (available, not selected)
                      isCurrentDay && isAvailable && !isSelected && [
                        'bg-brand-accent/15 dark:bg-brand-accent/20',
                        'text-brand-accent font-semibold',
                      ],
                      // Today (not available)
                      isCurrentDay && !isAvailable && isCurrentMonth && [
                        'text-[#a7a39e] dark:text-[#5f6470]',
                      ],
                      // Selected
                      isSelected && [
                        'bg-brand-accent text-white font-semibold',
                        'hover:bg-brand-accent',
                        'shadow-md shadow-brand-accent/25',
                        'ring-0',
                      ],
                      // Disabled
                      isDisabled && 'text-[#d1cdc8] dark:text-[#3a4150] cursor-not-allowed opacity-50'
                    )}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-3 pt-3 border-t border-[#e8e4df] dark:border-[#262b35] flex items-center justify-center gap-4 text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-brand-accent/15" />
                <span>Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-brand-accent" />
                <span>Selected</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
