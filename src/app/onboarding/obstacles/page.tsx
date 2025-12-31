'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { OnboardingLayout, OnboardingCTA } from '@/components/onboarding/OnboardingLayout';
import type { PeerAccountability } from '@/types';

const PEER_ACCOUNTABILITY_OPTIONS: { value: PeerAccountability; label: string; letter: string }[] = [
  { 
    value: 'alone', 
    label: 'No, I mostly go at it alone',
    letter: 'A'
  },
  { 
    value: 'no_daily_system', 
    label: 'I have friends/communities, but no daily system',
    letter: 'B'
  },
  { 
    value: 'inconsistent', 
    label: 'I have some accountability, but it\'s not consistent',
    letter: 'C'
  },
  { 
    value: 'strong_accountability', 
    label: 'Yes, I have strong peer accountability',
    letter: 'D'
  },
];

/**
 * Peer Accountability Question (Single-select)
 * Second quiz question in the onboarding flow
 */
export default function ObstaclesPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [selected, setSelected] = useState<PeerAccountability | null>(null);
  const [existingData, setExistingData] = useState<Record<string, unknown> | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  // Fetch existing onboarding data to merge
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/user/me');
        const data = await response.json();
        if (data.user?.onboarding) {
          setExistingData(data.user.onboarding);
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      }
    };
    if (isLoaded && user) {
      fetchData();
    }
  }, [isLoaded, user]);

  const selectOption = (value: PeerAccountability) => {
    setSelected(value);
  };

  const handleContinue = async () => {
    if (!selected) return;
    
    setIsNavigating(true);
    
    try {
      await fetch('/api/user/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          onboardingStatus: 'business_stage',
          onboarding: { 
            ...existingData,
            peerAccountability: selected 
          }
        }),
      });
      
      router.push('/onboarding/business-stage');
    } catch (error) {
      console.error('Failed to save peer accountability:', error);
      setIsNavigating(false);
    }
  };

  // Show loading spinner until everything is ready
  if (!isLoaded || !user) {
    if (!isLoaded) {
      return (
        <div className="fixed inset-0 bg-app-bg flex items-center justify-center">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8] dark:border-[#262b35]" />
            <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-brand-accent animate-spin" />
          </div>
        </div>
      );
    }
    router.push('/signup');
    return null;
  }

  return (
    <OnboardingLayout 
      showProgress 
      currentStep={2} 
      totalSteps={3}
      stepLabel="Step 2 of 3"
    >
        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-start px-4 py-8 lg:py-12">
          <div className="w-full max-w-xl lg:max-w-2xl mx-auto">
            {/* Header */}
          <motion.h1 
            className="font-albert text-[32px] lg:text-[42px] text-text-primary tracking-[-2px] leading-[1.2] mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
              Do you have a group of peers who see your commitments and your results every day?
          </motion.h1>
          <motion.p 
            className="font-sans text-[16px] text-text-secondary mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
              Select one option.
          </motion.p>

            {/* Options */}
            <div className="space-y-3 mb-8">
            {PEER_ACCOUNTABILITY_OPTIONS.map((option, index) => {
                const isSelected = selected === option.value;
                return (
                <motion.button
                    key={option.value}
                    onClick={() => selectOption(option.value)}
                    className={`w-full p-5 rounded-[20px] border-2 text-left transition-all ${
                      isSelected 
                      ? 'border-brand-accent bg-[#faf8f6] shadow-sm' 
                      : 'border-[#e1ddd8] bg-white hover:border-[#d4d0cb] hover:shadow-sm'
                    }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.15 + index * 0.08 }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Letter indicator */}
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all font-medium text-sm ${
                        isSelected 
                          ? 'border-brand-accent bg-brand-accent text-white' 
                          : 'border-[#d4d0cb] text-text-secondary'
                      }`}>
                        {option.letter}
                      </div>
                      <p className="font-sans text-[16px] text-text-primary">
                        {option.label}
                      </p>
                    </div>
                </motion.button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
      <OnboardingCTA onClick={handleContinue} disabled={!selected || isNavigating}>
            {isNavigating ? 'Saving...' : 'Continue'}
      </OnboardingCTA>
    </OnboardingLayout>
  );
}
