'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import type { EmotionalState } from '@/types';

const EMOTIONAL_STATES: EmotionalState[] = [
  'low_stuck',
  'uneasy',
  'uncertain',
  'neutral',
  'steady',
  'confident',
  'energized',
];

const STATE_LABELS: Record<EmotionalState, string> = {
  low_stuck: 'Low / Stuck',
  uneasy: 'Uneasy',
  uncertain: 'Uncertain',
  neutral: 'Neutral',
  steady: 'Steady',
  confident: 'Confident',
  energized: 'Energized',
};

// Full-screen gradient backgrounds for each state
const STATE_BACKGROUNDS: Record<EmotionalState, string> = {
  low_stuck: 'linear-gradient(180deg, #2C1810 0%, #1A0A0A 50%, #0A0505 100%)',
  uneasy: 'linear-gradient(180deg, #4A2828 0%, #2C1818 50%, #1A0A0A 100%)',
  uncertain: 'linear-gradient(180deg, #7A9B9B 0%, #9B8B7B 50%, #B87A6A 100%)',
  neutral: 'linear-gradient(180deg, #8BA89B 0%, #A8A090 50%, #B8A088 100%)',
  steady: 'linear-gradient(180deg, #6B9BAB 0%, #8BB8A8 50%, #A8C8B8 100%)',
  confident: 'linear-gradient(180deg, #7BC8C8 0%, #A8B8C8 50%, #C8B8C0 100%)',
  energized: 'linear-gradient(180deg, #4BDBD0 0%, #7BC8F0 50%, #B8D8FF 100%)',
};

export default function MorningCheckInStartPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [emotionalState, setEmotionalState] = useState<EmotionalState>('neutral');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const currentIndex = EMOTIONAL_STATES.indexOf(emotionalState);
  const thumbPosition = (currentIndex / (EMOTIONAL_STATES.length - 1)) * 100;

  const handleSliderInteraction = (clientX: number, rect: DOMRect) => {
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const index = Math.round(percentage * (EMOTIONAL_STATES.length - 1));
    setEmotionalState(EMOTIONAL_STATES[index]);
  };

  const handleContinue = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Start check-in
      await fetch('/api/checkin/morning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      // Update emotional state
      await fetch('/api/checkin/morning', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emotionalState }),
      });

      // Determine next step based on emotional state
      const skipReframe = emotionalState === 'confident' || emotionalState === 'energized';
      
      if (skipReframe) {
        router.push('/checkin/morning/begin-manifest');
      } else {
        router.push('/checkin/morning/accept');
      }
    } catch (error) {
      console.error('Error starting check-in:', error);
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const slider = document.getElementById('emotion-slider');
      if (slider) {
        handleSliderInteraction(e.clientX, slider.getBoundingClientRect());
      }
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!isLoaded) {
    return (
      <div className="fixed inset-0 bg-[#1a1a1a] flex items-center justify-center" style={{ minHeight: '100dvh' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  return (
    // Fixed container - viewport positioning
    <div 
      className="fixed inset-0 z-[9999] overflow-hidden"
      style={{ minHeight: '100dvh', background: STATE_BACKGROUNDS[emotionalState], transition: 'background 0.7s ease-out' }}
    >
      {/* Inner flex container - handles ALL layout */}
      <div className="w-full h-full flex flex-col">
        {/* CSS-animated wrapper - no Framer Motion, no hydration delay */}
        <div className="w-full h-full flex flex-col animate-page-fade-in">
          {/* Main content - centered */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
        {/* Header text */}
        <div className="text-center mb-8 md:mb-12 max-w-[500px]">
          <p className="font-albert text-[18px] md:text-[24px] font-medium text-white/70 tracking-[-1px] leading-[1.3] mb-3">
            Begin your day
          </p>
          <h1 className="font-albert text-[32px] md:text-[48px] text-white tracking-[-2px] leading-[1.1]">
            How do you feel about your goal today?
          </h1>
        </div>

        {/* Emotional state display */}
        <div className="mb-12 md:mb-16">
          <h2 className="font-albert text-[56px] md:text-[80px] lg:text-[96px] font-medium text-white text-center tracking-[-3px] leading-[1] transition-all duration-300">
            {STATE_LABELS[emotionalState]}
          </h2>
        </div>

        {/* Slider */}
        <div className="w-full max-w-[400px] md:max-w-[500px] px-4">
          <div 
            id="emotion-slider"
            className="relative h-[32px] cursor-pointer"
            onMouseDown={(e) => {
              setIsDragging(true);
              handleSliderInteraction(e.clientX, e.currentTarget.getBoundingClientRect());
            }}
            onTouchStart={(e) => {
              const touch = e.touches[0];
              handleSliderInteraction(touch.clientX, e.currentTarget.getBoundingClientRect());
            }}
            onTouchMove={(e) => {
              const touch = e.touches[0];
              handleSliderInteraction(touch.clientX, e.currentTarget.getBoundingClientRect());
            }}
          >
            {/* Track background */}
            <div className="absolute top-[12px] left-0 right-0 h-[8px] rounded-full overflow-hidden">
              {/* Multi-color gradient track */}
              <div 
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(90deg, #C0392B 0%, #E74C3C 15%, #F39C12 30%, #95A5A6 50%, #3498DB 70%, #27AE60 85%, #2ECC71 100%)',
                }}
              />
              {/* White overlay for unselected portion */}
              <div 
                className="absolute top-0 bottom-0 right-0 bg-white/30"
                style={{ left: `${thumbPosition}%` }}
              />
            </div>

            {/* Thumb */}
            <div 
              className="absolute top-0 w-[32px] h-[32px] rounded-full bg-white border-4 border-white shadow-lg transition-all duration-150 cursor-grab active:cursor-grabbing"
              style={{ 
                left: `${thumbPosition}%`,
                transform: 'translateX(-50%)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              }}
            />
          </div>

          {/* Labels */}
          <div className="flex justify-between mt-4 px-1">
            <span className="font-sans text-[12px] text-white/50">Low</span>
            <span className="font-sans text-[12px] text-white/50">Energized</span>
          </div>
        </div>
      </div>

          {/* Continue button - fixed at bottom */}
          <div className="px-6 pb-8 md:pb-12">
            <button
              onClick={handleContinue}
              disabled={isSubmitting}
              className="w-full max-w-[400px] mx-auto block py-4 md:py-5 rounded-full font-sans text-[16px] md:text-[18px] font-bold tracking-[-0.5px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
              style={{ backgroundColor: '#2c2520', color: '#ffffff' }}
            >
              {isSubmitting ? 'Starting...' : 'Continue'}
            </button>
          </div>

          {/* Close/Back button */}
          <button
            onClick={() => router.push('/')}
            className="absolute top-6 left-6 p-2 text-white/70 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
