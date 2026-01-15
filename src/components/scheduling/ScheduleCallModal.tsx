'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  Video,
  MessageCircle,
  MapPin,
  Loader2,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Repeat,
  Globe,
  BookOpen,
  Link2,
} from 'lucide-react';
import { useAvailableSlots } from '@/hooks/useAvailability';
import { useSchedulingActions } from '@/hooks/useScheduling';
import { calculateProgramDayForDate } from '@/lib/calendar-weeks';
import type { ProgramEnrollment, ProgramInstance } from '@/types';

interface ScheduleCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  onSuccess?: () => void;
}

const DURATION_OPTIONS = [
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
];

const LOCATION_OPTIONS = [
  { value: 'online', label: 'Video Call', icon: Video },
  { value: 'chat', label: 'In-App Chat', icon: MessageCircle },
];

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
];

interface ProposedTimeSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
}

// Response from /api/scheduling/client-enrollment
interface ClientEnrollmentData {
  enrollment: ProgramEnrollment | null;
  program: {
    id: string;
    name: string;
    lengthDays: number;
    includeWeekends: boolean;
  } | null;
  instance: ProgramInstance | null;
}

/**
 * ScheduleCallModal
 * 
 * Modal for coaches to schedule or propose calls with clients.
 * Supports:
 * - Selecting from available time slots
 * - Proposing multiple time options
 * - Direct scheduling (confirmed immediately)
 * - Recurring calls
 */
export function ScheduleCallModal({
  isOpen,
  onClose,
  clientId,
  clientName,
  onSuccess,
}: ScheduleCallModalProps) {
  const { proposeCall, isLoading, error } = useSchedulingActions();

  // Form state
  const [mode, setMode] = useState<'propose' | 'confirm'>('propose');
  const [duration, setDuration] = useState(60);
  const [locationType, setLocationType] = useState<'online' | 'chat'>('online');
  const [locationLabel, setLocationLabel] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [recurrence, setRecurrence] = useState('none');

  // Selected/proposed times
  const [proposedSlots, setProposedSlots] = useState<ProposedTimeSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');

  // Program linking state
  const [enrollmentData, setEnrollmentData] = useState<ClientEnrollmentData | null>(null);
  const [enrollmentLoading, setEnrollmentLoading] = useState(false);
  const [linkToProgram, setLinkToProgram] = useState(false);

  // Fetch client's active 1:1 enrollment when modal opens
  useEffect(() => {
    if (!isOpen || !clientId) return;

    const fetchEnrollment = async () => {
      setEnrollmentLoading(true);
      try {
        const response = await fetch(`/api/scheduling/client-enrollment?clientId=${clientId}`);
        if (response.ok) {
          const data = await response.json();
          setEnrollmentData(data);
          // Auto-enable linking if client has an active enrollment with instance
          if (data.instance) {
            setLinkToProgram(true);
          }
        }
      } catch (err) {
        console.error('Failed to fetch client enrollment:', err);
      } finally {
        setEnrollmentLoading(false);
      }
    };

    fetchEnrollment();
  }, [isOpen, clientId]);

  // Date range for available slots (next 30 days)
  const dateRange = useMemo(() => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 30);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }, []);

  // Fetch available slots
  const { slots, isLoading: slotsLoading, timezone } = useAvailableSlots(
    dateRange.startDate,
    dateRange.endDate,
    duration
  );

  // Group slots by date
  const slotsByDate = useMemo(() => {
    const grouped: Record<string, typeof slots> = {};
    for (const slot of slots) {
      const date = new Date(slot.start).toISOString().split('T')[0];
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(slot);
    }
    return grouped;
  }, [slots]);

  // Available dates
  const availableDates = useMemo(() => Object.keys(slotsByDate).sort(), [slotsByDate]);

  // Calculate program week/day for the first proposed slot (when linking is enabled)
  const calculatedProgramDay = useMemo(() => {
    if (!linkToProgram || !enrollmentData?.instance || !enrollmentData?.program || proposedSlots.length === 0) {
      return null;
    }

    const firstSlotDate = proposedSlots[0].date;
    const instanceStartDate = enrollmentData.instance.startDate;

    if (!instanceStartDate) return null;

    const dayInfo = calculateProgramDayForDate(
      instanceStartDate,
      firstSlotDate,
      enrollmentData.program.lengthDays,
      enrollmentData.program.includeWeekends
    );

    return dayInfo;
  }, [linkToProgram, enrollmentData, proposedSlots]);

  // Add a proposed time slot
  const addProposedSlot = useCallback(() => {
    if (!selectedDate || !selectedTime) return;

    const startDateTime = new Date(`${selectedDate}T${selectedTime}`);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);

    const newSlot: ProposedTimeSlot = {
      id: `slot_${Date.now()}`,
      date: selectedDate,
      startTime: selectedTime,
      endTime: endDateTime.toTimeString().slice(0, 5),
    };

    setProposedSlots(prev => [...prev, newSlot]);
    setSelectedTime('');
  }, [selectedDate, selectedTime, duration]);

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

      // Determine instanceId if linking to program
      const instanceId = linkToProgram && enrollmentData?.instance?.id
        ? enrollmentData.instance.id
        : undefined;

      await proposeCall({
        clientId,
        proposedTimes,
        title: title || `Call with ${clientName}`,
        description: notes,
        duration,
        locationType,
        locationLabel: locationLabel || (locationType === 'online' ? 'Video Call' : 'In-App Chat'),
        meetingLink: locationType === 'online' ? meetingLink : undefined,
        schedulingNotes: notes,
        isRecurring: recurrence !== 'none',
        recurrence: recurrence !== 'none' ? {
          frequency: recurrence as 'weekly' | 'biweekly' | 'monthly',
          time: proposedSlots[0].startTime,
          timezone,
          startDate: proposedSlots[0].date,
        } : undefined,
        instanceId,
      });

      onSuccess?.();
      onClose();
    } catch (err) {
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

  // Format timezone for display (e.g., "America/New_York" -> "New York")
  const formatTimezone = (tz: string) => {
    try {
      return tz.replace(/_/g, ' ').split('/').pop() || tz;
    } catch {
      return tz;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-backdrop-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#171b22] rounded-t-2xl sm:rounded-2xl shadow-2xl animate-modal-slide-up sm:animate-modal-zoom-in">
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#d1cdc8] dark:bg-[#3a4150]" />
        </div>

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 sm:border-b border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22]">
          <div>
            <h2 className="font-albert text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
              Schedule Call
            </h2>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
              with {clientName}
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
        <div className="p-6 space-y-6">
          {/* Mode Toggle */}
          <div className="flex p-1 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-xl">
            <button
              onClick={() => setMode('propose')}
              className={`flex-1 py-2 px-4 rounded-lg font-albert font-medium text-sm transition-colors ${
                mode === 'propose'
                  ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                  : 'text-[#5f5a55] dark:text-[#b2b6c2]'
              }`}
            >
              Propose Times
            </button>
            <button
              onClick={() => setMode('confirm')}
              className={`flex-1 py-2 px-4 rounded-lg font-albert font-medium text-sm transition-colors ${
                mode === 'confirm'
                  ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                  : 'text-[#5f5a55] dark:text-[#b2b6c2]'
              }`}
            >
              Confirm Directly
            </button>
          </div>

          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
            {mode === 'propose'
              ? 'Propose one or more time slots for the client to choose from.'
              : 'Schedule a confirmed call at a specific time.'}
          </p>

          {/* Duration & Location */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                Duration
              </label>
              <div className="relative">
                <select
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  className="w-full px-4 py-3 pr-10 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent appearance-none cursor-pointer"
                >
                  {DURATION_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg className="h-5 w-5 text-brand-accent" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                Location
              </label>
              <div className="relative">
                <select
                  value={locationType}
                  onChange={(e) => setLocationType(e.target.value as 'online' | 'chat')}
                  className="w-full px-4 py-3 pr-10 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent appearance-none cursor-pointer"
                >
                  {LOCATION_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg className="h-5 w-5 text-brand-accent" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Meeting Link (for video calls) */}
          {locationType === 'online' && (
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                Meeting Link (optional)
              </label>
              <input
                type="url"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                placeholder="https://zoom.us/j/... or leave empty for in-app call"
                className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] focus:outline-none focus:ring-2 focus:ring-brand-accent"
              />
            </div>
          )}

          {/* Date & Time Selection */}
          <div className="border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-[#f3f1ef] dark:bg-[#1e222a] border-b border-[#e1ddd8] dark:border-[#262b35]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                  <span className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                    Select Date & Time
                  </span>
                </div>
                {timezone && (
                  <div className="flex items-center gap-1 text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                    <Globe className="w-3 h-3" />
                    <span>{formatTimezone(timezone)}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
                Times shown in your availability timezone.
              </p>
            </div>

            <div className="p-4 space-y-4">
              {slotsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-brand-accent animate-spin" />
                </div>
              ) : availableDates.length === 0 ? (
                <p className="text-center text-[#a7a39e] dark:text-[#7d8190] py-8">
                  No available time slots. Please update your availability settings.
                </p>
              ) : (
                <>
                  {/* Date Selection */}
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                      Date
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {availableDates.slice(0, 14).map(date => (
                        <button
                          key={date}
                          onClick={() => {
                            setSelectedDate(date);
                            setSelectedTime('');
                          }}
                          className={`px-3 py-2 rounded-lg font-albert text-sm transition-colors ${
                            selectedDate === date
                              ? 'bg-brand-accent text-white'
                              : 'bg-[#f3f1ef] dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#e8e4df] dark:hover:bg-[#313746]'
                          }`}
                        >
                          {formatDate(date)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Time Selection */}
                  {selectedDate && slotsByDate[selectedDate] && (
                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                        Time
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {slotsByDate[selectedDate].map((slot, index) => {
                          const time = new Date(slot.start).toTimeString().slice(0, 5);
                          return (
                            <button
                              key={index}
                              onClick={() => setSelectedTime(time)}
                              className={`px-3 py-2 rounded-lg font-albert text-sm transition-colors ${
                                selectedTime === time
                                  ? 'bg-brand-accent text-white'
                                  : 'bg-[#f3f1ef] dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#e8e4df] dark:hover:bg-[#313746]'
                              }`}
                            >
                              {formatTime(time)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Add Time Button */}
                  {selectedDate && selectedTime && (
                    <button
                      onClick={addProposedSlot}
                      className="flex items-center gap-2 px-4 py-2 bg-brand-accent/10 text-brand-accent rounded-lg font-albert font-medium hover:bg-brand-accent/20 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add this time
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Proposed Times List */}
          {proposedSlots.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                {mode === 'propose' ? 'Proposed Times' : 'Selected Time'}
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

          {/* Program Linking (only shown if client has active 1:1 enrollment) */}
          {!enrollmentLoading && enrollmentData?.program && enrollmentData?.instance && (
            <div className="border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-[#f3f1ef] dark:bg-[#1e222a] border-b border-[#e1ddd8] dark:border-[#262b35]">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                  <span className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                    Program Linking
                  </span>
                </div>
              </div>
              <div className="p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={linkToProgram}
                    onChange={(e) => setLinkToProgram(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-[#d1cdc8] dark:border-[#3a4150] text-brand-accent focus:ring-brand-accent focus:ring-offset-0"
                  />
                  <div>
                    <span className="font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                      Link to {enrollmentData.program.name}
                    </span>
                    <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
                      Associate this call with the client&apos;s program timeline
                    </p>
                  </div>
                </label>

                {/* Show calculated week/day when linked and times selected */}
                {linkToProgram && proposedSlots.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 p-2 bg-brand-accent/5 dark:bg-brand-accent/10 rounded-lg">
                    <Link2 className="w-4 h-4 text-brand-accent" />
                    {calculatedProgramDay ? (
                      <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                        Will be linked to <strong>Week {calculatedProgramDay.weekIndex + 1}</strong>, <strong>Day {calculatedProgramDay.globalDayIndex}</strong>
                      </span>
                    ) : (
                      <span className="text-sm text-[#a7a39e] dark:text-[#7d8190]">
                        Selected date is outside program range
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recurrence (for confirm mode) */}
          {mode === 'confirm' && (
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                <Repeat className="w-4 h-4 inline mr-2" />
                Repeat
              </label>
              <div className="relative">
                <select
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value)}
                  className="w-full px-4 py-3 pr-10 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent appearance-none cursor-pointer"
                >
                  {RECURRENCE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg className="h-5 w-5 text-brand-accent" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* Title & Notes */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
              Title (optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Call with ${clientName}`}
              className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] focus:outline-none focus:ring-2 focus:ring-brand-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
              Notes for {clientName} (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="What would you like to discuss?"
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
            className="flex items-center gap-2 px-6 py-3 bg-brand-accent text-white rounded-xl font-albert font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'propose' ? 'Send Proposal' : 'Confirm Call'}
          </button>
        </div>
      </div>
    </div>
  );
}


