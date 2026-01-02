'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckInPageWrapper } from '@/components/checkin/CheckInPageWrapper';
import { useDemoMode } from '@/contexts/DemoModeContext';
import type { EmotionalState } from '@/types';

// Dynamic headings based on emotional state
const HEADINGS: Partial<Record<EmotionalState, string>> = {
  low_stuck: 'Feeling stuck today?',
  uneasy: 'Feeling uneasy today?',
  uncertain: 'Feeling uncertain today?',
  neutral: 'Taking a moment to center?',
  steady: 'Feeling steady today?',
};

export default function AcceptPage() {
  const router = useRouter();
  const { isDemoMode } = useDemoMode();
  const [emotionalState, setEmotionalState] = useState<EmotionalState>('uncertain');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // In demo mode, use default state
    if (isDemoMode) {
      setEmotionalState('uncertain');
      setIsLoading(false);
      return;
    }
    
    // Fetch current check-in state
    const fetchCheckIn = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const response = await fetch(`/api/checkin/morning?date=${today}`);
        const data = await response.json();
        
        if (data.checkIn?.emotionalState) {
          setEmotionalState(data.checkIn.emotionalState);
        }
      } catch (error) {
        console.error('Error fetching check-in:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCheckIn();
  }, [isDemoMode]);

  const handleContinue = () => {
    router.push('/checkin/morning/breath');
  };

  if (isLoading) {
    return (
      <CheckInPageWrapper>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary" />
        </div>
      </CheckInPageWrapper>
    );
  }

  const heading = HEADINGS[emotionalState] || 'Feeling uncertain today?';

  return (
    <CheckInPageWrapper centered={false}>
      <div className="h-full w-full flex flex-col">
        {/* Main content - centered on desktop */}
        <div className="flex-1 flex flex-col md:items-center md:justify-center px-6 pt-8 md:pt-0 w-full overflow-y-auto">
          <div className="max-w-[500px] w-full flex-1 md:flex-initial flex flex-col text-center">
            {/* Header */}
            <h1 className="font-albert text-[32px] md:text-[42px] text-[#1a1a1a] dark:text-white tracking-[-2px] leading-[1.2] mb-8">
              {heading}
            </h1>

            {/* Content */}
            <div className="space-y-6">
              <p className="font-sans text-[18px] md:text-[20px] text-[#1a1a1a] dark:text-white/90 tracking-[-0.4px] leading-[1.4]">
                It&apos;s okay. Doubt is part of the journey, even for the most driven.
              </p>

              <p className="font-sans text-[18px] md:text-[20px] text-[#1a1a1a] dark:text-white/90 tracking-[-0.4px] leading-[1.4]">
                You don&apos;t need to push the feeling away. Just notice it, let it be, and remember:
              </p>

              <p className="font-albert text-[22px] md:text-[26px] font-semibold text-[#1a1a1a] dark:text-white tracking-[-1px] leading-[1.3] mt-8">
                This moment doesn&apos;t define you or your potential.
              </p>
            </div>

            {/* Spacer on mobile to push button down */}
            <div className="flex-1 md:hidden" />

            {/* Action button - at bottom on mobile, inline on desktop */}
            <div className="mt-8 md:mt-10 pb-8 md:pb-0">
              <button
                onClick={handleContinue}
                className="w-full max-w-[400px] mx-auto block bg-[#2c2520] text-white py-4 md:py-5 rounded-full font-sans text-[16px] md:text-[18px] font-bold tracking-[-0.5px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Let&apos;s breathe
              </button>
            </div>
          </div>
        </div>
      </div>
    </CheckInPageWrapper>
  );
}
