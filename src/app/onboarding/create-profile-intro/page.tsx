'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

/**
 * Create Your Public Profile Intro Screen
 * Second step in the onboarding flow
 * Figma: https://www.figma.com/design/8y6xbjQJTnzqNEFpfB4Wyi/GrowthAddicts--Backup-?node-id=409-3877&m=dev
 */
export default function CreateProfileIntroPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [isNavigating, setIsNavigating] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (isLoaded && !user) {
      router.push('/');
    }
  }, [isLoaded, user, router]);

  const handleNext = () => {
    setIsNavigating(true);
    // Navigate to edit profile in onboarding mode
    router.push('/profile?edit=true&fromOnboarding=true');
  };

  const handleSkip = () => {
    setIsNavigating(true);
    // Skip profile creation - go to journey animation
    router.push('/onboarding/journey-started');
  };

  if (!isLoaded || !user) {
    return (
      <div className="fixed inset-0 bg-app-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-app-bg overflow-y-auto">
      <div className="min-h-full flex flex-col">
        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 pt-16 md:pt-20">
          <div className="w-full max-w-xl lg:max-w-2xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="font-albert text-[36px] lg:text-[48px] text-text-primary tracking-[-2px] leading-[1.2] mb-8">
                Create your public profile
              </h1>
              
              <div className="space-y-3 font-sans text-[18px] lg:text-[20px] text-text-primary tracking-[-0.4px] leading-[1.2]">
                <p>
                  Profile is your way to shine! It helps others connect with you, understand your goals, and share experiences.
                </p>
                <p>
                  Remember, the more you share, the better others can support and celebrate your journey!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="sticky bottom-0 px-6 pb-10 pt-6 bg-gradient-to-t from-app-bg via-app-bg to-transparent">
          <div className="w-full max-w-xl lg:max-w-2xl mx-auto space-y-3">
            {/* Primary Button */}
            <button
              onClick={handleNext}
              disabled={isNavigating}
              className="w-full bg-[#2c2520] text-white font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4] py-4 px-6 rounded-[32px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isNavigating ? 'Loading...' : 'Next'}
            </button>

            {/* Secondary Button */}
            <button
              onClick={handleSkip}
              disabled={isNavigating}
              className="w-full bg-white border border-[rgba(215,210,204,0.5)] text-[#2c2520] font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4] py-4 px-6 rounded-[32px] hover:bg-[#faf8f6] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              I&apos;ll do it later in settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

