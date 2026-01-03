'use client';

import { useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { CalendarContent } from './CalendarContent';
import { useDragToDismiss } from '@/hooks/useDragToDismiss';

interface CalendarSheetProps {
  isOpen: boolean;
  onClose: () => void;
  upcomingCount: number;
}

/**
 * CalendarSheet Component (Mobile Bottom Sheet)
 * 
 * Displays the calendar in a bottom-up sheet.
 * Used on mobile screens. Matches NotificationSheet design.
 */
export function CalendarSheet({
  isOpen,
  onClose,
  upcomingCount,
}: CalendarSheetProps) {
  const { sheetRef, handleRef, handleProps } = useDragToDismiss({ onClose });

  // Close on escape key and lock body scroll
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div 
        ref={sheetRef}
        tabIndex={-1}
        className="relative w-full max-w-[500px] mx-0 bg-white dark:bg-[#171b22] rounded-t-[24px] shadow-2xl animate-in slide-in-from-bottom duration-300 outline-none"
        style={{ maxHeight: '85dvh' }}
      >
        {/* Grabber (drag handle) */}
        <div ref={handleRef} {...handleProps} className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
          <div className="w-9 h-1 bg-gray-300 dark:bg-[#3a3f4b] rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pb-3">
          <div className="p-2 bg-brand-accent/10 rounded-lg">
            <Calendar className="w-5 h-5 text-brand-accent" />
          </div>
          <div>
            <h2 className="font-albert text-[20px] font-semibold text-text-primary tracking-[-0.5px]">
              My Calendar
            </h2>
            <p className="text-xs text-text-muted">
              {upcomingCount} upcoming event{upcomingCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Calendar Content */}
        <div className="overflow-y-auto pb-8" style={{ maxHeight: 'calc(85dvh - 100px)' }}>
          <CalendarContent compact />
        </div>
      </div>
    </div>
  );
}

export default CalendarSheet;


