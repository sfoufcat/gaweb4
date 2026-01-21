'use client';

import React, { useState, useEffect, Fragment, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import useSWR from 'swr';
import {
  X,
  Calendar,
  Clock,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Check,
  Video,
  Image as ImageIcon,
  Repeat,
  Globe,
  Users,
  UserCheck,
  ChevronRight,
  Eye,
} from 'lucide-react';
import {
  Drawer,
  DrawerContent,
} from '@/components/ui/drawer';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { MediaUpload } from '@/components/admin/MediaUpload';
import { useCoachIntegrations } from '@/hooks/useCoachIntegrations';
import { MeetingProviderSelector, MeetingProviderType, isMeetingProviderReady } from './MeetingProviderSelector';
import type { RecurrenceFrequency, Squad, ProgramCohort } from '@/types';

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
  { value: 'community_event', label: 'All Members', description: 'Anyone in your organization can join', visibility: 'Discover · Calendar', icon: Globe },
  { value: 'cohort_call', label: 'Program Group', description: 'Only members in a specific program group', visibility: 'Program Page · Calendar', icon: Users },
  { value: 'squad_call', label: 'Squad', description: 'Only members of a specific squad', visibility: 'Squad Page · Calendar', icon: UserCheck },
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

// Simple fetcher for SWR
const fetcher = (url: string) => fetch(url).then(res => res.json());

interface ProgramWithCohorts {
  id: string;
  name: string;
  type: 'group' | 'individual';
  cohorts?: ProgramCohort[];
}

/**
 * CreateEventModal - 3-Step Wizard matching NewProgramModal design
 *
 * Step 1: Basic Info - Title, description, cover image
 * Step 2: Event Type + Meeting Provider - Select type, show cohort/squad selector if needed, configure meeting
 * Step 3: Schedule - Date, time, duration, timezone, recurrence
 */
export function CreateEventModal({
  isOpen,
  onClose,
  programId: propProgramId,
  cohortId: propCohortId,
  squadId: propSquadId,
  instanceId,
  organizationId,
  onSuccess,
}: CreateEventModalProps) {
  const [step, setStep] = useState<WizardStep>('info');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mobile detection
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Coach integrations
  const { zoom, googleMeet } = useCoachIntegrations();

  // Fetch squads for squad selector
  const { data: squadsData } = useSWR<{ squads: Squad[] }>(
    isOpen ? '/api/coach/org-squads' : null,
    fetcher
  );

  // Fetch programs with cohorts for cohort selector
  const { data: programsData } = useSWR<{ programs: ProgramWithCohorts[] }>(
    isOpen ? '/api/coach/org-programs?includeStats=false' : null,
    fetcher
  );

  // Track initial mount to skip animation on first open
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isOpen) {
      isInitialMount.current = true;
      const timer = setTimeout(() => {
        isInitialMount.current = false;
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Step 1: Basic Info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');

  // Step 2: Event Type + Meeting Provider
  const [eventType, setEventType] = useState<string>('community_event');
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [selectedCohortId, setSelectedCohortId] = useState<string>('');
  const [selectedSquadId, setSelectedSquadId] = useState<string>('');
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

  // Fetch cohorts when a program is selected
  const { data: cohortsData } = useSWR<{ cohorts: ProgramCohort[] }>(
    isOpen && selectedProgramId ? `/api/coach/org-programs/${selectedProgramId}/cohorts?status=upcoming,active` : null,
    fetcher
  );

  // Get group programs (only group programs have cohorts)
  const groupPrograms = programsData?.programs?.filter(p => p.type === 'group') || [];
  const cohorts = cohortsData?.cohorts || [];
  const squads = squadsData?.squads || [];

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('info');
      setError(null);
      setTitle('');
      setDescription('');
      setCoverImageUrl('');
      setEventType('community_event');
      setSelectedProgramId(propProgramId || '');
      setSelectedCohortId(propCohortId || '');
      setSelectedSquadId(propSquadId || '');
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
  }, [isOpen, propProgramId, propCohortId, propSquadId]);

  // Animation variants
  const fadeVariants = {
    initial: { opacity: 0, scale: 0.98 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
  };

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
      // Check if cohort/squad is selected when required
      if (eventType === 'cohort_call' && !selectedCohortId) {
        setError('Please select a cohort');
        return false;
      }
      if (eventType === 'squad_call' && !selectedSquadId) {
        setError('Please select a squad');
        return false;
      }

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
    console.log('[goToNextStep]', { step, eventType, selectedCohortId, selectedProgramId, selectedSquadId });
    if (!validateStep(step)) return;

    if (step === 'info') setStep('meeting');
    else if (step === 'meeting') setStep('schedule');
  };

  const goToPrevStep = () => {
    setError(null);
    if (step === 'meeting') setStep('info');
    else if (step === 'schedule') setStep('meeting');
  };

  // Get step index for progress dots
  const getStepIndex = () => {
    const steps: WizardStep[] = ['info', 'meeting', 'schedule'];
    return steps.indexOf(step);
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

      // Determine IDs based on event type
      const finalCohortId = eventType === 'cohort_call' ? selectedCohortId : (propCohortId || undefined);
      const finalSquadId = eventType === 'squad_call' ? selectedSquadId : (propSquadId || undefined);
      const finalProgramId = eventType === 'cohort_call' ? selectedProgramId : (propProgramId || undefined);

      // Determine scope based on event type
      let scope: string = 'organization';
      let participantModel: string = 'open';

      if (eventType === 'squad_call' || finalSquadId) {
        scope = 'squad';
        participantModel = 'squad_members';
      } else if (eventType === 'cohort_call' || finalCohortId) {
        scope = 'cohort';
        participantModel = 'cohort_members';
      } else if (finalProgramId) {
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
        programId: finalProgramId || undefined,
        programIds: finalProgramId ? [finalProgramId] : [],
        cohortId: finalCohortId || undefined,
        squadId: finalSquadId || undefined,
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

  // Wizard content (shared between Dialog and Drawer)
  const wizardContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
        <div className="flex items-center gap-3">
          {step !== 'info' && (
            <button
              onClick={goToPrevStep}
              disabled={isSubmitting}
              className="p-2 rounded-xl text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-[-0.5px]">
              {step === 'info' && 'Create Event'}
              {step === 'meeting' && 'Event Type & Meeting'}
              {step === 'schedule' && 'Schedule'}
            </h2>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              {step === 'info' && 'Set up your event details'}
              {step === 'meeting' && 'Configure type and meeting link'}
              {step === 'schedule' && 'Pick a date and time'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="p-2 rounded-xl text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-6">
        {error && (
          <div className="mb-5 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="text-red-600 dark:text-red-400 text-sm font-albert">{error}</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* Step 1: Basic Info */}
          {step === 'info' && (
            <motion.div
              key="info"
              variants={fadeVariants}
              initial={isInitialMount.current ? false : 'initial'}
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="space-y-5"
            >
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

              {/* Cover Image */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                  <ImageIcon className="inline w-4 h-4 mr-1" />
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
            </motion.div>
          )}

          {/* Step 2: Event Type + Meeting Provider */}
          {step === 'meeting' && (
            <motion.div
              key="meeting"
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="space-y-5"
            >
              {/* Event Type - Card Selection */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-3">
                  Event Type
                </label>
                <div className="grid grid-cols-3 gap-3 -mx-0.5 px-0.5">
                  {EVENT_TYPES.map((type) => {
                    const Icon = type.icon;
                    const isSelected = eventType === type.value;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => {
                          setEventType(type.value);
                          // Reset selections when type changes
                          if (type.value !== 'cohort_call') {
                            setSelectedProgramId('');
                            setSelectedCohortId('');
                          }
                          if (type.value !== 'squad_call') {
                            setSelectedSquadId('');
                          }
                        }}
                        className={`group relative flex flex-col items-center text-center p-4 rounded-2xl border-2 transition-colors ${
                          isSelected
                            ? 'border-brand-accent bg-brand-accent/5'
                            : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] hover:border-brand-accent/50'
                        }`}
                      >
                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 transition-colors ${
                          isSelected
                            ? 'bg-brand-accent/20'
                            : 'bg-[#f3f1ef] dark:bg-[#262b35] group-hover:bg-brand-accent/10'
                        }`}>
                          <Icon className={`w-5 h-5 ${isSelected ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
                        </div>
                        <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-0.5">
                          {type.label}
                        </h3>
                        <p className="text-[10px] text-[#5f5a55] dark:text-[#b2b6c2] leading-tight">
                          {type.description}
                        </p>
                        {/* Visibility hint */}
                        <div className="mt-1.5 flex items-center gap-1 text-[9px] text-[#8a857f] dark:text-[#7a7f8c]">
                          <Eye className="w-2.5 h-2.5" />
                          <span>{type.visibility}</span>
                        </div>
                        {/* Selection indicator */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-accent flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Animated container for conditional selectors */}
              <AnimatePresence mode="wait">
              {/* Cohort Selector (when cohort_call is selected) */}
              {eventType === 'cohort_call' && (
                <motion.div
                  key="cohort-selector"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  className="space-y-3">
                  {/* Program Selector */}
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                      Select Program <span className="text-red-500">*</span>
                    </label>
                    {groupPrograms.length === 0 ? (
                      <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] p-3 bg-[#f9f7f5] dark:bg-[#1c2028] rounded-xl">
                        No group programs with cohorts found
                      </p>
                    ) : (
                      <Select
                        value={selectedProgramId}
                        onValueChange={(value) => {
                          setSelectedProgramId(value);
                          setSelectedCohortId(''); // Reset cohort when program changes
                        }}
                      >
                        <SelectTrigger className="w-full h-12 px-4 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent">
                          <SelectValue placeholder="Select a program..." />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl shadow-lg">
                          {groupPrograms.map((program) => (
                            <SelectItem
                              key={program.id}
                              value={program.id}
                              className="cursor-pointer font-albert"
                            >
                              {program.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Cohort Selector */}
                  {selectedProgramId && (
                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                        Select Cohort <span className="text-red-500">*</span>
                      </label>
                      {cohorts.length === 0 ? (
                        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] p-3 bg-[#f9f7f5] dark:bg-[#1c2028] rounded-xl">
                          No active or upcoming cohorts found for this program
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {cohorts.map((cohort) => (
                            <button
                              key={cohort.id}
                              type="button"
                              onClick={() => setSelectedCohortId(cohort.id)}
                              className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-colors ${
                                selectedCohortId === cohort.id
                                  ? 'border-brand-accent bg-brand-accent/5'
                                  : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                  selectedCohortId === cohort.id
                                    ? 'bg-brand-accent/20'
                                    : 'bg-[#f3f1ef] dark:bg-[#262b35]'
                                }`}>
                                  <Users className={`w-4 h-4 ${selectedCohortId === cohort.id ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
                                </div>
                                <div className="text-left">
                                  <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">{cohort.name}</p>
                                  <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                                    {cohort.status === 'active' ? 'Active' : 'Upcoming'} • {cohort.currentEnrollment || 0} members
                                  </p>
                                </div>
                              </div>
                              {selectedCohortId === cohort.id ? (
                                <div className="w-5 h-5 rounded-full bg-brand-accent flex items-center justify-center">
                                  <Check className="w-3 h-3 text-white" />
                                </div>
                              ) : (
                                <ChevronRight className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Squad Selector (when squad_call is selected) */}
              {eventType === 'squad_call' && (
                <motion.div
                  key="squad-selector"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                    Select Squad <span className="text-red-500">*</span>
                  </label>
                  {squads.length === 0 ? (
                    <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] p-3 bg-[#f9f7f5] dark:bg-[#1c2028] rounded-xl">
                      No squads found in your organization
                    </p>
                  ) : (
                    <Select value={selectedSquadId} onValueChange={setSelectedSquadId}>
                      <SelectTrigger className="w-full h-12 px-4 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent">
                        <SelectValue placeholder="Select a squad..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl shadow-lg">
                        {squads.map((squad) => (
                          <SelectItem
                            key={squad.id}
                            value={squad.id}
                            className="cursor-pointer font-albert"
                          >
                            {squad.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </motion.div>
              )}
              </AnimatePresence>

              {/* Meeting Provider */}
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
            </motion.div>
          )}

          {/* Step 3: Schedule */}
          {step === 'schedule' && (
            <motion.div
              key="schedule"
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="space-y-5"
            >
              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                    <Calendar className="inline w-4 h-4 mr-1 -mt-0.5" />
                    Date
                  </label>
                  <DatePicker
                    value={date}
                    onChange={(d) => setDate(d)}
                    minDate={new Date(minDate)}
                    placeholder="Select date"
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
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger className="w-full h-12 px-4 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl shadow-lg max-h-60">
                    {COMMON_TIMEZONES.map((tz) => (
                      <SelectItem
                        key={tz.value}
                        value={tz.value}
                        className="cursor-pointer font-albert"
                      >
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Recurrence */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                  <Repeat className="inline w-4 h-4 mr-1 -mt-0.5" />
                  Repeat
                </label>
                <Select value={recurrence} onValueChange={(value) => setRecurrence(value as RecurrenceFrequency | 'none')}>
                  <SelectTrigger className="w-full h-12 px-4 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl shadow-lg">
                    {RECURRENCE_OPTIONS.map((opt) => (
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

                {/* Recurrence End Options */}
                {recurrence !== 'none' && (
                  <div className="mt-3 p-3 bg-[#f9f7f5] dark:bg-[#1c2028] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] space-y-3">
                    <p className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wider">
                      End after
                    </p>

                    {/* Occurrences option */}
                    <button
                      type="button"
                      onClick={() => setRecurrenceEndType('occurrences')}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${
                        recurrenceEndType === 'occurrences'
                          ? 'border-brand-accent bg-brand-accent/5'
                          : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        recurrenceEndType === 'occurrences'
                          ? 'border-brand-accent bg-brand-accent'
                          : 'border-[#d1ccc6] dark:border-[#3a4150]'
                      }`}>
                        {recurrenceEndType === 'occurrences' && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                        Number of occurrences
                      </span>
                      {recurrenceEndType === 'occurrences' && (
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
                      onClick={() => setRecurrenceEndType('specific_date')}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${
                        recurrenceEndType === 'specific_date'
                          ? 'border-brand-accent bg-brand-accent/5'
                          : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        recurrenceEndType === 'specific_date'
                          ? 'border-brand-accent bg-brand-accent'
                          : 'border-[#d1ccc6] dark:border-[#3a4150]'
                      }`}>
                        {recurrenceEndType === 'specific_date' && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                        Specific date
                      </span>
                    </button>

                    {recurrenceEndType === 'specific_date' && (
                      <DatePicker
                        value={recurrenceEndDate}
                        onChange={(d) => setRecurrenceEndDate(d)}
                        minDate={date ? new Date(date + 'T00:00:00') : new Date()}
                        placeholder="End date"
                        displayFormat="MMM d, yyyy"
                      />
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50">
        <div className="flex items-center justify-between">
          {/* Progress Indicator - 3 dots */}
          <div className="flex items-center gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i <= getStepIndex()
                    ? 'bg-brand-accent'
                    : 'bg-[#e1ddd8] dark:bg-[#262b35]'
                }`}
              />
            ))}
          </div>

          {/* Action Button */}
          {step === 'schedule' ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || isCreatingMeeting}
              className="flex items-center gap-2 px-6 py-2.5 bg-brand-accent text-white rounded-xl font-medium font-albert hover:bg-brand-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {(isSubmitting || isCreatingMeeting) && <Loader2 className="w-4 h-4 animate-spin" />}
              {isCreatingMeeting ? 'Creating meeting...' : isSubmitting ? 'Creating...' : 'Create Event'}
            </button>
          ) : (
            <button
              type="button"
              onClick={goToNextStep}
              className="flex items-center gap-2 px-6 py-2.5 bg-brand-accent text-white rounded-xl font-medium font-albert hover:bg-brand-accent/90 transition-colors"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // Render mobile drawer or desktop dialog
  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="h-[90vh] max-h-[90vh]">
          {wizardContent}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[100]" onClose={onClose}>
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
          <div className="fixed inset-0 z-[99] bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 z-[100] overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white/95 dark:bg-[#171b22]/95 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl shadow-black/10 dark:shadow-black/30 transition-all">
                {wizardContent}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
