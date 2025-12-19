'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { OnboardingLayout, QuizOption, OnboardingCTA } from '@/components/onboarding/OnboardingLayout';
import { useGuestSession } from '@/hooks/useGuestSession';
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
 * Guest Workday Style Question
 * First quiz question in the guest onboarding flow
 */
export default function GuestWorkdayPage() {
  const router = useRouter();
  const { saveData, isLoading } = useGuestSession();
  const [selected, setSelected] = useState<WorkdayStyle | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const handleContinue = async (value?: WorkdayStyle) => {
    const selectedValue = value || selected;
    if (!selectedValue) return;
    
    setIsNavigating(true);
    
    await saveData({ 
      workdayStyle: selectedValue,
      currentStep: 'obstacles',
    });
    
    router.push('/start/obstacles');
  };

  // Auto-advance when an option is selected
  const handleOptionClick = (value: WorkdayStyle) => {
    setSelected(value);
    setTimeout(() => {
      handleContinue(value);
    }, 300);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-app-bg flex flex-col items-center justify-center">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8]" />
          <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-[#a07855] animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <OnboardingLayout 
      showProgress 
      currentStep={1} 
      totalSteps={3}
      stepLabel="Step 1 of 3"
    >
      {/* Content - Single fade-up animation for entire page */}
      <motion.div 
        className="flex-1 flex flex-col items-center justify-start px-4 py-8 lg:py-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="w-full max-w-xl lg:max-w-2xl mx-auto">
          {/* Header */}
          <h1 className="font-albert text-[32px] lg:text-[42px] text-text-primary tracking-[-2px] leading-[1.2] mb-4">
            Which best describes your current workdays?
          </h1>
          <p className="font-sans text-[16px] text-text-secondary mb-8">
            Be honest — this helps us personalize your experience.
          </p>

          {/* Options */}
          <div className="space-y-3 mb-8">
            {WORKDAY_OPTIONS.map((option) => (
              <QuizOption
                key={option.value}
                selected={selected === option.value}
                disabled={isNavigating}
                onClick={() => handleOptionClick(option.value)}
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
      </motion.div>

      {/* Bottom CTA */}
      <OnboardingCTA onClick={() => handleContinue()} disabled={!selected || isNavigating}>
        {isNavigating ? 'Saving...' : 'Continue'}
      </OnboardingCTA>
    </OnboardingLayout>
  );
}

