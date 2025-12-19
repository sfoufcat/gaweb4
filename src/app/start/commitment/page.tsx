'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { OnboardingLayout, OnboardingCTA } from '@/components/onboarding/OnboardingLayout';
import { useGuestSession } from '@/hooks/useGuestSession';

export default function CommitmentPage() {
  const router = useRouter();
  const { data, saveData, isLoading: sessionLoading } = useGuestSession();
  
  const [accountability, setAccountability] = useState<boolean | null>(null);
  const [readyToInvest, setReadyToInvest] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Load previously saved values if any
    if (data.accountability !== undefined) {
      setAccountability(data.accountability);
    }
    if (data.readyToInvest !== undefined) {
      setReadyToInvest(data.readyToInvest);
    }
  }, [data.accountability, data.readyToInvest]);

  const handleContinue = async () => {
    if (accountability === null || readyToInvest === null) return;
    
    setIsSubmitting(true);
    try {
      await saveData({
        accountability,
        readyToInvest,
        currentStep: 'analyzing',
      });
      router.push('/start/analyzing');
    } catch (error) {
      console.error('Error saving commitment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate cost per day ($9/month ≈ $0.30/day)
  const costPerDay = (9 / 30).toFixed(2);

  if (sessionLoading) {
    return (
      <div className="fixed inset-0 bg-app-bg flex flex-col items-center justify-center">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8]" />
          <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-[#a07855] animate-spin" />
        </div>
        <p className="mt-4 text-text-secondary">Loading...</p>
      </div>
    );
  }

  return (
    <OnboardingLayout 
      showProgress 
      currentStep={3} 
      totalSteps={3}
      stepLabel="Final questions"
    >
      {/* Content */}
      <motion.div 
        className="flex-1 flex flex-col items-center justify-start px-4 py-8 lg:py-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="w-full max-w-xl lg:max-w-2xl mx-auto space-y-12">
          
          {/* Question 1: Daily Check-in */}
          <div>
            <h2 className="font-albert text-[28px] lg:text-[36px] text-text-primary tracking-[-1.5px] leading-[1.2] mb-6">
              Are you willing to check in with your squad each day to stay accountable?
            </h2>
            <div className="flex gap-4">
              <button
                onClick={() => setAccountability(true)}
                disabled={isSubmitting}
                className={`flex-1 p-5 rounded-[20px] border-2 text-center font-sans text-[16px] font-medium transition-all ${
                  accountability === true
                    ? 'border-[#a07855] bg-[#faf8f6] text-text-primary shadow-sm'
                    : 'border-[#e1ddd8] bg-white text-text-secondary hover:border-[#d4d0cb] hover:shadow-sm'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Yes
              </button>
              <button
                onClick={() => setAccountability(false)}
                disabled={isSubmitting}
                className={`flex-1 p-5 rounded-[20px] border-2 text-center font-sans text-[16px] font-medium transition-all ${
                  accountability === false
                    ? 'border-[#a07855] bg-[#faf8f6] text-text-primary shadow-sm'
                    : 'border-[#e1ddd8] bg-white text-text-secondary hover:border-[#d4d0cb] hover:shadow-sm'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                No
              </button>
            </div>
          </div>

          {/* Question 2: Investment */}
          <div>
            <h2 className="font-albert text-[28px] lg:text-[36px] text-text-primary tracking-[-1.5px] leading-[1.2] mb-6">
              Are you ready to invest $9/month to join your squad?
            </h2>
            <div className="flex gap-4">
              <button
                onClick={() => setReadyToInvest(true)}
                disabled={isSubmitting}
                className={`flex-1 p-5 rounded-[20px] border-2 text-center font-sans text-[16px] font-medium transition-all ${
                  readyToInvest === true
                    ? 'border-[#a07855] bg-[#faf8f6] text-text-primary shadow-sm'
                    : 'border-[#e1ddd8] bg-white text-text-secondary hover:border-[#d4d0cb] hover:shadow-sm'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Yes
              </button>
              <button
                onClick={() => setReadyToInvest(false)}
                disabled={isSubmitting}
                className={`flex-1 p-5 rounded-[20px] border-2 text-center font-sans text-[16px] font-medium transition-all ${
                  readyToInvest === false
                    ? 'border-[#a07855] bg-[#faf8f6] text-text-primary shadow-sm'
                    : 'border-[#e1ddd8] bg-white text-text-secondary hover:border-[#d4d0cb] hover:shadow-sm'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                No
              </button>
            </div>

            {/* Value Card */}
            <div className="mt-6 p-4 bg-gradient-to-r from-[#faf8f6] to-[#f5f2ef] rounded-2xl border border-[#e1ddd8]">
              <p className="font-sans text-[14px] text-text-secondary text-center">
                That&apos;s the equivalent of <span className="font-semibold text-[#a07855]">${costPerDay}/day</span> for daily accountability, consistency, and real growth.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Bottom CTA */}
      <OnboardingCTA 
        onClick={handleContinue} 
        disabled={accountability !== true || readyToInvest !== true || isSubmitting}
        variant="golden"
      >
        {isSubmitting ? 'Saving...' : 'Continue'}
      </OnboardingCTA>
    </OnboardingLayout>
  );
}

