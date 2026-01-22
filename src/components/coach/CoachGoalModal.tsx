'use client';

import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Target, DollarSign, Users, TrendingUp, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CoachGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CoachGoalData) => Promise<void>;
  initialData?: CoachGoalData;
  currentMRR?: number;
  activeClients?: number;
}

export interface CoachGoalData {
  monthlyRevenueGoal: number;
  targetClients?: number;
}

// Glass card style matching CoachHomePage
const glassCard = cn(
  'bg-white/70 dark:bg-[#1a1f2a]/70',
  'backdrop-blur-xl',
  'border border-white/20 dark:border-white/5',
  'shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08)]',
  'dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.3)]'
);

// Preset MRR goals for quick selection
const MRR_PRESETS = [
  { value: 5000, label: '$5K', description: 'Side income' },
  { value: 10000, label: '$10K', description: 'Full-time' },
  { value: 25000, label: '$25K', description: 'Scaling up' },
  { value: 50000, label: '$50K', description: 'Team building' },
];

export function CoachGoalModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  currentMRR = 0,
  activeClients = 0,
}: CoachGoalModalProps) {
  const [monthlyGoal, setMonthlyGoal] = useState<number>(initialData?.monthlyRevenueGoal || 10000);
  const [targetClients, setTargetClients] = useState<number | undefined>(initialData?.targetClients);
  const [saving, setSaving] = useState(false);
  const [customGoal, setCustomGoal] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setMonthlyGoal(initialData?.monthlyRevenueGoal || 10000);
      setTargetClients(initialData?.targetClients);
      setCustomGoal('');
      setShowCustomInput(false);
    }
  }, [isOpen, initialData]);

  // Calculate suggested metrics
  const avgRevenuePerClient = activeClients > 0 && currentMRR > 0
    ? Math.round(currentMRR / activeClients)
    : 500; // Default assumption

  const suggestedClients = avgRevenuePerClient > 0
    ? Math.ceil(monthlyGoal / avgRevenuePerClient)
    : 0;

  const gap = Math.max(monthlyGoal - currentMRR, 0);
  const progress = currentMRR > 0 ? Math.min((currentMRR / monthlyGoal) * 100, 100) : 0;

  const handleSave = async () => {
    if (monthlyGoal <= 0) return;

    setSaving(true);
    try {
      await onSave({
        monthlyRevenueGoal: monthlyGoal,
        targetClients: targetClients || suggestedClients,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save goal:', error);
    } finally {
      setSaving(false);
    }
  };

  const handlePresetSelect = (value: number) => {
    setMonthlyGoal(value);
    setShowCustomInput(false);
    setCustomGoal('');
  };

  const handleCustomGoalSubmit = () => {
    const parsed = parseInt(customGoal.replace(/[^0-9]/g, ''), 10);
    if (parsed > 0) {
      setMonthlyGoal(parsed);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={cn(
                'w-full max-w-lg transform overflow-hidden rounded-2xl p-6 text-left align-middle transition-all',
                glassCard
              )}>
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-text-tertiary" />
                </button>

                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 rounded-xl bg-brand-accent/10 dark:bg-brand-accent/20">
                    <Target className="w-5 h-5 text-brand-accent" />
                  </div>
                  <div>
                    <Dialog.Title className="font-albert text-xl font-semibold text-text-primary">
                      Set Your Revenue Goal
                    </Dialog.Title>
                    <p className="font-albert text-sm text-text-secondary mt-0.5">
                      What&apos;s your target monthly revenue?
                    </p>
                  </div>
                </div>

                {/* Current Progress (if any) */}
                {currentMRR > 0 && (
                  <div className="mb-6 p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200/30 dark:border-emerald-700/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-albert text-emerald-700 dark:text-emerald-300">Current MRR</span>
                      <span className="text-lg font-bold font-albert text-emerald-700 dark:text-emerald-300">
                        ${currentMRR.toLocaleString()}
                      </span>
                    </div>
                    {activeClients > 0 && (
                      <p className="text-xs font-albert text-emerald-600/80 dark:text-emerald-400/80">
                        {activeClients} active {activeClients === 1 ? 'client' : 'clients'} · ${avgRevenuePerClient}/avg
                      </p>
                    )}
                  </div>
                )}

                {/* MRR Goal Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium font-albert text-text-secondary mb-3">
                    Monthly Revenue Target
                  </label>

                  {/* Preset buttons */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {MRR_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => handlePresetSelect(preset.value)}
                        className={cn(
                          'p-3 rounded-xl border transition-all duration-200 text-center',
                          monthlyGoal === preset.value && !showCustomInput
                            ? 'bg-brand-accent/10 dark:bg-brand-accent/20 border-brand-accent/50 dark:border-brand-accent/30'
                            : 'bg-white/50 dark:bg-white/5 border-white/20 dark:border-white/10 hover:bg-white/70 dark:hover:bg-white/10'
                        )}
                      >
                        <p className="font-albert font-semibold text-text-primary text-lg">
                          {preset.label}
                        </p>
                        <p className="font-albert text-[10px] text-text-tertiary">
                          {preset.description}
                        </p>
                      </button>
                    ))}
                  </div>

                  {/* Custom goal input */}
                  {showCustomInput ? (
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                        <input
                          type="text"
                          value={customGoal}
                          onChange={(e) => setCustomGoal(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleCustomGoalSubmit()}
                          placeholder="Enter amount"
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/50 dark:bg-white/5 border border-white/20 dark:border-white/10 font-albert text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
                          autoFocus
                        />
                      </div>
                      <Button
                        onClick={handleCustomGoalSubmit}
                        size="sm"
                        className="px-4 rounded-xl"
                      >
                        Set
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowCustomInput(true)}
                      className="w-full p-3 rounded-xl border border-dashed border-text-tertiary/30 hover:border-brand-accent/50 text-text-tertiary hover:text-brand-accent font-albert text-sm transition-colors"
                    >
                      + Custom amount
                    </button>
                  )}
                </div>

                {/* Selected Goal Display */}
                <div className="mb-6 p-4 rounded-xl bg-black/5 dark:bg-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-albert text-text-secondary">Your Goal</span>
                    <span className="text-2xl font-bold font-albert text-text-primary">
                      ${monthlyGoal.toLocaleString()}/mo
                    </span>
                  </div>

                  {/* Progress bar */}
                  {currentMRR > 0 && (
                    <div className="mb-3">
                      <div className="h-2 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-accent rounded-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-xs font-albert text-text-tertiary mt-1.5">
                        {Math.round(progress)}% of goal · ${gap.toLocaleString()} to go
                      </p>
                    </div>
                  )}

                  {/* Suggested path */}
                  <div className="flex items-start gap-2 pt-3 border-t border-black/5 dark:border-white/5">
                    <Sparkles className="w-4 h-4 text-brand-accent flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-albert text-text-secondary">
                        {currentMRR >= monthlyGoal ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            You&apos;ve reached this goal! Consider setting a higher target.
                          </span>
                        ) : (
                          <>
                            At <span className="font-medium text-text-primary">${avgRevenuePerClient}/client</span>,
                            you need <span className="font-medium text-text-primary">{suggestedClients} clients</span> to hit this goal.
                            {activeClients > 0 && gap > 0 && (
                              <span className="text-text-tertiary">
                                {' '}That&apos;s {Math.max(suggestedClients - activeClients, 0)} more than you have now.
                              </span>
                            )}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Optional: Target Clients Override */}
                <details className="mb-6">
                  <summary className="cursor-pointer text-sm font-albert text-text-tertiary hover:text-text-secondary transition-colors">
                    Advanced: Set custom client target
                  </summary>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="relative flex-1">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                      <input
                        type="number"
                        value={targetClients || ''}
                        onChange={(e) => setTargetClients(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                        placeholder={`${suggestedClients} (suggested)`}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/50 dark:bg-white/5 border border-white/20 dark:border-white/10 font-albert text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
                        min={1}
                      />
                    </div>
                    <span className="text-sm font-albert text-text-tertiary">clients</span>
                  </div>
                </details>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={onClose}
                    className="flex-1 h-11 rounded-xl font-albert bg-white/50 dark:bg-white/5 border-white/20 dark:border-white/10"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving || monthlyGoal <= 0}
                    className="flex-1 h-11 rounded-xl font-albert gap-2"
                  >
                    {saving ? (
                      'Saving...'
                    ) : (
                      <>
                        <TrendingUp className="w-4 h-4" />
                        Set Goal
                      </>
                    )}
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
