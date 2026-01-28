'use client';

import { useMemo } from 'react';
import { Calendar, X } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { usePendingProposals, useSchedulingEvents } from '@/hooks/useScheduling';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { CalendarContent } from './CalendarContent';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * CalendarModal Component
 *
 * Responsive calendar modal that shows:
 * - Dialog (centered popup) on desktop
 * - Drawer (bottom sheet) on mobile
 *
 * Used when we need a calendar modal without an anchor element
 * (e.g., "View calendar" link in empty states).
 */
export function CalendarModal({ isOpen, onClose }: CalendarModalProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
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
    return events.filter(e => new Date(e.startDateTime) >= now).length + proposals.length;
  }, [events, proposals.length]);

  // Header content shared between desktop and mobile
  const header = (
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
  );

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className="max-w-[420px] p-0 overflow-hidden"
          hideCloseButton
        >
          <VisuallyHidden.Root>
            <DialogTitle>My Calendar</DialogTitle>
          </VisuallyHidden.Root>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#262b35]">
            {header}
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#1e222a] transition-colors"
              aria-label="Close calendar"
            >
              <X className="w-5 h-5 text-text-muted" />
            </button>
          </div>

          {/* Calendar Content */}
          <div className="max-h-[450px] overflow-y-auto">
            <CalendarContent compact />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      shouldScaleBackground={false}
    >
      <DrawerContent className="max-w-[500px] mx-auto max-h-[85dvh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pb-3">
          {header}
        </div>

        {/* Calendar Content */}
        <div className="overflow-y-auto pb-8" style={{ maxHeight: 'calc(85dvh - 100px)' }}>
          <CalendarContent compact />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default CalendarModal;
