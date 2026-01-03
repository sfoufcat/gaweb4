'use client';

import { useState, useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { usePendingProposals, useSchedulingEvents } from '@/hooks/useScheduling';
import { CalendarSheet } from './CalendarSheet';

interface CalendarIconButtonProps {
  className?: string;
}

/**
 * CalendarIconButton Component
 * 
 * A compact calendar icon for mobile date row.
 * 28px height to match the horizontal ThemeToggle.
 * Shows pending badge and opens CalendarSheet on tap.
 */
export function CalendarIconButton({ className = '' }: CalendarIconButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
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

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  // Format badge count (cap at 9+)
  const badgeText = pendingCount > 9 ? '9+' : pendingCount.toString();

  return (
    <>
      <button
        onClick={handleOpen}
        className={`
          relative h-[28px] w-[28px] rounded-full
          bg-[#f3f1ef] dark:bg-[#181d28]
          flex items-center justify-center
          hover:bg-[#e9e5e0] dark:hover:bg-[#272d38]
          transition-colors
          ${className}
        `}
        aria-label={`Calendar${pendingCount > 0 ? ` (${pendingCount} pending)` : ''}`}
      >
        <Calendar 
          className="w-3.5 h-3.5 text-text-primary" 
          strokeWidth={2}
        />
        
        {/* Pending Badge */}
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 flex items-center justify-center bg-[#E74C3C] text-white text-[8px] font-semibold rounded-full leading-none">
            {badgeText}
          </span>
        )}
      </button>

      {/* Calendar Sheet */}
      <CalendarSheet
        isOpen={isOpen}
        onClose={handleClose}
        upcomingCount={upcomingCount}
      />
    </>
  );
}

export default CalendarIconButton;




