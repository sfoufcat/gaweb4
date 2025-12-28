'use client';

import { useRouter } from 'next/navigation';
import { useMenuTitles } from '@/contexts/BrandingContext';

/**
 * ProgramEmptyState Component
 * 
 * Matches Figma design for empty program state.
 * Shows when user has no enrolled programs AND coach has no available programs.
 * Features:
 * - Gradient orb background effect
 * - Large title with tracking
 * - Descriptive text
 * - "Discover more content" CTA button
 */
export function ProgramEmptyState() {
  const router = useRouter();
  const { programLower } = useMenuTitles();

  return (
    <div className="relative flex flex-col items-center justify-center py-20 px-4 min-h-[60vh]">
      {/* Gradient orb background effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Primary gradient orb */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full opacity-30 dark:opacity-20 blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(160, 120, 85, 0.5) 0%, rgba(160, 120, 85, 0) 70%)',
          }}
        />
        {/* Secondary accent orb */}
        <div 
          className="absolute top-1/3 left-1/3 w-[300px] h-[300px] rounded-full opacity-20 dark:opacity-10 blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(126, 108, 91, 0.4) 0%, rgba(126, 108, 91, 0) 70%)',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Empty state illustration - simplified icon */}
        <div className="w-20 h-20 rounded-full bg-white/80 dark:bg-[#171b22]/80 backdrop-blur-sm flex items-center justify-center mb-8 shadow-lg">
          <svg
            className="w-10 h-10 text-[#a07855] dark:text-[#b8896a] dark:text-[#a07855] dark:text-[#b8896a]"
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
        <h1 className="font-albert text-[36px] font-normal text-text-primary dark:text-[#f5f5f8] tracking-[-2px] leading-[1.2] text-center mb-4">
          No {programLower}s yet
        </h1>

        {/* Description */}
        <p className="font-sans text-[16px] text-text-secondary dark:text-[#b2b6c2] leading-[1.4] tracking-[-0.3px] text-center max-w-[320px] mb-10">
          Join a {programLower} to get structured guidance, connect with a community, and accelerate your growth journey.
        </p>

        {/* CTA Button - Figma style */}
        <button
          onClick={() => router.push('/discover')}
          className="bg-[#a07855] border border-[rgba(215,210,204,0.5)] rounded-[32px] px-8 py-4 font-bold text-[16px] text-white leading-[1.4] tracking-[-0.5px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          Discover more content
        </button>
      </div>
    </div>
  );
}
