'use client';

import React, { useState, Fragment, useCallback, useEffect, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ArrowRight,
  ArrowLeft,
  Globe,
  Lock,
  DollarSign,
  Loader2,
  Rocket,
  Users,
  Clock,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  Drawer,
  DrawerContent,
} from '@/components/ui/drawer';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MediaUpload } from '@/components/admin/MediaUpload';
import { useStripeConnectStatus } from '@/hooks/useStripeConnectStatus';
import type { FirebaseUser, SquadVisibility } from '@/types';

// Wizard step types
type WizardStep = 'info' | 'details' | 'pricing';

// Wizard data collected across steps
interface SquadWizardData {
  // Step 1: Basic Info
  name: string;
  description: string;
  avatarUrl: string;
  // Step 2: Details
  timezone: string;
  coachId: string;
  capacity: string;
  // Step 3: Pricing & Visibility
  visibility: SquadVisibility;
  pricing: 'free' | 'paid';
  priceInCents: number;
  subscriptionEnabled: boolean;
  billingInterval: 'monthly' | 'quarterly' | 'yearly';
}

const DEFAULT_WIZARD_DATA: SquadWizardData = {
  name: '',
  description: '',
  avatarUrl: '',
  timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC',
  coachId: '',
  capacity: '',
  visibility: 'public',
  pricing: 'free',
  priceInCents: 0,
  subscriptionEnabled: false,
  billingInterval: 'monthly',
};

// Popular timezones for quick selection
const POPULAR_TIMEZONES = [
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
];

interface CreateSquadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSquadCreated: () => void;
  /** API base path for squad operations (default: /api/admin/squads) */
  apiBasePath?: string;
  /** API endpoint for fetching coaches */
  coachesApiEndpoint?: string;
  /** Custom upload endpoint URL for squad images */
  uploadEndpoint?: string;
  /** Demo mode - skip API calls and use onDemoCreate instead */
  demoMode?: boolean;
  /** Called in demo mode instead of making API calls */
  onDemoCreate?: (data: SquadWizardData) => void;
}

export function CreateSquadModal({
  isOpen,
  onClose,
  onSquadCreated,
  apiBasePath = '/api/admin/squads',
  coachesApiEndpoint = '/api/admin/coaches',
  uploadEndpoint = '/api/admin/upload-media',
  demoMode = false,
  onDemoCreate,
}: CreateSquadModalProps) {
  const [step, setStep] = useState<WizardStep>('info');
  const [wizardData, setWizardData] = useState<SquadWizardData>(DEFAULT_WIZARD_DATA);
  const [isCreating, setIsCreating] = useState(false);
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [coaches, setCoaches] = useState<FirebaseUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Stripe Connect status for payment guards
  const { isConnected: stripeConnected, isLoading: stripeLoading } = useStripeConnectStatus();

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

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('info');
      setWizardData({
        ...DEFAULT_WIZARD_DATA,
        timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC',
      });
      setIsCreating(false);
      setShowCloseWarning(false);
      setError(null);
    }
  }, [isOpen]);

  // Fetch coaches
  useEffect(() => {
    const fetchCoaches = async () => {
      try {
        const response = await fetch(coachesApiEndpoint);
        if (response.ok) {
          const data = await response.json();
          setCoaches(data.coaches || []);
        }
      } catch (err) {
        console.error('Error fetching coaches:', err);
      }
    };
    if (isOpen) {
      fetchCoaches();
    }
  }, [coachesApiEndpoint, isOpen]);

  const handleCloseAttempt = () => {
    // Past step 1 with data entered, show warning
    if (step !== 'info' || wizardData.name || wizardData.avatarUrl) {
      setShowCloseWarning(true);
      return;
    }
    handleClose();
  };

  const handleClose = () => {
    onClose();
  };

  const updateWizardData = useCallback((updates: Partial<SquadWizardData>) => {
    setWizardData(prev => ({ ...prev, ...updates }));
  }, []);

  const goToNextStep = () => {
    const steps: WizardStep[] = ['info', 'details', 'pricing'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const goToPreviousStep = () => {
    const steps: WizardStep[] = ['info', 'details', 'pricing'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  const handleCreateSquad = async () => {
    if (demoMode && onDemoCreate) {
      onDemoCreate(wizardData);
      handleClose();
      onSquadCreated();
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch(apiBasePath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: wizardData.name.trim(),
          description: wizardData.description.trim() || undefined,
          avatarUrl: wizardData.avatarUrl.trim() || undefined,
          visibility: wizardData.visibility,
          timezone: wizardData.timezone,
          coachId: wizardData.coachId || null,
          capacity: wizardData.capacity ? parseInt(wizardData.capacity) : undefined,
          priceInCents: wizardData.pricing === 'paid' ? wizardData.priceInCents : 0,
          currency: 'usd',
          subscriptionEnabled: wizardData.subscriptionEnabled && wizardData.pricing === 'paid' && wizardData.priceInCents > 0,
          billingInterval: wizardData.subscriptionEnabled ? wizardData.billingInterval : undefined,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to create squad';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      const savedSquadId = responseData.squad?.id || responseData.id;

      // If subscription is enabled, create the Stripe price
      if (wizardData.subscriptionEnabled && wizardData.pricing === 'paid' && wizardData.priceInCents > 0 && savedSquadId && stripeConnected) {
        try {
          const subscriptionResponse = await fetch(`/api/coach/squads/${savedSquadId}/subscription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              priceInCents: wizardData.priceInCents,
              billingInterval: wizardData.billingInterval,
            }),
          });

          if (!subscriptionResponse.ok) {
            console.warn('Subscription pricing configuration failed, but squad was created');
          }
        } catch (subErr) {
          console.error('Error configuring subscription:', subErr);
        }
      }

      handleClose();
      onSquadCreated();
    } catch (err) {
      console.error('Error creating squad:', err);
      setError(err instanceof Error ? err.message : 'Failed to create squad');
    } finally {
      setIsCreating(false);
    }
  };

  // Get step index for progress indicator
  const getStepIndex = () => {
    const steps: WizardStep[] = ['info', 'details', 'pricing'];
    return steps.indexOf(step);
  };

  // Validation for each step
  const canProceed = () => {
    switch (step) {
      case 'info':
        return wizardData.name.trim().length > 0 && wizardData.avatarUrl.trim().length > 0 && wizardData.description.trim().length > 0;
      case 'details':
        return wizardData.timezone.length > 0;
      case 'pricing':
        return wizardData.pricing === 'free' || wizardData.priceInCents > 0;
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
          {step !== 'info' && (
            <button
              type="button"
              onClick={() => {
                setShowCloseWarning(false);
                goToPreviousStep();
              }}
              className="p-2 rounded-xl text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-[-0.5px]">
              {step === 'info' && 'Create New Squad'}
              {step === 'details' && 'Squad Details'}
              {step === 'pricing' && 'Pricing & Visibility'}
            </h2>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              {step === 'info' && 'Add your squad\'s basic information'}
              {step === 'details' && 'Configure timezone, coach, and capacity'}
              {step === 'pricing' && 'Set pricing and visibility options'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleCloseAttempt}
          className="p-2 rounded-xl text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Close Warning */}
      {showCloseWarning && (
        <div className="mx-6 mt-4 p-3 rounded-xl bg-[#faf8f6] dark:bg-[#1d222b] border border-[#e1ddd8] dark:border-[#262b35]">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                Discard progress?
              </p>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mt-0.5">
                Your progress will be lost if you close now.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors cursor-pointer"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={() => setShowCloseWarning(false)}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-[#e1ddd8] dark:border-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors cursor-pointer"
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
          {step === 'info' && (
            <motion.div
              key="info"
              variants={fadeVariants}
              initial={isInitialMount.current ? false : "initial"}
              animate="animate"
              exit="exit"
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            >
              <InfoStep
                data={wizardData}
                onChange={updateWizardData}
                uploadEndpoint={uploadEndpoint}
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
                coaches={coaches}
              />
            </motion.div>
          )}

          {step === 'pricing' && (
            <motion.div
              key="pricing"
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            >
              <PricingStep
                data={wizardData}
                onChange={updateWizardData}
                stripeConnected={stripeConnected}
                stripeLoading={stripeLoading}
                error={error}
              />
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

          {/* Action Buttons */}
          <button
            type="button"
            onClick={step === 'pricing' ? handleCreateSquad : goToNextStep}
            disabled={!canProceed() || isCreating}
            className="flex items-center gap-2 px-6 py-2.5 bg-brand-accent text-white rounded-xl font-medium font-albert hover:bg-brand-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : step === 'pricing' ? (
              <>
                Create Squad
                <Rocket className="w-4 h-4" />
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
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
      <Dialog as="div" className="relative z-[100]" onClose={handleCloseAttempt}>
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
              <Dialog.Panel className="w-full max-w-xl transform overflow-hidden rounded-2xl bg-white/95 dark:bg-[#171b22]/95 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl shadow-black/10 dark:shadow-black/30 transition-all max-h-[85vh] flex flex-col">
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
// STEP 1: Basic Info
// ============================================================================
interface InfoStepProps {
  data: SquadWizardData;
  onChange: (updates: Partial<SquadWizardData>) => void;
  uploadEndpoint: string;
}

function InfoStep({ data, onChange, uploadEndpoint }: InfoStepProps) {
  return (
    <div className="space-y-4">
      {/* Squad Name */}
      <div>
        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
          Squad Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder='e.g., "Wellness Warriors"'
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
          onChange={(e) => onChange({ description: e.target.value.slice(0, 200) })}
          placeholder="What's this squad about?"
          rows={2}
          maxLength={200}
          className="w-full px-4 py-3 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#8c8c8c] dark:placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-colors resize-none"
        />
        <p className="text-xs text-[#8c8a87] dark:text-[#8b8f9a] font-albert mt-1">
          {data.description.length}/200 characters
        </p>
      </div>

      {/* Cover Image - 16:9 */}
      <div>
        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
          Cover Image <span className="text-red-500">*</span>
        </label>
        <MediaUpload
          value={data.avatarUrl}
          onChange={(url) => onChange({ avatarUrl: url })}
          folder="squads"
          type="image"
          uploadEndpoint={uploadEndpoint}
          hideLabel
          aspectRatio="16:9"
        />
        <p className="text-xs text-[#8c8a87] dark:text-[#8b8f9a] font-albert mt-2">
          Recommended: 1920 x 1080px
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// STEP 2: Details
// ============================================================================
interface DetailsStepProps {
  data: SquadWizardData;
  onChange: (updates: Partial<SquadWizardData>) => void;
  coaches: FirebaseUser[];
}

function DetailsStep({ data, onChange, coaches }: DetailsStepProps) {
  return (
    <div className="space-y-5">
      {/* Timezone */}
      <div>
        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
          Timezone
        </label>
        <Select value={data.timezone} onValueChange={(value) => onChange({ timezone: value })}>
          <SelectTrigger className="w-full h-12 px-4 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            <SelectValue placeholder="Select timezone" />
          </SelectTrigger>
          <SelectContent className="z-[200]">
            {POPULAR_TIMEZONES.map((tz) => (
              <SelectItem key={tz.value} value={tz.value} className="font-albert cursor-pointer">
                {tz.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-[#8c8a87] dark:text-[#8b8f9a] font-albert mt-1">
          Used to coordinate squad activities
        </p>
      </div>

      {/* Coach Selection */}
      <div>
        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
          Coach <span className="text-[#8c8a87] dark:text-[#8b8f9a] font-normal">(optional)</span>
        </label>
        <Select value={data.coachId || 'none'} onValueChange={(val) => onChange({ coachId: val === 'none' ? '' : val })}>
          <SelectTrigger className="w-full h-12 px-4 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            <SelectValue placeholder="Select a coach" />
          </SelectTrigger>
          <SelectContent className="z-[200]">
            <SelectItem value="none" className="font-albert cursor-pointer">No coach assigned</SelectItem>
            {coaches.map((coach) => (
              <SelectItem key={coach.id} value={coach.id} className="font-albert cursor-pointer">
                {coach.name || `${coach.firstName} ${coach.lastName}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-[#8c8a87] dark:text-[#8b8f9a] font-albert mt-1">
          Assign a coach to lead this squad
        </p>
      </div>

      {/* Max Capacity */}
      <div>
        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
          Max Capacity <span className="text-[#8c8a87] dark:text-[#8b8f9a] font-normal">(optional)</span>
        </label>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <Users className="w-5 h-5 text-[#8c8a87] dark:text-[#8b8f9a]" />
          </div>
          <input
            type="number"
            value={data.capacity}
            onChange={(e) => onChange({ capacity: e.target.value })}
            placeholder="No limit"
            min="1"
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#8c8c8c] dark:placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-colors"
          />
        </div>
        <p className="text-xs text-[#8c8a87] dark:text-[#8b8f9a] font-albert mt-1">
          Leave empty for unlimited members
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// STEP 3: Pricing & Visibility
// ============================================================================
interface PricingStepProps {
  data: SquadWizardData;
  onChange: (updates: Partial<SquadWizardData>) => void;
  stripeConnected: boolean;
  stripeLoading: boolean;
  error: string | null;
}

function PricingStep({ data, onChange, stripeConnected, stripeLoading, error }: PricingStepProps) {
  return (
    <div className="space-y-6">
      {/* Pricing */}
      <div>
        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
          Pricing
        </label>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <button
            type="button"
            onClick={() => onChange({ pricing: 'free', priceInCents: 0, subscriptionEnabled: false })}
            className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer ${
              data.pricing === 'free'
                ? 'border-brand-accent bg-brand-accent/5'
                : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
            }`}
          >
            <span className={`text-lg font-semibold ${data.pricing === 'free' ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`}>Free</span>
          </button>
          <button
            type="button"
            onClick={() => onChange({ pricing: 'paid' })}
            className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer ${
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
          <div className="space-y-3">
            {/* Stripe Connect Warning */}
            {!stripeLoading && !stripeConnected && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-200 font-albert">
                      Stripe account required
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 font-albert mt-0.5">
                      Connect your Stripe account in Settings to accept payments.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5f5a55] dark:text-[#b2b6c2] font-albert">$</span>
              <input
                type="number"
                value={data.priceInCents ? (data.priceInCents / 100).toFixed(2) : ''}
                onChange={(e) => {
                  const dollars = parseFloat(e.target.value);
                  onChange({ priceInCents: isNaN(dollars) ? 0 : Math.round(dollars * 100) });
                }}
                placeholder="0.00"
                disabled={!stripeConnected && !stripeLoading}
                className={`w-full pl-8 pr-4 py-3 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-colors ${
                  !stripeConnected && !stripeLoading ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-900' : ''
                }`}
              />
            </div>

            {/* Subscription Settings - always visible when paid is selected */}
            {stripeConnected && (
              <div className="p-4 rounded-xl bg-[#faf8f6] dark:bg-[#1d222b]/50 border border-[#e1ddd8] dark:border-[#262b35]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <RefreshCw className={`w-5 h-5 ${data.subscriptionEnabled ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
                    <div>
                      <span className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8] block text-sm">
                        Recurring Subscription
                      </span>
                      <span className="text-xs text-[#8c8a87] dark:text-[#8b8f9a] font-albert">
                        Members pay automatically
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onChange({ subscriptionEnabled: !data.subscriptionEnabled })}
                    className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
                      data.subscriptionEnabled ? 'bg-brand-accent' : 'bg-[#d1ccc6] dark:bg-[#3a3f4a]'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        data.subscriptionEnabled ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </div>

                {data.subscriptionEnabled && (
                  <div className="pt-3 border-t border-[#e1ddd8] dark:border-[#262b35]">
                    <label className="block text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-2">
                      Billing Interval
                    </label>
                    <Select
                      value={data.billingInterval}
                      onValueChange={(val) => onChange({ billingInterval: val as 'monthly' | 'quarterly' | 'yearly' })}
                    >
                      <SelectTrigger className="w-full font-albert text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[200]">
                        <SelectItem value="monthly" className="font-albert cursor-pointer">Monthly (${(data.priceInCents / 100).toFixed(2)}/month)</SelectItem>
                        <SelectItem value="quarterly" className="font-albert cursor-pointer">Quarterly (${(data.priceInCents / 100).toFixed(2)}/3 months)</SelectItem>
                        <SelectItem value="yearly" className="font-albert cursor-pointer">Yearly (${(data.priceInCents / 100).toFixed(2)}/year)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Visibility */}
      <div>
        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
          Visibility
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onChange({ visibility: 'public' })}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
              data.visibility === 'public'
                ? 'border-brand-accent bg-brand-accent/5'
                : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              data.visibility === 'public'
                ? 'bg-brand-accent/20'
                : 'bg-[#f3f1ef] dark:bg-[#262b35]'
            }`}>
              <Globe className={`w-5 h-5 ${data.visibility === 'public' ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
            </div>
            <div className="text-left">
              <span className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8] block">Public</span>
              <span className="text-xs text-[#8c8a87] dark:text-[#8b8f9a] font-albert">Visible in discovery</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onChange({ visibility: 'private' })}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
              data.visibility === 'private'
                ? 'border-brand-accent bg-brand-accent/5'
                : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              data.visibility === 'private'
                ? 'bg-brand-accent/20'
                : 'bg-[#f3f1ef] dark:bg-[#262b35]'
            }`}>
              <Lock className={`w-5 h-5 ${data.visibility === 'private' ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
            </div>
            <div className="text-left">
              <span className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8] block">Private</span>
              <span className="text-xs text-[#8c8a87] dark:text-[#8b8f9a] font-albert">Invite only</span>
            </div>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400 font-albert">{error}</p>
        </div>
      )}
    </div>
  );
}
