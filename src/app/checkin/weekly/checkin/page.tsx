'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useWeeklyReflection } from '@/hooks/useWeeklyReflection';
import { useDemoMode } from '@/contexts/DemoModeContext';
import type { OnTrackStatus } from '@/types';

const ON_TRACK_OPTIONS: { value: OnTrackStatus; label: string }[] = [
  { value: 'off_track', label: 'No' },
  { value: 'not_sure', label: 'Not sure' },
  { value: 'on_track', label: 'Yes' },
];

// Background image for the dynamic section
const BACKGROUND_IMAGES: Record<OnTrackStatus, string> = {
  off_track: 'linear-gradient(180deg, rgba(180, 80, 60, 0.8) 0%, rgba(120, 50, 40, 0.9) 100%)',
  not_sure: 'linear-gradient(180deg, rgba(140, 130, 110, 0.8) 0%, rgba(100, 90, 80, 0.9) 100%)',
  on_track: 'linear-gradient(180deg, rgba(60, 140, 100, 0.8) 0%, rgba(40, 100, 70, 0.9) 100%)',
};

export default function WeeklyCheckInPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { isDemoMode } = useDemoMode();
  const { checkIn, isLoading, startCheckIn, updateOnTrackStatus } = useWeeklyReflection();
  
  const [onTrackStatus, setOnTrackStatus] = useState<OnTrackStatus>('not_sure');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Initialize with existing check-in data
  useEffect(() => {
    if (checkIn?.onTrackStatus) {
      setOnTrackStatus(checkIn.onTrackStatus);
    }
  }, [checkIn]);

  // Start check-in on mount if not exists
  useEffect(() => {
    if (!isLoading && !checkIn && isLoaded && user) {
      startCheckIn();
    }
  }, [isLoading, checkIn, isLoaded, user, startCheckIn]);

  const currentIndex = ON_TRACK_OPTIONS.findIndex(o => o.value === onTrackStatus);
  const thumbPosition = (currentIndex / (ON_TRACK_OPTIONS.length - 1)) * 100;

  const handleSliderInteraction = useCallback((clientX: number, rect: DOMRect) => {
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const index = Math.round(percentage * (ON_TRACK_OPTIONS.length - 1));
    setOnTrackStatus(ON_TRACK_OPTIONS[index].value);
  }, []);

  const handleContinue = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // In demo mode, skip API calls but still navigate
      if (!isDemoMode) {
        await updateOnTrackStatus(onTrackStatus);
      }
      router.push('/checkin/weekly/evaluate');
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

  if (!isLoaded || isLoading) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-[#faf8f6] dark:bg-[#05070b] flex items-center justify-center z-[9999]"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a1a1a] dark:border-white" />
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[9999] bg-[#faf8f6] dark:bg-[#05070b] flex flex-col overflow-hidden"
    >
      {/* Header with close button */}
      <div className="flex items-center justify-end px-6 pt-6 pb-4">
        <button
          onClick={() => router.push('/')}
          className="p-2 -mr-2 text-[#5f5a55] dark:text-[#a0a0a0] hover:text-[#1a1a1a] dark:hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:items-center md:justify-center px-6 overflow-y-auto">
        <div className="w-full max-w-[400px] mx-auto flex-1 md:flex-initial flex flex-col">
          {/* Header */}
          <p className="font-albert text-[18px] md:text-[24px] font-medium text-[#5f5a55] dark:text-[#a0a0a0] tracking-[-1px] md:tracking-[-1.5px] leading-[1.3] mb-2 md:mb-3 text-center">
            Reflect on your week
          </p>
          
          {/* Main question */}
          <h1 className="font-albert text-[26px] md:text-[36px] text-[#1a1a1a] dark:text-white tracking-[-2px] leading-[1.2] text-center mb-6 md:mb-8">
            Are you on track to achieve your goal?
          </h1>

          {/* Dynamic visual section */}
          <div 
            className="relative w-full aspect-square max-h-[280px] md:h-[260px] md:aspect-auto rounded-[20px] overflow-hidden flex items-center justify-center mb-6"
            style={{ background: BACKGROUND_IMAGES[onTrackStatus] }}
          >
            <div className="absolute inset-0 bg-black/35" />
            <h2 className="relative z-10 font-albert text-[36px] md:text-[48px] font-medium text-white text-center tracking-[-2px] leading-[1.2]">
              {ON_TRACK_OPTIONS.find(o => o.value === onTrackStatus)?.label}
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
              <span className="font-sans text-[14px] text-[#a7a39e] dark:text-[#7d8190]">No</span>
              <span className="font-sans text-[14px] text-[#a7a39e] dark:text-[#7d8190]">Not sure</span>
              <span className="font-sans text-[14px] text-[#a7a39e] dark:text-[#7d8190]">Yes</span>
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
