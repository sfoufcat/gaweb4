'use client';

import { useEffect, useRef } from 'react';
import { Calendar, X } from 'lucide-react';
import { CalendarContent } from './CalendarContent';

interface CalendarPanelProps {
  isOpen: boolean;
  onClose: () => void;
  upcomingCount: number;
}

/**
 * CalendarPanel Component (Desktop Popover)
 * 
 * Displays the calendar in a dropdown anchored to the calendar button.
 * Used on desktop/tablet screens. Matches NotificationPanel design.
 */
export function CalendarPanel({
  isOpen,
  onClose,
  upcomingCount,
}: CalendarPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // Check if click is on the calendar button (parent)
        const calendarButton = (e.target as Element).closest('[aria-label*="Calendar"]');
        if (!calendarButton) {
          onClose();
        }
      }
    };
    if (isOpen) {
      // Delay to prevent immediate close on open click
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Invisible backdrop for click-outside detection */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Panel - anchored to calendar button (parent has relative positioning) */}
      <div 
        ref={panelRef}
        className="absolute right-0 top-full mt-2 z-50 w-[380px] max-w-[calc(100vw-32px)] bg-white dark:bg-[#171b22] rounded-[20px] shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#262b35]">
          <div className="flex items-center gap-3">
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
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#1e222a] transition-colors"
            aria-label="Close calendar"
          >
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        {/* Calendar Content */}
        <div className="max-h-[450px] overflow-hidden">
          <CalendarContent compact />
        </div>
      </div>
    </>
  );
}

export default CalendarPanel;


