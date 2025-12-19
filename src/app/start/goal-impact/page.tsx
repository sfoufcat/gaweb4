'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { OnboardingLayout, QuizOption, OnboardingCTA } from '@/components/onboarding/OnboardingLayout';
import { useGuestSession } from '@/hooks/useGuestSession';
import type { GoalImpactLevel } from '@/types';

const IMPACT_OPTIONS: { value: GoalImpactLevel; emoji: string; label: string; description: string }[] = [
  { 
    value: 'transformational', 
    emoji: '🚀',
    label: 'Transformational', 
    description: 'It would completely change my trajectory' 
  },
  { 
    value: 'a_lot', 
    emoji: '⭐',
    label: 'A lot', 
    description: 'It would significantly improve my career, lifestyle, or freedom' 
  },
  { 
    value: 'somewhat', 
    emoji: '✨',
    label: 'Somewhat', 
    description: 'It would give me more confidence and stability' 
  },
  { 
    value: 'a_little', 
    emoji: '👍',
    label: 'A little', 
    description: 'It would feel good, but not change much' 
  },
];

/**
 * Guest Goal Impact Question
 * Quiz question after goal setting
 */
export default function GuestGoalImpactPage() {
  const router = useRouter();
  const { saveData, isLoading } = useGuestSession();
  const [selected, setSelected] = useState<GoalImpactLevel | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const handleContinue = async (value?: GoalImpactLevel) => {
    const selectedValue = value || selected;
    if (!selectedValue) return;
    
    setIsNavigating(true);
    
    await saveData({ 
      goalImpact: [selectedValue],
      currentStep: 'support_needs',
    });
    
    router.push('/start/support-needs');
  };

  // Auto-advance when an option is selected
  const handleOptionClick = (value: GoalImpactLevel) => {
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
            How would achieving your goal impact your life?
          </h1>
          <p className="font-sans text-[16px] text-text-secondary mb-8">
            Think about the goal you just set.
          </p>

          {/* Options */}
          <div className="space-y-3 mb-8">
            {IMPACT_OPTIONS.map((option) => (
              <QuizOption
                key={option.value}
                selected={selected === option.value}
                disabled={isNavigating}
                onClick={() => handleOptionClick(option.value)}
              >
                <div className="flex items-start gap-4">
                  <span className="text-[24px]">{option.emoji}</span>
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

