'use client';

import { useState, useEffect } from 'react';
import { Settings, RefreshCw, Layers, X, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { TaskDistribution } from '@/types';

interface ProgramSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskDistribution: TaskDistribution;
  onTaskDistributionChange: (value: TaskDistribution) => void;
  isSaving?: boolean;
  // For cohort completion threshold (group programs only)
  programType?: 'individual' | 'group';
  cohortCompletionThreshold?: number;
  onCohortCompletionThresholdChange?: (value: number) => void;
}

const distributionOptions: Array<{
  value: TaskDistribution;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'spread',
    label: 'Spread Across Week',
    description: 'Tasks are evenly distributed across the week, typically 1-2 tasks per day. Best for manageable daily workloads.',
    icon: <Layers className="w-5 h-5" />,
  },
  {
    value: 'repeat-daily',
    label: 'Repeat Daily',
    description: 'All week tasks appear every single day. Best for recurring habits or daily practice routines.',
    icon: <RefreshCw className="w-5 h-5" />,
  },
];

export function ProgramSettingsModal({
  isOpen,
  onClose,
  taskDistribution,
  onTaskDistributionChange,
  isSaving = false,
  programType,
  cohortCompletionThreshold,
  onCohortCompletionThresholdChange,
}: ProgramSettingsModalProps) {
  // Client-side only rendering to avoid hydration issues with portals
  const [isMounted, setIsMounted] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 768px)');

  // Local state for threshold slider to prevent API calls on every drag
  const [localThreshold, setLocalThreshold] = useState(cohortCompletionThreshold ?? 50);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Sync local state when prop changes (e.g., after save completes)
  useEffect(() => {
    setLocalThreshold(cohortCompletionThreshold ?? 50);
  }, [cohortCompletionThreshold]);

  const handleSelect = (value: TaskDistribution) => {
    if (value !== taskDistribution) {
      onTaskDistributionChange(value);
    }
  };

  // Only save when slider is released
  const handleThresholdCommit = () => {
    if (localThreshold !== cohortCompletionThreshold) {
      onCohortCompletionThresholdChange?.(localThreshold);
    }
  };

  const content = (
    <div className="space-y-6">
      {/* Task Distribution Section */}
      <div>
        <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1">
          Task Distribution
        </h3>
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
          How should week-level tasks appear on client&apos;s daily view?
        </p>

        <div className="space-y-3">
          {distributionOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              disabled={isSaving}
              className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                taskDistribution === option.value
                  ? 'border-brand-accent bg-brand-accent/5'
                  : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-[#c8c4bf] dark:hover:border-[#3a4150] bg-white dark:bg-[#1e222a]'
              } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                  taskDistribution === option.value
                    ? 'bg-brand-accent text-white'
                    : 'bg-[#f3f1ef] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2]'
                }`}
              >
                {option.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={`text-sm font-semibold font-albert mb-1 ${
                    taskDistribution === option.value
                      ? 'text-brand-accent'
                      : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                  }`}
                >
                  {option.label}
                </div>
                <div className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert leading-relaxed">
                  {option.description}
                </div>
              </div>
              {taskDistribution === option.value && (
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-accent flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Info Box */}
      <div className="flex gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/30">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 dark:text-blue-200 font-albert">
          <p className="font-medium mb-1">Manual assignments always override</p>
          <p className="text-blue-700 dark:text-blue-300 text-xs">
            Tasks you add directly to specific days will always appear on those days, regardless of this setting.
          </p>
        </div>
      </div>

      {/* Cohort Completion Threshold Section - Only for group programs */}
      {programType === 'group' && (
        <div className="pt-6 border-t border-[#e1ddd8] dark:border-[#262b35]">
          <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1">
            Cohort Completion Threshold
          </h3>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
            What percentage of cohort members must complete a task for it to show as &quot;completed&quot; to you?
          </p>

          {/* Slider with value display */}
          <div className="flex items-center gap-4 mb-3">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={localThreshold}
              onChange={(e) => setLocalThreshold(Number(e.target.value))}
              onPointerUp={handleThresholdCommit}
              onTouchEnd={handleThresholdCommit}
              disabled={isSaving}
              className="flex-1 h-2 bg-[#e1ddd8] dark:bg-[#262b35] rounded-lg appearance-none cursor-pointer accent-brand-accent disabled:opacity-50"
            />
            <span className="w-12 text-center text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
              {localThreshold}%
            </span>
          </div>

          {/* Quick select buttons */}
          <div className="flex gap-2 flex-wrap">
            {[0, 25, 50, 75, 100].map((value) => (
              <button
                key={value}
                onClick={() => {
                  setLocalThreshold(value);
                  onCohortCompletionThresholdChange?.(value);
                }}
                disabled={isSaving}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  localThreshold === value
                    ? 'bg-brand-accent text-white'
                    : 'bg-[#f3f1ef] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#e1ddd8] dark:hover:bg-[#3a4150]'
                } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {value === 0 ? 'Any' : `${value}%`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Don't render the dialog portal until mounted on client
  if (!isMounted) {
    return null;
  }

  // Desktop: Dialog
  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden rounded-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#f3f1ef] dark:bg-[#262b35] flex items-center justify-center">
                  <Settings className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                    Program Settings
                  </DialogTitle>
                  <DialogDescription className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                    Configure how this program works
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>
          <div className="p-6">
            {content}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Mobile: Drawer (slide up)
  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="px-6 pt-2 pb-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#f3f1ef] dark:bg-[#262b35] flex items-center justify-center">
              <Settings className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
            </div>
            <div>
              <DrawerTitle className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Program Settings
              </DrawerTitle>
              <DrawerDescription className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                Configure how this program works
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>
        <div className="p-6 overflow-y-auto">
          {content}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// Button trigger component for easy usage
interface ProgramSettingsButtonProps {
  onClick: () => void;
  isSaving?: boolean;
}

export function ProgramSettingsButton({ onClick, isSaving = false }: ProgramSettingsButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isSaving}
      className="p-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#1e222a] rounded-lg transition-colors disabled:opacity-50"
      title="Program Settings"
    >
      <Settings className="w-5 h-5" />
    </button>
  );
}
