'use client';

import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Target, DollarSign, Users, TrendingUp, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { useMediaQuery } from '@/hooks/useMediaQuery';

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

  const isMobile = useMediaQuery('(max-width: 768px)');

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

  // Modal content shared between Dialog and Drawer
  const modalContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-brand-accent/10 dark:bg-brand-accent/20">
            <Target className="w-5 h-5 text-brand-accent" />
          </div>
          <div>
            <h2 className="font-albert text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
              Set Your Revenue Goal
            </h2>
            <p className="font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2] mt-0.5">
              What&apos;s your target monthly revenue?
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
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
          <label className="block text-sm font-medium font-albert text-[#5f5a55] dark:text-[#b2b6c2] mb-3">
            Monthly Revenue Target
          </label>

          {/* Preset buttons */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {MRR_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => handlePresetSelect(preset.value)}
                className={`p-3 rounded-xl border transition-all duration-200 text-center ${
                  monthlyGoal === preset.value && !showCustomInput
                    ? 'bg-brand-accent/10 dark:bg-brand-accent/20 border-brand-accent/50 dark:border-brand-accent/30'
                    : 'bg-[#faf8f6] dark:bg-[#1d222b] border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35]'
                }`}
              >
                <p className="font-albert font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] text-lg">
                  {preset.label}
                </p>
                <p className="font-albert text-[10px] text-[#8c8a87] dark:text-[#8b8f9a]">
                  {preset.description}
                </p>
              </button>
            ))}
          </div>

          {/* Custom goal input */}
          {showCustomInput ? (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8c8a87] dark:text-[#8b8f9a]" />
                <input
                  type="text"
                  value={customGoal}
                  onChange={(e) => setCustomGoal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCustomGoalSubmit()}
                  placeholder="Enter amount"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white dark:bg-[#1d222b] border border-[#e1ddd8] dark:border-[#262b35] font-albert text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#8c8c8c] dark:placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
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
              className="w-full p-3 rounded-xl border border-dashed border-[#c4c0bb] dark:border-[#3d4452] hover:border-brand-accent/50 text-[#8c8a87] dark:text-[#8b8f9a] hover:text-brand-accent font-albert text-sm transition-colors"
            >
              + Custom amount
            </button>
          )}
        </div>

        {/* Selected Goal Display */}
        <div className="mb-6 p-4 rounded-xl bg-[#faf8f6] dark:bg-[#1d222b]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-albert text-[#5f5a55] dark:text-[#b2b6c2]">Your Goal</span>
            <span className="text-2xl font-bold font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
              ${monthlyGoal.toLocaleString()}/mo
            </span>
          </div>

          {/* Progress bar */}
          {currentMRR > 0 && (
            <div className="mb-3">
              <div className="h-2 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-accent rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs font-albert text-[#8c8a87] dark:text-[#8b8f9a] mt-1.5">
                {Math.round(progress)}% of goal · ${gap.toLocaleString()} to go
              </p>
            </div>
          )}

          {/* Suggested path */}
          <div className="flex items-start gap-2 pt-3 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50">
            <Sparkles className="w-4 h-4 text-brand-accent flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                {currentMRR >= monthlyGoal ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    You&apos;ve reached this goal! Consider setting a higher target.
                  </span>
                ) : (
                  <>
                    At <span className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">${avgRevenuePerClient}/client</span>,
                    you need <span className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">{suggestedClients} clients</span> to hit this goal.
                    {activeClients > 0 && gap > 0 && (
                      <span className="text-[#8c8a87] dark:text-[#8b8f9a]">
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
          <summary className="cursor-pointer text-sm font-albert text-[#8c8a87] dark:text-[#8b8f9a] hover:text-[#5f5a55] dark:hover:text-[#b2b6c2] transition-colors">
            Advanced: Set custom client target
          </summary>
          <div className="mt-3 flex items-center gap-3">
            <div className="relative flex-1">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8c8a87] dark:text-[#8b8f9a]" />
              <input
                type="number"
                value={targetClients || ''}
                onChange={(e) => setTargetClients(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                placeholder={`${suggestedClients} (suggested)`}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white dark:bg-[#1d222b] border border-[#e1ddd8] dark:border-[#262b35] font-albert text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#8c8c8c] dark:placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
                min={1}
              />
            </div>
            <span className="text-sm font-albert text-[#8c8a87] dark:text-[#8b8f9a]">clients</span>
          </div>
        </details>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50">
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl font-albert bg-white dark:bg-[#1d222b] border-[#e1ddd8] dark:border-[#262b35]"
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
      </div>
    </div>
  );

  // Render mobile drawer or desktop dialog
  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="h-[90vh] max-h-[90vh]">
          {modalContent}
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

        <div className="fixed inset-0 z-[10001] overflow-y-auto">
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
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-[#171b22] border border-[#e1ddd8]/50 dark:border-[#262b35]/50 shadow-2xl shadow-black/10 dark:shadow-black/30 transition-all">
                {modalContent}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
