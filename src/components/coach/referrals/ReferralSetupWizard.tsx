'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ReferralRewardSelector } from './ReferralRewardSelector';
import {
  Users,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  Copy,
  Share2,
  ExternalLink,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import type { Program, Funnel, ReferralReward, ReferralConfig } from '@/types';

type WizardStep = 'program' | 'funnel' | 'reward' | 'link';

interface ReferralSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId?: string;
  /** Pre-select a program (skip step 1) */
  initialProgramId?: string;
  /** Callback when referral is successfully enabled */
  onSuccess?: () => void;
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
  // Wizard state
  const [step, setStep] = useState<WizardStep>('program');
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(
    initialProgramId || null
  );
  const [selectedFunnelId, setSelectedFunnelId] = useState<string | null>(null);
  const [reward, setReward] = useState<ReferralReward | undefined>(undefined);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  // Data
  const [programs, setPrograms] = useState<Program[]>([]);
  const [funnels, setFunnels] = useState<Funnel[]>([]);

  // Loading states
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [loadingFunnels, setLoadingFunnels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  // UI states
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setStep(initialProgramId ? 'funnel' : 'program');
      setSelectedProgramId(initialProgramId || null);
      setSelectedFunnelId(null);
      setReward(undefined);
      setGeneratedLink(null);
      setError(null);
      setCopied(false);
    }
  }, [open, initialProgramId]);

  // Fetch programs
  useEffect(() => {
    if (!open) return;

    const fetchPrograms = async () => {
      setLoadingPrograms(true);
      try {
        const response = await fetch('/api/coach/org-programs');
        if (response.ok) {
          const data = await response.json();
          setPrograms(data.programs || []);
        }
      } catch (err) {
        console.error('Failed to fetch programs:', err);
      } finally {
        setLoadingPrograms(false);
      }
    };

    fetchPrograms();
  }, [open]);

  // Fetch funnels when program is selected
  useEffect(() => {
    if (!selectedProgramId) {
      setFunnels([]);
      return;
    }

    const fetchFunnels = async () => {
      setLoadingFunnels(true);
      try {
        const response = await fetch('/api/coach/org-funnels');
        if (response.ok) {
          const data = await response.json();
          // Filter funnels that target this program
          const programFunnels = (data.funnels || []).filter(
            (f: Funnel) => f.programId === selectedProgramId
          );
          setFunnels(programFunnels);
        }
      } catch (err) {
        console.error('Failed to fetch funnels:', err);
      } finally {
        setLoadingFunnels(false);
      }
    };

    fetchFunnels();
  }, [selectedProgramId]);

  const selectedProgram = programs.find((p) => p.id === selectedProgramId);
  const hasExistingReferrals = selectedProgram?.referralConfig?.enabled;

  const handleProgramSelect = (programId: string) => {
    setSelectedProgramId(programId);
    setSelectedFunnelId(null);
    setError(null);
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

      case 'reward':
        // Save the referral config
        await saveReferralConfig();
        break;

      case 'link':
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
      case 'reward':
        setStep('funnel');
        break;
      case 'link':
        setStep('reward');
        break;
    }
  };

  const saveReferralConfig = async () => {
    if (!selectedProgramId || !selectedFunnelId) return;

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
          targetType: 'program',
          targetId: selectedProgramId,
          config,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      // Generate the referral link
      await generateReferralLink();
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
    if (!generatedLink || !selectedProgram) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${selectedProgram.name}`,
          text: `Check out ${selectedProgram.name}!`,
          url: generatedLink,
        });
      } catch (err) {
        // User cancelled or share failed
        console.error('Share failed:', err);
      }
    }
  };

  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  const getStepNumber = () => {
    const steps: WizardStep[] = ['program', 'funnel', 'reward', 'link'];
    const startIndex = initialProgramId ? 1 : 0;
    const currentIndex = steps.indexOf(step);
    return currentIndex - startIndex + 1;
  };

  const getTotalSteps = () => {
    return initialProgramId ? 3 : 4;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-accent" />
            Enable Referrals
          </DialogTitle>
          <DialogDescription>
            {step === 'link'
              ? 'Your referral link is ready!'
              : `Step ${getStepNumber()} of ${getTotalSteps()}`}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[280px]">
          {/* Step 1: Select Program */}
          {step === 'program' && (
            <div className="space-y-4">
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                Select a program to enable referrals
              </p>

              {loadingPrograms ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#5f5a55]" />
                </div>
              ) : programs.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="w-12 h-12 text-[#5f5a55] mx-auto mb-3" />
                  <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-3">
                    No programs found
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
                <div className="space-y-2 max-h-[240px] overflow-y-auto">
                  {programs.map((program) => {
                    const isSelected = selectedProgramId === program.id;
                    const hasReferrals = program.referralConfig?.enabled;

                    return (
                      <button
                        key={program.id}
                        type="button"
                        onClick={() => handleProgramSelect(program.id)}
                        className={`w-full p-3 rounded-lg border text-left transition-all ${
                          isSelected
                            ? 'border-brand-accent bg-brand-accent/10 dark:bg-brand-accent/20'
                            : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p
                              className={`text-sm font-medium ${
                                isSelected
                                  ? 'text-brand-accent'
                                  : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                              }`}
                            >
                              {program.name}
                            </p>
                            {program.type && (
                              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] capitalize">
                                {program.type.replace('_', ' ')}
                              </p>
                            )}
                          </div>
                          {hasReferrals && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                              Referrals enabled
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Funnel */}
          {step === 'funnel' && (
            <div className="space-y-4">
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                Select a funnel for referred users to go through
              </p>

              {loadingFunnels ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#5f5a55]" />
                </div>
              ) : funnels.length === 0 ? (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        No funnels for this program
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                        Create a funnel that targets this program, then come back to enable
                        referrals.
                      </p>
                      <a
                        href="/coach?tab=funnels"
                        className="inline-flex items-center gap-1 text-xs text-brand-accent hover:underline mt-2"
                      >
                        Go to Funnels
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-[240px] overflow-y-auto">
                  {funnels.map((funnel) => {
                    const isSelected = selectedFunnelId === funnel.id;

                    return (
                      <button
                        key={funnel.id}
                        type="button"
                        onClick={() => setSelectedFunnelId(funnel.id)}
                        className={`w-full p-3 rounded-lg border text-left transition-all ${
                          isSelected
                            ? 'border-brand-accent bg-brand-accent/10 dark:bg-brand-accent/20'
                            : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p
                              className={`text-sm font-medium ${
                                isSelected
                                  ? 'text-brand-accent'
                                  : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                              }`}
                            >
                              {funnel.name}
                            </p>
                            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                              /join/{funnel.slug}
                            </p>
                          </div>
                          {funnel.isDefault && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                              Default
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Configure Reward */}
          {step === 'reward' && (
            <div className="space-y-4">
              <ReferralRewardSelector
                value={reward}
                onChange={setReward}
                organizationId={organizationId}
              />
            </div>
          )}

          {/* Step 4: Copy Link */}
          {step === 'link' && (
            <div className="space-y-4">
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
                  <div className="p-3 bg-[#f8f6f4] dark:bg-[#11141b] rounded-lg border border-[#e1ddd8] dark:border-[#262b35]">
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
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400 font-albert">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
          {step !== 'program' && step !== 'link' ? (
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={saving}
              className="text-[#5f5a55]"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          ) : (
            <div />
          )}

          <Button
            onClick={handleNext}
            disabled={
              saving ||
              generatingLink ||
              (step === 'program' && !selectedProgramId) ||
              (step === 'funnel' && (!selectedFunnelId || funnels.length === 0))
            }
            className="bg-brand-accent hover:bg-brand-accent/90 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : step === 'link' ? (
              'Done'
            ) : step === 'reward' ? (
              <>
                Enable Referrals
                <ChevronRight className="w-4 h-4 ml-1" />
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
