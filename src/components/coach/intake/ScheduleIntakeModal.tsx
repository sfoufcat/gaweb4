'use client';

import React, { useState, useEffect, Fragment, useRef, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import useSWR from 'swr';
import {
  X,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Check,
  Calendar,
  Clock,
  Video,
  ChevronLeft,
  ChevronRight,
  Plus,
  Phone as PhoneIcon,
} from 'lucide-react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { IntakeConfigWizard } from './IntakeConfigWizard';
import { IntakeConfigActions } from './IntakeConfigActions';
import type { IntakeCallConfig, IntakeFormField } from '@/types';

interface ScheduleIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (event: { id: string; title: string; startDateTime: string }) => void;
}

type WizardStep = 'type' | 'details' | 'time' | 'success';

interface TimeSlot {
  start: string;
  end: string;
  duration: number;
}

const PROVIDER_LABELS: Record<string, string> = {
  zoom: 'Zoom',
  google_meet: 'Google Meet',
  in_app: 'In-app',
  manual: 'Custom',
};

const fetcher = (url: string) => fetch(url).then(res => res.json());

/**
 * ScheduleIntakeModal - 3-step wizard for scheduling an intake call
 *
 * Step 1: Select intake type (or create new)
 * Step 2: Enter prospect details (name, email, custom fields)
 * Step 3: Pick date/time from available slots
 * Success: Show confirmation
 */
export function ScheduleIntakeModal({
  isOpen,
  onClose,
  onSuccess,
}: ScheduleIntakeModalProps) {
  const [step, setStep] = useState<WizardStep>('type');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMobile = useMediaQuery('(max-width: 768px)');
  const isInitialMount = useRef(true);

  // Step 1: Type selection
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [showConfigEditor, setShowConfigEditor] = useState(false);

  // Step 2: Prospect details
  const [prospectName, setProspectName] = useState('');
  const [prospectEmail, setProspectEmail] = useState('');
  const [prospectPhone, setProspectPhone] = useState('');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  // Step 3: Time selection
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slots, setSlots] = useState<TimeSlot[]>([]);

  // Success state
  const [bookedEvent, setBookedEvent] = useState<{
    id: string;
    title: string;
    startDateTime: string;
    meetingUrl?: string;
  } | null>(null);

  // Fetch intake configs
  const { data: configsData, mutate: mutateConfigs } = useSWR<{ configs: IntakeCallConfig[] }>(
    isOpen ? '/api/coach/intake-configs' : null,
    fetcher
  );

  const configs = configsData?.configs?.filter(c => c.isActive) || [];
  const selectedConfig = configs.find(c => c.id === selectedConfigId);

  // User timezone
  const userTimezone = useMemo(() => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, []);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('type');
      setError(null);
      setSelectedConfigId('');
      setProspectName('');
      setProspectEmail('');
      setProspectPhone('');
      setCustomFieldValues({});
      setCurrentMonth(new Date());
      setSelectedDate(null);
      setSelectedSlot(null);
      setSlots([]);
      setBookedEvent(null);
      setShowConfigEditor(false);
      isInitialMount.current = true;
      const timer = setTimeout(() => {
        isInitialMount.current = false;
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Fetch slots when date is selected
  useEffect(() => {
    if (!selectedDate || !selectedConfigId) return;

    const fetchSlots = async () => {
      setIsLoadingSlots(true);
      setError(null);

      try {
        const startDate = new Date(selectedDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(selectedDate);
        endDate.setHours(23, 59, 59, 999);

        const response = await fetch(
          `/api/funnel/scheduling/slots?intakeConfigId=${selectedConfigId}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
        );

        if (!response.ok) {
          throw new Error('Failed to load available times');
        }

        const data = await response.json();
        setSlots(data.slots || []);
      } catch (err) {
        console.error('Error fetching slots:', err);
        setError('Failed to load available times');
      } finally {
        setIsLoadingSlots(false);
      }
    };

    fetchSlots();
  }, [selectedDate, selectedConfigId]);

  // Animation variants
  const fadeVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  // Step validation
  const validateStep = (currentStep: WizardStep): boolean => {
    setError(null);

    if (currentStep === 'type') {
      if (!selectedConfigId) {
        setError('Please select a call type');
        return false;
      }
      return true;
    }

    if (currentStep === 'details') {
      if (!prospectName.trim()) {
        setError('Name is required');
        return false;
      }
      if (!prospectEmail.trim()) {
        setError('Email is required');
        return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(prospectEmail)) {
        setError('Please enter a valid email address');
        return false;
      }
      if (selectedConfig?.requirePhone && !prospectPhone.trim()) {
        setError('Phone number is required');
        return false;
      }
      // Check required custom fields
      for (const field of selectedConfig?.customFields || []) {
        if (field.required && !customFieldValues[field.id]?.trim()) {
          setError(`${field.label} is required`);
          return false;
        }
      }
      return true;
    }

    if (currentStep === 'time') {
      if (!selectedSlot) {
        setError('Please select a time slot');
        return false;
      }
      return true;
    }

    return true;
  };

  // Navigate steps
  const goToNextStep = () => {
    if (!validateStep(step)) return;

    if (step === 'type') setStep('details');
    else if (step === 'details') setStep('time');
    else if (step === 'time') handleSubmit();
  };

  const goToPrevStep = () => {
    setError(null);
    if (step === 'details') setStep('type');
    else if (step === 'time') setStep('details');
  };

  // Get step index for progress dots
  const getStepIndex = () => {
    const steps: WizardStep[] = ['type', 'details', 'time'];
    return steps.indexOf(step);
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateStep('time')) return;
    if (!selectedSlot || !selectedConfig) return;
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/coach/intake-calls/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intakeConfigId: selectedConfigId,
          prospectName: prospectName.trim(),
          prospectEmail: prospectEmail.trim().toLowerCase(),
          prospectPhone: prospectPhone.trim() || undefined,
          customFields: customFieldValues,
          startDateTime: selectedSlot.start,
          endDateTime: selectedSlot.end,
          timezone: userTimezone,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to book call');
      }

      const data = await response.json();
      setBookedEvent(data.event);
      setStep('success');

      if (onSuccess) {
        onSuccess(data.event);
      }
    } catch (err) {
      console.error('Error booking call:', err);
      setError(err instanceof Error ? err.message : 'Failed to book call');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle config creation
  const handleConfigSaved = (config: IntakeCallConfig) => {
    mutateConfigs();
    setSelectedConfigId(config.id);
    setShowConfigEditor(false);
  };

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
    return date < today;
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: userTimezone,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Wizard content
  const wizardContent = (
    <div className="flex flex-col h-full max-h-[85vh]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
        <div className="flex items-center gap-3">
          {step !== 'type' && step !== 'success' && (
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
              {step === 'type' && 'Schedule Intake Call'}
              {step === 'details' && 'Prospect Details'}
              {step === 'time' && 'Select Time'}
              {step === 'success' && 'Call Scheduled!'}
            </h2>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              {step === 'type' && 'Choose a call type'}
              {step === 'details' && 'Who are you meeting with?'}
              {step === 'time' && selectedConfig && `${selectedConfig.name} · ${selectedConfig.duration} min`}
              {step === 'success' && 'Confirmation sent'}
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
      <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-6">
        {error && (
          <div className="mb-5 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="text-red-600 dark:text-red-400 text-sm font-albert">{error}</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* Step 1: Type Selection */}
          {step === 'type' && (
            <motion.div
              key="type"
              variants={fadeVariants}
              initial={isInitialMount.current ? false : 'initial'}
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="space-y-3"
            >
              {configs.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 mx-auto text-[#a7a39e] dark:text-[#7d8190] mb-4" />
                  <h3 className="text-lg font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                    No intake call types yet
                  </h3>
                  <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mb-4">
                    Create your first intake call type to get started
                  </p>
                  <button
                    onClick={() => setShowConfigEditor(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-brand-accent text-white rounded-xl font-albert font-medium text-sm hover:bg-brand-accent/90 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create Intake Type
                  </button>
                </div>
              ) : (
                <>
                  {configs.map((config) => (
                    <button
                      key={config.id}
                      onClick={() => setSelectedConfigId(config.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                        selectedConfigId === config.id
                          ? 'border-brand-accent bg-brand-accent/5'
                          : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] hover:border-brand-accent/50'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
                            {config.name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {config.duration} min
                          </span>
                          <span className="flex items-center gap-1">
                            <Video className="w-3.5 h-3.5" />
                            {PROVIDER_LABELS[config.meetingProvider]}
                          </span>
                        </div>
                        {config.description && (
                          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mt-2 line-clamp-1">
                            {config.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            selectedConfigId === config.id
                              ? 'border-brand-accent bg-brand-accent'
                              : 'border-[#d1ccc6] dark:border-[#3a4150]'
                          }`}
                        >
                          {selectedConfigId === config.id && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <IntakeConfigActions
                          config={config}
                          size="sm"
                          onUpdate={() => mutateConfigs()}
                          onDelete={() => {
                            mutateConfigs();
                            if (selectedConfigId === config.id) {
                              setSelectedConfigId('');
                            }
                          }}
                        />
                      </div>
                    </button>
                  ))}

                  <button
                    onClick={() => setShowConfigEditor(true)}
                    className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-brand-accent hover:border-brand-accent hover:bg-brand-accent/5 transition-colors font-albert font-medium text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Create new type
                  </button>
                </>
              )}
            </motion.div>
          )}

          {/* Step 2: Prospect Details */}
          {step === 'details' && (
            <motion.div
              key="details"
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="space-y-5"
            >
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={prospectName}
                  onChange={(e) => setProspectName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] focus:outline-none focus:ring-2 focus:ring-brand-accent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={prospectEmail}
                  onChange={(e) => setProspectEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] focus:outline-none focus:ring-2 focus:ring-brand-accent"
                />
              </div>

              {(selectedConfig?.requirePhone || true) && (
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                    Phone {selectedConfig?.requirePhone && <span className="text-red-500">*</span>}
                    {!selectedConfig?.requirePhone && <span className="text-[#5f5a55] dark:text-[#b2b6c2] font-normal">(optional)</span>}
                  </label>
                  <input
                    type="tel"
                    value={prospectPhone}
                    onChange={(e) => setProspectPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] focus:outline-none focus:ring-2 focus:ring-brand-accent"
                  />
                </div>
              )}

              {/* Custom fields from config */}
              {selectedConfig?.customFields?.map((field) => (
                <div key={field.id}>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      value={customFieldValues[field.id] || ''}
                      onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                      placeholder={field.placeholder}
                      rows={3}
                      className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] focus:outline-none focus:ring-2 focus:ring-brand-accent resize-none"
                    />
                  ) : field.type === 'select' ? (
                    <select
                      value={customFieldValues[field.id] || ''}
                      onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                      className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent"
                    >
                      <option value="">Select...</option>
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                      value={customFieldValues[field.id] || ''}
                      onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] focus:outline-none focus:ring-2 focus:ring-brand-accent"
                    />
                  )}
                </div>
              ))}
            </motion.div>
          )}

          {/* Step 3: Time Selection */}
          {step === 'time' && (
            <motion.div
              key="time"
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="space-y-5"
            >
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

                    return (
                      <button
                        key={date.toISOString()}
                        onClick={() => !isDisabled && setSelectedDate(date)}
                        disabled={isDisabled}
                        className={`h-10 rounded-lg text-sm font-albert font-medium transition-colors ${
                          isDisabled
                            ? 'text-[#ccc8c3] dark:text-[#4a4f5b] cursor-not-allowed'
                            : isSelected
                            ? 'bg-brand-accent text-white'
                            : isToday
                            ? 'bg-brand-accent/10 text-brand-accent hover:bg-brand-accent/20'
                            : 'text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#e8e4df] dark:hover:bg-[#262b35]'
                        }`}
                      >
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time slots */}
              {selectedDate && (
                <div>
                  <h4 className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-3">
                    {formatDate(selectedDate)}
                  </h4>

                  {isLoadingSlots ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 text-brand-accent animate-spin" />
                    </div>
                  ) : slots.length === 0 ? (
                    <p className="text-center py-8 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                      No available times on this day
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {slots.map((slot) => {
                        const isSelected = selectedSlot?.start === slot.start;
                        return (
                          <button
                            key={slot.start}
                            onClick={() => setSelectedSlot(slot)}
                            className={`px-3 py-2.5 rounded-xl text-sm font-albert font-medium transition-colors ${
                              isSelected
                                ? 'bg-brand-accent text-white'
                                : 'bg-white dark:bg-[#1d222b] border border-[#e1ddd8] dark:border-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] hover:border-brand-accent'
                            }`}
                          >
                            {formatTime(slot.start)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Success State */}
          {step === 'success' && bookedEvent && (
            <motion.div
              key="success"
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="text-center py-6"
            >
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>

              <h3 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                {bookedEvent.title}
              </h3>
              <p className="text-[#5f5a55] dark:text-[#b2b6c2] mb-6">
                with {prospectName}
              </p>

              <div className="inline-flex items-center gap-3 px-4 py-3 bg-[#f9f7f5] dark:bg-[#1c2028] rounded-xl text-sm mb-6">
                <Calendar className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                <span className="text-[#1a1a1a] dark:text-[#f5f5f8]">
                  {new Date(bookedEvent.startDateTime).toLocaleString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZone: userTimezone,
                  })}
                </span>
              </div>

              <div className="space-y-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                <div className="flex items-center justify-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>Calendar invite sent to {prospectEmail}</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>Added to your calendar</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      {step !== 'success' && (
        <div className="px-6 py-4 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50">
          <div className="flex items-center justify-between">
            {/* Progress dots */}
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

            {/* Action button */}
            <button
              type="button"
              onClick={goToNextStep}
              disabled={isSubmitting || (step === 'type' && !selectedConfigId) || (step === 'time' && !selectedSlot)}
              className="flex items-center gap-2 px-6 py-2.5 bg-brand-accent text-white rounded-xl font-medium font-albert hover:bg-brand-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {step === 'time' ? (isSubmitting ? 'Booking...' : 'Book Call') : 'Continue'}
              {step !== 'time' && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Success footer */}
      {step === 'success' && (
        <div className="px-6 py-4 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50">
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => {
                setStep('type');
                setSelectedConfigId('');
                setProspectName('');
                setProspectEmail('');
                setProspectPhone('');
                setCustomFieldValues({});
                setSelectedDate(null);
                setSelectedSlot(null);
                setBookedEvent(null);
              }}
              className="px-4 py-2.5 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] font-albert font-medium transition-colors"
            >
              Schedule Another
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-brand-accent text-white rounded-xl font-medium font-albert hover:bg-brand-accent/90 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Render mobile drawer or desktop dialog
  if (isMobile) {
    return (
      <>
        <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
          <DrawerContent className="h-[90vh] max-h-[90vh] flex flex-col">
            {wizardContent}
          </DrawerContent>
        </Drawer>

        <IntakeConfigWizard
          isOpen={showConfigEditor}
          onClose={() => setShowConfigEditor(false)}
          onSuccess={handleConfigSaved}
        />
      </>
    );
  }

  return (
    <>
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[10000]" onClose={onClose}>
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
                <Dialog.Panel className="w-full max-w-lg max-h-[85vh] transform rounded-2xl bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] shadow-2xl shadow-black/10 dark:shadow-black/30 transition-all flex flex-col overflow-hidden">
                  {wizardContent}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <IntakeConfigWizard
        isOpen={showConfigEditor}
        onClose={() => setShowConfigEditor(false)}
        onSuccess={handleConfigSaved}
      />
    </>
  );
}
