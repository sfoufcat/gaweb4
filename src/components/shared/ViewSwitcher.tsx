'use client';

import { useViewMode } from '@/contexts/ViewModeContext';
import { cn } from '@/lib/utils';

// User icon for client mode
function UserIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
    </svg>
  );
}

// Shield icon for coach mode
function ShieldIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}

interface ViewSwitcherProps {
  className?: string;
  horizontal?: boolean;
}

/**
 * ViewSwitcher Component
 *
 * A pill-shaped toggle for switching between Client and Coach views.
 * Matches the ThemeToggle design - vertical (default) or horizontal.
 * User icon for client, shield icon for coach.
 * Only renders for users who have coach access.
 */
export function ViewSwitcher({ className = '', horizontal = false }: ViewSwitcherProps) {
  const { viewMode, setViewMode, canAccessCoachView } = useViewMode();

  // Don't render for non-coaches
  // Note: We don't hide during loading because canAccessCoachView will be false during loading anyway
  if (!canAccessCoachView) {
    return null;
  }

  const isCoachView = viewMode === 'coach';

  const handleToggle = () => {
    setViewMode(isCoachView ? 'client' : 'coach');
  };

  if (horizontal) {
    return (
      <button
        onClick={handleToggle}
        className={cn(
          'relative flex flex-row items-center justify-between',
          'h-[28px] w-[62px] rounded-full p-[3px]',
          'bg-[#f3f1ef] dark:bg-[#181d28]',
          'transition-colors duration-300 ease-out',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent',
          className
        )}
        aria-label={isCoachView ? 'Switch to Client View' : 'Switch to Coach View'}
        title={isCoachView ? 'Switch to Client View' : 'Switch to Coach View'}
      >
        {/* Sliding indicator background - horizontal */}
        <div
          className={cn(
            'absolute w-[28px] h-[22px] rounded-full',
            'bg-white dark:bg-[#262b35]',
            'shadow-sm',
            'transition-all duration-300 ease-out',
            isCoachView ? 'left-[31px]' : 'left-[3px]'
          )}
        />

        {/* User icon - left position (client) */}
        <div
          className={cn(
            'relative z-10 w-[28px] h-[22px] flex items-center justify-center',
            'transition-all duration-300',
            !isCoachView ? 'text-blue-500' : 'text-[#7d8190]'
          )}
        >
          <UserIcon />
        </div>

        {/* Shield icon - right position (coach) */}
        <div
          className={cn(
            'relative z-10 w-[28px] h-[22px] flex items-center justify-center',
            'transition-all duration-300',
            isCoachView ? 'text-amber-600 dark:text-amber-500' : 'text-[#a7a39e]'
          )}
        >
          <ShieldIcon />
        </div>
      </button>
    );
  }

  // Vertical orientation (default)
  return (
    <button
      onClick={handleToggle}
      className={cn(
        'relative flex flex-col items-center justify-between',
        'w-[28px] h-[62px] rounded-full p-[3px]',
        'bg-[#f3f1ef] dark:bg-[#181d28]',
        'transition-colors duration-300 ease-out',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent',
        className
      )}
      aria-label={isCoachView ? 'Switch to Client View' : 'Switch to Coach View'}
      title={isCoachView ? 'Switch to Client View' : 'Switch to Coach View'}
    >
      {/* Sliding indicator background */}
      <div
        className={cn(
          'absolute w-[22px] h-[28px] rounded-full',
          'bg-white dark:bg-[#262b35]',
          'shadow-sm',
          'transition-all duration-300 ease-out',
          isCoachView ? 'top-[31px]' : 'top-[3px]'
        )}
      />

      {/* User icon - top position (client) */}
      <div
        className={cn(
          'relative z-10 w-[22px] h-[28px] flex items-center justify-center',
          'transition-all duration-300',
          !isCoachView ? 'text-blue-500' : 'text-[#7d8190]'
        )}
      >
        <UserIcon />
      </div>

      {/* Shield icon - bottom position (coach) */}
      <div
        className={cn(
          'relative z-10 w-[22px] h-[28px] flex items-center justify-center',
          'transition-all duration-300',
          isCoachView ? 'text-amber-600 dark:text-amber-500' : 'text-[#a7a39e]'
        )}
      >
        <ShieldIcon />
      </div>
    </button>
  );
}

export default ViewSwitcher;
