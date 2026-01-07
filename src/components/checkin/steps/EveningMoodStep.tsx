'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useEveningCheckIn } from '@/hooks/useEveningCheckIn';
import type { EveningMoodStepProps } from './types';
import type { EveningEmotionalState } from '@/types';

// Default emotional states configuration
const DEFAULT_STATES: Array<{ value: EveningEmotionalState; label: string; gradient: string }> = [
  { value: 'tough_day', label: 'Tough day', gradient: 'linear-gradient(180deg, #7a8b9b 0%, #9b8b7b 50%, #b87a6a 100%)' },
  { value: 'mixed', label: 'Mixed', gradient: 'linear-gradient(180deg, #8a9b9b 0%, #9b9b8b 50%, #a89b8b 100%)' },
  { value: 'steady', label: 'Steady', gradient: 'linear-gradient(180deg, #6b9bab 0%, #8bb8a8 50%, #a8c8b8 100%)' },
  { value: 'good_day', label: 'Good day', gradient: 'linear-gradient(180deg, #7bc8c8 0%, #a8c8d8 50%, #c8d8e0 100%)' },
  { value: 'great_day', label: 'Amazing', gradient: 'linear-gradient(180deg, #4bdbd0 0%, #7bc8f0 50%, #b8d8ff 100%)' },
];

// Slider gradient colors for evening
const SLIDER_GRADIENT = 'linear-gradient(90deg, #C0392B 0%, #F39C12 25%, #95A5A6 50%, #27AE60 75%, #2ECC71 100%)';

/**
 * EveningMoodStep - 5-state evening mood slider
 *
 * Displays a slider with 5 emotional states (tough_day to great_day),
 * full-screen gradient background per state, smooth transitions.
 * Extracted from: src/app/checkin/evening/evaluate/page.tsx
 */
export function EveningMoodStep({ config, onComplete }: EveningMoodStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Get config values with defaults
  const {
    question = 'How did today feel?',
    states = DEFAULT_STATES,
  } = config;

  const { updateEmotionalState, checkIn } = useEveningCheckIn();

  // Initialize state from config or default
  const defaultState = (states[Math.floor(states.length / 2)]?.value as EveningEmotionalState) || 'steady';
  const [emotionalState, setEmotionalState] = useState<EveningEmotionalState>(defaultState);

  // Load existing state if available
  useEffect(() => {
    if (checkIn?.emotionalState) {
      setEmotionalState(checkIn.emotionalState);
    }
  }, [checkIn]);

  const currentIndex = states.findIndex(s => s.value === emotionalState);
  const thumbPosition = (currentIndex / (states.length - 1)) * 100;
  const currentState = states.find(s => s.value === emotionalState);

  const handleSliderInteraction = (clientX: number, rect: DOMRect) => {
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const index = Math.round(percentage * (states.length - 1));
    setEmotionalState(states[index].value as EveningEmotionalState);
  };

  const handleContinue = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      await updateEmotionalState(emotionalState);
      onComplete({ emotionalState });
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="h-full flex flex-col overflow-hidden"
    >
      {/* Main content */}
      <div className="flex-1 flex flex-col md:items-center md:justify-center px-6 overflow-y-auto">
        <div className="w-full max-w-[480px] lg:max-w-[560px] mx-auto flex-1 md:flex-initial flex flex-col pt-4 md:pt-0">
          {/* Header */}
          <div className="mb-4 md:mb-8">
            <h1 className="font-albert text-[32px] md:text-[44px] text-[#1a1a1a] dark:text-white tracking-[-2px] leading-[1.15] mb-2">
              {question}
            </h1>
            <p className="font-sans text-[18px] md:text-[20px] text-[#5f5a55] dark:text-[#a0a0a0] tracking-[-0.4px] leading-[1.4]">
              Choose the option that fits your experience.
            </p>
          </div>

          {/* Dynamic section with mood display */}
          <div
            className="relative w-full aspect-[4/3] md:aspect-[3/2] rounded-[20px] overflow-hidden mb-6 flex items-center justify-center transition-all duration-700"
            style={{ background: currentState?.gradient || DEFAULT_STATES[2].gradient }}
          >
            {/* Overlay for mood text */}
            <div className="absolute inset-0 bg-black/35" />

            {/* Mood label */}
            <h2 className="relative font-albert text-[36px] md:text-[56px] font-medium text-white text-center tracking-[-2px] leading-[1.2] z-10">
              {currentState?.label || 'Steady'}
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
                  className="absolute top-0 bottom-0 right-0 bg-[#e1ddd8] dark:bg-[#2a2f38]"
                  style={{ left: `${thumbPosition}%` }}
                />
              </div>

              {/* Thumb */}
              <div
                className="absolute top-[4px] w-[32px] h-[32px] rounded-full bg-[#f3f1ef] dark:bg-[#2a2f38] border-2 border-[#2c2520] dark:border-white shadow-lg transition-all duration-150 cursor-grab active:cursor-grabbing"
                style={{
                  left: `${thumbPosition}%`,
                  transform: 'translateX(-50%)',
                }}
              />
            </div>

            {/* Labels */}
            <div className="flex justify-between mt-3 px-1">
              <span className="font-sans text-[13px] md:text-[14px] text-[#5f5a55] dark:text-[#a0a0a0]">Tough</span>
              <span className="font-sans text-[13px] md:text-[14px] text-[#5f5a55] dark:text-[#a0a0a0]">Amazing</span>
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
