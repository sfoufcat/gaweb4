'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

/**
 * Guest Profile Intro Page
 * Shown after account creation, before dashboard
 * Prompts user to set up their profile
 */
export default function GuestProfilePage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const [isNavigating, setIsNavigating] = useState(false);

  // Redirect if not signed in (shouldn't happen if flow is correct)
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/start/create-account');
    }
  }, [isLoaded, isSignedIn, router]);

  const handleNext = async () => {
    setIsNavigating(true);
    
    // Navigate to edit profile with return to completion animation
    router.push('/profile?edit=true&fromOnboarding=true&returnTo=/start/complete');
  };

  const handleSkip = async () => {
    setIsNavigating(true);
    
    // Skip profile creation - go to completion animation
    router.push('/start/complete');
  };

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="fixed inset-0 bg-app-bg flex items-center justify-center">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8]" />
          <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-[#a07855] animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-app-bg overflow-y-auto">
      <div className="min-h-full flex flex-col">
        {/* Logo Header - centered */}
        <motion.div 
          className="pt-8 pb-4 px-6 flex justify-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Image 
            src="/logo.jpg" 
            alt="GrowthAddicts" 
            width={56} 
            height={56} 
            className="rounded-lg"
          />
        </motion.div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          <div className="w-full max-w-xl lg:max-w-2xl mx-auto">
            {/* Success celebration */}
            <motion.div 
              className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-[#22c55e] to-[#16a34a] flex items-center justify-center mb-8 shadow-lg"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            >
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>

            {/* Header */}
            <motion.div 
              className="mb-8 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <h1 className="font-albert text-[36px] lg:text-[48px] text-text-primary tracking-[-2px] leading-[1.15] mb-4">
                <span className="bg-gradient-to-r from-[#a07855] via-[#d4a574] to-[#a07855] bg-clip-text text-transparent">
                  You&apos;re all set!
                </span>
              </h1>
            </motion.div>

            <motion.div 
              className="mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <h2 className="font-albert text-[28px] lg:text-[32px] text-text-primary tracking-[-1.5px] leading-[1.2] mb-4">
                Create your public profile
              </h2>
              
              <div className="space-y-3 font-sans text-[17px] lg:text-[19px] text-text-secondary tracking-[-0.3px] leading-[1.4]">
                <p>
                  Your profile helps others connect with you, understand your goals, and share experiences.
                </p>
                <p>
                  The more you share, the better others can support and celebrate your journey!
                </p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Bottom Actions */}
        <motion.div 
          className="sticky bottom-0 px-6 pb-10 pt-6 bg-gradient-to-t from-app-bg via-app-bg to-transparent"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <div className="w-full max-w-xl lg:max-w-2xl mx-auto space-y-3">
            {/* Primary Button */}
            <button
              onClick={handleNext}
              disabled={isNavigating}
              className="w-full bg-gradient-to-r from-[#f7c948] to-[#f5b820] text-[#2c2520] font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4] py-4 px-6 rounded-[32px] shadow-[0px_8px_24px_0px_rgba(247,201,72,0.35)] hover:shadow-[0px_12px_32px_0px_rgba(247,201,72,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isNavigating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </span>
              ) : (
                'Set up my profile →'
              )}
            </button>

            {/* Secondary Button */}
            <button
              onClick={handleSkip}
              disabled={isNavigating}
              className="w-full bg-white border border-[rgba(215,210,204,0.5)] text-[#2c2520] font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4] py-4 px-6 rounded-[32px] hover:bg-[#faf8f6] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              I&apos;ll do it later
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

