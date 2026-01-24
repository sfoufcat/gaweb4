'use client';

import { useState, useCallback, useMemo, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  X,
  Loader2,
  Trash2,
  Check,
  AlertCircle,
  Globe,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAvailableSlots } from '@/hooks/useAvailability';
import { useSchedulingActions } from '@/hooks/useScheduling';
import type { UnifiedEvent } from '@/types';

interface RescheduleCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: UnifiedEvent;
  onSuccess?: () => void;
}

interface ProposedTimeSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
}

type RescheduleMode = 'propose' | 'confirm';

/**
 * RescheduleCallModal
 *
 * Modal for rescheduling a confirmed call.
 * - For 1:1 coaching calls: Can propose times OR confirm directly
 * - For intake/cohort/squad/community calls: Always confirms directly (no proposal)
 */
export function RescheduleCallModal({
  isOpen,
  onClose,
  event,
  onSuccess,
}: RescheduleCallModalProps) {
  const { rescheduleEvent, isLoading, error } = useSchedulingActions();
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Check if this is a 1:1 coaching call (only type that supports proposals)
  const is1on1Call = event.eventType === 'coaching_1on1';

  // Form state
  const [mode, setMode] = useState<RescheduleMode>(is1on1Call ? 'propose' : 'confirm');
  const [reason, setReason] = useState('');
  const [proposedSlots, setProposedSlots] = useState<ProposedTimeSlot[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');

  const duration = event.durationMinutes || 60;

  // Helper to format date as YYYY-MM-DD in local timezone
  const formatDateLocal = useCallback((date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Date range for available slots (next 30 days)
  const dateRange = useMemo(() => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 30);
    return {
      startDate: formatDateLocal(start),
      endDate: formatDateLocal(end),
    };
  }, [formatDateLocal]);

  // Fetch available slots
  const { slots, isLoading: slotsLoading } = useAvailableSlots(
    dateRange.startDate,
    dateRange.endDate,
    duration
  );

  // Use user's local timezone
  const userTimezone = useMemo(() => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, []);

  // Group slots by date (using local time)
  const slotsByDate = useMemo(() => {
    const grouped: Record<string, typeof slots> = {};
    for (const slot of slots) {
      const date = formatDateLocal(new Date(slot.start));
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(slot);
    }
    return grouped;
  }, [slots]);

  // Available dates set for quick lookup
  const availableDatesSet = useMemo(() => new Set(Object.keys(slotsByDate)), [slotsByDate]);

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days: Array<Date | null> = [];

    // Add empty cells for days before the first of the month
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    // Add the days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return true;

    // Also disable if no slots available for this date
    const dateStr = formatDateLocal(date);
    return !availableDatesSet.has(dateStr);
  };

  // Add a proposed time slot
  const addProposedSlot = useCallback(() => {
    if (!selectedDate || !selectedTime) return;

    const dateStr = formatDateLocal(selectedDate);
    const startDateTime = new Date(`${dateStr}T${selectedTime}`);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);
    const endTimeStr = `${String(endDateTime.getHours()).padStart(2, '0')}:${String(endDateTime.getMinutes()).padStart(2, '0')}`;

    const newSlot: ProposedTimeSlot = {
      id: `slot_${Date.now()}`,
      date: dateStr,
      startTime: selectedTime,
      endTime: endTimeStr,
    };

    // In confirm mode, replace the slot. In propose mode, append.
    if (mode === 'confirm') {
      setProposedSlots([newSlot]);
    } else {
      setProposedSlots(prev => [...prev, newSlot]);
    }
    setSelectedTime('');
  }, [selectedDate, selectedTime, duration, mode, formatDateLocal]);

  // Remove a proposed time slot
  const removeProposedSlot = useCallback((slotId: string) => {
    setProposedSlots(prev => prev.filter(s => s.id !== slotId));
  }, []);

  // Handle form submission
  const handleSubmit = async () => {
    if (proposedSlots.length === 0) return;

    try {
      // Convert proposed slots to the API format
      const proposedTimes = proposedSlots.map(slot => {
        const startDateTime = new Date(`${slot.date}T${slot.startTime}`);
        const endDateTime = new Date(`${slot.date}T${slot.endTime}`);
        return {
          startDateTime: startDateTime.toISOString(),
          endDateTime: endDateTime.toISOString(),
        };
      });

      // For non-1on1 calls, always confirm directly
      // For 1on1 calls, use the selected mode
      const confirmDirectly = !is1on1Call || mode === 'confirm';

      await rescheduleEvent({
        eventId: event.id,
        proposedTimes,
        reason: reason || undefined,
        confirmDirectly,
      });

      onSuccess?.();
      onClose();
    } catch {
      // Error is handled by the hook
    }
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  // Format time for display
  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Format timezone for display
  const formatTimezone = (tz: string) => {
    try {
      return tz.replace(/_/g, ' ').split('/').pop() || tz;
    } catch {
      return tz;
    }
  };

  // Format original event date
  const originalEventDate = useMemo(() => {
    const date = new Date(event.startDateTime);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: event.timezone,
    });
  }, [event.startDateTime, event.timezone]);

  // Modal content - shared between mobile and desktop
  const modalContent = (
    <>
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22]">
        <div>
          <h2 className="font-albert text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
            Reschedule Call
          </h2>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
            {event.title}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Current Schedule Info */}
          <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl">
            <div className="flex items-start gap-3">
              <CalendarClock className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Currently scheduled for:
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  {originalEventDate}
                </p>
              </div>
            </div>
          </div>

          {/* Mode Toggle - Only show for 1:1 coaching calls */}
          {is1on1Call && (
            <div className="flex p-1 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-xl">
              <button
                onClick={() => {
                  setMode('propose');
                  setProposedSlots([]);
                }}
                className={`flex-1 py-2 px-4 rounded-lg font-albert font-medium text-sm transition-colors ${
                  mode === 'propose'
                    ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                    : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                }`}
              >
                Propose Times
              </button>
              <button
                onClick={() => {
                  setMode('confirm');
                  setProposedSlots([]);
                }}
                className={`flex-1 py-2 px-4 rounded-lg font-albert font-medium text-sm transition-colors ${
                  mode === 'confirm'
                    ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                    : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                }`}
              >
                Confirm Directly
              </button>
            </div>
          )}

          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
            {is1on1Call
              ? mode === 'propose'
                ? 'Propose new time(s) for the client to choose from.'
                : 'Reschedule to a specific time immediately.'
              : 'Select a new time for this call.'}
          </p>

          {/* Date & Time Selection */}
          <div className="space-y-5">
            {slotsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-brand-accent animate-spin" />
              </div>
            ) : availableDatesSet.size === 0 ? (
              <p className="text-center text-[#a7a39e] dark:text-[#7d8190] py-8">
                No available time slots in the next 30 days.
              </p>
            ) : (
              <>
                {/* Calendar */}
                <div className="bg-[#f9f7f5] dark:bg-[#1c2028] rounded-xl p-4">
                  {/* Month navigation */}
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                      className="p-1 rounded-lg hover:bg-[#e8e4df] dark:hover:bg-[#262b35] transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
                    </button>
                    <h3 className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                      {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h3>
                    <button
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                      className="p-1 rounded-lg hover:bg-[#e8e4df] dark:hover:bg-[#262b35] transition-colors"
                    >
                      <ChevronRight className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
                    </button>
                  </div>

                  {/* Day labels */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                      <div key={day} className="text-center text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] py-1">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {getDaysInMonth(currentMonth).map((date, i) => {
                      if (!date) {
                        return <div key={`empty-${i}`} className="h-10" />;
                      }

                      const isDisabled = isDateDisabled(date);
                      const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
                      const isToday = date.toDateString() === new Date().toDateString();
                      const hasSlots = availableDatesSet.has(formatDateLocal(date));

                      return (
                        <button
                          key={date.toISOString()}
                          onClick={() => {
                            if (!isDisabled) {
                              setSelectedDate(date);
                              setSelectedTime('');
                            }
                          }}
                          disabled={isDisabled}
                          className={`h-10 rounded-lg text-sm font-albert font-medium transition-colors ${
                            isDisabled
                              ? 'text-[#ccc8c3] dark:text-[#4a4f5b] cursor-not-allowed'
                              : isSelected
                              ? 'bg-brand-accent text-white'
                              : isToday && hasSlots
                              ? 'bg-brand-accent/10 text-brand-accent hover:bg-brand-accent/20'
                              : hasSlots
                              ? 'text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#e8e4df] dark:hover:bg-[#262b35]'
                              : 'text-[#ccc8c3] dark:text-[#4a4f5b] cursor-not-allowed'
                          }`}
                        >
                          {date.getDate()}
                        </button>
                      );
                    })}
                  </div>

                  {/* Timezone indicator */}
                  {userTimezone && (
                    <div className="flex items-center justify-center gap-1 mt-3 text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                      <Globe className="w-3 h-3" />
                      <span>{formatTimezone(userTimezone)}</span>
                    </div>
                  )}
                </div>

                {/* Time slots */}
                {selectedDate && (
                  <div>
                    <h4 className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-3">
                      {selectedDate.toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </h4>

                    {(() => {
                      const dateStr = formatDateLocal(selectedDate);
                      const daySlots = slotsByDate[dateStr] || [];

                      if (daySlots.length === 0) {
                        return (
                          <p className="text-center py-8 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                            No available times on this day
                          </p>
                        );
                      }

                      return (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {daySlots.map((slot, index) => {
                            // slot.start is ISO string - convert to local time
                            const slotDate = new Date(slot.start);
                            const localHours = String(slotDate.getHours()).padStart(2, '0');
                            const localMinutes = String(slotDate.getMinutes()).padStart(2, '0');
                            const time = `${localHours}:${localMinutes}`;
                            const isSelected = selectedTime === time;
                            return (
                              <button
                                key={index}
                                onClick={() => {
                                  setSelectedTime(time);
                                  // In confirm mode, auto-add the slot immediately
                                  if (mode === 'confirm') {
                                    const localDateStr = formatDateLocal(selectedDate);
                                    const startDateTime = new Date(`${localDateStr}T${time}`);
                                    const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);
                                    setProposedSlots([{
                                      id: `slot_${Date.now()}`,
                                      date: localDateStr,
                                      startTime: time,
                                      endTime: `${String(endDateTime.getHours()).padStart(2, '0')}:${String(endDateTime.getMinutes()).padStart(2, '0')}`,
                                    }]);
                                  }
                                }}
                                className={`px-3 py-2.5 rounded-xl text-sm font-albert font-medium transition-colors ${
                                  isSelected
                                    ? 'bg-brand-accent text-white'
                                    : 'bg-white dark:bg-[#1d222b] border border-[#e1ddd8] dark:border-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] hover:border-brand-accent'
                                }`}
                              >
                                {formatTime(time)}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Add to proposed times button - only show in propose mode */}
                    {mode === 'propose' && selectedTime && (
                      <button
                        onClick={addProposedSlot}
                        className="mt-4 flex items-center gap-2 px-4 py-2 bg-brand-accent/10 text-brand-accent rounded-lg font-albert font-medium hover:bg-brand-accent/20 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                        Add this time to proposal
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Proposed Times List */}
          {proposedSlots.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                {mode === 'confirm' ? 'New Time' : 'New Proposed Times'}
              </label>
              <div className="space-y-2">
                {proposedSlots.map(slot => (
                  <div
                    key={slot.id}
                    className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <Check className="w-4 h-4 text-green-500" />
                      <span className="font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                        {formatDate(slot.date)} at {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                      </span>
                    </div>
                    <button
                      onClick={() => removeProposedSlot(slot.id)}
                      className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reason for Rescheduling */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
              Reason for rescheduling (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Let them know why you need to reschedule..."
              className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] focus:outline-none focus:ring-2 focus:ring-brand-accent resize-none"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>

      {/* Footer */}
      <div className="sticky bottom-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22]">
        <button
          onClick={onClose}
          className="px-6 py-3 text-[#5f5a55] dark:text-[#b2b6c2] font-albert font-medium hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={proposedSlots.length === 0 || isLoading}
          className="flex items-center gap-2 px-6 py-3 bg-brand-accent text-white rounded-xl font-albert font-medium hover:bg-brand-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          {mode === 'confirm' ? 'Reschedule Call' : 'Send Reschedule Request'}
        </button>
      </div>
    </>
  );

  // Mobile: Use Drawer component
  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="h-[90vh] max-h-[90vh] flex flex-col">
          {modalContent}
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: Use Dialog with portal
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[10000]" onClose={onClose}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 z-[10001] overflow-hidden">
          <div className="flex h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl max-h-[85vh] transform rounded-2xl bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] shadow-2xl shadow-black/10 dark:shadow-black/30 transition-all flex flex-col overflow-hidden">
                {modalContent}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
