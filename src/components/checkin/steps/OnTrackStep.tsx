'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useWeeklyReflection } from '@/hooks/useWeeklyReflection';
import { useDemoMode } from '@/contexts/DemoModeContext';
import type { OnTrackStepProps } from './types';
import type { OnTrackStatus } from '@/types';

// Default on-track options
const DEFAULT_OPTIONS: Array<{ value: string; label: string; gradient: string }> = [
  { value: 'off_track', label: 'No', gradient: 'linear-gradient(180deg, rgba(180, 80, 60, 0.8) 0%, rgba(120, 50, 40, 0.9) 100%)' },
  { value: 'not_sure', label: 'Not sure', gradient: 'linear-gradient(180deg, rgba(140, 130, 110, 0.8) 0%, rgba(100, 90, 80, 0.9) 100%)' },
  { value: 'on_track', label: 'Yes', gradient: 'linear-gradient(180deg, rgba(60, 140, 100, 0.8) 0%, rgba(40, 100, 70, 0.9) 100%)' },
];

/**
 * OnTrackStep - 3-state weekly on-track slider
 *
 * Asks "Are you on track to achieve your goal?" with
 * 3 options: No, Not sure, Yes. Full-screen gradient background.
 * Extracted from: src/app/checkin/weekly/checkin/page.tsx
 */
export function OnTrackStep({ config, onComplete }: OnTrackStepProps) {
  const { isDemoMode } = useDemoMode();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Get config values with defaults
  const {
    question = 'Are you on track to achieve your goal?',
    subheading = 'Reflect on your week',
    options = DEFAULT_OPTIONS,
  } = config;

  const { checkIn, isLoading, startCheckIn, updateOnTrackStatus } = useWeeklyReflection();

  // Initialize state from middle option
  const defaultStatus = (options[Math.floor(options.length / 2)]?.value as OnTrackStatus) || 'not_sure';
  const [onTrackStatus, setOnTrackStatus] = useState<OnTrackStatus>(defaultStatus);

  // Initialize with existing check-in data
  useEffect(() => {
    if (checkIn?.onTrackStatus) {
      setOnTrackStatus(checkIn.onTrackStatus);
    }
  }, [checkIn]);

  // Start check-in on mount if not exists
  useEffect(() => {
    if (!isLoading && !checkIn && !isDemoMode) {
      startCheckIn();
    }
  }, [isLoading, checkIn, isDemoMode, startCheckIn]);

  const currentIndex = options.findIndex(o => o.value === onTrackStatus);
  const thumbPosition = (currentIndex / (options.length - 1)) * 100;
  const currentOption = options.find(o => o.value === onTrackStatus);

  const handleSliderInteraction = useCallback((clientX: number, rect: DOMRect) => {
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const index = Math.round(percentage * (options.length - 1));
    setOnTrackStatus(options[index].value as OnTrackStatus);
  }, [options]);

  const handleContinue = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (!isDemoMode) {
        await updateOnTrackStatus(onTrackStatus);
      }
      onComplete({ onTrackStatus });
    } catch (error) {
      console.error('Error updating on-track status:', error);
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const slider = document.getElementById('on-track-slider');
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
  }, [isDragging, handleSliderInteraction]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a1a1a] dark:border-white" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="h-full flex flex-col overflow-hidden"
    >
      {/* Main content */}
      <div className="flex-1 flex flex-col md:items-center md:justify-center px-6 overflow-y-auto">
        <div className="w-full max-w-[400px] mx-auto flex-1 md:flex-initial flex flex-col pt-4 md:pt-0">
          {/* Header */}
          <p className="font-albert text-[18px] md:text-[24px] font-medium text-[#5f5a55] dark:text-[#a0a0a0] tracking-[-1px] md:tracking-[-1.5px] leading-[1.3] mb-2 md:mb-3 text-center">
            {subheading}
          </p>

          {/* Main question */}
          <h1 className="font-albert text-[26px] md:text-[36px] text-[#1a1a1a] dark:text-white tracking-[-2px] leading-[1.2] text-center mb-6 md:mb-8">
            {question}
          </h1>

          {/* Dynamic visual section */}
          <div
            className="relative w-full aspect-square max-h-[280px] md:h-[260px] md:aspect-auto rounded-[20px] overflow-hidden flex items-center justify-center mb-6"
            style={{ background: currentOption?.gradient || DEFAULT_OPTIONS[1].gradient }}
          >
            <div className="absolute inset-0 bg-black/35" />
            <h2 className="relative z-10 font-albert text-[36px] md:text-[48px] font-medium text-white text-center tracking-[-2px] leading-[1.2]">
              {currentOption?.label || 'Not sure'}
            </h2>
          </div>

          {/* Slider */}
          <div className="w-full px-4 mb-4">
            <div
              id="on-track-slider"
              className="relative h-[24px] cursor-pointer"
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
              <div className="absolute top-[9px] left-0 right-0 h-[6px] rounded-[12px] bg-[#e1ddd8] dark:bg-[#262b35]" />

              {/* Track fill */}
              <div
                className="absolute top-[9px] left-0 h-[6px] rounded-l-[12px] bg-[#2c2520] dark:bg-[#b8896a]"
                style={{ width: `${thumbPosition}%` }}
              />

              {/* Thumb */}
              <div
                className="absolute top-0 w-[24px] h-[24px] rounded-full bg-[#f3f1ef] dark:bg-[#1a1f28] border-2 border-[#2c2520] dark:border-[#b8896a] cursor-grab active:cursor-grabbing transition-all duration-150"
                style={{
                  left: `${thumbPosition}%`,
                  transform: 'translateX(-50%)',
                }}
              />
            </div>

            {/* Labels */}
            <div className="flex justify-between mt-3">
              {options.map((opt) => (
                <span key={opt.value} className="font-sans text-[14px] text-[#a7a39e] dark:text-[#7d8190]">
                  {opt.label}
                </span>
              ))}
            </div>
          </div>

          {/* Spacer on mobile to push button down */}
          <div className="flex-1 md:hidden" />

          {/* Continue button */}
          <div className="mt-6 md:mt-10 pb-8 md:pb-0">
            <button
              onClick={handleContinue}
              disabled={isSubmitting}
              className="w-full max-w-[400px] mx-auto block bg-[#2c2520] dark:bg-white text-white dark:text-[#1a1a1a] py-4 rounded-full font-sans text-[16px] font-bold tracking-[-0.5px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Loading...' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
