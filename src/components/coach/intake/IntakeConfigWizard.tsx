'use client';

import React, { useState, useEffect, Fragment, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft, ArrowRight, Loader2, Check } from 'lucide-react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { MeetingProviderSelector, MeetingProviderType } from '@/components/scheduling/MeetingProviderSelector';
import type { IntakeCallConfig, IntakeCallMeetingProvider } from '@/types';

interface IntakeConfigWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (config: IntakeCallConfig) => void;
  existingConfig?: IntakeCallConfig; // for edit mode
}

type WizardStep = 'basics' | 'settings' | 'options';

const DURATION_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' },
];

export function IntakeConfigWizard({
  isOpen,
  onClose,
  onSuccess,
  existingConfig,
}: IntakeConfigWizardProps) {
  const isEditing = !!existingConfig;
  const [step, setStep] = useState<WizardStep>('basics');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mobile detection
  const isMobile = useMediaQuery('(max-width: 768px)');

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

  // Step 1: Basics
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Step 2: Settings
  const [duration, setDuration] = useState(30);
  const [meetingProvider, setMeetingProvider] = useState<MeetingProviderType>('zoom');
  const [manualMeetingUrl, setManualMeetingUrl] = useState('');
  const [requirePhone, setRequirePhone] = useState(false);

  // Step 3: Options
  const [allowReschedule, setAllowReschedule] = useState(true);
  const [allowCancellation, setAllowCancellation] = useState(true);
  const [cancelDeadlineHours, setCancelDeadlineHours] = useState(24);
  const [confirmationMessage, setConfirmationMessage] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('basics');
      setError(null);

      if (existingConfig) {
        // Edit mode - populate from existing config
        setName(existingConfig.name);
        setDescription(existingConfig.description || '');
        setDuration(existingConfig.duration);
        setMeetingProvider(existingConfig.meetingProvider as MeetingProviderType);
        setManualMeetingUrl(existingConfig.manualMeetingUrl || '');
        setRequirePhone(existingConfig.requirePhone || false);
        setAllowReschedule(existingConfig.allowReschedule ?? true);
        setAllowCancellation(existingConfig.allowCancellation ?? true);
        setCancelDeadlineHours(existingConfig.cancelDeadlineHours || 24);
        setConfirmationMessage(existingConfig.confirmationMessage || '');
      } else {
        // Create mode - reset to defaults
        setName('');
        setDescription('');
        setDuration(30);
        setMeetingProvider('zoom');
        setManualMeetingUrl('');
        setRequirePhone(false);
        setAllowReschedule(true);
        setAllowCancellation(true);
        setCancelDeadlineHours(24);
        setConfirmationMessage('');
      }
    }
  }, [isOpen, existingConfig]);


  // Animation variants
  const fadeVariants = {
    initial: { opacity: 0, scale: 0.98 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
  };

  // Step validation
  const validateStep = (currentStep: WizardStep): boolean => {
    setError(null);

    if (currentStep === 'basics') {
      if (!name.trim()) {
        setError('Please enter a name for this call type');
        return false;
      }
      return true;
    }

    if (currentStep === 'settings') {
      if (meetingProvider === 'manual' && !manualMeetingUrl.trim()) {
        setError('Please enter a meeting URL');
        return false;
      }
      return true;
    }

    return true;
  };

  // Navigate steps
  const goToNextStep = () => {
    if (!validateStep(step)) return;

    if (step === 'basics') setStep('settings');
    else if (step === 'settings') setStep('options');
  };

  const goToPrevStep = () => {
    setError(null);
    if (step === 'settings') setStep('basics');
    else if (step === 'options') setStep('settings');
  };

  // Get step index for progress dots
  const getStepIndex = () => {
    const steps: WizardStep[] = ['basics', 'settings', 'options'];
    return steps.indexOf(step);
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateStep('options')) return;
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      // Map MeetingProviderType to IntakeCallMeetingProvider
      let intakeMeetingProvider: IntakeCallMeetingProvider = 'zoom';
      if (meetingProvider === 'google_meet') {
        intakeMeetingProvider = 'google_meet';
      } else if (meetingProvider === 'manual') {
        intakeMeetingProvider = 'manual';
      } else if (meetingProvider === 'in_app') {
        intakeMeetingProvider = 'in_app';
      }

      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        duration,
        meetingProvider: intakeMeetingProvider,
        manualMeetingUrl: meetingProvider === 'manual' ? manualMeetingUrl : undefined,
        requirePhone,
        allowReschedule,
        allowCancellation,
        cancelDeadlineHours,
        confirmationMessage: confirmationMessage.trim() || undefined,
      };

      const url = isEditing
        ? `/api/coach/intake-configs/${existingConfig.id}`
        : '/api/coach/intake-configs';
      const method = isEditing ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      const { config } = await response.json();
      onSuccess?.(config);
      onClose();
    } catch (err) {
      console.error('Error saving intake config:', err);
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Wizard content (shared between Dialog and Drawer)
  const wizardContent = (
    <div className="flex flex-col h-full max-h-[85vh]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
        <div className="flex items-center gap-3">
          {step !== 'basics' && (
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
              {isEditing ? 'Edit Intake Type' : 'Create Intake Type'}
            </h2>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              {step === 'basics' && 'Set up your call type'}
              {step === 'settings' && 'Configure duration and meeting'}
              {step === 'options' && 'Set booking preferences'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="hidden sm:block p-2 rounded-xl text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
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
          {/* Step 1: Basics */}
          {step === 'basics' && (
            <motion.div
              key="basics"
              variants={fadeVariants}
              initial={isInitialMount.current ? false : 'initial'}
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="space-y-5"
            >
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Discovery Call"
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
                  placeholder="What will you discuss during this call?"
                  rows={3}
                  className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] focus:outline-none focus:ring-2 focus:ring-brand-accent resize-none"
                />
              </div>
            </motion.div>
          )}

          {/* Step 2: Settings */}
          {step === 'settings' && (
            <motion.div
              key="settings"
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="space-y-6"
            >
              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-3">
                  Duration
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {DURATION_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setDuration(option.value)}
                      className={`relative px-4 py-3 rounded-xl border-2 transition-colors text-center ${
                        duration === option.value
                          ? 'border-brand-accent bg-brand-accent/5'
                          : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] hover:border-brand-accent/50'
                      }`}
                    >
                      <span className={`text-sm font-medium ${
                        duration === option.value
                          ? 'text-brand-accent'
                          : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                      }`}>
                        {option.label}
                      </span>
                      {duration === option.value && (
                        <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-brand-accent flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Meeting Provider */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-3">
                  Meeting Provider
                </label>
                <MeetingProviderSelector
                  value={meetingProvider}
                  onChange={setMeetingProvider}
                  manualLink={manualMeetingUrl}
                  onManualLinkChange={setManualMeetingUrl}
                  allowInApp={true}
                />
              </div>

            </motion.div>
          )}

          {/* Step 3: Options */}
          {step === 'options' && (
            <motion.div
              key="options"
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="space-y-4"
            >
              {/* Option Cards - Single Container */}
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mb-1">
                Name and email are always required
              </p>
              <div className="border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden divide-y divide-[#e1ddd8] dark:divide-[#262b35]">
                {/* Require Phone */}
                <button
                  type="button"
                  onClick={() => setRequirePhone(!requirePhone)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#1d222b] hover:bg-[#f9f7f5] dark:hover:bg-[#262b35] transition-colors text-left"
                >
                  <svg className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="flex-1 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                    Require phone number
                  </span>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    requirePhone
                      ? 'border-brand-accent bg-brand-accent'
                      : 'border-[#d1ccc6] dark:border-[#3a4150] bg-white dark:bg-[#1d222b]'
                  }`}>
                    {requirePhone && <Check className="w-3 h-3 text-white" />}
                  </div>
                </button>

                {/* Allow Reschedule */}
                <button
                  type="button"
                  onClick={() => setAllowReschedule(!allowReschedule)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#1d222b] hover:bg-[#f9f7f5] dark:hover:bg-[#262b35] transition-colors text-left"
                >
                  <svg className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="flex-1 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                    Allow rescheduling
                  </span>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    allowReschedule
                      ? 'border-brand-accent bg-brand-accent'
                      : 'border-[#d1ccc6] dark:border-[#3a4150] bg-white dark:bg-[#1d222b]'
                  }`}>
                    {allowReschedule && <Check className="w-3 h-3 text-white" />}
                  </div>
                </button>

                {/* Allow Cancellation */}
                <button
                  type="button"
                  onClick={() => setAllowCancellation(!allowCancellation)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#1d222b] hover:bg-[#f9f7f5] dark:hover:bg-[#262b35] transition-colors text-left"
                >
                  <svg className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="flex-1 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                    Allow cancellation
                  </span>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    allowCancellation
                      ? 'border-brand-accent bg-brand-accent'
                      : 'border-[#d1ccc6] dark:border-[#3a4150] bg-white dark:bg-[#1d222b]'
                  }`}>
                    {allowCancellation && <Check className="w-3 h-3 text-white" />}
                  </div>
                </button>
              </div>

              {/* Deadline - only show if reschedule or cancel enabled */}
              {(allowReschedule || allowCancellation) && (
                <div className="pt-2">
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                    Allow changes until
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={cancelDeadlineHours}
                      onChange={(e) => setCancelDeadlineHours(Math.max(1, parseInt(e.target.value) || 1))}
                      min={1}
                      max={168}
                      className="w-16 px-3 py-2.5 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-center focus:outline-none focus:ring-2 focus:ring-brand-accent"
                    />
                    <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                      hours before
                    </span>
                  </div>
                </div>
              )}

              {/* Confirmation Message */}
              <div className="pt-2">
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                  Confirmation message <span className="text-[#5f5a55] dark:text-[#b2b6c2] font-normal">(optional)</span>
                </label>
                <textarea
                  value={confirmationMessage}
                  onChange={(e) => setConfirmationMessage(e.target.value)}
                  placeholder="Looking forward to speaking with you!"
                  rows={3}
                  className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] focus:outline-none focus:ring-2 focus:ring-brand-accent resize-none"
                />
                <p className="mt-1.5 text-xs text-[#8a857f] dark:text-[#7a7f8c]">
                  This message will be included in the confirmation email
                </p>
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
          {step === 'options' ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-brand-accent text-white rounded-xl font-medium font-albert hover:bg-brand-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? 'Creating...' : isEditing ? 'Save Changes' : 'Create Type'}
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
        <DrawerContent className="h-[90vh] max-h-[90vh] flex flex-col">
          {wizardContent}
        </DrawerContent>
      </Drawer>
    );
  }

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
              <Dialog.Panel className="w-full max-w-lg max-h-[85vh] transform rounded-2xl bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] shadow-2xl shadow-black/10 dark:shadow-black/30 transition-all flex flex-col overflow-hidden">
                {wizardContent}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
