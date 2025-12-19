'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { OnboardingLayout, QuizOption, OnboardingCTA } from '@/components/onboarding/OnboardingLayout';
import { useGuestSession } from '@/hooks/useGuestSession';
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
 * Guest Personal Growth Journey Stage Question
 * Third quiz question in the guest onboarding flow
 */
export default function GuestBusinessStagePage() {
  const router = useRouter();
  const { saveData, isLoading } = useGuestSession();
  const [selected, setSelected] = useState<BusinessStage | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const handleContinue = async (value?: BusinessStage) => {
    const selectedValue = value || selected;
    if (!selectedValue) return;
    
    setIsNavigating(true);
    
    await saveData({ 
      businessStage: selectedValue,
      currentStep: 'goal',
    });
    
    // After business stage, go to goal (identity moved to after payment)
    router.push('/start/goal');
  };

  // Auto-advance when an option is selected
  const handleOptionClick = (value: BusinessStage) => {
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
      currentStep={3} 
      totalSteps={3}
      stepLabel="Step 3 of 3"
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
            Where are you right now in your personal growth journey?
          </h1>
          <p className="font-sans text-[16px] text-text-secondary mb-8">
            This helps us tailor your experience to where you are.
          </p>

          {/* Options */}
          <div className="space-y-3 mb-8">
            {GROWTH_OPTIONS.map((option) => (
              <QuizOption
                key={option.value}
                selected={selected === option.value}
                disabled={isNavigating}
                onClick={() => handleOptionClick(option.value)}
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
      </motion.div>

      {/* Bottom CTA */}
      <OnboardingCTA onClick={() => handleContinue()} disabled={!selected || isNavigating}>
        {isNavigating ? 'Saving...' : 'Continue'}
      </OnboardingCTA>
    </OnboardingLayout>
  );
}

