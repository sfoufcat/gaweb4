'use client';

import { Settings, RefreshCw, Layers } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import type { TaskDistribution } from '@/types';

interface ProgramSettingsPopoverProps {
  taskDistribution: TaskDistribution;
  onTaskDistributionChange: (value: TaskDistribution) => void;
  isSaving?: boolean;
}

const distributionOptions: Array<{
  value: TaskDistribution;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'spread',
    label: 'Spread',
    description: 'Tasks distributed across the week (1-2 per day)',
    icon: <Layers className="w-4 h-4" />,
  },
  {
    value: 'repeat-daily',
    label: 'Repeat Daily',
    description: 'All week tasks appear every day',
    icon: <RefreshCw className="w-4 h-4" />,
  },
];

export function ProgramSettingsPopover({
  taskDistribution,
  onTaskDistributionChange,
  isSaving = false,
}: ProgramSettingsPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={isSaving}
        >
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline">Settings</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1">
              Program Settings
            </h4>
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              Configure how this program works
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              Task Distribution
            </label>
            <div className="space-y-2">
              {distributionOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => onTaskDistributionChange(option.value)}
                  disabled={isSaving}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-colors text-left ${
                    taskDistribution === option.value
                      ? 'border-brand-accent bg-brand-accent/5'
                      : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-[#c8c4bf] dark:hover:border-[#3a4150]'
                  }`}
                >
                  <div
                    className={`mt-0.5 ${
                      taskDistribution === option.value
                        ? 'text-brand-accent'
                        : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                    }`}
                  >
                    {option.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm font-medium font-albert ${
                        taskDistribution === option.value
                          ? 'text-brand-accent'
                          : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                      }`}
                    >
                      {option.label}
                    </div>
                    <div className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                      {option.description}
                    </div>
                  </div>
                  {taskDistribution === option.value && (
                    <div className="w-2 h-2 rounded-full bg-brand-accent mt-1.5" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-[#a7a39e] dark:text-[#7d8190] font-albert">
            Note: Tasks added directly to specific days always override this setting.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
