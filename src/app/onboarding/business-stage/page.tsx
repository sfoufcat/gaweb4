'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { OnboardingLayout, QuizOption, OnboardingCTA } from '@/components/onboarding/OnboardingLayout';
import type { BusinessStage } from '@/types';

const GROWTH_OPTIONS: { value: BusinessStage; letter: string; label: string }[] = [
  { 
    value: 'just_starting', 
    letter: 'A',
    label: 'Just getting started',
  },
  { 
    value: 'building_momentum', 
    letter: 'B',
    label: 'Building momentum',
  },
  { 
    value: 'growing_steadily', 
    letter: 'C',
    label: 'Growing steadily',
  },
  { 
    value: 'leveling_up', 
    letter: 'D',
    label: 'Leveling up a new chapter',
  },
  { 
    value: 'reinventing', 
    letter: 'E',
    label: 'Reinventing myself',
  },
];

/**
 * Personal Growth Journey Stage Question
 * Third quiz question in the onboarding flow
 */
export default function BusinessStagePage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [selected, setSelected] = useState<BusinessStage | null>(null);
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

  const handleContinue = async (value?: BusinessStage) => {
    const selectedValue = value || selected;
    if (!selectedValue) return;
    
    setIsNavigating(true);
    
    try {
      // After business stage, go to goal (identity moved to after payment)
      await fetch('/api/user/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          onboardingStatus: 'goal',
          onboarding: { 
            ...existingData,
            businessStage: selectedValue 
          }
        }),
      });
      
      router.push('/onboarding/goal');
    } catch (error) {
      console.error('Failed to save business stage:', error);
      setIsNavigating(false);
    }
  };

  // Auto-advance when an option is selected
  const handleOptionClick = (value: BusinessStage) => {
    setSelected(value);
    setTimeout(() => {
      handleContinue(value);
    }, 300);
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
    router.push('/begin');
    return null;
  }

  return (
    <OnboardingLayout 
      showProgress 
      currentStep={3} 
      totalSteps={3}
      stepLabel="Step 3 of 3"
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
              Where are you right now in your personal growth journey?
          </motion.h1>
          <motion.p 
            className="font-sans text-[16px] text-text-secondary mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
              This helps us tailor your experience to where you are.
          </motion.p>

            {/* Options */}
            <div className="space-y-3 mb-8">
              {GROWTH_OPTIONS.map((option, index) => (
              <QuizOption
                  key={option.value}
                selected={selected === option.value}
                disabled={isNavigating}
                  onClick={() => handleOptionClick(option.value)}
                index={index}
                >
                  <div className="flex items-start gap-4">
                    <span className="w-8 h-8 rounded-full bg-[#f3f1ef] flex items-center justify-center font-albert text-[14px] font-semibold text-text-secondary flex-shrink-0">
                    {option.letter}
                    </span>
                    <p className="font-albert text-[18px] font-semibold text-text-primary tracking-[-0.5px] pt-1">
                      {option.label}
                    </p>
                  </div>
              </QuizOption>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
      <OnboardingCTA onClick={() => handleContinue()} disabled={!selected || isNavigating}>
            {isNavigating ? 'Saving...' : 'Continue'}
      </OnboardingCTA>
    </OnboardingLayout>
  );
}
