import * as React from 'react';
import { Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TaskPriority } from '@/types';

export interface PriorityBadgeProps {
  priority: TaskPriority;
  size?: 'sm' | 'md';
  className?: string;
}

const priorityConfig = {
  high: {
    label: 'High',
    color: 'text-red-500 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
  },
  medium: {
    label: 'Medium',
    color: 'text-orange-500 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    border: 'border-orange-200 dark:border-orange-800',
  },
  low: {
    label: 'Low',
    color: 'text-yellow-500 dark:text-yellow-400',
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-200 dark:border-yellow-800',
  },
} as const;

// Flag icon with priority color - the main visual element
export function PriorityIcon({
  priority,
  size = 'sm',
  className,
}: PriorityBadgeProps) {
  const config = priorityConfig[priority];

  return (
    <Flag
      className={cn(
        size === 'sm' ? 'w-4 h-4' : 'w-5 h-5',
        config.color,
        className
      )}
      fill="currentColor"
    />
  );
}

// Badge with label (for WeekEditor display)
export function PriorityBadge({
  priority,
  size = 'sm',
  className,
}: PriorityBadgeProps) {
  const config = priorityConfig[priority];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
        config.bg,
        config.border,
        config.color,
        className
      )}
    >
      <Flag className={cn(size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5')} fill="currentColor" />
      {config.label}
    </span>
  );
}

// Dot variant for calendar/schedule views
export function PriorityDot({
  priority,
  className,
}: {
  priority?: TaskPriority;
  className?: string;
}) {
  const dotColor = priority
    ? priority === 'high'
      ? 'bg-red-500'
      : priority === 'medium'
      ? 'bg-orange-500'
      : 'bg-yellow-500'
    : 'bg-brand-accent';

  return (
    <span
      className={cn(
        'inline-block w-1.5 h-1.5 rounded-full',
        dotColor,
        className
      )}
    />
  );
}

// Clickable priority toggle - cycles through: none → high → medium → low → none
export function PriorityToggle({
  value,
  onChange,
  size = 'sm',
  className,
}: {
  value?: TaskPriority;
  onChange: (priority: TaskPriority | undefined) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const cycle = () => {
    if (!value) onChange('high');
    else if (value === 'high') onChange('medium');
    else if (value === 'medium') onChange('low');
    else onChange(undefined);
  };

  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <button
      type="button"
      onClick={cycle}
      className={cn(
        'flex items-center justify-center rounded-lg transition-all',
        size === 'sm' ? 'p-1.5' : 'p-2',
        value
          ? priorityConfig[value].color
          : 'text-[#a7a39e] dark:text-[#7d8190] hover:text-[#5f5a55] dark:hover:text-[#b2b6c2] hover:bg-[#faf8f6] dark:hover:bg-[#1e222a]',
        className
      )}
      title={value ? `Priority: ${priorityConfig[value].label}` : 'Set priority'}
    >
      <Flag className={iconSize} fill={value ? 'currentColor' : 'none'} />
    </button>
  );
}

export { priorityConfig };
