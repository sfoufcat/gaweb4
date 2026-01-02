'use client';

import { useState, useEffect, useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { usePendingProposals, useSchedulingEvents } from '@/hooks/useScheduling';
import { CalendarPanel } from './CalendarPanel';
import { CalendarSheet } from './CalendarSheet';

interface CalendarButtonProps {
  className?: string;
}

/**
 * CalendarButton
 * 
 * A button that opens the user's calendar panel.
 * Shows a badge if there are pending proposals to respond to.
 * - Desktop: Opens a popover dropdown
 * - Mobile: Opens a bottom sheet
 * 
 * Styled to match the NotificationBell component.
 */
export function CalendarButton({ className = '' }: CalendarButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { proposals } = usePendingProposals();
  
  // Get upcoming events count for the current month
  const dateRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }, []);

  const { events } = useSchedulingEvents({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    role: 'all',
  });

  const upcomingCount = useMemo(() => {
    const now = new Date();
    return events.filter(e => new Date(e.startDateTime) >= now).length;
  }, [events]);

  const pendingCount = proposals.length;

  // Detect mobile vs desktop
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  // Format badge count (cap at 9+)
  const badgeText = pendingCount > 9 ? '9+' : pendingCount.toString();

  return (
    <div className={`relative ${className}`}>
      {/* Calendar Button - Styled like NotificationBell / AlignmentGauge */}
      <button
        onClick={handleOpen}
        className="bg-[#f3f1ef] dark:bg-[#181d28] rounded-[40px] p-2 flex items-center justify-center hover:bg-[#e9e5e0] dark:hover:bg-[#272d38] transition-colors"
        style={{ width: 62, height: 62 }}
        aria-label={`Calendar${pendingCount > 0 ? ` (${pendingCount} pending)` : ''}`}
      >
        <div className="relative w-[50px] h-[50px] flex items-center justify-center">
          <Calendar 
            className="w-6 h-6 text-text-primary" 
            strokeWidth={2}
          />
          
          {/* Pending Badge */}
          {pendingCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-[#E74C3C] text-white text-[10px] font-semibold rounded-full leading-none">
              {badgeText}
            </span>
          )}
        </div>
      </button>

      {/* Desktop: Popover Panel */}
      {!isMobile && (
        <CalendarPanel
          isOpen={isOpen}
          onClose={handleClose}
          upcomingCount={upcomingCount}
        />
      )}

      {/* Mobile: Bottom Sheet */}
      {isMobile && (
        <CalendarSheet
          isOpen={isOpen}
          onClose={handleClose}
          upcomingCount={upcomingCount}
        />
      )}
    </div>
  );
}

export default CalendarButton;
