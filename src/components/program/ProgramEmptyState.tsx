'use client';

import { useRouter } from 'next/navigation';
import { useMenuTitles } from '@/contexts/BrandingContext';

/**
 * ProgramEmptyState Component
 * 
 * Shows when user has no enrolled programs.
 * Provides a CTA to discover and enroll in programs.
 */
export function ProgramEmptyState() {
  const router = useRouter();
  const { program: programTitle } = useMenuTitles();

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {/* Empty state illustration */}
      <div className="w-24 h-24 rounded-full bg-[#f3f1ef] dark:bg-[#171b22] flex items-center justify-center mb-6">
        <svg
          className="w-12 h-12 text-text-secondary dark:text-[#7d8190]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"
          />
        </svg>
      </div>

      {/* Title */}
      <h2 className="font-albert text-[24px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.3] text-center mb-3">
        No programs yet
      </h2>

      {/* Description */}
      <p className="font-sans text-[16px] text-text-secondary dark:text-[#b2b6c2] leading-[1.5] text-center max-w-sm mb-8">
        Join a program to get structured guidance, connect with a community, and accelerate your growth journey.
      </p>

      {/* CTA Button */}
      <button
        onClick={() => router.push('/discover')}
        className="bg-[#2c2520] dark:bg-[#f5f5f8] text-white dark:text-[#05070b] rounded-[32px] px-8 py-4 font-bold text-[16px] leading-[1.4] tracking-[-0.5px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all"
      >
        Discover programs
      </button>

      {/* Secondary link */}
      <button
        onClick={() => router.push('/discover?tab=programs')}
        className="mt-4 font-albert text-[14px] text-text-secondary dark:text-[#7d8190] underline hover:text-text-primary dark:hover:text-[#f5f5f8] transition-colors"
      >
        Browse all programs
      </button>
    </div>
  );
}

