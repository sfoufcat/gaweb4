'use client';

import { useEffect, useRef } from 'react';
import type { UserAlignment, UserAlignmentSummary } from '@/types';

// Fire icon SVG component
function FireIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path 
        d="M12 12C14 9.04 12 5 11 4C11 7.038 9.227 8.741 8 10C6.774 11.26 6 13.24 6 15C6 16.5913 6.63214 18.1174 7.75736 19.2426C8.88258 20.3679 10.4087 21 12 21C13.5913 21 15.1174 20.3679 16.2426 19.2426C17.3679 18.1174 18 16.5913 18 15C18 13.468 16.944 11.06 16 10C14.214 13 13.209 13 12 12Z" 
        fill="#E74C3C" 
        stroke="#E74C3C" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface AlignmentSheetProps {
  isOpen: boolean;
  onClose: () => void;
  alignment: UserAlignment | null;
  summary: UserAlignmentSummary | null;
}

/**
 * AlignmentSheet Component
 * 
 * Bottom sheet (mobile) / Popup card (desktop) showing daily alignment details.
 * Based on Figma designs:
 * - Complete: https://www.figma.com/design/.../node-id=1760-8609
 * - Incomplete: https://www.figma.com/design/.../node-id=1760-8721
 */
export function AlignmentSheet({
  isOpen,
  onClose,
  alignment,
  summary,
}: AlignmentSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (isOpen && sheetRef.current) {
      sheetRef.current.focus();
    }
  }, [isOpen]);

  const streak = summary?.currentStreak ?? 0;
  const score = alignment?.alignmentScore ?? 0;
  const fullyAligned = alignment?.fullyAligned ?? false;
  const progress = score / 100;

  // Alignment items
  const alignmentItems = [
    { label: 'Confidence check-in', completed: alignment?.didMorningCheckin ?? false },
    { label: "Set today's tasks", completed: alignment?.didSetTasks ?? false },
    { label: 'Chat with your squad', completed: alignment?.didInteractWithSquad ?? false },
    { label: 'Have an active goal', completed: alignment?.hasActiveGoal ?? false },
  ];

  // Check if it's a weekend
  const isWeekend = (() => {
    const day = new Date().getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  })();
  
  const weekendDayName = new Date().getDay() === 6 ? 'Saturday' : 'Sunday';

  // Message based on state
  const getMessage = () => {
    // Weekend message - no daily check-ins on weekends
    if (isWeekend) {
      return `Happy ${weekendDayName}!\nYour streak won't be affected on the weekend.`;
    }
    
    if (fullyAligned) {
      return 'Fully aligned today. Great work! 🔥';
    }
    const completedCount = alignmentItems.filter(i => i.completed).length;
    if (completedCount >= 3) {
      return "You're almost there.\nFinish your steps to align for today.";
    }
    if (completedCount >= 2) {
      return "You're making progress.\nKeep going to reach full alignment.";
    }
    if (completedCount >= 1) {
      return "Great start!\nComplete more steps to stay aligned.";
    }
    return "Start your alignment journey.\nComplete your daily growth routine.";
  };

  // SVG Gauge for the sheet
  const GaugeLarge = () => {
    const size = 100;
    const center = size / 2;
    const radius = 40;
    const strokeWidth = 4;
    
    const angleToRadians = (angle: number) => (angle * Math.PI) / 180;
    
    const describeArc = (startAng: number, endAng: number) => {
      const start = {
        x: center + radius * Math.cos(angleToRadians(startAng)),
        y: center + radius * Math.sin(angleToRadians(startAng)),
      };
      const end = {
        x: center + radius * Math.cos(angleToRadians(endAng)),
        y: center + radius * Math.sin(angleToRadians(endAng)),
      };
      const largeArcFlag = endAng - startAng <= 180 ? 0 : 1;
      return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
    };

    const indicatorAngle = -180 + (180 * progress);
    const indicatorX = center + radius * Math.cos(angleToRadians(indicatorAngle));
    const indicatorY = center + radius * Math.sin(angleToRadians(indicatorAngle));

    return (
      <div className="relative w-[100px] h-[100px]">
        <svg className="w-full h-full" viewBox={`0 0 ${size} ${size}`}>
          <defs>
            <linearGradient id="gauge-gradient-sheet" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="50%" stopColor="#FBBF24" />
              <stop offset="100%" stopColor="#22C55E" />
            </linearGradient>
          </defs>
          
          {/* Background arc */}
          <path
            d={describeArc(-180, 0)}
            fill="none"
            stroke="currentColor"
            className="text-[#e1ddd8] dark:text-[#272d38]"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          
          {/* Progress arc */}
          {progress > 0 && (
            <path
              d={describeArc(-180, -180 + 180 * progress)}
              fill="none"
              stroke="url(#gauge-gradient-sheet)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
          )}
          
          {/* Indicator dot */}
          <circle
            cx={indicatorX}
            cy={indicatorY}
            r={5}
            fill="currentColor"
            className="text-[#1a1a1a] dark:text-[#faf8f6]"
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
          <span className="font-geist font-medium text-[36px] text-text-primary dark:text-[#f5f5f8] leading-none">
            {streak}
          </span>
          <FireIcon size={28} className="mt-1" />
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container - Bottom sheet on mobile, centered card on desktop */}
      <div 
        ref={sheetRef}
        tabIndex={-1}
        className="relative w-full max-w-[500px] mx-0 md:mx-4 bg-white dark:bg-[#171b22] rounded-t-[24px] md:rounded-[24px] shadow-2xl dark:shadow-black/50 animate-in slide-in-from-bottom md:zoom-in-95 duration-300 outline-none"
      >
        {/* Grabber - Only on mobile */}
        <div className="flex justify-center pt-3 pb-2 md:hidden">
          <div className="w-9 h-1 bg-gray-300 dark:bg-[#272d38] rounded-full" />
        </div>

        {/* Close button - Desktop only */}
        <button
          onClick={onClose}
          className="hidden md:block absolute top-4 right-4 text-text-muted dark:text-[#7d8190] hover:text-text-primary dark:hover:text-[#f5f5f8] transition-colors z-10"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="px-6 pt-4 md:pt-6 pb-6 md:pb-8 flex flex-col gap-6 items-center max-h-[85vh] md:max-h-[80vh] overflow-y-auto">
          {/* Title */}
          <h2 className="font-albert font-medium text-[20px] md:text-[24px] text-text-secondary dark:text-[#b2b6c2] tracking-[-1.5px] leading-[1.3] w-full">
            Daily Alignment & Streak
          </h2>

          {/* Gauge */}
          <GaugeLarge />

          {/* Message & Checklist */}
          <div className="w-full flex flex-col gap-5">
            {/* Status Message */}
            <p className="font-albert font-medium text-[20px] md:text-[24px] text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3] text-center whitespace-pre-line">
              {getMessage()}
            </p>

            {/* Checklist */}
            <div className="flex flex-col gap-1">
              {alignmentItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 h-[22px]"
                >
                  {/* Checkbox */}
                  <div className="w-4 h-4 border border-[#e1ddd8] dark:border-[#262b35] rounded-[4px] flex items-center justify-center flex-shrink-0">
                    {item.completed && (
                      <div className="w-2 h-2 bg-accent-secondary dark:bg-[#b8896a] rounded-[2px]" />
                    )}
                  </div>
                  {/* Label */}
                  <span className="font-geist text-[14px] md:text-[16px] text-text-primary dark:text-[#f5f5f8] tracking-[-0.3px] leading-[1.2]">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Explanatory Text */}
            <div className="font-geist text-[14px] md:text-[16px] text-text-primary dark:text-[#b2b6c2] tracking-[-0.3px] leading-[1.4]">
              <p className="mb-2">
                Your Alignment Compass shows how well you&apos;re following your growth routine today.
              </p>
              <p>
                The number in the center shows how many days in a row you&apos;ve stayed aligned.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default AlignmentSheet;
