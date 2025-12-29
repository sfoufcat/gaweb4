'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { OnboardingLayout, QuizOption, OnboardingCTA } from '@/components/onboarding/OnboardingLayout';
import type { WorkdayStyle } from '@/types';

const WORKDAY_OPTIONS: { value: WorkdayStyle; emoji: string; label: string; description: string }[] = [
  { 
    value: 'chaotic', 
    emoji: '🚨', 
    label: 'Chaotic', 
    description: 'Putting out fires all day' 
  },
  { 
    value: 'busy', 
    emoji: '🔄', 
    label: 'Busy', 
    description: 'I work a lot, but not always on the right things' 
  },
  { 
    value: 'productive', 
    emoji: '✅', 
    label: 'Productive', 
    description: 'I usually focus on what matters most' 
  },
  { 
    value: 'disciplined', 
    emoji: '🔥', 
    label: 'Disciplined', 
    description: 'Every day is structured and intentional' 
  },
];

/**
 * Workday Style Question
 * First quiz question in the onboarding flow
 */
export default function WorkdayPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [selected, setSelected] = useState<WorkdayStyle | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const handleContinue = async (value?: WorkdayStyle) => {
    const selectedValue = value || selected;
    if (!selectedValue) return;
    
    setIsNavigating(true);
    
    try {
      await fetch('/api/user/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          onboardingStatus: 'obstacles',
          onboarding: { workdayStyle: selectedValue }
        }),
      });
      
      router.push('/onboarding/obstacles');
    } catch (error) {
      console.error('Failed to save workday style:', error);
      setIsNavigating(false);
    }
  };

  // Auto-advance when an option is selected
  const handleOptionClick = (value: WorkdayStyle) => {
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
    router.push('/signup');
    return null;
  }

  return (
    <OnboardingLayout 
      showProgress 
      currentStep={1} 
      totalSteps={3}
      stepLabel="Step 1 of 3"
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
              Which best describes your current workdays?
          </motion.h1>
          <motion.p 
            className="font-sans text-[16px] text-text-secondary mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
              Be honest — this helps us personalize your experience.
          </motion.p>

            {/* Options */}
            <div className="space-y-3 mb-8">
            {WORKDAY_OPTIONS.map((option, index) => (
              <QuizOption
                  key={option.value}
                selected={selected === option.value}
                disabled={isNavigating}
                  onClick={() => handleOptionClick(option.value)}
                index={index}
                >
                  <div className="flex items-start gap-4">
                    <span className="text-[28px]">{option.emoji}</span>
                    <div>
                      <p className="font-albert text-[18px] font-semibold text-text-primary tracking-[-0.5px]">
                        {option.label}
                      </p>
                      <p className="font-sans text-[14px] text-text-secondary mt-0.5">
                        {option.description}
                      </p>
                    </div>
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
