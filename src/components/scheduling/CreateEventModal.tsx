'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Video,
  Image as ImageIcon,
  Repeat,
  Globe,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { MediaUpload } from '@/components/admin/MediaUpload';
import { useCoachIntegrations } from '@/hooks/useCoachIntegrations';
import { MeetingProviderSelector, MeetingProviderType, isMeetingProviderReady } from './MeetingProviderSelector';
import type { RecurrenceFrequency } from '@/types';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  programId?: string;
  cohortId?: string;
  squadId?: string;
  instanceId?: string;
  organizationId?: string;
  onSuccess?: (event: any) => void;
}

type WizardStep = 'info' | 'meeting' | 'schedule';

const DURATION_OPTIONS = [
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
];

const RECURRENCE_OPTIONS: { value: RecurrenceFrequency | 'none'; label: string }[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
];

const EVENT_TYPES = [
  { value: 'community_event', label: 'Community Event', description: 'Open event for all members' },
  { value: 'cohort_call', label: 'Cohort Call', description: 'Call with cohort members' },
  { value: 'squad_call', label: 'Squad Call', description: 'Call with squad members' },
];

const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'UTC', label: 'UTC' },
];

type RecurrenceEndType = 'specific_date' | 'occurrences';

/**
 * CreateEventModal - 3-Step Wizard
 *
 * Step 1: Basic Info - Title, description, event type, cover image
 * Step 2: Meeting Provider - Zoom, Google Meet, or Manual link
 * Step 3: Schedule - Date, time, duration, timezone, recurrence
 */
export function CreateEventModal({
  isOpen,
  onClose,
  programId,
  cohortId,
  squadId,
  instanceId,
  organizationId,
  onSuccess,
}: CreateEventModalProps) {
  const [step, setStep] = useState<WizardStep>('info');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Coach integrations
  const { zoom, googleMeet } = useCoachIntegrations();

  // Step 1: Basic Info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<string>('community_event');
  const [coverImageUrl, setCoverImageUrl] = useState('');

  // Step 2: Meeting Provider
  const [meetingProvider, setMeetingProvider] = useState<MeetingProviderType>('manual');
  const [manualMeetingLink, setManualMeetingLink] = useState('');
  const [useManualOverride, setUseManualOverride] = useState(false);

  // Step 3: Schedule
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState(60);
  const [timezone, setTimezone] = useState('America/New_York');
  const [recurrence, setRecurrence] = useState<RecurrenceFrequency | 'none'>('none');
  const [recurrenceEndType, setRecurrenceEndType] = useState<RecurrenceEndType>('occurrences');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [recurrenceOccurrences, setRecurrenceOccurrences] = useState(4);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('info');
      setError(null);
      setTitle('');
      setDescription('');
      setEventType('community_event');
      setCoverImageUrl('');
      setMeetingProvider('manual');
      setManualMeetingLink('');
      setUseManualOverride(false);

      // Set default date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDate(tomorrow.toISOString().split('T')[0]);
      setTime('10:00');
      setDuration(60);
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York');
      setRecurrence('none');
      setRecurrenceEndType('occurrences');
      setRecurrenceEndDate('');
      setRecurrenceOccurrences(4);
    }
  }, [isOpen]);

  // Step validation
  const validateStep = (currentStep: WizardStep): boolean => {
    setError(null);

    if (currentStep === 'info') {
      if (!title.trim()) {
        setError('Please enter a title');
        return false;
      }
      return true;
    }

    if (currentStep === 'meeting') {
      const integrations = { zoom: { connected: zoom.connected }, googleMeet: { connected: googleMeet.connected } };
      if (!isMeetingProviderReady(meetingProvider, integrations, useManualOverride, manualMeetingLink)) {
        if (meetingProvider === 'manual' && !manualMeetingLink.trim()) {
          setError('Please enter a meeting link');
          return false;
        }
        if ((meetingProvider === 'zoom' || meetingProvider === 'google_meet') && useManualOverride && !manualMeetingLink.trim()) {
          setError('Please enter a meeting link or disable manual override');
          return false;
        }
      }
      return true;
    }

    if (currentStep === 'schedule') {
      if (!date || !time) {
        setError('Please select a date and time');
        return false;
      }
      if (recurrence !== 'none' && recurrenceEndType === 'specific_date' && !recurrenceEndDate) {
        setError('Please select an end date for the recurring event');
        return false;
      }
      return true;
    }

    return true;
  };

  // Navigate steps
  const goToNextStep = () => {
    if (!validateStep(step)) return;

    if (step === 'info') setStep('meeting');
    else if (step === 'meeting') setStep('schedule');
  };

  const goToPrevStep = () => {
    setError(null);
    if (step === 'meeting') setStep('info');
    else if (step === 'schedule') setStep('meeting');
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateStep('schedule')) return;
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      // Build datetime
      const [year, month, day] = date.split('-').map(Number);
      const [hours, minutes] = time.split(':').map(Number);
      const localDate = new Date(year, month - 1, day, hours, minutes);

      // Convert to UTC
      const dateInTz = new Date(localDate.toLocaleString('en-US', { timeZone: timezone }));
      const utcDate = new Date(localDate.getTime() - (dateInTz.getTime() - localDate.getTime()));

      // Determine meeting URL
      let finalMeetingUrl: string | undefined;
      let finalMeetingId: string | undefined;
      let finalMeetingProvider: 'zoom' | 'google_meet' | 'manual' | undefined;

      // Auto-create meeting if using Zoom/Meet and not using manual override
      if ((meetingProvider === 'zoom' || meetingProvider === 'google_meet') && !useManualOverride) {
        setIsCreatingMeeting(true);
        try {
          const meetingTitle = title.trim();

          if (meetingProvider === 'zoom') {
            const response = await fetch('/api/coach/integrations/zoom/meetings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                topic: meetingTitle,
                startTime: utcDate.toISOString(),
                duration,
                timezone,
              }),
            });

            if (response.ok) {
              const data = await response.json();
              finalMeetingUrl = data.meetingUrl;
              finalMeetingId = data.meetingId;
              finalMeetingProvider = 'zoom';
            } else {
              throw new Error('Failed to create Zoom meeting');
            }
          } else if (meetingProvider === 'google_meet') {
            const endDate = new Date(utcDate.getTime() + duration * 60 * 1000);

            const response = await fetch('/api/coach/integrations/google_meet/meetings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                summary: meetingTitle,
                startTime: utcDate.toISOString(),
                endTime: endDate.toISOString(),
                timezone,
                description: description.trim() || undefined,
              }),
            });

            if (response.ok) {
              const data = await response.json();
              finalMeetingUrl = data.meetingUrl;
              finalMeetingId = data.eventId;
              finalMeetingProvider = 'google_meet';
            } else {
              throw new Error('Failed to create Google Meet');
            }
          }
        } finally {
          setIsCreatingMeeting(false);
        }
      } else {
        finalMeetingUrl = manualMeetingLink.trim() || undefined;
        // For events, we don't use 'in_app' so this will always be 'manual', 'zoom', or 'google_meet'
        finalMeetingProvider = meetingProvider === 'in_app' ? 'manual' : meetingProvider;
      }

      // Build recurrence pattern
      const recurrencePattern = recurrence !== 'none' ? {
        frequency: recurrence,
        dayOfWeek: new Date(date + 'T12:00:00').getDay(),
        dayOfMonth: recurrence === 'monthly' ? day : undefined,
        time,
        timezone,
        startDate: date,
        endDate: recurrenceEndType === 'specific_date' ? recurrenceEndDate : undefined,
        occurrences: recurrenceEndType === 'occurrences' ? recurrenceOccurrences : undefined,
      } : undefined;

      // Determine scope based on context
      let scope: string = 'organization';
      let participantModel: string = 'open';

      if (squadId) {
        scope = 'squad';
        participantModel = 'squad_members';
      } else if (cohortId) {
        scope = 'cohort';
        participantModel = 'cohort_members';
      } else if (programId) {
        scope = 'program';
        participantModel = 'program_enrollees';
      }

      // Build event payload
      const eventData = {
        title: title.trim(),
        description: description.trim() || undefined,
        startDateTime: utcDate.toISOString(),
        timezone,
        durationMinutes: duration,

        locationType: finalMeetingUrl ? 'online' : 'chat',
        locationLabel: finalMeetingProvider === 'zoom' ? 'Zoom' : finalMeetingProvider === 'google_meet' ? 'Google Meet' : 'Meeting',
        meetingLink: finalMeetingUrl,
        meetingProvider: finalMeetingProvider,
        externalMeetingId: finalMeetingId,

        eventType,
        scope,
        participantModel,
        approvalType: 'none',

        visibility: 'program_wide',

        organizationId: organizationId || undefined,
        programId: programId || undefined,
        programIds: programId ? [programId] : [],
        cohortId: cohortId || undefined,
        squadId: squadId || undefined,
        instanceId: instanceId || undefined,

        isRecurring: recurrence !== 'none',
        recurrence: recurrencePattern,

        isCoachLed: true,
        coverImageUrl: coverImageUrl || undefined,
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

      const { event } = await response.json();

      onClose();
      if (onSuccess) {
        onSuccess(event);
      }
    } catch (err) {
      console.error('Error creating event:', err);
      setError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get minimum date (today)
  const minDate = new Date().toISOString().split('T')[0];

  // Progress indicator
  const steps: { key: WizardStep; label: string; icon: typeof FileText }[] = [
    { key: 'info', label: 'Basic Info', icon: FileText },
    { key: 'meeting', label: 'Meeting', icon: Video },
    { key: 'schedule', label: 'Schedule', icon: Calendar },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0" hideCloseButton>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-[#1e222a] border-b border-[#e1ddd8] dark:border-[#262b35] px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-albert text-[20px] font-semibold tracking-[-0.5px] text-[#1a1a1a] dark:text-[#f5f5f8]">
              Create Event
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
            >
              <X className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-2">
            {steps.map((s, index) => {
              const Icon = s.icon;
              const isActive = index === currentStepIndex;
              const isCompleted = index < currentStepIndex;

              return (
                <div key={s.key} className="flex items-center flex-1">
                  <div
                    className={`
                      flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-albert font-medium transition-colors
                      ${isActive ? 'bg-brand-accent text-white' : ''}
                      ${isCompleted ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' : ''}
                      ${!isActive && !isCompleted ? 'bg-[#f3f1ef] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2]' : ''}
                    `}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">{s.label}</span>
                    <span className="sm:hidden">{index + 1}</span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 rounded ${index < currentStepIndex ? 'bg-green-500' : 'bg-[#e1ddd8] dark:bg-[#262b35]'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <p className="text-red-600 dark:text-red-400 text-sm font-albert">{error}</p>
            </div>
          )}

          {/* Step 1: Basic Info */}
          {step === 'info' && (
            <div className="space-y-5">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Weekly Q&A Session"
                  className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] focus:outline-none focus:ring-2 focus:ring-brand-accent"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                  Description <span className="text-[#5f5a55] dark:text-[#b2b6c2] font-normal">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What will this event cover?"
                  rows={3}
                  className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] focus:outline-none focus:ring-2 focus:ring-brand-accent resize-none"
                />
              </div>

              {/* Event Type */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                  Event Type
                </label>
                <div className="space-y-2">
                  {EVENT_TYPES.map((type) => (
                    <label
                      key={type.value}
                      className={`
                        flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors
                        ${eventType === type.value
                          ? 'bg-brand-accent/5 border-brand-accent'
                          : 'bg-white dark:bg-[#11141b] border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
                        }
                      `}
                    >
                      <input
                        type="radio"
                        name="eventType"
                        value={type.value}
                        checked={eventType === type.value}
                        onChange={(e) => setEventType(e.target.value)}
                        className="mt-1 w-4 h-4 text-brand-accent focus:ring-brand-accent"
                      />
                      <div>
                        <span className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                          {type.label}
                        </span>
                        <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-0.5">
                          {type.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Cover Image */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                  <ImageIcon className="inline w-4 h-4 mr-1 -mt-0.5" />
                  Cover Image <span className="text-[#5f5a55] dark:text-[#b2b6c2] font-normal">(optional)</span>
                </label>
                <MediaUpload
                  value={coverImageUrl}
                  onChange={setCoverImageUrl}
                  folder="events"
                  type="image"
                  uploadEndpoint="/api/coach/org-upload-media"
                  hideLabel
                  aspectRatio="16:9"
                />
              </div>
            </div>
          )}

          {/* Step 2: Meeting Provider */}
          {step === 'meeting' && (
            <div className="space-y-5">
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                Choose how attendees will join this event.
              </p>
              <MeetingProviderSelector
                allowInApp={false}
                value={meetingProvider}
                onChange={setMeetingProvider}
                manualLink={manualMeetingLink}
                onManualLinkChange={setManualMeetingLink}
                useManualOverride={useManualOverride}
                onUseManualOverrideChange={setUseManualOverride}
                label="Meeting Link"
              />
            </div>
          )}

          {/* Step 3: Schedule */}
          {step === 'schedule' && (
            <div className="space-y-5">
              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                    <Calendar className="inline w-4 h-4 mr-1 -mt-0.5" />
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={minDate}
                    className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                    <Clock className="inline w-4 h-4 mr-1 -mt-0.5" />
                    Time
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent"
                  />
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                  Duration
                </label>
                <div className="flex flex-wrap gap-2">
                  {DURATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDuration(opt.value)}
                      className={`
                        px-4 py-2 rounded-full font-albert text-sm transition-colors
                        ${duration === opt.value
                          ? 'bg-brand-accent text-white'
                          : 'bg-[#f3f1ef] dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#e9e5e0] dark:hover:bg-[#2e333d]'
                        }
                      `}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timezone */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                  <Globe className="inline w-4 h-4 mr-1 -mt-0.5" />
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent"
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Recurrence */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                  <Repeat className="inline w-4 h-4 mr-1 -mt-0.5" />
                  Repeat
                </label>
                <select
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value as RecurrenceFrequency | 'none')}
                  className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent"
                >
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {/* Recurrence End Options */}
                {recurrence !== 'none' && (
                  <div className="mt-3 p-3 bg-[#f9f7f5] dark:bg-[#1c2028] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] space-y-3">
                    <p className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wider">
                      End after
                    </p>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="recurrenceEnd"
                        checked={recurrenceEndType === 'occurrences'}
                        onChange={() => setRecurrenceEndType('occurrences')}
                        className="w-4 h-4 text-brand-accent focus:ring-brand-accent"
                      />
                      <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                        Number of occurrences
                      </span>
                      {recurrenceEndType === 'occurrences' && (
                        <input
                          type="number"
                          value={recurrenceOccurrences}
                          onChange={(e) => setRecurrenceOccurrences(Math.max(1, parseInt(e.target.value) || 1))}
                          min={1}
                          max={52}
                          className="w-16 px-2 py-1 text-sm bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent"
                        />
                      )}
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="recurrenceEnd"
                        checked={recurrenceEndType === 'specific_date'}
                        onChange={() => setRecurrenceEndType('specific_date')}
                        className="w-4 h-4 text-brand-accent focus:ring-brand-accent"
                      />
                      <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                        Specific date
                      </span>
                    </label>

                    {recurrenceEndType === 'specific_date' && (
                      <input
                        type="date"
                        value={recurrenceEndDate}
                        onChange={(e) => setRecurrenceEndDate(e.target.value)}
                        min={date}
                        className="w-full px-3 py-2 text-sm bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 z-10 bg-white dark:bg-[#1e222a] border-t border-[#e1ddd8] dark:border-[#262b35] px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={step === 'info' ? onClose : goToPrevStep}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-albert font-medium text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors disabled:opacity-50"
            >
              {step === 'info' ? (
                'Cancel'
              ) : (
                <>
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </>
              )}
            </button>

            {step === 'schedule' ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || isCreatingMeeting}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-accent hover:bg-brand-accent/90 text-white text-sm font-albert font-semibold rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {(isSubmitting || isCreatingMeeting) && <Loader2 className="w-4 h-4 animate-spin" />}
                {isCreatingMeeting ? 'Creating meeting...' : isSubmitting ? 'Creating...' : 'Create Event'}
              </button>
            ) : (
              <button
                type="button"
                onClick={goToNextStep}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-brand-accent hover:bg-brand-accent/90 text-white text-sm font-albert font-semibold rounded-full transition-colors"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
