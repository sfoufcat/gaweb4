'use client';

/**
 * SquadStreakSheet Component
 *
 * Modal/sheet explaining how Squad Alignment works.
 * Shows:
 * - Title: "Squad Alignment"
 * - Explanation of 50% rule
 * - Detailed explanations
 *
 * Responsive: Dialog on desktop, Drawer on mobile.
 */

import { useState, useEffect } from 'react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface SquadStreakSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SquadStreakSheet({ isOpen, onClose }: SquadStreakSheetProps) {
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile vs desktop
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Shared content component
  const SheetContent = () => (
    <>
      {/* Content */}
      <div className="px-6 pt-5 pb-8 space-y-6">
        {/* Title */}
        <p className="font-albert text-[24px] font-medium text-text-secondary leading-[1.3] tracking-[-1.5px]">
          Squad Alignment
        </p>

        {/* Main Explanation */}
        <p className="font-sans text-[16px] text-text-primary leading-[1.5] tracking-[-0.3px]">
          Your squad&apos;s alignment compass shows how well your squad is following their growth routine today.
        </p>

        <p className="font-sans text-[16px] text-text-primary leading-[1.5] tracking-[-0.3px]">
          The number at the center shows the squad streak, which increases if more than 50% of members are fully aligned.
        </p>
      </div>
    </>
  );

  // Mobile: Bottom Drawer
  if (isMobile) {
    return (
      <Drawer
        open={isOpen}
        onOpenChange={(open) => !open && onClose()}
        shouldScaleBackground={false}
      >
        <DrawerContent className="max-w-[500px] mx-auto">
          <SheetContent />
          {/* Home Indicator Spacer - Mobile only */}
          <div className="h-8 w-full flex justify-center">
            <div className="w-36 h-1.5 bg-gray-900 rounded-full opacity-20" />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: Centered Dialog
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[420px] p-0 gap-0">
        <VisuallyHidden>
          <DialogTitle>Squad Alignment</DialogTitle>
        </VisuallyHidden>
        <SheetContent />
      </DialogContent>
    </Dialog>
  );
}





