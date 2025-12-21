'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { OnboardingLayout, QuizOption, OnboardingCTA } from '@/components/onboarding/OnboardingLayout';
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
 * Goal Impact Question
 * Quiz question after goal setting
 */
export default function GoalImpactPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [selected, setSelected] = useState<GoalImpactLevel | null>(null);
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

  const handleContinue = async (value?: GoalImpactLevel) => {
    const selectedValue = value || selected;
    if (!selectedValue) return;
    
    setIsNavigating(true);
    
    try {
      await fetch('/api/user/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          onboardingStatus: 'support_needs',
          onboarding: { 
            ...existingData,
            goalImpact: selectedValue 
          }
        }),
      });
      
      router.push('/onboarding/support-needs');
    } catch (error) {
      console.error('Failed to save goal impact:', error);
      setIsNavigating(false);
    }
  };

  // Auto-advance when an option is selected
  const handleOptionClick = (value: GoalImpactLevel) => {
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
    router.push('/join/starter-90');
    return null;
  }

  return (
    <OnboardingLayout 
      showProgress 
      currentStep={1} 
      totalSteps={2}
      stepLabel="Almost there — 2 quick questions"
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
              How would achieving your goal impact your life?
          </motion.h1>
          <motion.p 
            className="font-sans text-[16px] text-text-secondary mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
              Think about the goal you just set.
          </motion.p>

            {/* Options */}
            <div className="space-y-3 mb-8">
            {IMPACT_OPTIONS.map((option, index) => (
              <QuizOption
                  key={option.value}
                selected={selected === option.value}
                disabled={isNavigating}
                  onClick={() => handleOptionClick(option.value)}
                index={index}
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
        </div>

        {/* Bottom CTA */}
      <OnboardingCTA onClick={() => handleContinue()} disabled={!selected || isNavigating}>
            {isNavigating ? 'Saving...' : 'Continue'}
      </OnboardingCTA>
    </OnboardingLayout>
  );
}
