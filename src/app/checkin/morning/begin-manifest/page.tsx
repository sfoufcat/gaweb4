'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckInPageWrapper } from '@/components/checkin/CheckInPageWrapper';

export default function BeginManifestPage() {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleBegin = () => {
    if (isNavigating) return;
    setIsNavigating(true);
    router.push('/checkin/morning/manifest');
  };

  return (
    <CheckInPageWrapper centered={false}>
      <div className="h-full w-full flex flex-col">
        {/* Main content - centered on desktop */}
        <div className="flex-1 flex flex-col md:items-center md:justify-center px-6 pt-8 md:pt-0 w-full overflow-y-auto">
          <div className="max-w-[500px] w-full flex-1 md:flex-initial flex flex-col text-center">
            {/* Header */}
            <h1 className="font-albert text-[32px] md:text-[42px] text-[#1a1a1a] tracking-[-2px] leading-[1.2] mb-8">
              Time to manifest
            </h1>

            {/* Content */}
            <div className="space-y-6">
              <p className="font-sans text-[18px] md:text-[20px] text-[#1a1a1a] tracking-[-0.4px] leading-[1.5]">
                You&apos;re about to see your identity and your goal.
              </p>

              <p className="font-sans text-[18px] md:text-[20px] text-[#1a1a1a] tracking-[-0.4px] leading-[1.5]">
                Close your eyes and visualize them as if they&apos;re already your reality.
              </p>

              <p className="font-albert text-[22px] md:text-[26px] font-semibold text-[#1a1a1a] tracking-[-1px] leading-[1.3] mt-8">
                Feel the emotions. See the environment. Make it real in your mind.
              </p>
            </div>

            {/* Spacer on mobile to push button down */}
            <div className="flex-1 md:hidden" />

            {/* Action button - at bottom on mobile, inline on desktop */}
            <div className="mt-8 md:mt-10 pb-8 md:pb-0">
              <button
                onClick={handleBegin}
                disabled={isNavigating}
                className="w-full max-w-[400px] mx-auto block bg-[#2c2520] text-white py-4 md:py-5 rounded-full font-sans text-[16px] md:text-[18px] font-bold tracking-[-0.5px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isNavigating ? 'Starting...' : 'Begin manifestation'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </CheckInPageWrapper>
  );
}

