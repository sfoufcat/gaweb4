'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { OnboardingLayout, OnboardingCTA } from '@/components/onboarding/OnboardingLayout';
import { useGuestSession } from '@/hooks/useGuestSession';
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
 * Guest Peer Accountability Question (Single-select)
 * Second quiz question in the guest onboarding flow
 */
export default function GuestObstaclesPage() {
  const router = useRouter();
  const { saveData, isLoading } = useGuestSession();
  const [selected, setSelected] = useState<PeerAccountability | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const handleContinue = async (value?: PeerAccountability) => {
    const selectedValue = value || selected;
    if (!selectedValue) return;
    
    setIsNavigating(true);
    
    await saveData({ 
      peerAccountability: selectedValue,
      currentStep: 'business_stage',
    });
    
    router.push('/start/business-stage');
  };

  // Auto-advance when an option is selected
  const handleOptionClick = (value: PeerAccountability) => {
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
            Do you have a group of peers who see your commitments and your results every day?
          </h1>
          <p className="font-sans text-[16px] text-text-secondary mb-8">
            Select one option.
          </p>

          {/* Options */}
          <div className="space-y-3 mb-8">
            {PEER_ACCOUNTABILITY_OPTIONS.map((option) => {
              const isSelected = selected === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => handleOptionClick(option.value)}
                  disabled={isNavigating}
                  className={`w-full p-5 rounded-[20px] border-2 text-left transition-all hover:scale-[1.01] active:scale-[0.99] ${
                    isSelected 
                      ? 'border-[#a07855] bg-[#faf8f6] shadow-sm' 
                      : 'border-[#e1ddd8] bg-white hover:border-[#d4d0cb] hover:shadow-sm'
                  } disabled:opacity-50 disabled:hover:scale-100`}
                >
                  <div className="flex items-center gap-4">
                    {/* Letter indicator */}
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all font-medium text-sm ${
                      isSelected 
                        ? 'border-[#a07855] bg-[#a07855] text-white' 
                        : 'border-[#d4d0cb] text-text-secondary'
                    }`}>
                      {option.letter}
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
      <OnboardingCTA onClick={handleContinue} disabled={!selected || isNavigating}>
        {isNavigating ? 'Saving...' : 'Continue'}
      </OnboardingCTA>
    </OnboardingLayout>
  );
}

