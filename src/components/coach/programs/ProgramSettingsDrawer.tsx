'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Settings,
  Loader2,
  ChevronDown,
  ChevronUp,
  Layers,
  RefreshCw,
  Calendar,
  CalendarOff,
  Users,
  User,
  Phone,
  DollarSign,
  Gift,
  Eye,
  EyeOff,
  Rocket,
  Pause,
  Globe,
  Lock,
  Check,
  Image as ImageIcon,
  Info,
  Sparkles,
} from 'lucide-react';
import {
  Drawer,
  DrawerContent,
} from '@/components/ui/drawer';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { MediaUpload } from '@/components/admin/MediaUpload';
import { useStripeConnectStatus } from '@/hooks/useStripeConnectStatus';
import { StripeConnectPrompt } from '@/components/ui/StripeConnectPrompt';
import { StripeConnectModal } from '@/components/ui/StripeConnectModal';
import { useOrgEntitlements } from '@/lib/billing/use-entitlements';
import { SingleCoachSelector } from '@/components/coach/SingleCoachSelector';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Program, TaskDistribution } from '@/types';

interface ProgramSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  program: Program | null;
  programs: Program[]; // For upsell dropdown
  coaches: Array<{ id: string; name: string; email: string; imageUrl?: string }>;
  loadingCoaches: boolean;
  onSave: (updates: Partial<ProgramFormData>) => Promise<void>;
}

interface ProgramFormData {
  name: string;
  description: string;
  coverImageUrl: string;
  priceInCents: number;
  callCreditsPerMonth: number;
  dailyFocusSlots: number;
  taskDistribution: TaskDistribution;
  includeWeekends: boolean;
  autoGenerateSummary: boolean;
  coachId?: string;
  clientCommunityEnabled: boolean;
  completionConfig: {
    showConfetti: boolean;
    upsellProgramId?: string;
    upsellHeadline?: string;
    upsellDescription?: string;
  };
  isActive: boolean;
  isPublished: boolean;
}

export function ProgramSettingsDrawer({
  isOpen,
  onClose,
  program,
  programs,
  coaches,
  loadingCoaches,
  onSave,
}: ProgramSettingsDrawerProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [isMounted, setIsMounted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [showStripeModal, setShowStripeModal] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  // Stripe status
  const { isConnected: stripeConnected, isLoading: stripeLoading, refetch: refetchStripe } = useStripeConnectStatus();
  const canAcceptPayments = stripeConnected;

  // Entitlements for coach selection
  const entitlements = useOrgEntitlements();
  const canSelectCoach = entitlements?.features.multiCoachSupport ?? false;

  // Form state
  const [formData, setFormData] = useState<ProgramFormData>({
    name: '',
    description: '',
    coverImageUrl: '',
    priceInCents: 0,
    callCreditsPerMonth: 0,
    dailyFocusSlots: 2,
    taskDistribution: 'spread',
    includeWeekends: true,
    autoGenerateSummary: false,
    coachId: undefined,
    clientCommunityEnabled: false,
    completionConfig: {
      showConfetti: true,
      upsellProgramId: undefined,
      upsellHeadline: '',
      upsellDescription: '',
    },
    isActive: true,
    isPublished: false,
  });

  // Debounce ref for auto-save
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>('');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Sync form data when program changes or drawer opens
  useEffect(() => {
    if (isOpen && program) {
      const newFormData: ProgramFormData = {
        name: program.name || '',
        description: program.description || '',
        coverImageUrl: program.coverImageUrl || '',
        priceInCents: program.priceInCents || 0,
        callCreditsPerMonth: program.callCreditsPerMonth ?? 0,
        dailyFocusSlots: program.dailyFocusSlots ?? 2,
        taskDistribution: program.taskDistribution || 'spread',
        includeWeekends: program.includeWeekends !== false,
        autoGenerateSummary: program.autoGenerateSummary || false,
        coachId: program.coachId,
        clientCommunityEnabled: program.clientCommunityEnabled || false,
        completionConfig: {
          showConfetti: true, // Always on
          upsellProgramId: program.completionConfig?.upsellProgramId,
          upsellHeadline: program.completionConfig?.upsellHeadline || '',
          upsellDescription: program.completionConfig?.upsellDescription || '',
        },
        isActive: program.isActive !== false,
        isPublished: program.isPublished || false,
      };
      setFormData(newFormData);
      lastSavedRef.current = JSON.stringify(newFormData);
      // Collapse details section when switching programs
      setDetailsExpanded(false);
    }
  }, [isOpen, program]);

  // Auto-save with debounce
  const triggerAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Hide "Saved" when starting a new save cycle
    setShowSaved(false);

    saveTimeoutRef.current = setTimeout(async () => {
      const currentJson = JSON.stringify(formData);
      if (currentJson !== lastSavedRef.current && program) {
        setIsSaving(true);
        try {
          await onSave(formData);
          lastSavedRef.current = currentJson;
          // Show "Saved" indicator
          setShowSaved(true);
          // Hide after 2 seconds
          setTimeout(() => setShowSaved(false), 2000);
        } catch (error) {
          console.error('Auto-save failed:', error);
        } finally {
          setIsSaving(false);
        }
      }
    }, 500);
  }, [formData, program, onSave]);

  // Trigger auto-save when form data changes
  useEffect(() => {
    if (isOpen && program) {
      triggerAutoSave();
    }
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [formData, isOpen, program, triggerAutoSave]);

  const updateField = useCallback(<K extends keyof ProgramFormData>(
    field: K,
    value: ProgramFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const updateCompletionConfig = useCallback((updates: Partial<ProgramFormData['completionConfig']>) => {
    setFormData(prev => ({
      ...prev,
      completionConfig: { ...prev.completionConfig, ...updates },
    }));
  }, []);

  // Animation variants
  const fadeVariants = {
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: 'auto' },
    exit: { opacity: 0, height: 0 },
  };

  const isIndividual = program?.type === 'individual';

  if (!isMounted || !program) {
    return null;
  }

  // Save status indicator component
  const SaveIndicator = () => {
    if (isSaving) {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-accent/10 text-brand-accent">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm font-medium font-albert">Saving...</span>
        </div>
      );
    }
    if (showSaved) {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400">
          <Check className="w-4 h-4" />
          <span className="text-sm font-medium font-albert">Saved</span>
        </div>
      );
    }
    return null;
  };

  const content = (showCloseButton: boolean) => (
    <div className="flex flex-col h-full min-h-0 relative">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#f3f1ef] dark:bg-[#262b35] flex items-center justify-center">
            <Settings className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-[-0.5px]">
              Program Settings
            </h2>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              {program.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SaveIndicator />
          {showCloseButton && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-20 space-y-8 relative">
        {/* Section 1: Program Details (Collapsible) */}
        <section>
          <button
            onClick={() => setDetailsExpanded(!detailsExpanded)}
            className="w-full flex items-center justify-between p-4 rounded-xl bg-[#faf8f6] dark:bg-[#1d222b] border border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white dark:bg-[#262b35] flex items-center justify-center overflow-hidden">
                {formData.coverImageUrl ? (
                  <img src={formData.coverImageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
                )}
              </div>
              <div className="text-left">
                <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  {formData.name || 'Program Details'}
                </h3>
                <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  Name, description & cover image
                </p>
              </div>
            </div>
            {detailsExpanded ? (
              <ChevronUp className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
            ) : (
              <ChevronDown className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
            )}
          </button>

          <AnimatePresence>
            {detailsExpanded && (
              <motion.div
                initial="initial"
                animate="animate"
                exit="exit"
                variants={fadeVariants}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                      Program Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => updateField('description', e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-colors resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                      Cover Image
                    </label>
                    <MediaUpload
                      value={formData.coverImageUrl}
                      onChange={(url) => updateField('coverImageUrl', url || '')}
                      folder="programs"
                      type="image"
                      uploadEndpoint="/api/coach/org-upload-media"
                      hideLabel
                      aspectRatio="16:9"
                      collapsiblePreview
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Section 2: Monthly 1:1 Calls (Individual programs only) */}
        {isIndividual && (
          <section>
            <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3 flex items-center gap-2">
              <Phone className="w-4 h-4 text-brand-accent" />
              Monthly 1:1 Calls
            </h3>
            <div className="p-4 rounded-xl bg-[#faf8f6] dark:bg-[#1d222b] border border-[#e1ddd8] dark:border-[#262b35]">
              <label className="block text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-2">
                Calls per month
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={formData.callCreditsPerMonth}
                  onChange={(e) => updateField('callCreditsPerMonth', Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-20 px-3 py-2.5 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-center text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-brand-accent/50"
                />
                <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  calls per 30-day window
                </span>
              </div>
              {/* Info box explaining the feature */}
              <div className="flex gap-2 mt-3 p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30">
                <Info className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-700 dark:text-blue-300 font-albert space-y-1">
                  <p>
                    {formData.callCreditsPerMonth === 0
                      ? 'Unlimited 1:1 coaching calls are included with this program.'
                      : `${formData.callCreditsPerMonth} coaching call${formData.callCreditsPerMonth === 1 ? '' : 's'} per month included with this program.`
                    }
                  </p>
                  <p className="text-blue-600/80 dark:text-blue-400/70">
                    {formData.callCreditsPerMonth === 0
                      ? 'Clients can book as many calls as your availability allows.'
                      : 'Credits refresh every 30 days from enrollment date.'}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Section 3: Pricing */}
        <section>
          <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
            Pricing
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <button
              onClick={() => updateField('priceInCents', 0)}
              className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                formData.priceInCents === 0
                  ? 'border-brand-accent bg-brand-accent/5'
                  : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
              }`}
            >
              <span className={`text-lg font-semibold font-albert ${
                formData.priceInCents === 0 ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'
              }`}>
                Free
              </span>
              {formData.priceInCents === 0 && (
                <Check className="w-5 h-5 text-brand-accent" />
              )}
            </button>
            <button
              onClick={() => formData.priceInCents === 0 && updateField('priceInCents', 29700)}
              className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                formData.priceInCents > 0
                  ? 'border-brand-accent bg-brand-accent/5'
                  : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
              }`}
            >
              <DollarSign className={`w-5 h-5 ${
                formData.priceInCents > 0 ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'
              }`} />
              <span className={`text-lg font-semibold font-albert ${
                formData.priceInCents > 0 ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'
              }`}>
                Paid
              </span>
              {formData.priceInCents > 0 && (
                <Check className="w-5 h-5 text-brand-accent" />
              )}
            </button>
          </div>

          <AnimatePresence mode="wait">
            {formData.priceInCents > 0 && (
              <motion.div
                key="paid-options"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-3 overflow-hidden"
              >
                {!canAcceptPayments && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.1 }}
                  >
                    <StripeConnectPrompt onClick={() => setShowStripeModal(true)} />
                  </motion.div>
                )}

                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: canAcceptPayments ? 0 : 0.15 }}
                  className="relative"
                >
                  <span className="absolute left-4 top-3.5 text-[#1a1a1a] dark:text-[#f5f5f8] font-albert font-medium">$</span>
                  <input
                    type="number"
                    value={formData.priceInCents / 100}
                    onChange={(e) => updateField('priceInCents', Math.max(0, Math.round(parseFloat(e.target.value) * 100) || 0))}
                    placeholder="297"
                    className="w-full pl-8 pr-4 py-3 rounded-xl border-2 border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#8c8c8c] focus:outline-none focus:border-brand-accent transition-colors"
                  />
                  {!canAcceptPayments && (
                    <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-2">
                      Connect Stripe to accept payments. You can still add prepaid clients manually.
                    </p>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Section 4: Daily Focus Tasks & Distribution */}
        <section>
          <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
            Daily Focus Tasks
          </h3>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#faf8f6] dark:bg-[#1d222b] border border-[#e1ddd8] dark:border-[#262b35]">
              <label className="block text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-2">
                Tasks per day
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="4"
                  value={formData.dailyFocusSlots}
                  onChange={(e) => updateField('dailyFocusSlots', Math.max(1, Math.min(4, parseInt(e.target.value) || 2)))}
                  className="w-16 px-3 py-2.5 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-center text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-brand-accent/50"
                />
                <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  tasks from this program appear in daily focus (1-4)
                </span>
              </div>
            </div>

            {/* Auto-generate summaries toggle */}
            <div className="py-3">
              <label className="block text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                Auto-generate summaries
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => updateField('autoGenerateSummary', false)}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    !formData.autoGenerateSummary
                      ? 'border-brand-accent bg-brand-accent/5'
                      : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
                  }`}
                >
                  <div className="relative w-4 h-4">
                    <Sparkles className={`w-4 h-4 ${
                      !formData.autoGenerateSummary ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                    }`} />
                    <div className={`absolute inset-0 flex items-center justify-center ${
                      !formData.autoGenerateSummary ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                    }`}>
                      <div className="w-5 h-0.5 bg-current rotate-45 -translate-x-0.5" />
                    </div>
                  </div>
                  <span className={`text-sm font-semibold font-albert ${
                    !formData.autoGenerateSummary ? 'text-brand-accent' : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                  }`}>
                    Off
                  </span>
                  {!formData.autoGenerateSummary && (
                    <Check className="w-4 h-4 text-brand-accent flex-shrink-0" />
                  )}
                </button>

                <button
                  onClick={() => updateField('autoGenerateSummary', true)}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    formData.autoGenerateSummary
                      ? 'border-brand-accent bg-brand-accent/5'
                      : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
                  }`}
                >
                  <Sparkles className={`w-4 h-4 ${
                    formData.autoGenerateSummary ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                  }`} />
                  <span className={`text-sm font-semibold font-albert ${
                    formData.autoGenerateSummary ? 'text-brand-accent' : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                  }`}>
                    On
                  </span>
                  <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">(1 credit)</span>
                  {formData.autoGenerateSummary && (
                    <Check className="w-4 h-4 text-brand-accent flex-shrink-0" />
                  )}
                </button>
              </div>
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-2">
                Generates call summaries and adds tasks to upcoming program days automatically
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                Task Distribution
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={() => updateField('taskDistribution', 'spread')}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                    formData.taskDistribution === 'spread'
                      ? 'border-brand-accent bg-brand-accent/5'
                      : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    formData.taskDistribution === 'spread'
                      ? 'bg-brand-accent text-white'
                      : 'bg-[#f3f1ef] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2]'
                  }`}>
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <div className={`text-sm font-semibold font-albert ${
                      formData.taskDistribution === 'spread' ? 'text-brand-accent' : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                    }`}>
                      Spread Across Week
                    </div>
                    <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-0.5">
                      Tasks distributed evenly, 1-2 per day
                    </p>
                  </div>
                  {formData.taskDistribution === 'spread' && (
                    <Check className="w-5 h-5 text-brand-accent flex-shrink-0 ml-auto" />
                  )}
                </button>

                <button
                  onClick={() => updateField('taskDistribution', 'repeat-daily')}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                    formData.taskDistribution === 'repeat-daily'
                      ? 'border-brand-accent bg-brand-accent/5'
                      : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    formData.taskDistribution === 'repeat-daily'
                      ? 'bg-brand-accent text-white'
                      : 'bg-[#f3f1ef] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2]'
                  }`}>
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <div>
                    <div className={`text-sm font-semibold font-albert ${
                      formData.taskDistribution === 'repeat-daily' ? 'text-brand-accent' : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                    }`}>
                      Repeat Daily
                    </div>
                    <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-0.5">
                      All week tasks appear every day
                    </p>
                  </div>
                  {formData.taskDistribution === 'repeat-daily' && (
                    <Check className="w-5 h-5 text-brand-accent flex-shrink-0 ml-auto" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Include Weekends */}
        <section>
          <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
            Week Schedule
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => updateField('includeWeekends', false)}
              className={`flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${
                !formData.includeWeekends
                  ? 'border-brand-accent bg-brand-accent/5'
                  : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
              }`}
            >
              <CalendarOff className={`w-5 h-5 ${
                !formData.includeWeekends ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'
              }`} />
              <div className="text-left">
                <div className={`text-sm font-semibold font-albert ${
                  !formData.includeWeekends ? 'text-brand-accent' : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                }`}>
                  Weekdays Only
                </div>
                <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  Mon - Fri
                </p>
              </div>
              {!formData.includeWeekends && (
                <Check className="w-5 h-5 text-brand-accent flex-shrink-0" />
              )}
            </button>

            <button
              onClick={() => updateField('includeWeekends', true)}
              className={`flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${
                formData.includeWeekends
                  ? 'border-brand-accent bg-brand-accent/5'
                  : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
              }`}
            >
              <Calendar className={`w-5 h-5 ${
                formData.includeWeekends ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'
              }`} />
              <div className="text-left">
                <div className={`text-sm font-semibold font-albert ${
                  formData.includeWeekends ? 'text-brand-accent' : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                }`}>
                  All Week
                </div>
                <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  7 days
                </p>
              </div>
              {formData.includeWeekends && (
                <Check className="w-5 h-5 text-brand-accent flex-shrink-0" />
              )}
            </button>
          </div>
        </section>

        {/* Section 6: Program Coach */}
        <section>
          <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-brand-accent" />
            Program Coach
          </h3>
          {canSelectCoach ? (
            <>
              {loadingCoaches ? (
                <div className="p-4 rounded-xl bg-[#faf8f6] dark:bg-[#1d222b] border border-[#e1ddd8] dark:border-[#262b35] flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-brand-accent" />
                  <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Loading coaches...</span>
                </div>
              ) : coaches.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#faf8f6] dark:bg-[#1d222b] border border-[#e1ddd8] dark:border-[#262b35]">
                  <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                    No coaches found in your organization.
                  </p>
                </div>
              ) : (
                <>
                  <SingleCoachSelector
                    coaches={coaches}
                    value={formData.coachId || null}
                    onChange={(coachId) => updateField('coachId', coachId || undefined)}
                    loading={false}
                    placeholder="Select primary coach..."
                  />
                  <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert mt-2">
                    Primary coach joins all squads and receives notifications
                  </p>
                </>
              )}
            </>
          ) : (
            <div className="p-4 rounded-xl bg-[#faf8f6] dark:bg-[#1d222b] border border-[#e1ddd8] dark:border-[#262b35]">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-[#e1ddd8] dark:bg-[#262b35] flex items-center justify-center">
                  <User className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                </div>
                <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  You (Organization Owner)
                </span>
              </div>
              <div className="flex gap-2 mt-3 p-3 bg-amber-50/50 dark:bg-amber-900/10 rounded-lg border border-amber-100 dark:border-amber-900/30">
                <Info className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300 font-albert">
                  Upgrade to Scale plan to assign other coaches to programs.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Section 7: Client Community (Individual programs only) */}
        {isIndividual && (
          <section>
            <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
              Client Community
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => updateField('clientCommunityEnabled', false)}
                className={`flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  !formData.clientCommunityEnabled
                    ? 'border-brand-accent bg-brand-accent/5'
                    : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
                }`}
              >
                <User className={`w-5 h-5 ${
                  !formData.clientCommunityEnabled ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                }`} />
                <div className="text-left">
                  <div className={`text-sm font-semibold font-albert ${
                    !formData.clientCommunityEnabled ? 'text-brand-accent' : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                  }`}>
                    Private Only
                  </div>
                  <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                    1:1 with you
                  </p>
                </div>
                {!formData.clientCommunityEnabled && (
                  <Check className="w-5 h-5 text-brand-accent flex-shrink-0" />
                )}
              </button>

              <button
                onClick={() => updateField('clientCommunityEnabled', true)}
                className={`flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  formData.clientCommunityEnabled
                    ? 'border-brand-accent bg-brand-accent/5'
                    : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
                }`}
              >
                <Users className={`w-5 h-5 ${
                  formData.clientCommunityEnabled ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                }`} />
                <div className="text-left">
                  <div className={`text-sm font-semibold font-albert ${
                    formData.clientCommunityEnabled ? 'text-brand-accent' : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                  }`}>
                    Community
                  </div>
                  <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                    Shared group chat
                  </p>
                </div>
                {formData.clientCommunityEnabled && (
                  <Check className="w-5 h-5 text-brand-accent flex-shrink-0" />
                )}
              </button>
            </div>
          </section>
        )}

        {/* Section 8: Upsell Program */}
        <section>
          <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3 flex items-center gap-2">
            <Gift className="w-4 h-4 text-brand-accent" />
            Completion Upsell
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <button
              onClick={() => updateCompletionConfig({ upsellProgramId: undefined })}
              className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                !formData.completionConfig.upsellProgramId
                  ? 'border-brand-accent bg-brand-accent/5'
                  : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
              }`}
            >
              <EyeOff className={`w-5 h-5 ${
                !formData.completionConfig.upsellProgramId ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'
              }`} />
              <span className={`text-sm font-semibold font-albert ${
                !formData.completionConfig.upsellProgramId ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'
              }`}>
                No Upsell
              </span>
              {!formData.completionConfig.upsellProgramId && (
                <Check className="w-5 h-5 text-brand-accent" />
              )}
            </button>

            <button
              onClick={() => {
                const firstProgram = programs.find(p => p.id !== program?.id && p.isActive);
                if (firstProgram && !formData.completionConfig.upsellProgramId) {
                  updateCompletionConfig({ upsellProgramId: firstProgram.id });
                }
              }}
              className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                formData.completionConfig.upsellProgramId
                  ? 'border-brand-accent bg-brand-accent/5'
                  : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
              }`}
            >
              <Gift className={`w-5 h-5 ${
                formData.completionConfig.upsellProgramId ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'
              }`} />
              <span className={`text-sm font-semibold font-albert ${
                formData.completionConfig.upsellProgramId ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'
              }`}>
                Upsell
              </span>
              {formData.completionConfig.upsellProgramId && (
                <Check className="w-5 h-5 text-brand-accent" />
              )}
            </button>
          </div>

          <AnimatePresence mode="wait">
            {formData.completionConfig.upsellProgramId && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-3 overflow-hidden"
              >
                <div>
                  <label className="block text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-2">
                    Select Program
                  </label>
                  <Select
                    value={formData.completionConfig.upsellProgramId}
                    onValueChange={(value) => updateCompletionConfig({ upsellProgramId: value })}
                  >
                    <SelectTrigger className="w-full rounded-xl">
                      <SelectValue placeholder="Choose a program" />
                    </SelectTrigger>
                    <SelectContent>
                      {programs
                        .filter(p => p.id !== program?.id && p.isActive)
                        .map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.priceInCents === 0 ? 'Free' : `$${(p.priceInCents / 100).toFixed(2)}`})
                          </SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-2">
                    Headline
                  </label>
                  <input
                    type="text"
                    value={formData.completionConfig.upsellHeadline || ''}
                    onChange={(e) => updateCompletionConfig({ upsellHeadline: e.target.value })}
                    placeholder="Keep the momentum going!"
                    className="w-full px-4 py-3 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.completionConfig.upsellDescription || ''}
                    onChange={(e) => updateCompletionConfig({ upsellDescription: e.target.value })}
                    placeholder="Continue your journey..."
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent/50 resize-none"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Section 9: Status */}
        <section>
          <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
            Program Status
          </h3>
          <div className="space-y-4">
            {/* Active toggle */}
            <button
              onClick={() => updateField('isActive', !formData.isActive)}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] hover:border-brand-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Rocket className={`w-5 h-5 ${formData.isActive ? 'text-brand-accent' : 'text-[#a7a39e] dark:text-[#7d8190]'}`} />
                <div className="text-left">
                  <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Active</span>
                  <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert">Program accepts new enrollments</p>
                </div>
              </div>
              <div className={`w-11 h-6 rounded-full transition-colors ${formData.isActive ? 'bg-brand-accent' : 'bg-[#e1ddd8] dark:bg-[#3a4150]'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform mt-0.5 ${formData.isActive ? 'translate-x-5.5 ml-0.5' : 'translate-x-0.5'}`} />
              </div>
            </button>

            {/* Public toggle */}
            <button
              onClick={() => updateField('isPublished', !formData.isPublished)}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] hover:border-brand-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Globe className={`w-5 h-5 ${formData.isPublished ? 'text-brand-accent' : 'text-[#a7a39e] dark:text-[#7d8190]'}`} />
                <div className="text-left">
                  <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Public</span>
                  <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert">Visible in Discover and searchable</p>
                </div>
              </div>
              <div className={`w-11 h-6 rounded-full transition-colors ${formData.isPublished ? 'bg-brand-accent' : 'bg-[#e1ddd8] dark:bg-[#3a4150]'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform mt-0.5 ${formData.isPublished ? 'translate-x-5.5 ml-0.5' : 'translate-x-0.5'}`} />
              </div>
            </button>
          </div>
        </section>

      </div>

      {/* Bottom blur gradient for comfortable scrolling */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white dark:from-[#171b22] to-transparent pointer-events-none" />
    </div>
  );

  // Mobile: Drawer
  if (isMobile) {
    return (
      <>
        <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
          <DrawerContent className="h-[90vh] max-h-[90vh]">
            {content(false)}
          </DrawerContent>
        </Drawer>
        <StripeConnectModal
          isOpen={showStripeModal}
          onClose={() => setShowStripeModal(false)}
          onConnected={() => refetchStripe()}
        />
      </>
    );
  }

  // Desktop: Dialog
  return (
    <>
      <Transition appear show={isOpen} as={React.Fragment}>
        <Dialog as="div" className="relative z-[10002]" onClose={onClose}>
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 z-[10001] bg-black/40 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 z-[10002] overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={React.Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-2xl h-[85vh] transform overflow-hidden rounded-2xl bg-white dark:bg-[#171b22] shadow-2xl shadow-black/10 dark:shadow-black/30 transition-all flex flex-col">
                  {content(true)}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
      <StripeConnectModal
        isOpen={showStripeModal}
        onClose={() => setShowStripeModal(false)}
        onConnected={() => refetchStripe()}
      />
    </>
  );
}
