'use client';

import React, { useState, Fragment, useCallback, useEffect, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import {
  X,
  ArrowRight,
  ArrowLeft,
  User,
  Users,
  Calendar,
  Layers,
  Globe,
  Lock,
  DollarSign,
  FileEdit,
  Rocket,
  Upload,
  Loader2,
  RefreshCw,
  Clock
} from 'lucide-react';
import {
  Drawer,
  DrawerContent,
} from '@/components/ui/drawer';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Wizard step types
type WizardStep = 'type' | 'structure' | 'details' | 'settings';

// Wizard data collected across steps
interface ProgramWizardData {
  // Step 1
  type: 'individual' | 'group';
  // Step 2
  durationType: 'fixed' | 'evergreen';
  durationWeeks: number;
  numModules: number;
  includeWeekends: boolean;
  // Step 3
  name: string;
  description: string;
  coverImage?: string;
  // Step 4
  visibility: 'public' | 'private';
  pricing: 'free' | 'paid';
  price: number;
  recurring: boolean;
  recurringCadence: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  status: 'active' | 'draft';
}

const DEFAULT_WIZARD_DATA: ProgramWizardData = {
  type: 'individual',
  durationType: 'fixed',
  durationWeeks: 12,
  numModules: 4,
  includeWeekends: false,
  name: '',
  description: '',
  coverImage: undefined,
  visibility: 'private',
  pricing: 'free',
  price: 297,
  recurring: false,
  recurringCadence: 'monthly',
  status: 'draft',
};;

interface NewProgramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateFromScratch: (options?: { numModules?: number }) => void;
  onProgramCreated: (programId: string) => void;
  demoMode?: boolean;
  onDemoCreate?: (program: { name: string; type: 'group' | 'individual'; duration: number }) => void;
}

export function NewProgramModal({
  isOpen,
  onClose,
  onCreateFromScratch,
  onProgramCreated,
  demoMode = false,
  onDemoCreate,
}: NewProgramModalProps) {
  const [step, setStep] = useState<WizardStep>('type');
  const [wizardData, setWizardData] = useState<ProgramWizardData>(DEFAULT_WIZARD_DATA);
  const [isCreating, setIsCreating] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showCloseWarning, setShowCloseWarning] = useState(false);

  const isMobile = useMediaQuery('(max-width: 768px)');
  
  // Track if this is the initial mount to skip animation on first open
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

  // Smooth fade animation variants
  const fadeVariants = {
    initial: {
      opacity: 0,
      scale: 0.98,
    },
    animate: {
      opacity: 1,
      scale: 1,
    },
    exit: {
      opacity: 0,
      scale: 0.98,
    },
  };

  // Reset state when modal opens (not on close, to preserve state during exit animation)
  useEffect(() => {
    if (isOpen) {
      setStep('type');
      setWizardData(DEFAULT_WIZARD_DATA);
      setIsCreating(false);
      setUploadError(null);
      setShowCloseWarning(false);
    }
  }, [isOpen]);

  const handleCloseAttempt = () => {
    // If past step 1, show warning
    if (step !== 'type') {
      setShowCloseWarning(true);
      return;
    }
    handleClose();
  };

  const handleClose = () => {
    // Just close - state reset happens via useEffect when modal reopens
    // This preserves the current step during the exit animation
    onClose();
  };

  const updateWizardData = useCallback((updates: Partial<ProgramWizardData>) => {
    setWizardData(prev => ({ ...prev, ...updates }));
  }, []);

  const goToNextStep = () => {
    const steps: WizardStep[] = ['type', 'structure', 'details', 'settings'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const goToPreviousStep = () => {
    const steps: WizardStep[] = ['type', 'structure', 'details', 'settings'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  const handleCreateProgram = async () => {
    if (demoMode && onDemoCreate) {
      onDemoCreate({
        name: wizardData.name,
        type: wizardData.type,
        duration: wizardData.durationWeeks,
      });
      handleClose();
      return;
    }

    setIsCreating(true);
    try {
      // Create the program via API
      const response = await fetch('/api/coach/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: wizardData.name,
          description: wizardData.description,
          type: wizardData.type,
          durationType: wizardData.durationType,
          durationWeeks: wizardData.durationWeeks,
          numModules: wizardData.numModules,
          includeWeekends: wizardData.includeWeekends,
          coverImage: wizardData.coverImage,
          visibility: wizardData.visibility,
          price: wizardData.pricing === 'paid' ? wizardData.price : 0,
          status: wizardData.status,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create program');
      }

      const data = await response.json();
      handleClose();
      onProgramCreated(data.id);
    } catch (error) {
      console.error('Error creating program:', error);
      // Could show error toast here
    } finally {
      setIsCreating(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'program-cover');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Upload failed');
      }

      const data = await response.json();
      updateWizardData({ coverImage: data.url });
    } catch (error) {
      console.error('Error uploading image:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Get step index for progress indicator
  const getStepIndex = () => {
    const steps: WizardStep[] = ['type', 'structure', 'details', 'settings'];
    return steps.indexOf(step);
  };

  // Validation for each step
  const canProceed = () => {
    switch (step) {
      case 'type':
        return true; // Type is always selected (has default)
      case 'structure':
        return wizardData.durationWeeks >= 1 && wizardData.numModules >= 1;
      case 'details':
        return wizardData.name.trim().length > 0 && wizardData.description.trim().length > 0 && !!wizardData.coverImage;
      case 'settings':
        return wizardData.pricing === 'free' || wizardData.price > 0;
      default:
        return false;
    }
  };

  // Wizard content (shared between Dialog and Drawer)
  const wizardContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
        <div className="flex items-center gap-3">
          {step !== 'type' && (
            <button
              onClick={() => {
                setShowCloseWarning(false);
                goToPreviousStep();
              }}
              className="p-2 rounded-xl text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-[-0.5px]">
              {step === 'type' && 'Create New Program'}
              {step === 'structure' && 'Program Structure'}
              {step === 'details' && 'Program Details'}
              {step === 'settings' && 'Final Settings'}
            </h2>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              {step === 'type' && 'Choose your program type'}
              {step === 'structure' && 'Configure how your program is organized'}
              {step === 'details' && 'Give your program a name and description'}
              {step === 'settings' && 'Set visibility, pricing, and status'}
            </p>
          </div>
        </div>
        <button
          onClick={handleCloseAttempt}
          className="p-2 rounded-xl text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Close Warning */}
      {showCloseWarning && (
        <div className="mx-6 mt-4 p-3 rounded-xl bg-[#faf8f6] dark:bg-[#1d222b] border border-[#e1ddd8] dark:border-[#262b35]">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                Discard progress?
              </p>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mt-0.5">
                Your progress will be lost if you close now.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleClose}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={() => setShowCloseWarning(false)}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-[#e1ddd8] dark:border-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors"
                >
                  Continue Editing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <AnimatePresence mode="wait">
          {step === 'type' && (
            <motion.div
              key="type"
              variants={fadeVariants}
              initial={isInitialMount.current ? false : "initial"}
              animate="animate"
              exit="exit"
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            >
              <TypeStep
                value={wizardData.type}
                onChange={(type) => {
                  updateWizardData({ type });
                  goToNextStep();
                }}
              />
            </motion.div>
          )}

          {step === 'structure' && (
            <motion.div
              key="structure"
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            >
              <StructureStep
                data={wizardData}
                onChange={updateWizardData}
              />
            </motion.div>
          )}

          {step === 'details' && (
            <motion.div
              key="details"
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            >
              <DetailsStep
                data={wizardData}
                onChange={updateWizardData}
                onImageUpload={handleImageUpload}
                uploadingImage={uploadingImage}
                uploadError={uploadError}
              />
            </motion.div>
          )}

          {step === 'settings' && (
            <motion.div
              key="settings"
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            >
              <SettingsStep
                data={wizardData}
                onChange={updateWizardData}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50">
        <div className="flex items-center justify-between">
          {/* Progress Indicator */}
          <div className="flex items-center gap-2">
            {[0, 1, 2, 3].map((i) => (
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
          {step !== 'type' && (
            <button
              onClick={step === 'settings' ? handleCreateProgram : goToNextStep}
              disabled={!canProceed() || isCreating}
              className="flex items-center gap-2 px-6 py-2.5 bg-brand-accent text-white rounded-xl font-medium font-albert hover:bg-brand-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : step === 'settings' ? (
                <>
                  Create Program
                  <Rocket className="w-4 h-4" />
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // Render mobile drawer or desktop dialog
  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DrawerContent className="h-[90vh] max-h-[90vh]">
          {wizardContent}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[100]" onClose={handleClose}>
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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white/95 dark:bg-[#171b22]/95 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl shadow-black/10 dark:shadow-black/30 transition-all">
                {wizardContent}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

// ============================================================================
// STEP 1: Type Selection
// ============================================================================
interface TypeStepProps {
  value: 'individual' | 'group';
  onChange: (type: 'individual' | 'group') => void;
}

function TypeStep({ value, onChange }: TypeStepProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* 1:1 Card */}
      <button
        onClick={() => onChange('individual')}
        className={`group relative flex flex-col items-center text-center p-6 rounded-2xl border-2 transition-colors ${
          value === 'individual'
            ? 'border-brand-accent bg-brand-accent/5'
            : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] hover:border-brand-accent/50'
        }`}
      >
        {/* Icon */}
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors ${
          value === 'individual'
            ? 'bg-brand-accent/20'
            : 'bg-[#f3f1ef] dark:bg-[#262b35] group-hover:bg-brand-accent/10'
        }`}>
          <User className={`w-7 h-7 ${value === 'individual' ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
          1:1 Program
        </h3>

        {/* Description */}
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-3">
          One-on-one coaching with individual clients
        </p>

        {/* Explainer */}
        <p className="text-xs text-[#8c8a87] dark:text-[#8b8f9a] font-albert leading-relaxed">
          Best for personalized coaching, high-touch relationships, and premium offerings
        </p>

        {/* Selection indicator */}
        {value === 'individual' && (
          <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-brand-accent flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </button>

      {/* Group Card */}
      <button
        onClick={() => onChange('group')}
        className={`group relative flex flex-col items-center text-center p-6 rounded-2xl border-2 transition-colors ${
          value === 'group'
            ? 'border-brand-accent bg-brand-accent/5'
            : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] hover:border-brand-accent/50'
        }`}
      >
        {/* Icon */}
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors ${
          value === 'group'
            ? 'bg-brand-accent/20'
            : 'bg-[#f3f1ef] dark:bg-[#262b35] group-hover:bg-brand-accent/10'
        }`}>
          <Users className={`w-7 h-7 ${value === 'group' ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
          Group Program
        </h3>

        {/* Description */}
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-3">
          Lead a cohort of clients together
        </p>

        {/* Explainer */}
        <p className="text-xs text-[#8c8a87] dark:text-[#8b8f9a] font-albert leading-relaxed">
          Best for community-based programs, scalable offerings, and peer accountability
        </p>

        {/* Selection indicator */}
        {value === 'group' && (
          <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-brand-accent flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </button>
    </div>
  );
}

// ============================================================================
// STEP 2: Structure
// ============================================================================
interface StructureStepProps {
  data: ProgramWizardData;
  onChange: (updates: Partial<ProgramWizardData>) => void;
}

function StructureStep({ data, onChange }: StructureStepProps) {
  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* Duration Type - Prominent Toggle */}
      <div className="text-center">
        <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-[#f3f1ef] dark:bg-[#1d222b] border border-[#e1ddd8]/50 dark:border-[#262b35]/50">
          <button
            onClick={() => onChange({ durationType: 'fixed' })}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              data.durationType === 'fixed'
                ? 'bg-white dark:bg-[#262b35] text-brand-accent shadow-sm'
                : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
            }`}
          >
            <Clock className="w-4 h-4" />
            Fixed
          </button>
          <button
            onClick={() => onChange({ durationType: 'evergreen' })}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              data.durationType === 'evergreen'
                ? 'bg-white dark:bg-[#262b35] text-brand-accent shadow-sm'
                : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            Evergreen
          </button>
        </div>
        <p className="mt-2 text-xs text-[#8c8a87] dark:text-[#8b8f9a] font-albert">
          {data.durationType === 'evergreen'
            ? 'Program repeats continuously after completion'
            : 'Program ends after the set duration'}
        </p>
      </div>

      {/* Duration + Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Duration Card */}
        <div className="p-4 rounded-xl bg-[#faf8f6] dark:bg-[#1d222b]/50 border border-[#e1ddd8]/60 dark:border-[#262b35]/60 text-center">
          <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
            {data.durationType === 'evergreen' ? 'Cycle Length' : 'Duration'}
          </label>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => onChange({ durationWeeks: Math.max(1, data.durationWeeks - 1) })}
              disabled={data.durationWeeks <= 1}
              className="w-10 h-10 rounded-xl bg-[#f3f1ef] dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-medium text-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#e8e5e1] dark:hover:bg-[#262b35] transition-colors"
            >
              −
            </button>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tabular-nums">{data.durationWeeks}</span>
              <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">weeks</span>
            </div>
            <button
              onClick={() => onChange({ durationWeeks: Math.min(52, data.durationWeeks + 1) })}
              disabled={data.durationWeeks >= 52}
              className="w-10 h-10 rounded-xl bg-[#f3f1ef] dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-medium text-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#e8e5e1] dark:hover:bg-[#262b35] transition-colors"
            >
              +
            </button>
          </div>
        </div>

        {/* Modules Card */}
        <div className="p-4 rounded-xl bg-[#faf8f6] dark:bg-[#1d222b]/50 border border-[#e1ddd8]/60 dark:border-[#262b35]/60 text-center">
          <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
            Modules
          </label>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => onChange({ numModules: Math.max(1, data.numModules - 1) })}
              disabled={data.numModules <= 1}
              className="w-10 h-10 rounded-xl bg-[#f3f1ef] dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-medium text-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#e8e5e1] dark:hover:bg-[#262b35] transition-colors"
            >
              −
            </button>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tabular-nums">{data.numModules}</span>
              <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">modules</span>
            </div>
            <button
              onClick={() => onChange({ numModules: Math.min(12, data.numModules + 1) })}
              disabled={data.numModules >= 12}
              className="w-10 h-10 rounded-xl bg-[#f3f1ef] dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-medium text-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#e8e5e1] dark:hover:bg-[#262b35] transition-colors"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Weeks per module calculation */}
      <p className="text-center text-xs text-[#8c8a87] dark:text-[#8b8f9a] font-albert">
        {Math.round(data.durationWeeks / data.numModules * 10) / 10} weeks per module
      </p>

      {/* Weekends Toggle */}
      <div className="flex items-center justify-center gap-8 p-4 rounded-2xl bg-transparent md:bg-[#faf8f6] dark:bg-transparent dark:md:bg-[#1d222b]/50">
        <div className="text-center">
          <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Include Weekends
          </label>
          <p className="text-xs text-[#8c8a87] dark:text-[#8b8f9a] font-albert mt-0.5">
            {data.includeWeekends ? '7 days per week' : '5 days per week (Mon-Fri)'}
          </p>
        </div>
        <Switch
          checked={data.includeWeekends}
          onCheckedChange={(checked) => onChange({ includeWeekends: checked })}
        />
      </div>
    </div>
  );
}

// ============================================================================
// STEP 3: Details
// ============================================================================
interface DetailsStepProps {
  data: ProgramWizardData;
  onChange: (updates: Partial<ProgramWizardData>) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadingImage: boolean;
  uploadError: string | null;
}

function DetailsStep({ data, onChange, onImageUpload, uploadingImage, uploadError }: DetailsStepProps) {
  return (
    <div className="space-y-5">
      {/* Program Name */}
      <div>
        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
          Program Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder='e.g., "90-Day Transformation"'
          className="w-full px-4 py-3 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#8c8c8c] dark:placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-colors"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
          Description <span className="text-red-500">*</span>
        </label>
        <textarea
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Describe what clients will achieve in this program..."
          rows={4}
          className="w-full px-4 py-3 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#8c8c8c] dark:placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-colors resize-none"
        />
      </div>

      {/* Cover Image */}
      <div>
        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
          Cover Image <span className="text-red-500">*</span>
        </label>

        {data.coverImage ? (
          <div className="relative rounded-xl overflow-hidden border border-[#e1ddd8] dark:border-[#262b35]">
            <img
              src={data.coverImage}
              alt="Cover preview"
              className="w-full h-40 object-cover"
            />
            <button
              onClick={() => onChange({ coverImage: undefined })}
              className="absolute top-2 right-2 p-2 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-40 rounded-xl border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] bg-[#faf8f6] dark:bg-[#1d222b] cursor-pointer hover:border-brand-accent/50 transition-colors">
            <input
              type="file"
              accept="image/*"
              onChange={onImageUpload}
              className="hidden"
            />
            {uploadingImage ? (
              <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
            ) : (
              <>
                <div className="w-12 h-12 rounded-xl bg-brand-accent/10 flex items-center justify-center mb-3">
                  <Upload className="w-6 h-6 text-brand-accent" />
                </div>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  Drop image here or click to upload
                </p>
              </>
            )}
          </label>
        )}

        {uploadError && (
          <p className="text-sm text-red-500 dark:text-red-400 mt-2 font-albert">
            {uploadError}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// STEP 4: Settings
// ============================================================================
interface SettingsStepProps {
  data: ProgramWizardData;
  onChange: (updates: Partial<ProgramWizardData>) => void;
}

function SettingsStep({ data, onChange }: SettingsStepProps) {
  const isEvergreen = data.durationType === 'evergreen';
  
  return (
    <div className="space-y-6">
      {/* Visibility */}
      <div>
        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
          Visibility
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onChange({ visibility: 'public' })}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
              data.visibility === 'public'
                ? 'border-brand-accent bg-brand-accent/5'
                : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
            }`}
          >
            <Globe className={`w-5 h-5 ${data.visibility === 'public' ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
            <span className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">Public</span>
          </button>
          <button
            onClick={() => onChange({ visibility: 'private' })}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
              data.visibility === 'private'
                ? 'border-brand-accent bg-brand-accent/5'
                : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
            }`}
          >
            <Lock className={`w-5 h-5 ${data.visibility === 'private' ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
            <span className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">Private</span>
          </button>
        </div>
      </div>

      {/* Pricing */}
      <div>
        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
          Pricing
        </label>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <button
            onClick={() => onChange({ pricing: 'free' })}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
              data.pricing === 'free'
                ? 'border-brand-accent bg-brand-accent/5'
                : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
            }`}
          >
            <span className={`text-lg font-semibold ${data.pricing === 'free' ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`}>Free</span>
          </button>
          <button
            onClick={() => onChange({ pricing: 'paid' })}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
              data.pricing === 'paid'
                ? 'border-brand-accent bg-brand-accent/5'
                : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
            }`}
          >
            <DollarSign className={`w-5 h-5 ${data.pricing === 'paid' ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
            <span className={`font-semibold ${data.pricing === 'paid' ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`}>Paid</span>
          </button>
        </div>

        {/* Price Input */}
        {data.pricing === 'paid' && (
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5f5a55] dark:text-[#b2b6c2] font-albert">$</span>
            <input
              type="number"
              value={data.price}
              onChange={(e) => onChange({ price: Math.max(0, parseInt(e.target.value) || 0) })}
              className="w-full pl-8 pr-4 py-3 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-colors"
            />
          </div>
        )}
      </div>

      {/* Status */}
      <div>
        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
          Status
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onChange({ status: 'active' })}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
              data.status === 'active'
                ? 'border-brand-accent bg-brand-accent/5'
                : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
            }`}
          >
            <Rocket className={`w-5 h-5 ${data.status === 'active' ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
            <span className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">Active</span>
          </button>
          <button
            onClick={() => onChange({ status: 'draft' })}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
              data.status === 'draft'
                ? 'border-brand-accent bg-brand-accent/5'
                : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
            }`}
          >
            <FileEdit className={`w-5 h-5 ${data.status === 'draft' ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
            <span className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">Draft</span>
          </button>
        </div>
      </div>
    </div>
  );
}
