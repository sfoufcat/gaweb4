'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { OnboardingLayout, OnboardingCTA } from '@/components/onboarding/OnboardingLayout';
import type { OnboardingSupportNeed } from '@/types';

const SUPPORT_OPTIONS: { value: OnboardingSupportNeed; label: string }[] = [
  { 
    value: 'daily_checkins', 
    label: 'Consistent daily check-ins' 
  },
  { 
    value: 'accountability', 
    label: 'Accountability (people who notice if I slip)' 
  },
  { 
    value: 'clear_system', 
    label: 'A clear system for priorities & daily tasks' 
  },
  { 
    value: 'expert_guidance', 
    label: 'Expert guidance & resources' 
  },
  { 
    value: 'inspiration', 
    label: 'Simply being regularly inspired' 
  },
];

/**
 * Support Needs Question (Multi-select)
 * Final quiz question before transformation page
 */
export default function SupportNeedsPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [selected, setSelected] = useState<OnboardingSupportNeed[]>([]);
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

  const toggleOption = (value: OnboardingSupportNeed) => {
    setSelected(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value) 
        : [...prev, value]
    );
  };

  const handleContinue = async () => {
    if (selected.length === 0) return;
    
    setIsNavigating(true);
    
    try {
      // After support needs, go to transformation page
      await fetch('/api/user/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          onboardingStatus: 'transformation',
          onboarding: { 
            ...existingData,
            supportNeeds: selected 
          }
        }),
      });
      
      // Navigate to transformation page
      router.push('/onboarding/transformation');
    } catch (error) {
      console.error('Failed to save support needs:', error);
      setIsNavigating(false);
    }
  };

  // Show loading spinner until everything is ready
  if (!isLoaded || !user) {
    if (!isLoaded) {
      return (
        <div className="fixed inset-0 bg-app-bg flex items-center justify-center">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8]" />
            <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-[#a07855] animate-spin" />
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
      totalSteps={2}
      stepLabel="Final question"
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
              What would support you the most in achieving your goal?
          </motion.h1>
          <motion.p 
            className="font-sans text-[16px] text-text-secondary mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
              Select all that apply.
          </motion.p>

            {/* Options */}
            <div className="space-y-3 mb-8">
            {SUPPORT_OPTIONS.map((option, index) => {
                const isSelected = selected.includes(option.value);
                return (
                <motion.button
                    key={option.value}
                    onClick={() => toggleOption(option.value)}
                    className={`w-full p-5 rounded-[20px] border-2 text-left transition-all ${
                      isSelected 
                      ? 'border-[#a07855] dark:border-[#b8896a] bg-[#faf8f6] shadow-sm' 
                      : 'border-[#e1ddd8] bg-white hover:border-[#d4d0cb] hover:shadow-sm'
                    }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.15 + index * 0.08 }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Checkbox */}
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        isSelected 
                          ? 'border-[#a07855] dark:border-[#b8896a] bg-[#a07855] dark:bg-[#b8896a]' 
                          : 'border-[#d4d0cb]'
                      }`}>
                        {isSelected && (
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
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
      <OnboardingCTA onClick={handleContinue} disabled={selected.length === 0 || isNavigating}>
        {isNavigating ? 'Creating your plan...' : 'See my growth plan →'}
      </OnboardingCTA>
    </OnboardingLayout>
  );
}
