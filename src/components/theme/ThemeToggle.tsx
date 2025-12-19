'use client';

import { useTheme } from '@/contexts/ThemeContext';

// Sun icon for light mode
function SunIcon({ className = '' }: { className?: string }) {
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
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

// Moon icon for dark mode
function MoonIcon({ className = '' }: { className?: string }) {
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
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

interface ThemeToggleProps {
  className?: string;
  horizontal?: boolean;
}

/**
 * ThemeToggle Component
 * 
 * A pill-shaped toggle for switching between light and dark modes.
 * Supports vertical (default) and horizontal orientations.
 * Sun icon for light, moon icon for dark.
 * Sliding indicator shows active state.
 */
export function ThemeToggle({ className = '', horizontal = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  if (horizontal) {
    return (
      <button
        onClick={toggleTheme}
        className={`
          relative flex flex-row items-center justify-between
          h-[28px] w-[62px] rounded-full p-[3px]
          bg-[#f3f1ef] dark:bg-[#181d28]
          transition-colors duration-300 ease-out
          focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a07855] dark:focus-visible:ring-[#b8896a]
          ${className}
        `}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {/* Sliding indicator background - horizontal */}
        <div 
          className={`
            absolute w-[28px] h-[22px] rounded-full
            bg-white dark:bg-[#262b35]
            shadow-sm
            transition-all duration-300 ease-out
            ${isDark ? 'left-[31px]' : 'left-[3px]'}
          `}
        />
        
        {/* Sun icon - left position */}
        <div 
          className={`
            relative z-10 w-[28px] h-[22px] flex items-center justify-center
            transition-all duration-300
            ${isDark 
              ? 'text-[#7d8190]' 
              : 'text-amber-500'
            }
          `}
        >
          <SunIcon />
        </div>
        
        {/* Moon icon - right position */}
        <div 
          className={`
            relative z-10 w-[28px] h-[22px] flex items-center justify-center
            transition-all duration-300
            ${isDark 
              ? 'text-blue-300' 
              : 'text-[#a7a39e]'
            }
          `}
        >
          <MoonIcon />
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className={`
        relative flex flex-col items-center justify-between
        w-[28px] h-[62px] rounded-full p-[3px]
        bg-[#f3f1ef] dark:bg-[#181d28]
        transition-colors duration-300 ease-out
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a07855] dark:focus-visible:ring-[#b8896a]
        ${className}
      `}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {/* Sliding indicator background */}
      <div 
        className={`
          absolute w-[22px] h-[28px] rounded-full
          bg-white dark:bg-[#262b35]
          shadow-sm
          transition-all duration-300 ease-out
          ${isDark ? 'top-[31px]' : 'top-[3px]'}
        `}
      />
      
      {/* Sun icon - top position */}
      <div 
        className={`
          relative z-10 w-[22px] h-[28px] flex items-center justify-center
          transition-all duration-300
          ${isDark 
            ? 'text-[#7d8190]' 
            : 'text-amber-500'
          }
        `}
      >
        <SunIcon />
      </div>
      
      {/* Moon icon - bottom position */}
      <div 
        className={`
          relative z-10 w-[22px] h-[28px] flex items-center justify-center
          transition-all duration-300
          ${isDark 
            ? 'text-blue-300' 
            : 'text-[#a7a39e]'
          }
        `}
      >
        <MoonIcon />
      </div>
    </button>
  );
}

export default ThemeToggle;
