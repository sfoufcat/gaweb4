'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Calendar,
  Clock,
  Loader2,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Repeat,
  Globe,
  Link2,
} from 'lucide-react';
import { useAvailableSlots } from '@/hooks/useAvailability';
import { useCoachIntegrations } from '@/hooks/useCoachIntegrations';
import { calculateProgramDayForDate } from '@/lib/calendar-weeks';
import { MeetingProviderSelector, type MeetingProviderType, isMeetingProviderReady } from './MeetingProviderSelector';

/**
 * Minimal cohort info needed for scheduling
 */
interface CohortInfo {
  id: string;
  name: string;
  endDate?: string | Date;
}

interface ScheduleCohortEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  cohort: CohortInfo;
  programId: string;
  programName: string;
  organizationId?: string; // Optional - API gets it from auth context
  instanceId?: string;
  instanceStartDate?: string;
  programLengthDays?: number;
  includeWeekends?: boolean;
  onSuccess?: () => void;
}

const DURATION_OPTIONS = [
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
];

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
];

type RecurrenceEndType = 'end_of_cohort' | 'specific_date' | 'occurrences';

interface ProposedTimeSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
}

/**
 * ScheduleCohortEventModal
 *
 * Modal for coaches to schedule events/calls for a cohort.
 * Supports:
 * - Zoom/Google Meet auto-generation or manual link
 * - Selecting from coach's available time slots
 * - Recurring events (weekly, biweekly, monthly)
 * - Auto-notification to cohort members
 */
export function ScheduleCohortEventModal({
  isOpen,
  onClose,
  cohort,
  programId,
  programName,
  organizationId,
  instanceId,
  instanceStartDate,
  programLengthDays,
  includeWeekends = false,
  onSuccess,
}: ScheduleCohortEventModalProps) {
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(60);
  const [meetingProvider, setMeetingProvider] = useState<MeetingProviderType>('manual');
  const [manualMeetingLink, setManualMeetingLink] = useState('');
  const [useManualOverride, setUseManualOverride] = useState(false);

  // Selected times
  const [proposedSlots, setProposedSlots] = useState<ProposedTimeSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');

  // Recurrence state
  const [recurrence, setRecurrence] = useState<string>('none');
  const [recurrenceEnd, setRecurrenceEnd] = useState<RecurrenceEndType>('end_of_cohort');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>('');
  const [recurrenceOccurrences, setRecurrenceOccurrences] = useState<number>(10);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Integrations
  const { zoom, googleMeet, isLoading: integrationsLoading } = useCoachIntegrations();

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

  // Cohort end date for "end of cohort" recurrence option
  const cohortEndDate = useMemo(() => {
    if (cohort.endDate) {
      // Parse cohort.endDate (could be string or Date)
      const date = typeof cohort.endDate === 'string'
        ? cohort.endDate
        : cohort.endDate.toISOString?.().split('T')[0];
      return date;
    }
    // If no cohort end date, calculate from instance
    if (instanceStartDate && programLengthDays) {
      const startDate = new Date(instanceStartDate);
      if (includeWeekends) {
        startDate.setDate(startDate.getDate() + programLengthDays - 1);
      } else {
        let daysAdded = 0;
        while (daysAdded < programLengthDays - 1) {
          startDate.setDate(startDate.getDate() + 1);
          const dayOfWeek = startDate.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            daysAdded++;
          }
        }
      }
      return startDate.toISOString().split('T')[0];
    }
    return null;
  }, [cohort.endDate, instanceStartDate, programLengthDays, includeWeekends]);

  // Calculate program week/day for the first proposed slot
  const calculatedProgramDay = useMemo(() => {
    if (!instanceStartDate || !programLengthDays || proposedSlots.length === 0) {
      return null;
    }

    const firstSlotDate = proposedSlots[0].date;

    const dayInfo = calculateProgramDayForDate(
      instanceStartDate,
      firstSlotDate,
      programLengthDays,
      includeWeekends
    );

    return dayInfo;
  }, [instanceStartDate, programLengthDays, includeWeekends, proposedSlots]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setDuration(60);
      setMeetingProvider('manual');
      setManualMeetingLink('');
      setProposedSlots([]);
      setSelectedDate('');
      setSelectedTime('');
      setRecurrence('none');
      setRecurrenceEnd('end_of_cohort');
      setRecurrenceEndDate('');
      setRecurrenceOccurrences(10);
      setError(null);
    }
  }, [isOpen]);

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

    setProposedSlots([newSlot]); // For cohort events, only one time slot
    setSelectedTime('');
  }, [selectedDate, selectedTime, duration]);

  // Remove a proposed time slot
  const removeProposedSlot = useCallback((slotId: string) => {
    setProposedSlots(prev => prev.filter(s => s.id !== slotId));
  }, []);

  // Handle form submission
  const handleSubmit = async () => {
    if (proposedSlots.length === 0) {
      setError('Please select a date and time');
      return;
    }

    // Validate meeting link for manual mode or manual override
    if ((meetingProvider === 'manual' || useManualOverride) && !manualMeetingLink.trim()) {
      setError('Please enter a meeting link');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const slot = proposedSlots[0];
      const startDateTime = new Date(`${slot.date}T${slot.startTime}`);
      const endDateTime = new Date(`${slot.date}T${slot.endTime}`);

      let meetingUrl: string | undefined;
      let meetingId: string | undefined;
      let finalMeetingProvider: 'zoom' | 'google_meet' | 'manual' | undefined;

      // Auto-create meeting if Zoom or Google Meet selected and connected (and not using manual override)
      if (meetingProvider === 'zoom' && zoom.connected && !useManualOverride) {
        setIsCreatingMeeting(true);
        try {
          const response = await fetch('/api/coach/integrations/zoom/meetings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              topic: title.trim() || `${cohort.name} Call`,
              startTime: startDateTime.toISOString(),
              duration,
              timezone,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            meetingUrl = data.meetingUrl;
            meetingId = data.meetingId;
            finalMeetingProvider = 'zoom';
          } else {
            console.error('Failed to create Zoom meeting');
            setError('Failed to create Zoom meeting. Using manual link instead.');
          }
        } catch (err) {
          console.error('Error creating Zoom meeting:', err);
        } finally {
          setIsCreatingMeeting(false);
        }
      } else if (meetingProvider === 'google_meet' && googleMeet.connected && !useManualOverride) {
        setIsCreatingMeeting(true);
        try {
          const response = await fetch('/api/coach/integrations/google_meet/meetings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              summary: title.trim() || `${cohort.name} Call`,
              startTime: startDateTime.toISOString(),
              endTime: endDateTime.toISOString(),
              timezone,
              description: description.trim() || `Cohort call for ${cohort.name}`,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            meetingUrl = data.meetingUrl;
            meetingId = data.eventId;
            finalMeetingProvider = 'google_meet';
          } else {
            console.error('Failed to create Google Meet');
            setError('Failed to create Google Meet. Using manual link instead.');
          }
        } catch (err) {
          console.error('Error creating Google Meet:', err);
        } finally {
          setIsCreatingMeeting(false);
        }
      } else if (meetingProvider === 'manual' || useManualOverride) {
        meetingUrl = manualMeetingLink.trim();
        finalMeetingProvider = 'manual';
      }

      // Build recurrence pattern if needed
      let recurrencePattern = undefined;
      if (recurrence !== 'none') {
        recurrencePattern = {
          frequency: recurrence as 'weekly' | 'biweekly' | 'monthly',
          time: slot.startTime,
          timezone,
          startDate: slot.date,
          dayOfWeek: new Date(slot.date).getDay(),
        };

        // Apply end condition
        if (recurrenceEnd === 'end_of_cohort' && cohortEndDate) {
          (recurrencePattern as { endDate?: string }).endDate = cohortEndDate;
        } else if (recurrenceEnd === 'specific_date' && recurrenceEndDate) {
          (recurrencePattern as { endDate?: string }).endDate = recurrenceEndDate;
        } else if (recurrenceEnd === 'occurrences') {
          (recurrencePattern as { occurrences?: number }).occurrences = recurrenceOccurrences;
        }
      }

      // Create the event
      const eventData = {
        title: title.trim() || `${cohort.name} Call`,
        description: description.trim() || `Cohort call for ${cohort.name}`,
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        timezone,
        durationMinutes: duration,

        eventType: 'cohort_call',
        scope: 'program',
        participantModel: 'cohort_members',
        approvalType: 'none',
        status: 'confirmed',

        locationType: 'online',
        locationLabel: finalMeetingProvider === 'zoom'
          ? 'Zoom'
          : finalMeetingProvider === 'google_meet'
            ? 'Google Meet'
            : 'Video Call',
        meetingLink: meetingUrl,
        meetingProvider: finalMeetingProvider,
        externalMeetingId: meetingId,

        organizationId,
        programId,
        programIds: [programId],
        cohortId: cohort.id,
        instanceId,
        weekIndex: calculatedProgramDay?.weekIndex,
        dayIndex: calculatedProgramDay?.globalDayIndex,

        isRecurring: recurrence !== 'none',
        recurrence: recurrencePattern,

        isCoachLed: true,
        sendChatReminders: false,
      };

      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create event');
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule event');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format helpers
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatTimezone = (tz: string) => {
    try {
      return tz.replace(/_/g, ' ').split('/').pop() || tz;
    } catch {
      return tz;
    }
  };

  // Mount portal
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  const content = (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-backdrop-fade-in"
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
              Schedule Event
            </h2>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
              for {cohort.name}
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
          {/* Title & Description */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`${cohort.name} Call`}
                className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] focus:outline-none focus:ring-2 focus:ring-brand-accent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="What will you cover in this session?"
                className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] focus:outline-none focus:ring-2 focus:ring-brand-accent resize-none"
              />
            </div>
          </div>

          {/* Duration */}
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
                <Clock className="h-5 w-5 text-brand-accent" />
              </div>
            </div>
          </div>

          {/* Meeting Provider Selection */}
          <MeetingProviderSelector
            allowInApp={false}
            value={meetingProvider}
            onChange={setMeetingProvider}
            manualLink={manualMeetingLink}
            onManualLinkChange={setManualMeetingLink}
            useManualOverride={useManualOverride}
            onUseManualOverrideChange={setUseManualOverride}
          />

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
                  {selectedDate && selectedTime && proposedSlots.length === 0 && (
                    <button
                      onClick={addProposedSlot}
                      className="flex items-center gap-2 px-4 py-2 bg-brand-accent/10 text-brand-accent rounded-lg font-albert font-medium hover:bg-brand-accent/20 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Confirm this time
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Selected Time Display */}
          {proposedSlots.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                Selected Time
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

              {/* Program Week Info */}
              {calculatedProgramDay && (
                <div className="mt-3 flex items-center gap-2 p-2 bg-brand-accent/5 dark:bg-brand-accent/10 rounded-lg">
                  <Link2 className="w-4 h-4 text-brand-accent" />
                  <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                    Will be linked to <strong>Week {calculatedProgramDay.weekIndex + 1}</strong>, <strong>Day {calculatedProgramDay.globalDayIndex}</strong>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Recurrence */}
          {proposedSlots.length > 0 && (
            <div className="space-y-4">
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
                    <Repeat className="h-5 w-5 text-brand-accent" />
                  </div>
                </div>
              </div>

              {/* Recurrence End Condition */}
              {recurrence !== 'none' && (
                <div className="space-y-3 p-4 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-xl">
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                    End Condition
                  </label>

                  {/* End of Cohort option */}
                  {cohortEndDate && (
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="recurrenceEnd"
                        value="end_of_cohort"
                        checked={recurrenceEnd === 'end_of_cohort'}
                        onChange={() => setRecurrenceEnd('end_of_cohort')}
                        className="mt-0.5 w-4 h-4 text-brand-accent focus:ring-brand-accent focus:ring-offset-0"
                      />
                      <div>
                        <span className="font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                          Ends at end of cohort
                        </span>
                        <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-0.5">
                          {formatDate(cohortEndDate)}
                        </p>
                      </div>
                    </label>
                  )}

                  {/* Specific date option */}
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="recurrenceEnd"
                      value="specific_date"
                      checked={recurrenceEnd === 'specific_date'}
                      onChange={() => setRecurrenceEnd('specific_date')}
                      className="mt-0.5 w-4 h-4 text-brand-accent focus:ring-brand-accent focus:ring-offset-0"
                    />
                    <div className="flex-1">
                      <span className="font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                        Ends on specific date
                      </span>
                      {recurrenceEnd === 'specific_date' && (
                        <input
                          type="date"
                          value={recurrenceEndDate}
                          onChange={(e) => setRecurrenceEndDate(e.target.value)}
                          min={proposedSlots[0]?.date || new Date().toISOString().split('T')[0]}
                          className="mt-2 w-full px-3 py-2 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
                        />
                      )}
                    </div>
                  </label>

                  {/* Number of occurrences option */}
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="recurrenceEnd"
                      value="occurrences"
                      checked={recurrenceEnd === 'occurrences'}
                      onChange={() => setRecurrenceEnd('occurrences')}
                      className="mt-0.5 w-4 h-4 text-brand-accent focus:ring-brand-accent focus:ring-offset-0"
                    />
                    <div className="flex-1">
                      <span className="font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                        Ends after number of occurrences
                      </span>
                      {recurrenceEnd === 'occurrences' && (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="number"
                            value={recurrenceOccurrences}
                            onChange={(e) => setRecurrenceOccurrences(Math.max(1, parseInt(e.target.value) || 1))}
                            min={1}
                            max={52}
                            className="w-20 px-3 py-2 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
                          />
                          <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">occurrences</span>
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 px-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4 border-t border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22]">
          <button
            onClick={onClose}
            className="px-6 py-3 text-[#5f5a55] dark:text-[#b2b6c2] font-albert font-medium hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={proposedSlots.length === 0 || isSubmitting || isCreatingMeeting}
            className="flex items-center gap-2 px-6 py-3 bg-brand-accent text-white rounded-xl font-albert font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {(isSubmitting || isCreatingMeeting) && <Loader2 className="w-4 h-4 animate-spin" />}
            {isCreatingMeeting ? 'Creating Meeting...' : 'Schedule Event'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
