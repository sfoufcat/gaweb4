'use client';

import { useState, useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { usePendingProposals, useSchedulingEvents } from '@/hooks/useScheduling';
import { CalendarSheet } from './CalendarSheet';

interface CalendarIconButtonProps {
  className?: string;
  /** Icon size variant: sm (28px), lg (40px), xl (62px to match ChatButton) */
  size?: 'sm' | 'lg' | 'xl';
}

/**
 * CalendarIconButton Component
 *
 * A compact calendar icon for mobile date row.
 * Shows pending badge and opens CalendarSheet on tap.
 */
export function CalendarIconButton({ className = '', size = 'sm' }: CalendarIconButtonProps) {
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

  // Size classes matching ChatButton for xl
  const sizeClasses = size === 'xl'
    ? 'rounded-[40px] p-2'
    : size === 'lg'
      ? 'h-10 w-10 rounded-full'
      : 'h-[28px] w-[28px] rounded-full';
  const iconClasses = size === 'xl' ? 'w-6 h-6' : size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5';
  const badgeClasses = size === 'xl'
    ? 'absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 text-[10px]'
    : 'absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 text-[8px]';

  // For xl size, use fixed dimensions like ChatButton
  const xlStyle = size === 'xl' ? { width: 62, height: 62 } : undefined;

  return (
    <>
      <button
        onClick={handleOpen}
        style={xlStyle}
        className={`
          relative ${sizeClasses}
          bg-[#f3f1ef] dark:bg-[#181d28]
          flex items-center justify-center
          hover:bg-[#e9e5e0] dark:hover:bg-[#272d38]
          transition-colors
          ${className}
        `}
        aria-label={`Calendar${pendingCount > 0 ? ` (${pendingCount} pending)` : ''}`}
      >
        {size === 'xl' ? (
          <div className="relative w-[50px] h-[50px] flex items-center justify-center">
            <Calendar
              className={`${iconClasses} text-text-primary`}
              strokeWidth={2}
            />
            {/* Pending Badge */}
            {pendingCount > 0 && (
              <span className={`${badgeClasses} flex items-center justify-center bg-[#E74C3C] text-white font-semibold rounded-full leading-none`}>
                {badgeText}
              </span>
            )}
          </div>
        ) : (
          <>
            <Calendar
              className={`${iconClasses} text-text-primary`}
              strokeWidth={2}
            />
            {/* Pending Badge */}
            {pendingCount > 0 && (
              <span className={`${badgeClasses} flex items-center justify-center bg-[#E74C3C] text-white font-semibold rounded-full leading-none`}>
                {badgeText}
              </span>
            )}
          </>
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












