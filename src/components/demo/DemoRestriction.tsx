'use client';

import { useDemoMode } from '@/contexts/DemoModeContext';
import { Lock } from 'lucide-react';

interface DemoRestrictionProps {
  children: React.ReactNode;
  /** What action this restriction applies to */
  action?: string;
  /** Whether to show inline badge or wrap children */
  variant?: 'badge' | 'wrap' | 'tooltip';
  /** Custom class for the wrapper */
  className?: string;
}

/**
 * DemoRestriction Component
 * 
 * Shows a "Not available in demo mode" indicator for restricted actions.
 * 
 * Usage:
 * ```tsx
 * <DemoRestriction action="create post">
 *   <Button onClick={handleCreate}>Create Post</Button>
 * </DemoRestriction>
 * ```
 */
export function DemoRestriction({ 
  children, 
  action = 'This action',
  variant = 'wrap',
  className = '',
}: DemoRestrictionProps) {
  const { isDemoMode } = useDemoMode();

  // Not in demo mode - render children normally
  if (!isDemoMode) {
    return <>{children}</>;
  }

  // Badge variant - just show a small badge
  if (variant === 'badge') {
    return (
      <div className={`relative inline-flex ${className}`}>
        {children}
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500/90 text-[10px]">
          <Lock className="h-2.5 w-2.5 text-white" />
        </span>
      </div>
    );
  }

  // Tooltip variant - show tooltip on hover
  if (variant === 'tooltip') {
    return (
      <div className={`relative group inline-flex ${className}`}>
        <div className="opacity-50 cursor-not-allowed">
          {children}
        </div>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#1a1a1a] text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
          Not available in demo
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1a1a1a]" />
        </div>
      </div>
    );
  }

  // Wrap variant (default) - dim children and show message
  return (
    <div className={`relative ${className}`}>
      <div className="opacity-50 pointer-events-none select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-[2px] rounded-xl">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 rounded-lg">
          <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
            {action} not available in demo
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to check if an action should be blocked in demo mode
 * Returns a handler wrapper that shows a toast/alert instead of executing
 */
export function useDemoRestriction() {
  const { isDemoMode } = useDemoMode();

  const wrapHandler = <T extends (...args: unknown[]) => unknown>(
    handler: T,
    actionName: string = 'This action'
  ): T => {
    if (!isDemoMode) {
      return handler;
    }

    return ((...args: unknown[]) => {
      // In demo mode, show alert instead of executing
      console.log(`[Demo Mode] Blocked action: ${actionName}`);
      // Could show a toast here instead
      alert(`${actionName} is not available in demo mode`);
    }) as T;
  };

  return {
    isDemoMode,
    wrapHandler,
    /** Check if action should be blocked */
    shouldBlock: isDemoMode,
  };
}

/**
 * DemoModeBanner Component
 * 
 * A banner shown at the top of pages in demo mode
 */
export function DemoModeBanner() {
  const { isDemoMode } = useDemoMode();

  if (!isDemoMode) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-b border-amber-200 dark:border-amber-800/50 px-4 py-2">
      <div className="flex items-center justify-center gap-2">
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/30">
          <svg className="w-3 h-3 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        </div>
        <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
          Demo Mode Active
        </span>
        <span className="text-sm text-amber-600/80 dark:text-amber-400/80">
          — Showing sample client data for demonstration purposes
        </span>
      </div>
    </div>
  );
}

export default DemoRestriction;

