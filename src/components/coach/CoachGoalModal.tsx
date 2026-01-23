'use client';

import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Target, DollarSign, TrendingUp, Calendar as CalendarIcon } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface CoachGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CoachGoalData) => Promise<void>;
  initialData?: CoachGoalData;
  currentRevenue?: number; // Revenue since goal start (or 0 if no goal)
}

export interface CoachGoalData {
  revenueGoal: number;
  revenueGoalDeadline: string; // ISO date YYYY-MM-DD
  // Legacy fields for backwards compatibility
  monthlyRevenueGoal?: number;
  targetClients?: number;
}

// Preset revenue goals for quick selection
const REVENUE_PRESETS = [
  { value: 5000, label: '$5K', description: 'Side income' },
  { value: 10000, label: '$10K', description: 'Full-time' },
  { value: 25000, label: '$25K', description: 'Scaling up' },
  { value: 50000, label: '$50K', description: 'Team building' },
];

// Deadline presets (days from now)
const DEADLINE_PRESETS = [
  { days: 30, label: '30 days' },
  { days: 60, label: '60 days' },
  { days: 90, label: '90 days' },
];

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDateFromDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function getDaysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function CoachGoalModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  currentRevenue = 0,
}: CoachGoalModalProps) {
  const [revenueGoal, setRevenueGoal] = useState<number>(initialData?.revenueGoal || 10000);
  const [deadline, setDeadline] = useState<string>(initialData?.revenueGoalDeadline || getDateFromDays(30));
  const [selectedDeadlinePreset, setSelectedDeadlinePreset] = useState<number | null>(30);
  const [saving, setSaving] = useState(false);
  const [customGoal, setCustomGoal] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showCustomDate, setShowCustomDate] = useState(false);

  const isMobile = useMediaQuery('(max-width: 768px)');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialData?.revenueGoal) {
        setRevenueGoal(initialData.revenueGoal);
      } else {
        setRevenueGoal(10000);
      }

      if (initialData?.revenueGoalDeadline) {
        setDeadline(initialData.revenueGoalDeadline);
        // Check if it matches a preset
        const daysUntil = getDaysUntil(initialData.revenueGoalDeadline);
        const matchingPreset = DEADLINE_PRESETS.find(p => Math.abs(p.days - daysUntil) <= 1);
        setSelectedDeadlinePreset(matchingPreset?.days || null);
        setShowCustomDate(!matchingPreset);
      } else {
        setDeadline(getDateFromDays(30));
        setSelectedDeadlinePreset(30);
        setShowCustomDate(false);
      }

      setCustomGoal('');
      setShowCustomInput(false);
    }
  }, [isOpen, initialData]);

  // Calculate progress
  const progress = currentRevenue > 0 && revenueGoal > 0
    ? Math.min((currentRevenue / revenueGoal) * 100, 100)
    : 0;
  const gap = Math.max(revenueGoal - currentRevenue, 0);
  const daysLeft = getDaysUntil(deadline);

  const handleSave = async () => {
    if (revenueGoal <= 0 || !deadline) return;

    setSaving(true);
    try {
      await onSave({
        revenueGoal,
        revenueGoalDeadline: deadline,
        // Legacy field for backwards compatibility
        monthlyRevenueGoal: revenueGoal,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save goal:', error);
    } finally {
      setSaving(false);
    }
  };

  const handlePresetSelect = (value: number) => {
    setRevenueGoal(value);
    setShowCustomInput(false);
    setCustomGoal('');
  };

  const handleDeadlinePresetSelect = (days: number) => {
    setDeadline(getDateFromDays(days));
    setSelectedDeadlinePreset(days);
    setShowCustomDate(false);
  };

  const handleCustomGoalSubmit = () => {
    const parsed = parseInt(customGoal.replace(/[^0-9]/g, ''), 10);
    if (parsed > 0) {
      setRevenueGoal(parsed);
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
              Set Revenue Goal
            </h2>
            <p className="font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2] mt-0.5">
              How much do you want to earn?
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
        {/* Revenue Goal Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium font-albert text-[#5f5a55] dark:text-[#b2b6c2] mb-3">
            Revenue Target
          </label>

          {/* Preset buttons */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {REVENUE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => handlePresetSelect(preset.value)}
                className={`p-3 rounded-xl border transition-all duration-200 text-center ${
                  revenueGoal === preset.value && !showCustomInput
                    ? 'bg-[#f3f1ef] dark:bg-[#262b35] border-brand-accent/50 dark:border-brand-accent/30 shadow-sm'
                    : 'bg-white dark:bg-[#171b22] border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35]'
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
                className="px-5 py-2.5 h-auto rounded-xl"
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

        {/* Deadline Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium font-albert text-[#5f5a55] dark:text-[#b2b6c2] mb-3">
            Deadline
          </label>

          {/* Deadline preset buttons */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {DEADLINE_PRESETS.map((preset) => (
              <button
                key={preset.days}
                onClick={() => handleDeadlinePresetSelect(preset.days)}
                className={`p-3 rounded-xl border transition-all duration-200 text-center ${
                  selectedDeadlinePreset === preset.days && !showCustomDate
                    ? 'bg-[#f3f1ef] dark:bg-[#262b35] border-brand-accent/50 dark:border-brand-accent/30 shadow-sm'
                    : 'bg-white dark:bg-[#171b22] border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35]'
                }`}
              >
                <p className="font-albert font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                  {preset.label}
                </p>
                <p className="font-albert text-[10px] text-[#8c8a87] dark:text-[#8b8f9a]">
                  {formatDate(getDateFromDays(preset.days))}
                </p>
              </button>
            ))}
          </div>

          {/* Custom date picker */}
          {showCustomDate ? (
            <DatePicker
              value={deadline}
              onChange={(date) => {
                setDeadline(date);
                setSelectedDeadlinePreset(null);
              }}
              minDate={new Date()}
              displayFormat="MMM d, yyyy"
              placeholder="Select deadline"
            />
          ) : (
            <button
              onClick={() => {
                setShowCustomDate(true);
                setSelectedDeadlinePreset(null);
              }}
              className="w-full p-3 rounded-xl border border-dashed border-[#c4c0bb] dark:border-[#3d4452] hover:border-brand-accent/50 text-[#8c8a87] dark:text-[#8b8f9a] hover:text-brand-accent font-albert text-sm transition-colors"
            >
              + Custom date
            </button>
          )}
        </div>

        {/* Goal Summary */}
        <div className="p-4 rounded-xl bg-[#faf8f6] dark:bg-[#1d222b]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-albert text-[#5f5a55] dark:text-[#b2b6c2]">Your Goal</span>
            <div className="text-right">
              <span className="text-2xl font-bold font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                ${revenueGoal.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
            <CalendarIcon className="w-4 h-4" />
            <span>by {formatDate(deadline)}</span>
            <span className="text-[#8c8a87] dark:text-[#8b8f9a]">
              ({daysLeft} {daysLeft === 1 ? 'day' : 'days'} from now)
            </span>
          </div>

          {/* Progress bar (only if there's existing progress) */}
          {currentRevenue > 0 && (
            <div className="mt-4 pt-4 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-albert text-[#8c8a87] dark:text-[#8b8f9a]">
                  Current progress
                </span>
                <span className="text-xs font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                  ${currentRevenue.toLocaleString()} of ${revenueGoal.toLocaleString()}
                </span>
              </div>
              <div className="h-2 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-accent rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs font-albert text-[#8c8a87] dark:text-[#8b8f9a] mt-1.5">
                {Math.round(progress)}% complete · ${gap.toLocaleString()} to go
              </p>
            </div>
          )}
        </div>
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
            disabled={saving || revenueGoal <= 0 || !deadline}
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
