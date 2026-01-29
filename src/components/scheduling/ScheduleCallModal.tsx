'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSWRConfig } from 'swr';
import {
  X,
  Calendar,
  Loader2,
  Trash2,
  Check,
  AlertCircle,
  Repeat,
  Globe,
  Link2,
} from 'lucide-react';
import { useAvailableSlots } from '@/hooks/useAvailability';
import { useSchedulingActions } from '@/hooks/useScheduling';
import { useCallUsage, formatCallUsageStatus, formatExtraCallPrice } from '@/hooks/useCallUsage';
import { useCoachIntegrations } from '@/hooks/useCoachIntegrations';
import { calculateProgramDayForDate } from '@/lib/calendar-weeks';
import { MeetingProviderSelector, type MeetingProviderType, isMeetingProviderReady } from './MeetingProviderSelector';
import { normalizeUrl } from '@/lib/url-utils';
import { DatePicker } from '@/components/ui/date-picker';
import { SessionCalendarPicker } from './SessionCalendarPicker';
import { BrandedRadio } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ProgramEnrollment, ProgramInstance } from '@/types';
import { ChevronLeft } from 'lucide-react';

type ScheduleStep = 'details' | 'schedule';
type CallTypeOption = 'program' | 'extra';

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

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
];

const RECURRENCE_END_OPTIONS = [
  { value: 'end_of_program', label: 'Ends at end of program' },
  { value: 'specific_date', label: 'Ends on specific date' },
  { value: 'occurrences', label: 'Ends after number of occurrences' },
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
  const { zoom, googleMeet } = useCoachIntegrations();
  const { mutate } = useSWRConfig();

  // Step state
  const [step, setStep] = useState<ScheduleStep>('details');

  // Form state
  const [mode, setMode] = useState<'propose' | 'confirm'>('propose');
  const [duration, setDuration] = useState(60);
  const [meetingProvider, setMeetingProvider] = useState<MeetingProviderType>('in_app');
  const [manualMeetingLink, setManualMeetingLink] = useState('');
  const [useManualOverride, setUseManualOverride] = useState(false);
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [meetingError, setMeetingError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [recurrence, setRecurrence] = useState('none');
  const [recurrenceEnd, setRecurrenceEnd] = useState<'end_of_program' | 'specific_date' | 'occurrences'>('end_of_program');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>('');
  const [recurrenceOccurrences, setRecurrenceOccurrences] = useState<number>(10);

  // Selected/proposed times
  const [proposedSlots, setProposedSlots] = useState<ProposedTimeSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');

  // Program linking state - always enabled by default when enrollment exists
  const [enrollmentData, setEnrollmentData] = useState<ClientEnrollmentData | null>(null);
  const [enrollmentLoading, setEnrollmentLoading] = useState(false);
  const [callType, setCallType] = useState<CallTypeOption>('program');

  // Reset step when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('details');
    }
  }, [isOpen]);

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
        }
      } catch (err) {
        console.error('Failed to fetch client enrollment:', err);
      } finally {
        setEnrollmentLoading(false);
      }
    };

    fetchEnrollment();
  }, [isOpen, clientId]);

  // Program linking is always enabled when client has an active enrollment
  const linkToProgram = !!(enrollmentData?.program && enrollmentData?.instance);

  // Fetch call usage for the client's enrollment
  const {
    usage: callUsage,
    isLoading: callUsageLoading,
    hasAllowance,
  } = useCallUsage(enrollmentData?.enrollment?.id, isOpen && linkToProgram);

  // Show call type selector when client has program with call allowance
  const showCallTypeSelector = linkToProgram && hasAllowance;

  // Extra call price from program
  const extraCallPrice = callUsage?.pricePerExtraCallCents ?? 0;

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

  // Fetch available slots (isCoach=true bypasses minimum notice time restriction)
  const { slots, isLoading: slotsLoading, timezone } = useAvailableSlots(
    dateRange.startDate,
    dateRange.endDate,
    duration,
    true // isCoach - allow booking without 24hr buffer
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

  // Calculate program end date for "Ends at end of program" option
  const programEndDate = useMemo(() => {
    if (!enrollmentData?.program?.lengthDays) {
      return null;
    }

    // Fallback chain for start date: instance.startDate → enrollment.startedAt → enrollment.createdAt
    const startDateStr = enrollmentData?.instance?.startDate
      || enrollmentData?.enrollment?.startedAt
      || (enrollmentData?.enrollment?.createdAt && typeof enrollmentData.enrollment.createdAt === 'object' && 'toDate' in enrollmentData.enrollment.createdAt
        ? (enrollmentData.enrollment.createdAt as { toDate: () => Date }).toDate().toISOString().split('T')[0]
        : enrollmentData?.enrollment?.createdAt);

    if (!startDateStr) {
      console.warn('[ScheduleCallModal] No start date found for program end date calculation');
      return null;
    }

    const startDate = new Date(startDateStr);
    const lengthDays = enrollmentData.program.lengthDays;
    const includeWeekends = enrollmentData.program.includeWeekends;

    // Calculate end date based on lengthDays
    // If weekends are excluded, we need to count only weekdays
    if (includeWeekends) {
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + lengthDays - 1);
      return endDate.toISOString().split('T')[0];
    } else {
      // Count weekdays only
      let daysAdded = 0;
      const endDate = new Date(startDate);
      while (daysAdded < lengthDays - 1) {
        endDate.setDate(endDate.getDate() + 1);
        const dayOfWeek = endDate.getDay();
        // Skip weekends (0 = Sunday, 6 = Saturday)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          daysAdded++;
        }
      }
      return endDate.toISOString().split('T')[0];
    }
  }, [enrollmentData]);

  // Remove a proposed time slot
  const removeProposedSlot = useCallback((slotId: string) => {
    setProposedSlots(prev => prev.filter(s => s.id !== slotId));
  }, []);

  // Handle form submission
  const handleSubmit = async () => {
    if (proposedSlots.length === 0) return;

    // Check if meeting provider selection is ready
    const providerReady = isMeetingProviderReady(
      meetingProvider,
      { zoom, googleMeet },
      useManualOverride,
      manualMeetingLink
    );

    if (!providerReady) {
      setMeetingError('Please configure your meeting link or select a connected provider');
      return;
    }

    setMeetingError(null);

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

      // Build recurrence config with end condition
      let recurrenceConfig: {
        frequency: 'weekly' | 'biweekly' | 'monthly';
        time: string;
        timezone: string;
        startDate: string;
        endDate?: string;
        count?: number;
      } | undefined = undefined;

      if (recurrence !== 'none') {
        recurrenceConfig = {
          frequency: recurrence as 'weekly' | 'biweekly' | 'monthly',
          time: proposedSlots[0].startTime,
          timezone,
          startDate: proposedSlots[0].date,
        };

        // Apply end condition
        if (recurrenceEnd === 'end_of_program' && programEndDate) {
          recurrenceConfig.endDate = programEndDate;
        } else if (recurrenceEnd === 'specific_date' && recurrenceEndDate) {
          recurrenceConfig.endDate = recurrenceEndDate;
        } else if (recurrenceEnd === 'occurrences') {
          recurrenceConfig.count = recurrenceOccurrences;
        }
      }

      // Handle meeting creation based on provider
      let finalMeetingUrl: string | undefined;
      let externalMeetingId: string | undefined;
      let finalMeetingProvider: 'zoom' | 'google_meet' | 'stream' | 'manual' | undefined;

      const firstSlot = proposedSlots[0];
      const startDateTime = new Date(`${firstSlot.date}T${firstSlot.startTime}`);
      const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);

      if (meetingProvider === 'in_app') {
        // In-app call via Stream Video
        finalMeetingProvider = 'stream';
      } else if (meetingProvider === 'zoom' && zoom.connected && !useManualOverride) {
        // Auto-create Zoom meeting
        setIsCreatingMeeting(true);
        try {
          const response = await fetch('/api/coach/integrations/zoom/meetings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              topic: title || `Call with ${clientName}`,
              startTime: startDateTime.toISOString(),
              duration,
              timezone,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            finalMeetingUrl = data.meetingUrl;
            externalMeetingId = data.meetingId;
            finalMeetingProvider = 'zoom';
          } else {
            throw new Error('Failed to create Zoom meeting');
          }
        } catch (err) {
          console.error('Error creating Zoom meeting:', err);
          setMeetingError('Failed to create Zoom meeting. Please try again or use a manual link.');
          setIsCreatingMeeting(false);
          return;
        } finally {
          setIsCreatingMeeting(false);
        }
      } else if (meetingProvider === 'google_meet' && googleMeet.connected && !useManualOverride) {
        // Auto-create Google Meet
        setIsCreatingMeeting(true);
        try {
          const response = await fetch('/api/coach/integrations/google_meet/meetings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              summary: title || `Call with ${clientName}`,
              startTime: startDateTime.toISOString(),
              endTime: endDateTime.toISOString(),
              timezone,
              description: notes || `Coaching call with ${clientName}`,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            finalMeetingUrl = data.meetingUrl;
            externalMeetingId = data.eventId;
            finalMeetingProvider = 'google_meet';
          } else {
            throw new Error('Failed to create Google Meet');
          }
        } catch (err) {
          console.error('Error creating Google Meet:', err);
          setMeetingError('Failed to create Google Meet. Please try again or use a manual link.');
          setIsCreatingMeeting(false);
          return;
        } finally {
          setIsCreatingMeeting(false);
        }
      } else if (meetingProvider === 'manual' || useManualOverride) {
        // Manual link
        finalMeetingUrl = normalizeUrl(manualMeetingLink);
        finalMeetingProvider = 'manual';
      }

      // Determine location type based on provider
      const locationType = meetingProvider === 'in_app' ? 'chat' : 'online';
      const locationLabel = meetingProvider === 'in_app'
        ? 'In-App Call'
        : meetingProvider === 'zoom'
          ? 'Zoom'
          : meetingProvider === 'google_meet'
            ? 'Google Meet'
            : 'Video Call';

      await proposeCall({
        clientId,
        proposedTimes,
        title: title || `Call with ${clientName}`,
        description: notes,
        duration,
        locationType,
        locationLabel,
        meetingLink: finalMeetingUrl,
        meetingProvider: finalMeetingProvider,
        externalMeetingId,
        schedulingNotes: notes,
        isRecurring: recurrence !== 'none',
        recurrence: recurrenceConfig,
        instanceId,
        // Program call tracking
        ...(showCallTypeSelector && {
          isProgramCall: callType === 'program',
          isExtraCall: callType === 'extra',
          enrollmentId: enrollmentData?.enrollment?.id,
        }),
        // Direct confirmation mode - creates confirmed event immediately
        confirmDirectly: mode === 'confirm',
      });

      // Invalidate SWR cache for event-related queries so UI updates immediately
      mutate(
        key => typeof key === 'string' && (
          key.startsWith('/api/events') ||
          key.startsWith('/api/scheduling/events') ||
          key.includes('/events')
        ),
        undefined,
        { revalidate: true }
      );

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

  // Mount portal after initial render
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent body scroll when open
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
          <div className="flex items-center gap-3">
            {step === 'schedule' && (
              <button
                onClick={() => setStep('details')}
                className="p-1.5 text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h2 className="font-albert text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                {step === 'details' ? 'Call Details' : 'Schedule'}
              </h2>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                {step === 'details' ? `with ${clientName}` : 'Pick a date and time'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Step indicator dots */}
            <div className="flex items-center gap-1.5">
              {(['details', 'schedule'] as const).map((s, i) => (
                <div
                  key={s}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    step === s
                      ? 'bg-brand-accent'
                      : i < (['details', 'schedule'] as const).indexOf(step)
                        ? 'bg-brand-accent/50'
                        : 'bg-[#d1cdc8] dark:bg-[#3a4150]'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={onClose}
              className="p-2 text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* =============== STEP 1: DETAILS =============== */}
          {step === 'details' && (
            <>
              {/* Title */}
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

              {/* Notes */}
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

              {/* Meeting Provider Selection */}
              <MeetingProviderSelector
                allowInApp={true}
                value={meetingProvider}
                onChange={setMeetingProvider}
                manualLink={manualMeetingLink}
                onManualLinkChange={setManualMeetingLink}
                useManualOverride={useManualOverride}
                onUseManualOverrideChange={setUseManualOverride}
              />

              {/* Meeting Error */}
              {meetingError && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl text-amber-600 dark:text-amber-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <p className="text-sm">{meetingError}</p>
                </div>
              )}
            </>
          )}

          {/* =============== STEP 2: SCHEDULE =============== */}
          {step === 'schedule' && (
            <>
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
                  {/* Calendar Picker */}
                  <SessionCalendarPicker
                    value={selectedDate}
                    onChange={(date) => {
                      setSelectedDate(date);
                      setSelectedTime('');
                    }}
                    availableSlots={slots}
                    isLoading={slotsLoading}
                    className="border-0"
                  />

                  {/* Time Selection */}
                  {selectedDate && slotsByDate[selectedDate] && (
                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                        Time
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {slotsByDate[selectedDate].map((slot, index) => {
                          const time = new Date(slot.start).toTimeString().slice(0, 5);
                          // Check if this time slot is already selected/proposed
                          const isSelected = proposedSlots.some(s => s.date === selectedDate && s.startTime === time);
                          return (
                            <button
                              key={index}
                              onClick={() => {
                                setSelectedTime(time);
                                // Auto-add the time slot
                                const startDateTime = new Date(`${selectedDate}T${time}`);
                                const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);
                                const newSlot: ProposedTimeSlot = {
                                  id: `slot_${Date.now()}`,
                                  date: selectedDate,
                                  startTime: time,
                                  endTime: endDateTime.toTimeString().slice(0, 5),
                                };
                                if (mode === 'confirm') {
                                  // Replace - single slot only for confirm mode
                                  setProposedSlots([newSlot]);
                                } else {
                                  // Append for propose mode (avoid duplicates)
                                  if (!isSelected) {
                                    setProposedSlots(prev => [...prev, newSlot]);
                                  }
                                }
                              }}
                              className={`px-3 py-2 rounded-lg font-albert text-sm transition-colors ${
                                isSelected
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
                </div>
              </div>

              {/* Duration - Pill Buttons */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                  Duration
                </label>
                <div className="flex flex-wrap gap-2">
                  {DURATION_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDuration(opt.value)}
                      className={`px-4 py-2 rounded-full font-albert text-sm transition-colors ${
                        duration === opt.value
                          ? 'bg-brand-accent text-white'
                          : 'bg-[#f3f1ef] dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#e9e5e0] dark:hover:bg-[#2e333d]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Repeat - Radix Select Dropdown */}
              {mode === 'confirm' && (
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                    <Repeat className="inline w-4 h-4 mr-1 -mt-0.5" />
                    Repeat
                  </label>
                  <Select value={recurrence} onValueChange={(value) => setRecurrence(value)}>
                    <SelectTrigger className="w-full h-12 px-4 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl shadow-lg">
                      {RECURRENCE_OPTIONS.map(opt => (
                        <SelectItem
                          key={opt.value}
                          value={opt.value}
                          className="cursor-pointer font-albert"
                        >
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Recurrence End Condition - Card Selection Pattern */}
                  {recurrence !== 'none' && (
                    <div className="mt-3 p-3 bg-[#f9f7f5] dark:bg-[#1c2028] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] space-y-3">
                      <p className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wider">
                        End after
                      </p>

                      {/* End of Program option */}
                      {enrollmentData?.program && programEndDate && (
                        <button
                          type="button"
                          onClick={() => setRecurrenceEnd('end_of_program')}
                          className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 transition-colors ${
                            recurrenceEnd === 'end_of_program'
                              ? 'border-brand-accent bg-brand-accent/5'
                              : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
                          }`}
                        >
                          <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            recurrenceEnd === 'end_of_program'
                              ? 'border-brand-accent bg-brand-accent'
                              : 'border-[#d1ccc6] dark:border-[#3a4150]'
                          }`}>
                            {recurrenceEnd === 'end_of_program' && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </div>
                          <div className="flex-1 text-left">
                            <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                              End of program
                            </span>
                            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-0.5">
                              {formatDate(programEndDate)} ({enrollmentData.program.name})
                            </p>
                          </div>
                        </button>
                      )}

                      {/* Occurrences option */}
                      <button
                        type="button"
                        onClick={() => setRecurrenceEnd('occurrences')}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${
                          recurrenceEnd === 'occurrences'
                            ? 'border-brand-accent bg-brand-accent/5'
                            : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          recurrenceEnd === 'occurrences'
                            ? 'border-brand-accent bg-brand-accent'
                            : 'border-[#d1ccc6] dark:border-[#3a4150]'
                        }`}>
                          {recurrenceEnd === 'occurrences' && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                          Number of occurrences
                        </span>
                        {recurrenceEnd === 'occurrences' && (
                          <input
                            type="number"
                            value={recurrenceOccurrences}
                            onChange={(e) => setRecurrenceOccurrences(Math.max(1, parseInt(e.target.value) || 1))}
                            onClick={(e) => e.stopPropagation()}
                            min={1}
                            max={52}
                            className="ml-auto w-16 px-2 py-1 text-sm bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent"
                          />
                        )}
                      </button>

                      {/* Specific date option */}
                      <button
                        type="button"
                        onClick={() => setRecurrenceEnd('specific_date')}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${
                          recurrenceEnd === 'specific_date'
                            ? 'border-brand-accent bg-brand-accent/5'
                            : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          recurrenceEnd === 'specific_date'
                            ? 'border-brand-accent bg-brand-accent'
                            : 'border-[#d1ccc6] dark:border-[#3a4150]'
                        }`}>
                          {recurrenceEnd === 'specific_date' && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                          Specific date
                        </span>
                      </button>

                      {recurrenceEnd === 'specific_date' && (
                        <DatePicker
                          value={recurrenceEndDate}
                          onChange={(d) => setRecurrenceEndDate(d)}
                          minDate={proposedSlots[0]?.date ? new Date(proposedSlots[0].date + 'T00:00:00') : new Date()}
                          placeholder="End date"
                          displayFormat="MMM d, yyyy"
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

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

              {/* Call Type Selector (when client has program with call allowance) */}
              {!enrollmentLoading && !callUsageLoading && showCallTypeSelector && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                    Call Type
                  </label>

                  {/* Program Call Option */}
                  <button
                    onClick={() => setCallType('program')}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      callType === 'program'
                        ? 'border-brand-accent bg-brand-accent/5'
                        : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-[#c5c0ba] dark:hover:border-[#3a4050]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        callType === 'program' ? 'border-brand-accent bg-brand-accent' : 'border-[#c5c0ba] dark:border-[#4a5060]'
                      }`}>
                        {callType === 'program' && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Link2 className="w-4 h-4 text-brand-accent" />
                          <span className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                            Program Call
                          </span>
                        </div>
                        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
                          Uses client&apos;s allowance: {formatCallUsageStatus(callUsage)}
                        </p>
                        <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-1">
                          Linked to: {enrollmentData?.program?.name}
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* Extra Call Option */}
                  <button
                    onClick={() => setCallType('extra')}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      callType === 'extra'
                        ? 'border-brand-accent bg-brand-accent/5'
                        : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-[#c5c0ba] dark:hover:border-[#3a4050]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        callType === 'extra' ? 'border-brand-accent bg-brand-accent' : 'border-[#c5c0ba] dark:border-[#4a5060]'
                      }`}>
                        {callType === 'extra' && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                            Extra Session
                          </span>
                          {extraCallPrice > 0 && (
                            <span className="text-sm text-green-600 dark:text-green-400">
                              {formatExtraCallPrice(extraCallPrice)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
                          Doesn&apos;t use client&apos;s allowance
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {/* Program Linking info (when program call selected and has proposed slots) */}
              {!enrollmentLoading && linkToProgram && proposedSlots.length > 0 && callType === 'program' && (
                <div className="p-4 bg-brand-accent/5 dark:bg-brand-accent/10 border border-brand-accent/20 dark:border-brand-accent/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-brand-accent/10 dark:bg-brand-accent/20 rounded-lg flex items-center justify-center">
                      <Link2 className="w-4 h-4 text-brand-accent" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                        Linked to {enrollmentData?.program?.name}
                      </p>
                      {calculatedProgramDay ? (
                        <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-0.5">
                          Will appear in <strong>Week {calculatedProgramDay.weekIndex + 1}</strong>, <strong>Day {calculatedProgramDay.globalDayIndex}</strong>
                        </p>
                      ) : (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                          Selected date is outside program range
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Error Message (shown on both steps) */}
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
          {step === 'details' ? (
            <button
              onClick={() => setStep('schedule')}
              className="flex items-center gap-2 px-6 py-3 bg-brand-accent text-white rounded-xl font-albert font-medium hover:opacity-90 transition-opacity"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={proposedSlots.length === 0 || isLoading || isCreatingMeeting}
              className="flex items-center gap-2 px-6 py-3 bg-brand-accent text-white rounded-xl font-albert font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {(isLoading || isCreatingMeeting) && <Loader2 className="w-4 h-4 animate-spin" />}
              {isCreatingMeeting ? 'Creating Meeting...' : mode === 'propose' ? 'Send Proposal' : 'Confirm Call'}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // Use portal to render at document body level
  return createPortal(content, document.body);
}
