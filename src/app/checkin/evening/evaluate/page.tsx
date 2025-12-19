'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { useEveningCheckIn } from '@/hooks/useEveningCheckIn';
import type { EveningEmotionalState } from '@/types';

const EMOTIONAL_STATES: EveningEmotionalState[] = [
  'tough_day',
  'mixed',
  'steady',
  'good_day',
  'great_day',
];

const STATE_LABELS: Record<EveningEmotionalState, string> = {
  tough_day: 'Tough day',
  mixed: 'Mixed',
  steady: 'Steady',
  good_day: 'Good day',
  great_day: 'Amazing',
};

// Background images for each state - using gradient overlays to create mood
const STATE_BACKGROUNDS: Record<EveningEmotionalState, string> = {
  tough_day: 'linear-gradient(180deg, #7a8b9b 0%, #9b8b7b 50%, #b87a6a 100%)',
  mixed: 'linear-gradient(180deg, #8a9b9b 0%, #9b9b8b 50%, #a89b8b 100%)',
  steady: 'linear-gradient(180deg, #6b9bab 0%, #8bb8a8 50%, #a8c8b8 100%)',
  good_day: 'linear-gradient(180deg, #7bc8c8 0%, #a8c8d8 50%, #c8d8e0 100%)',
  great_day: 'linear-gradient(180deg, #4bdbd0 0%, #7bc8f0 50%, #b8d8ff 100%)',
};

// Slider gradient colors for evening
const SLIDER_GRADIENT = 'linear-gradient(90deg, #C0392B 0%, #F39C12 25%, #95A5A6 50%, #27AE60 75%, #2ECC71 100%)';

export default function EveningEvaluatePage() {
  const router = useRouter();
  const { isLoaded } = useUser();
  const [emotionalState, setEmotionalState] = useState<EveningEmotionalState>('steady');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const { updateEmotionalState, checkIn } = useEveningCheckIn();

  // Load existing state if available
  useEffect(() => {
    if (checkIn?.emotionalState) {
      setEmotionalState(checkIn.emotionalState);
    }
  }, [checkIn]);

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
      // Save emotional state
      await updateEmotionalState(emotionalState);
      
      // Navigate to reflect step
      router.push('/checkin/evening/reflect');
    } catch (error) {
      console.error('Error saving emotional state:', error);
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const slider = document.getElementById('evening-emotion-slider');
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
      <div className="fixed inset-0 bg-[#faf8f6] flex items-center justify-center z-[9999]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a1a1a]" />
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-[9999] bg-[#faf8f6] flex flex-col overflow-hidden"
    >
      {/* Back button - fixed top left */}
      <div className="px-6 pt-6 pb-2">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 text-[#1a1a1a] hover:text-[#5f5a55] transition-colors"
          aria-label="Back"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:items-center md:justify-center px-6 overflow-y-auto">
        <div className="w-full max-w-[480px] lg:max-w-[560px] mx-auto flex-1 md:flex-initial flex flex-col">
          {/* Header */}
          <div className="mb-4 md:mb-8">
            <h1 className="font-albert text-[32px] md:text-[44px] text-[#1a1a1a] tracking-[-2px] leading-[1.15] mb-2">
              How did today feel?
            </h1>
            <p className="font-sans text-[18px] md:text-[20px] text-[#5f5a55] tracking-[-0.4px] leading-[1.4]">
              Choose the option that fits your experience.
            </p>
          </div>

          {/* Dynamic section with mood display */}
          <div 
            className="relative w-full aspect-[4/3] md:aspect-[3/2] rounded-[20px] overflow-hidden mb-6 flex items-center justify-center transition-all duration-700"
            style={{ background: STATE_BACKGROUNDS[emotionalState] }}
          >
            {/* Overlay for mood text */}
            <div className="absolute inset-0 bg-black/35" />
            
            {/* Mood label */}
            <h2 className="relative font-albert text-[36px] md:text-[56px] font-medium text-white text-center tracking-[-2px] leading-[1.2] z-10">
              {STATE_LABELS[emotionalState]}
            </h2>
          </div>

          {/* Slider */}
          <div className="w-full max-w-[420px] mx-auto mb-6">
            <div 
              id="evening-emotion-slider"
              className="relative h-[40px] cursor-pointer"
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
              <div className="absolute top-[16px] left-0 right-0 h-[8px] rounded-full overflow-hidden">
                {/* Multi-color gradient track */}
                <div 
                  className="absolute inset-0"
                  style={{ background: SLIDER_GRADIENT }}
                />
                {/* Gray overlay for unselected portion */}
                <div 
                  className="absolute top-0 bottom-0 right-0 bg-[#e1ddd8]"
                  style={{ left: `${thumbPosition}%` }}
                />
              </div>

              {/* Thumb */}
              <div 
                className="absolute top-[4px] w-[32px] h-[32px] rounded-full bg-[#f3f1ef] border-2 border-[#2c2520] shadow-lg transition-all duration-150 cursor-grab active:cursor-grabbing"
                style={{ 
                  left: `${thumbPosition}%`,
                  transform: 'translateX(-50%)',
                }}
              />
            </div>

            {/* Labels */}
            <div className="flex justify-between mt-3 px-1">
              <span className="font-sans text-[13px] md:text-[14px] text-[#5f5a55]">Tough</span>
              <span className="font-sans text-[13px] md:text-[14px] text-[#5f5a55]">Amazing</span>
            </div>
          </div>

          {/* Spacer on mobile to push button down */}
          <div className="flex-1 md:hidden" />

          {/* Continue button */}
          <div className="mt-6 md:mt-10 pb-8 md:pb-0">
            <button
              onClick={handleContinue}
              disabled={isSubmitting}
              className="w-full bg-[#2c2520] text-white py-4 md:py-5 rounded-full font-sans text-[16px] md:text-[17px] font-bold tracking-[-0.5px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}



