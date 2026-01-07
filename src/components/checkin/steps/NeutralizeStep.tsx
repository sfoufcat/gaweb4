'use client';

import { useState, useEffect } from 'react';
import type { NeutralizeStepProps } from './types';

/**
 * NeutralizeStep - AI-powered thought reframing
 *
 * Extracted from /src/app/checkin/morning/neutralize/page.tsx
 * Features:
 * - AI reframe display card with accent bar
 * - Loading skeleton with pulse animation
 * - API call to /api/checkin/reframe
 * - Gets userThought from session data
 */
export function NeutralizeStep({ data, onComplete }: NeutralizeStepProps) {
  const [reframe, setReframe] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const thought = (data?.userThought as string) || '';

  useEffect(() => {
    const fetchReframe = async () => {
      if (!thought) {
        setError('No thought provided');
        setIsLoading(false);
        return;
      }

      // Clear previous error and reset loading when thought becomes available
      setError(null);
      setIsLoading(true);

      try {
        const response = await fetch('/api/checkin/reframe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ thought }),
        });

        const responseData = await response.json();

        if (!response.ok) {
          throw new Error(responseData.error || 'Failed to reframe thought');
        }

        setReframe(responseData.reframe);

        // Save reframe to check-in
        await fetch('/api/checkin/morning', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aiReframe: responseData.reframe }),
        });
      } catch (err) {
        console.error('Error reframing:', err);
        const message = err instanceof Error ? err.message : 'Failed to reframe thought';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReframe();
  }, [thought]);

  const handleContinue = () => {
    onComplete({ aiReframe: reframe || '' });
  };

  return (
    <div className="h-full w-full flex flex-col">
      {/* Main content - centered on desktop */}
      <div className="flex-1 flex flex-col md:items-center md:justify-center px-6 pt-8 md:pt-0 w-full overflow-y-auto">
        <div className="max-w-[550px] w-full flex-1 md:flex-initial flex flex-col">
          {/* Header */}
          <div className="mb-8 md:mb-12 text-center">
            <h1 className="font-albert text-[32px] md:text-[42px] text-[#1a1a1a] dark:text-white tracking-[-2px] leading-[1.2]">
              Thoughts aren&apos;t facts. They&apos;re stories we can rewrite.
            </h1>
          </div>

          {/* Content */}
          <div className="space-y-8">
            <p className="font-sans text-[18px] md:text-[20px] text-[#1a1a1a] dark:text-white/90 tracking-[-0.4px] leading-[1.4] text-center">
              And when we look at them with clarity and kindness, they lose their power over us.
            </p>

            {/* Reframe card */}
            {isLoading ? (
              <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-6 flex items-start shadow-sm">
                <div className="w-[3px] bg-[#5f5a55] dark:bg-[#b2b6c2] self-stretch mr-4 rounded-full" />
                <div className="flex-1 animate-pulse">
                  <div className="h-5 bg-[#e1ddd8] dark:bg-[#262b35] rounded w-3/4 mb-3" />
                  <div className="h-6 bg-[#e1ddd8] dark:bg-[#262b35] rounded w-full mb-2" />
                  <div className="h-6 bg-[#e1ddd8] dark:bg-[#262b35] rounded w-5/6" />
                </div>
              </div>
            ) : error ? (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-[20px] p-6">
                <p className="text-red-600 dark:text-red-400 font-sans text-[16px]">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-2 text-red-700 dark:text-red-300 underline"
                >
                  Try again
                </button>
              </div>
            ) : (
              <div className="bg-white dark:bg-[#171b22] rounded-[20px] overflow-hidden flex shadow-sm">
                {/* Left accent bar */}
                <div className="w-[3px] bg-[#5f5a55] dark:bg-[#b2b6c2]" />

                {/* Content */}
                <div className="flex-1 p-6">
                  <p className="font-albert text-[20px] md:text-[24px] font-semibold text-[#5f5a55] dark:text-[#b2b6c2] tracking-[-1px] leading-[1.3] mb-4">
                    Here&apos;s a more supportive way to see this:
                  </p>
                  <p className="font-sans text-[22px] md:text-[26px] text-[#1a1a1a] dark:text-white tracking-[-0.5px] leading-[1.3]">
                    {reframe}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Spacer on mobile to push button down */}
          <div className="flex-1 md:hidden" />

          {/* Action button - at bottom on mobile, inline on desktop */}
          <div className="mt-8 md:mt-10 pb-8 md:pb-0">
            <button
              onClick={handleContinue}
              disabled={isLoading}
              className={`w-full max-w-[400px] mx-auto block py-4 md:py-5 rounded-full font-sans text-[16px] md:text-[18px] font-bold tracking-[-0.5px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.3)] transition-all ${
                !isLoading
                  ? 'bg-[#2c2520] dark:bg-white text-white dark:text-[#1a1a1a] hover:scale-[1.02] active:scale-[0.98]'
                  : 'bg-[#e1ddd8] dark:bg-[#262b35] text-[#a7a39e] dark:text-[#7d8190] cursor-not-allowed'
              }`}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
