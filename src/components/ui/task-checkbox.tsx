'use client';

import { cn } from '@/lib/utils';

interface TaskCheckboxProps {
  isCompleted: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * TaskCheckbox - A branded checkbox matching Daily Focus style
 *
 * Uses org branding (brand-accent) color and shows a filled inner square when completed.
 * This is the standard checkbox style used across the program editor views.
 */
export function TaskCheckbox({ isCompleted, size = 'md', className }: TaskCheckboxProps) {
  const sizeClasses = {
    sm: { outer: 'w-5 h-5', inner: 'w-3 h-3' },
    md: { outer: 'w-6 h-6', inner: 'w-4 h-4' },
    lg: { outer: 'w-7 h-7', inner: 'w-5 h-5' },
  };

  const { outer, inner } = sizeClasses[size];

  return (
    <div
      className={cn(
        outer,
        'rounded-lg border flex items-center justify-center flex-shrink-0 transition-all duration-300',
        isCompleted
          ? 'border-brand-accent bg-white dark:bg-[#181d26]'
          : 'border-[#d4d0cb] dark:border-[#3d4351] bg-white dark:bg-[#181d26]',
        className
      )}
    >
      {isCompleted && (
        <div
          className={cn(
            inner,
            'bg-brand-accent rounded-sm animate-in zoom-in-50 duration-300'
          )}
        />
      )}
    </div>
  );
}

/**
 * TaskCheckboxWithProgress - Shows completion rate inside when not fully complete
 *
 * Used for cohort task completion where we want to show partial progress.
 */
interface TaskCheckboxWithProgressProps extends TaskCheckboxProps {
  completionRate?: number;
  showProgress?: boolean;
}

export function TaskCheckboxWithProgress({
  isCompleted,
  completionRate = 0,
  showProgress = true,
  size = 'md',
  className
}: TaskCheckboxWithProgressProps) {
  const sizeClasses = {
    sm: { outer: 'w-5 h-5', inner: 'w-3 h-3', text: 'text-[8px]' },
    md: { outer: 'w-6 h-6', inner: 'w-4 h-4', text: 'text-[9px]' },
    lg: { outer: 'w-7 h-7', inner: 'w-5 h-5', text: 'text-[10px]' },
  };

  const { outer, inner, text } = sizeClasses[size];

  return (
    <div
      className={cn(
        outer,
        'rounded-lg border flex items-center justify-center flex-shrink-0 transition-all duration-300',
        isCompleted
          ? 'border-brand-accent bg-white dark:bg-[#181d26]'
          : 'border-[#d4d0cb] dark:border-[#3d4351] bg-white dark:bg-[#181d26]',
        className
      )}
    >
      {isCompleted ? (
        <div
          className={cn(
            inner,
            'bg-brand-accent rounded-sm animate-in zoom-in-50 duration-300'
          )}
        />
      ) : showProgress && completionRate > 0 ? (
        <span className={cn(text, 'font-bold text-brand-accent')}>{completionRate}</span>
      ) : null}
    </div>
  );
}
