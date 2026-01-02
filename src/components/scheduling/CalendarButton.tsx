'use client';

import { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { usePendingProposals } from '@/hooks/useScheduling';
import { UserCalendarPanel } from './UserCalendarPanel';

/**
 * CalendarButton
 * 
 * A button that opens the user's calendar panel.
 * Shows a badge if there are pending proposals to respond to.
 */
export function CalendarButton() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const { proposals } = usePendingProposals();

  const pendingCount = proposals.length;

  return (
    <>
      <button
        onClick={() => setIsPanelOpen(true)}
        className="relative p-2 rounded-xl bg-[#f3f1ef] dark:bg-[#11141b] hover:bg-[#e8e4df] dark:hover:bg-[#1e222a] transition-colors"
        title="My Calendar"
      >
        <Calendar className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-brand-accent text-white text-[10px] font-bold rounded-full">
            {pendingCount > 9 ? '9+' : pendingCount}
          </span>
        )}
      </button>

      <UserCalendarPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
      />
    </>
  );
}

