'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { OnboardingLayout, OnboardingCTA } from '@/components/onboarding/OnboardingLayout';
import { useGuestSession } from '@/hooks/useGuestSession';
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
 * Guest Support Needs Question (Multi-select)
 * Final quiz question before collecting user info
 */
export default function GuestSupportNeedsPage() {
  const router = useRouter();
  const { saveData, isLoading } = useGuestSession();
  const [selected, setSelected] = useState<OnboardingSupportNeed[]>([]);
  const [isNavigating, setIsNavigating] = useState(false);

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
    
    await saveData({ 
      supportNeeds: selected,
      currentStep: 'commitment',
    });
    
    // Navigate to analyzing screen (shows personalized plan creation)
    router.push('/start/commitment');
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
      currentStep={2} 
      totalSteps={3}
      stepLabel="Step 2 of 3"
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
            What would support you the most in achieving your goal?
          </h1>
          <p className="font-sans text-[16px] text-text-secondary mb-8">
            Select all that apply.
          </p>

          {/* Options */}
          <div className="space-y-3 mb-8">
            {SUPPORT_OPTIONS.map((option) => {
              const isSelected = selected.includes(option.value);
              return (
                <button
                  key={option.value}
                  onClick={() => toggleOption(option.value)}
                  disabled={isNavigating}
                  className={`w-full p-5 rounded-[20px] border-2 text-left transition-all hover:scale-[1.01] active:scale-[0.99] ${
                    isSelected 
                      ? 'border-[#a07855] bg-[#faf8f6] shadow-sm' 
                      : 'border-[#e1ddd8] bg-white hover:border-[#d4d0cb] hover:shadow-sm'
                  } disabled:opacity-50 disabled:hover:scale-100`}
                >
                  <div className="flex items-center gap-4">
                    {/* Checkbox */}
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      isSelected 
                        ? 'border-[#a07855] bg-[#a07855]' 
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
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Bottom CTA */}
      <OnboardingCTA onClick={handleContinue} disabled={selected.length === 0 || isNavigating}>
        {isNavigating ? 'Analyzing...' : 'Create my growth plan →'}
      </OnboardingCTA>
    </OnboardingLayout>
  );
}

