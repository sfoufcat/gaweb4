'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { EmotionalState } from '@/types';

interface EmotionalSliderProps {
  value: EmotionalState;
  onChange: (value: EmotionalState) => void;
}

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

// Gradient backgrounds for each state (matching Figma)
const STATE_BACKGROUNDS: Record<EmotionalState, string> = {
  low_stuck: 'linear-gradient(135deg, #8B4B6B 0%, #2C1810 50%, #1A0A0A 100%)',
  uneasy: 'linear-gradient(135deg, #9B6B6B 0%, #6B4B4B 50%, #2C1818 100%)',
  uncertain: 'linear-gradient(135deg, #A8B5C7 0%, #C4A89B 50%, #E87C6C 100%)',
  neutral: 'linear-gradient(135deg, #B5C4C7 0%, #D4C4B5 50%, #C9A890 100%)',
  steady: 'linear-gradient(135deg, #89A8B5 0%, #A5C4B8 50%, #B5D4C8 100%)',
  confident: 'linear-gradient(135deg, #9BCACA 0%, #C4A8B5 50%, #D4B5C4 100%)',
  energized: 'linear-gradient(135deg, #6BD4CA 0%, #9BCAFF 50%, #D4CAFF 100%)',
};

export function EmotionalSlider({ value, onChange }: EmotionalSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const currentIndex = EMOTIONAL_STATES.indexOf(value);

  const handlePositionChange = useCallback((clientX: number) => {
    if (!sliderRef.current) return;
    
    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const index = Math.round(percentage * (EMOTIONAL_STATES.length - 1));
    
    onChange(EMOTIONAL_STATES[index]);
  }, [onChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handlePositionChange(e.clientX);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      handlePositionChange(e.clientX);
    }
  }, [isDragging, handlePositionChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    handlePositionChange(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging) {
      handlePositionChange(e.touches[0].clientX);
    }
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const thumbPosition = (currentIndex / (EMOTIONAL_STATES.length - 1)) * 100;

  return (
    <div className="w-full">
      {/* Mood display card */}
      <div 
        className="relative h-[260px] rounded-[20px] overflow-hidden mb-8 transition-all duration-500"
        style={{ background: STATE_BACKGROUNDS[value] }}
      >
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-black/35" />
        
        {/* Content */}
        <div className="relative z-10 h-full flex items-center justify-center p-6">
          <h2 className="font-albert text-[48px] font-medium text-[#f1ece6] text-center tracking-[-2px] leading-[1.2]">
            {STATE_LABELS[value]}
          </h2>
        </div>
      </div>

      {/* Slider */}
      <div 
        ref={sliderRef}
        className="relative h-[24px] cursor-pointer"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => setIsDragging(false)}
      >
        {/* Track background with gradient */}
        <div className="absolute top-[9px] left-0 right-0 h-[6px] rounded-[12px] overflow-hidden">
          {/* Multi-color gradient track */}
          <div 
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(90deg, #E74C3C 0%, #F39C12 25%, #95A5A6 50%, #3498DB 75%, #27AE60 100%)',
            }}
          />
          {/* Gray overlay for unselected portion */}
          <div 
            className="absolute top-0 bottom-0 right-0 bg-[#e1ddd8]"
            style={{ left: `${thumbPosition}%` }}
          />
        </div>

        {/* Thumb */}
        <div 
          className="absolute top-0 w-[24px] h-[24px] rounded-full bg-white border-2 border-[#2c2520] shadow-md transition-all duration-150"
          style={{ 
            left: `${thumbPosition}%`,
            transform: 'translateX(-50%)',
          }}
        />
      </div>
    </div>
  );
}

