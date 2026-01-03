'use client';

import { useRouter } from 'next/navigation';
import { type Habit } from '@/types';
import { useDragToDismiss } from '@/hooks/useDragToDismiss';

interface HabitCheckInModalProps {
  habit: Habit;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  onSkip: () => void;
}

export function HabitCheckInModal({ habit, isOpen, onClose, onComplete, onSkip }: HabitCheckInModalProps) {
  const router = useRouter();
  const { sheetRef, handleRef, handleProps } = useDragToDismiss({ onClose });
  
  if (!isOpen) return null;

  const handleEdit = () => {
    router.push(`/habits/${habit.id}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Container - Bottom sheet on mobile, centered card on desktop */}
      <div ref={sheetRef} className="relative w-full max-w-[500px] md:mx-4 bg-white dark:bg-[#171b22] rounded-t-[24px] md:rounded-[24px] shadow-2xl animate-in slide-in-from-bottom md:zoom-in-95 duration-300">
        {/* Grabber - Only on mobile (drag handle) */}
        <div ref={handleRef} {...handleProps} className="flex justify-center pt-3 pb-2 md:hidden touch-none select-none cursor-grab active:cursor-grabbing">
          <div className="w-9 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>
        
        {/* Close button - Desktop only */}
        <button
          onClick={onClose}
          className="hidden md:block absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        {/* Content */}
        <div className="px-6 pt-5 md:pt-8 pb-6 space-y-4">
          <p className="font-albert text-[20px] md:text-[24px] font-medium text-text-secondary tracking-[-1.5px] leading-[1.3]">
            Habit actions
          </p>
          <p className="font-albert text-[28px] md:text-[36px] text-text-primary tracking-[-2px] leading-[1.2]">
            Did you crush it today?
          </p>
          
          {/* Habit Card */}
          <div className="bg-[#f3f1ef] dark:bg-[#1a1f28] rounded-[20px] p-4 flex items-center justify-between">
            <p className="font-albert text-[16px] md:text-[18px] font-semibold tracking-[-1px] text-text-primary">
              {habit.text}
            </p>
            <button 
              onClick={handleEdit}
              className="text-text-secondary hover:text-text-primary transition-colors"
              aria-label="Edit habit"
            >
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6 md:pb-8 pt-2">
          <button
            onClick={onSkip}
            className="flex-1 py-3 md:py-4 px-4 rounded-full bg-white dark:bg-[#1a1f28] text-text-primary border border-[#d7d2cc]/50 dark:border-[#3a3f48] font-sans font-bold text-[14px] md:text-[16px] tracking-[-0.5px] leading-[1.4] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
          >
            Skip for today
          </button>
          <button
            onClick={onComplete}
            className="flex-1 py-3 md:py-4 px-4 rounded-full bg-[#2c2520] text-white font-sans font-bold text-[14px] md:text-[16px] tracking-[-0.5px] leading-[1.4] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            I did it!
          </button>
        </div>
      </div>
    </div>
  );
}

