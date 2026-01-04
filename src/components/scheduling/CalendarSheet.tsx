'use client';

import { Calendar } from 'lucide-react';
import { CalendarContent } from './CalendarContent';
import { Drawer, DrawerContent } from '@/components/ui/drawer';

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
  return (
    <Drawer
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      shouldScaleBackground={false}
    >
      <DrawerContent className="max-w-[500px] mx-auto max-h-[85dvh]">
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
      </DrawerContent>
    </Drawer>
  );
}

export default CalendarSheet;


