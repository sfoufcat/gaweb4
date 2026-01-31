'use client';

import { useState, useEffect, Fragment, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerFooter,
  DrawerScrollArea,
} from '@/components/ui/drawer';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Button } from '@/components/ui/button';
import { ReferralRewardSelector } from './ReferralRewardSelector';
import {
  Users,
  Check,
  Loader2,
  Copy,
  Share2,
  ExternalLink,
  AlertCircle,
  BookOpen,
  Plus,
  X,
  ArrowLeft,
  ArrowRight,
  Gift,
} from 'lucide-react';
import type { Program, Funnel, ReferralReward, ReferralConfig, ReferralResourceType } from '@/types';

type WizardStep = 'program' | 'funnel' | 'funnelCreate' | 'reward' | 'link';

// Target can be a program or a resource
type TargetType = 'program' | ReferralResourceType;

interface SelectableTarget {
  id: string;
  name: string;
  type: TargetType;
  category: string; // e.g., "Programs", "Courses", etc.
  hasReferrals?: boolean;
}

// Display labels for target types
const TARGET_TYPE_LABELS: Record<string, string> = {
  program: 'Programs',
  course: 'Courses',
  article: 'Articles',
  download: 'Downloads',
  video: 'Videos',
  link: 'Links',
};

interface ReferralSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId?: string;
  /** Pre-select a program (skip step 1) */
  initialProgramId?: string;
  /** Callback when referral is successfully enabled */
  onSuccess?: () => void;
}

const STORAGE_KEY = 'referralWizardState';

interface WizardState {
  step: WizardStep;
  selectedProgramId: string | null;
  selectedTargetType: TargetType | null;
  selectedFunnelId: string | null;
  reward: ReferralReward | undefined;
  funnelName: string;
  funnelSlug: string;
  funnelAccessType: 'public' | 'invite_only';
}

/**
 * ReferralSetupWizard Component
 *
 * Multi-step wizard to enable referrals on a program:
 * 1. Select a program
 * 2. Select or create a funnel
 * 3. Configure optional reward
 * 4. Copy/share the referral link
 */
export function ReferralSetupWizard({
  open,
  onOpenChange,
  organizationId,
  initialProgramId,
  onSuccess,
}: ReferralSetupWizardProps) {
  // Mobile detection
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Track initial mount to skip animation on first open
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (open) {
      isInitialMount.current = true;
      const timer = setTimeout(() => {
        isInitialMount.current = false;
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Wizard state
  const [step, setStep] = useState<WizardStep>('program');
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(
    initialProgramId || null
  );
  const [selectedTargetType, setSelectedTargetType] = useState<TargetType | null>(
    initialProgramId ? 'program' : null
  );
  const [selectedFunnelId, setSelectedFunnelId] = useState<string | null>(null);
  const [reward, setReward] = useState<ReferralReward | undefined>(undefined);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  // Inline funnel creation state
  const [funnelName, setFunnelName] = useState('');
  const [funnelSlug, setFunnelSlug] = useState('');
  const [funnelAccessType, setFunnelAccessType] = useState<'public' | 'invite_only'>('public');
  const [creatingFunnel, setCreatingFunnel] = useState(false);

  // Data
  const [programs, setPrograms] = useState<Program[]>([]);
  const [targets, setTargets] = useState<SelectableTarget[]>([]);
  const [funnels, setFunnels] = useState<Funnel[]>([]);

  // Loading states
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [loadingFunnels, setLoadingFunnels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  // UI states
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Animation variants
  const fadeVariants = {
    initial: { opacity: 0, scale: 0.98 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
  };

  // Save state to localStorage
  const saveState = () => {
    if (step === 'link') return; // Don't save completed state
    const state: WizardState = {
      step,
      selectedProgramId,
      selectedTargetType,
      selectedFunnelId,
      reward,
      funnelName,
      funnelSlug,
      funnelAccessType,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  };

  // Load state from localStorage
  const loadState = (): WizardState | null => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Ignore parse errors
    }
    return null;
  };

  // Clear saved state
  const clearState = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  // Save state when it changes
  useEffect(() => {
    if (open && step !== 'link') {
      saveState();
    }
  }, [step, selectedProgramId, selectedTargetType, selectedFunnelId, reward, funnelName, funnelSlug, funnelAccessType, open]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      // Try to restore saved state
      const savedState = loadState();
      if (savedState && !initialProgramId) {
        setStep(savedState.step);
        setSelectedProgramId(savedState.selectedProgramId);
        setSelectedTargetType(savedState.selectedTargetType || null);
        setSelectedFunnelId(savedState.selectedFunnelId);
        setReward(savedState.reward);
        setFunnelName(savedState.funnelName);
        setFunnelSlug(savedState.funnelSlug);
        setFunnelAccessType(savedState.funnelAccessType);
      } else {
        setStep(initialProgramId ? 'funnel' : 'program');
        setSelectedProgramId(initialProgramId || null);
        setSelectedTargetType(initialProgramId ? 'program' : null);
        setSelectedFunnelId(null);
        setReward(undefined);
        setFunnelName('');
        setFunnelSlug('');
        setFunnelAccessType('public');
      }
      setGeneratedLink(null);
      setError(null);
      setCopied(false);
    }
  }, [open, initialProgramId]);

  // Fetch programs and resources
  useEffect(() => {
    if (!open) return;

    const fetchTargets = async () => {
      setLoadingPrograms(true);
      try {
        // Fetch programs
        const programsRes = await fetch('/api/coach/org-programs');
        const programsData = programsRes.ok ? await programsRes.json() : { programs: [] };
        setPrograms(programsData.programs || []);

        // Fetch referral configs which includes resources
        const configsRes = await fetch('/api/coach/referral-config');
        const configsData = configsRes.ok ? await configsRes.json() : { configs: [] };

        // Build targets list from configs (which includes programs + resources)
        const targetsList: SelectableTarget[] = (configsData.configs || []).map(
          (c: { targetType: TargetType; targetId: string; targetName: string; referralConfig?: { enabled?: boolean } }) => ({
            id: c.targetId,
            name: c.targetName,
            type: c.targetType,
            category: TARGET_TYPE_LABELS[c.targetType] || c.targetType,
            hasReferrals: c.referralConfig?.enabled,
          })
        );
        setTargets(targetsList);
      } catch (err) {
        console.error('Failed to fetch targets:', err);
      } finally {
        setLoadingPrograms(false);
      }
    };

    fetchTargets();
  }, [open]);

  // Fetch funnels when target is selected
  useEffect(() => {
    if (!selectedProgramId || !selectedTargetType) {
      setFunnels([]);
      return;
    }

    const fetchFunnels = async () => {
      setLoadingFunnels(true);
      try {
        const response = await fetch('/api/coach/org-funnels');
        if (response.ok) {
          const data = await response.json();
          // Filter funnels based on target type
          const filteredFunnels = (data.funnels || []).filter(
            (f: Funnel) => {
              if (selectedTargetType === 'program') {
                return f.programId === selectedProgramId;
              } else {
                // For resources, show all funnels (no specific resource funnels exist yet)
                return true;
              }
            }
          );
          setFunnels(filteredFunnels);
        }
      } catch (err) {
        console.error('Failed to fetch funnels:', err);
      } finally {
        setLoadingFunnels(false);
      }
    };

    fetchFunnels();
  }, [selectedProgramId, selectedTargetType]);

  const selectedProgram = programs.find((p) => p.id === selectedProgramId);
  const selectedTarget = targets.find((t) => t.id === selectedProgramId && t.type === selectedTargetType);

  const handleTargetSelect = (targetId: string, targetType: TargetType) => {
    setSelectedProgramId(targetId);
    setSelectedTargetType(targetType);
    setSelectedFunnelId(null);
    setError(null);
  };

  // Keep old handler for backward compatibility with initialProgramId
  const handleProgramSelect = (programId: string) => {
    handleTargetSelect(programId, 'program');
  };

  // Auto-generate slug from name
  const handleFunnelNameChange = (name: string) => {
    setFunnelName(name);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    setFunnelSlug(slug);
  };

  // Create funnel inline (same pattern as InviteClientsDialog)
  const createFunnelInline = async () => {
    if (!funnelName.trim() || !funnelSlug.trim() || !selectedProgramId) {
      setError('Please enter a funnel name');
      return;
    }

    setCreatingFunnel(true);
    setError(null);

    try {
      const response = await fetch('/api/coach/org-funnels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: funnelName.trim(),
          slug: funnelSlug.trim(),
          accessType: funnelAccessType,
          isActive: true,
          isDefault: true,
          targetType: 'program',
          programId: selectedProgramId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create funnel');
      }

      const data = await response.json();
      // API auto-creates steps (payment if paid, signup, success)
      setSelectedFunnelId(data.funnel.id);
      setFunnels(prev => [...prev, data.funnel]);
      setStep('reward');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create funnel');
    } finally {
      setCreatingFunnel(false);
    }
  };

  const handleNext = async () => {
    setError(null);

    switch (step) {
      case 'program':
        if (!selectedProgramId) {
          setError('Please select a program');
          return;
        }
        setStep('funnel');
        break;

      case 'funnel':
        if (!selectedFunnelId) {
          setError('Please select a funnel');
          return;
        }
        setStep('reward');
        break;

      case 'funnelCreate':
        await createFunnelInline();
        break;

      case 'reward':
        // Save the referral config
        await saveReferralConfig();
        break;

      case 'link':
        clearState();
        onOpenChange(false);
        onSuccess?.();
        break;
    }
  };

  const handleBack = () => {
    setError(null);

    switch (step) {
      case 'funnel':
        if (!initialProgramId) {
          setStep('program');
        }
        break;
      case 'funnelCreate':
        setStep('funnel');
        break;
      case 'reward':
        setStep('funnel');
        break;
      case 'link':
        setStep('reward');
        break;
    }
  };

  const saveReferralConfig = async () => {
    if (!selectedProgramId || !selectedFunnelId || !selectedTargetType) return;

    setSaving(true);
    setError(null);

    try {
      const config: ReferralConfig = {
        enabled: true,
        funnelId: selectedFunnelId,
        reward,
      };

      const response = await fetch('/api/coach/referral-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: selectedTargetType,
          targetId: selectedProgramId,
          referralConfig: config,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      // Generate the referral link
      await generateReferralLink();
      clearState();
      setStep('link');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const generateReferralLink = async () => {
    if (!selectedProgramId) return;

    setGeneratingLink(true);
    try {
      const response = await fetch('/api/referral/generate-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: 'program',
          targetId: selectedProgramId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedLink(data.referralUrl);
      }
    } catch (err) {
      console.error('Failed to generate link:', err);
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = async () => {
    if (!generatedLink) return;

    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleShare = async () => {
    if (!generatedLink) return;

    const targetName = selectedTarget?.name || selectedProgram?.name || 'this';

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${targetName}`,
          text: `Check out ${targetName}!`,
          url: generatedLink,
        });
      } catch (err) {
        // User cancelled or share failed
        console.error('Share failed:', err);
      }
    }
  };

  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  // Get step index for progress dots (3 steps total now: program/funnel, reward, link)
  const getStepIndex = () => {
    if (step === 'program' || step === 'funnel' || step === 'funnelCreate') return 0;
    if (step === 'reward') return 1;
    if (step === 'link') return 2;
    return 0;
  };

  const totalSteps = 3;

  // Header component (shared between mobile and desktop)
  const wizardHeader = (
    <div className="flex-shrink-0 px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {step !== 'program' && step !== 'link' && (
            <button
              type="button"
              onClick={handleBack}
              className="p-1.5 -ml-1.5 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-accent" />
              <h2 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Create Referral
              </h2>
            </div>
          </div>
        </div>
        {/* Hide X button on mobile - drawer has swipe-to-close handle */}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="hidden sm:block p-2 -mr-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
        >
          <X className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
        </button>
      </div>
    </div>
  );

  // Footer content (progress dots + action button)
  const wizardFooterContent = (
    <div className="flex items-center justify-between">
      {/* Progress dots */}
      <div className="flex items-center gap-2">
        {[...Array(totalSteps)].map((_, i) => (
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
      {step === 'link' ? (
        <button
          type="button"
          onClick={handleNext}
          className="px-6 py-2.5 bg-brand-accent text-white rounded-xl font-medium font-albert hover:bg-brand-accent/90 transition-colors"
        >
          Done
        </button>
      ) : step === 'funnelCreate' ? (
        <button
          type="button"
          onClick={handleNext}
          disabled={creatingFunnel || !funnelName.trim() || !funnelSlug.trim()}
          className="flex items-center gap-2 px-6 py-2.5 bg-brand-accent text-white rounded-xl font-medium font-albert hover:bg-brand-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creatingFunnel && <Loader2 className="w-4 h-4 animate-spin" />}
          {creatingFunnel ? 'Creating...' : 'Create & Continue'}
        </button>
      ) : step === 'reward' ? (
        <button
          type="button"
          onClick={handleNext}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-brand-accent text-white rounded-xl font-medium font-albert hover:bg-brand-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving...' : 'Enable Referrals'}
          {!saving && <ArrowRight className="w-4 h-4" />}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleNext}
          disabled={
            (step === 'program' && !selectedProgramId) ||
            (step === 'funnel' && (!selectedFunnelId || funnels.length === 0))
          }
          className="flex items-center gap-2 px-6 py-2.5 bg-brand-accent text-white rounded-xl font-medium font-albert hover:bg-brand-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );

  // Main scrollable content
  const wizardMainContent = (
    <>
        <AnimatePresence mode="wait">
          {/* Step 1: Select Target (Program or Resource) */}
          {step === 'program' && (
            <motion.div
              key="program"
              variants={fadeVariants}
              initial={isInitialMount.current ? false : 'initial'}
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="space-y-4"
            >
              <p className="text-base font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                What do you want to refer people to?
              </p>
              {loadingPrograms ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-accent" />
                </div>
              ) : targets.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="w-12 h-12 text-[#5f5a55] mx-auto mb-3" />
                  <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-3">
                    No programs or resources found
                  </p>
                  <a
                    href="/coach?tab=programs"
                    className="inline-flex items-center gap-1 text-sm text-brand-accent hover:underline"
                  >
                    Create a program first
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Group targets by category */}
                  {Object.entries(
                    targets.reduce((acc, target) => {
                      const category = target.category;
                      if (!acc[category]) acc[category] = [];
                      acc[category].push(target);
                      return acc;
                    }, {} as Record<string, SelectableTarget[]>)
                  ).map(([category, categoryTargets]) => (
                    <div key={category}>
                      <p className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wide mb-2">
                        {category}
                      </p>
                      <div className="space-y-2">
                        {categoryTargets.map((target) => {
                          const isSelected = selectedProgramId === target.id && selectedTargetType === target.type;

                          return (
                            <button
                              key={`${target.type}-${target.id}`}
                              type="button"
                              onClick={() => handleTargetSelect(target.id, target.type)}
                              className={`group relative w-full p-4 rounded-2xl border-2 text-left transition-all ${
                                isSelected
                                  ? 'border-brand-accent bg-brand-accent/5'
                                  : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] hover:border-brand-accent/50'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p
                                    className={`text-base font-medium ${
                                      isSelected
                                        ? 'text-brand-accent'
                                        : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                                    }`}
                                  >
                                    {target.name}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {target.hasReferrals && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 flex items-center gap-1">
                                      <Gift className="w-3 h-3" />
                                      Enabled
                                    </span>
                                  )}
                                  {isSelected && (
                                    <div className="w-6 h-6 rounded-full bg-brand-accent flex items-center justify-center">
                                      <Check className="w-4 h-4 text-white" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Step 2: Select Funnel */}
          {step === 'funnel' && (
            <motion.div
              key="funnel"
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="space-y-4"
            >
              <p className="text-base font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Select the funnel referred users will go through
              </p>
              {loadingFunnels ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-accent" />
                </div>
              ) : funnels.length === 0 ? (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        No funnels available
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                        Create a funnel for referred users to go through when they sign up.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          const name = selectedTarget?.name || selectedProgram?.name || 'Referral';
                          setFunnelName(`${name} Funnel`);
                          handleFunnelNameChange(`${name} Funnel`);
                          setStep('funnelCreate');
                        }}
                        className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-brand-accent text-white rounded-xl font-medium font-albert hover:bg-brand-accent/90 transition-colors text-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Create Funnel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {funnels.map((funnel) => {
                      const isSelected = selectedFunnelId === funnel.id;

                      return (
                        <button
                          key={funnel.id}
                          type="button"
                          onClick={() => setSelectedFunnelId(funnel.id)}
                          className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${
                            isSelected
                              ? 'border-brand-accent bg-brand-accent/5'
                              : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] hover:border-brand-accent/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p
                                className={`text-base font-medium ${
                                  isSelected
                                    ? 'text-brand-accent'
                                    : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                                }`}
                              >
                                {funnel.name}
                              </p>
                              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                                /{funnel.slug}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {funnel.isDefault && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                  Default
                                </span>
                              )}
                              {isSelected && (
                                <div className="w-5 h-5 rounded-full bg-brand-accent flex items-center justify-center">
                                  <Check className="w-3 h-3 text-white" />
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const name = selectedTarget?.name || selectedProgram?.name || 'Referral';
                      setFunnelName(`${name} Funnel`);
                      handleFunnelNameChange(`${name} Funnel`);
                      setStep('funnelCreate');
                    }}
                    className="w-full p-4 rounded-2xl border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50 transition-all flex items-center justify-center gap-2 text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] hover:text-brand-accent"
                  >
                    <Plus className="w-4 h-4" />
                    Create new funnel
                  </button>
                </>
              )}
            </motion.div>
          )}

          {/* Step 2b: Create Funnel Inline */}
          {step === 'funnelCreate' && (
            <motion.div
              key="funnelCreate"
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="space-y-5"
            >
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                  Funnel Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={funnelName}
                  onChange={(e) => handleFunnelNameChange(e.target.value)}
                  placeholder="e.g., Referral Signup"
                  className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] focus:outline-none focus:ring-2 focus:ring-brand-accent"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                  URL Slug <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl focus-within:ring-2 focus-within:ring-brand-accent focus-within:border-transparent overflow-hidden">
                  <span className="pl-4 pr-1 py-3 text-[#a7a39e] dark:text-[#7d8190] font-albert text-sm whitespace-nowrap select-none">
                    /join/{selectedProgram?.slug || 'program'}/
                  </span>
                  <input
                    type="text"
                    value={funnelSlug}
                    onChange={(e) => setFunnelSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="your-slug"
                    className="flex-1 px-1 py-3 bg-transparent text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#c4c0bb] dark:placeholder:text-[#4a4f5c] focus:outline-none"
                  />
                </div>
              </div>

              {/* Access Type */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-3">
                  Access
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFunnelAccessType('public')}
                    className={`p-3 rounded-xl border-2 transition-all text-left ${
                      funnelAccessType === 'public'
                        ? 'border-brand-accent bg-brand-accent/5'
                        : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] hover:border-brand-accent/50'
                    }`}
                  >
                    <span className="block font-medium text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                      Public
                    </span>
                    <span className="block text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-0.5">
                      Anyone with link
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFunnelAccessType('invite_only')}
                    className={`p-3 rounded-xl border-2 transition-all text-left ${
                      funnelAccessType === 'invite_only'
                        ? 'border-brand-accent bg-brand-accent/5'
                        : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] hover:border-brand-accent/50'
                    }`}
                  >
                    <span className="block font-medium text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                      Invite Only
                    </span>
                    <span className="block text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-0.5">
                      Requires invite code
                    </span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: Configure Reward */}
          {step === 'reward' && (
            <motion.div
              key="reward"
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="space-y-4"
            >
              <ReferralRewardSelector
                value={reward}
                onChange={setReward}
                organizationId={organizationId}
              />
            </motion.div>
          )}

          {/* Step 4: Copy Link */}
          {step === 'link' && (
            <motion.div
              key="link"
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="space-y-4"
            >
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                  Referrals Enabled!
                </h3>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  Share this link with your members so they can start referring friends
                </p>
              </div>

              {generatingLink ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-[#5f5a55]" />
                </div>
              ) : generatedLink ? (
                <div className="space-y-3">
                  <div className="p-3 bg-[#f8f6f4] dark:bg-[#11141b] rounded-xl border border-[#e1ddd8] dark:border-[#262b35]">
                    <p className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-mono break-all">
                      {generatedLink}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleCopyLink}
                      className="flex-1 bg-brand-accent hover:bg-brand-accent/90 text-white"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy Link
                        </>
                      )}
                    </Button>

                    {canShare && (
                      <Button onClick={handleShare} variant="outline">
                        <Share2 className="w-4 h-4 mr-2" />
                        Share
                      </Button>
                    )}
                  </div>
                </div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
    </>
  );

  // Desktop: full wizard content with inline footer
  const wizardContent = (
    <div className="flex flex-col h-full relative">
      {wizardHeader}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-6">
        {error && (
          <div className="mb-5 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="text-red-600 dark:text-red-400 text-sm font-albert">{error}</p>
          </div>
        )}
        {wizardMainContent}
      </div>
      <div className="flex-shrink-0 px-6 py-4 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50">
        {wizardFooterContent}
      </div>
    </div>
  );

  // Render mobile drawer or desktop dialog
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[85vh] max-h-[700px] flex flex-col">
          <VisuallyHidden>
            <DrawerTitle>Create Referral</DrawerTitle>
          </VisuallyHidden>
          {wizardHeader}
          <DrawerScrollArea className="px-5 py-6">
            {error && (
              <div className="mb-5 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <p className="text-red-600 dark:text-red-400 text-sm font-albert">{error}</p>
              </div>
            )}
            {wizardMainContent}
          </DrawerScrollArea>
          <DrawerFooter style={{ paddingBottom: 'max(1.75rem, env(safe-area-inset-bottom, 1.75rem))' }}>
            {wizardFooterContent}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-[10000]" onClose={() => onOpenChange(false)}>
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
              <Dialog.Panel className="w-full max-w-lg max-h-[85vh] transform rounded-3xl bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] shadow-2xl shadow-black/10 dark:shadow-black/30 transition-all flex flex-col overflow-hidden">
                {wizardContent}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
