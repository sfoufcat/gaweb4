'use client';

import { useViewMode } from '@/contexts/ViewModeContext';
import { cn } from '@/lib/utils';
import { User, Shield } from 'lucide-react';

interface ViewSwitcherProps {
  /** Compact mode - icons only */
  compact?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * ViewSwitcher - Toggle between Coach and Client views
 *
 * Only renders for users who have coach access.
 * Subtle segmented control design that matches the app's aesthetic.
 */
export function ViewSwitcher({ compact = false, className }: ViewSwitcherProps) {
  const { viewMode, setViewMode, canAccessCoachView, isLoading } = useViewMode();

  // Don't render for non-coaches or while loading
  if (!canAccessCoachView || isLoading) {
    return null;
  }

  const isCoachView = viewMode === 'coach';

  if (compact) {
    // Compact mode - single button that toggles
    return (
      <button
        onClick={() => setViewMode(isCoachView ? 'client' : 'coach')}
        title={isCoachView ? 'Switch to Client View' : 'Switch to Coach View'}
        className={cn(
          'flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200',
          'bg-[#f5f3f0] dark:bg-[#1a1f2a] hover:bg-[#ebe8e4] dark:hover:bg-[#242a38]',
          className
        )}
      >
        {isCoachView ? (
          <Shield className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
        ) : (
          <User className="w-5 h-5 text-[#5f5a55] dark:text-[#b5b0ab]" />
        )}
      </button>
    );
  }

  // Full mode - segmented control
  return (
    <div
      className={cn(
        'flex items-center p-1 rounded-xl',
        'bg-[#f5f3f0] dark:bg-[#1a1f2a]',
        className
      )}
    >
      <button
        onClick={() => setViewMode('client')}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
          !isCoachView
            ? 'bg-white dark:bg-[#272d38] text-[#1a1a1a] dark:text-[#faf8f6] shadow-sm'
            : 'text-[#5f5a55] dark:text-[#b5b0ab] hover:text-[#1a1a1a] dark:hover:text-[#faf8f6]'
        )}
      >
        <User className="w-4 h-4" />
        <span>Client</span>
      </button>
      <button
        onClick={() => setViewMode('coach')}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
          isCoachView
            ? 'bg-white dark:bg-[#272d38] text-[#1a1a1a] dark:text-[#faf8f6] shadow-sm'
            : 'text-[#5f5a55] dark:text-[#b5b0ab] hover:text-[#1a1a1a] dark:hover:text-[#faf8f6]'
        )}
      >
        <Shield className="w-4 h-4" />
        <span>Coach</span>
      </button>
    </div>
  );
}

/**
 * ViewSwitcherInline - Horizontal inline version for headers
 */
export function ViewSwitcherInline({ className }: { className?: string }) {
  const { viewMode, setViewMode, canAccessCoachView, isLoading } = useViewMode();

  if (!canAccessCoachView || isLoading) {
    return null;
  }

  const isCoachView = viewMode === 'coach';

  return (
    <div
      className={cn(
        'inline-flex items-center p-0.5 rounded-lg',
        'bg-[#f5f3f0]/80 dark:bg-[#1a1f2a]/80 backdrop-blur-sm',
        'border border-[#e1ddd8]/50 dark:border-[#272d38]/50',
        className
      )}
    >
      <button
        onClick={() => setViewMode('client')}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200',
          !isCoachView
            ? 'bg-white dark:bg-[#272d38] text-[#1a1a1a] dark:text-[#faf8f6] shadow-sm'
            : 'text-[#5f5a55] dark:text-[#b5b0ab] hover:text-[#1a1a1a] dark:hover:text-[#faf8f6]'
        )}
      >
        <User className="w-3.5 h-3.5" />
        <span>Client</span>
      </button>
      <button
        onClick={() => setViewMode('coach')}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200',
          isCoachView
            ? 'bg-white dark:bg-[#272d38] text-[#1a1a1a] dark:text-[#faf8f6] shadow-sm'
            : 'text-[#5f5a55] dark:text-[#b5b0ab] hover:text-[#1a1a1a] dark:hover:text-[#faf8f6]'
        )}
      >
        <Shield className="w-3.5 h-3.5" />
        <span>Coach</span>
      </button>
    </div>
  );
}
