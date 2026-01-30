'use client';

import { Sparkles, Loader2 } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';

interface SummaryConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function SummaryConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: SummaryConfirmationModalProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const content = (
    <>
      {/* Icon */}
      <div className="flex justify-center mb-2">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-brand-accent/10">
          <Sparkles className="w-6 h-6 text-brand-accent" />
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-center text-[#5f5a55] dark:text-[#b2b6c2]">
        Generating a summary will use <span className="font-semibold text-brand-accent">1 credit</span> from your account.
      </p>
    </>
  );

  const buttons = (
    <>
      <button
        type="button"
        onClick={onClose}
        disabled={isLoading}
        className="flex-1 px-4 py-2.5 text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] bg-[#f3f1ef] dark:bg-[#262b35] hover:bg-[#ebe8e4] dark:hover:bg-[#313746] rounded-xl transition-colors disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={isLoading}
        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-brand-accent hover:bg-brand-accent/90 rounded-xl transition-colors disabled:opacity-70"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating...
          </>
        ) : (
          'Generate Summary'
        )}
      </button>
    </>
  );

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Generate Summary</DialogTitle>
            <DialogDescription className="sr-only">
              Confirm summary generation
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">{content}</div>
          <DialogFooter className="flex-row gap-3 pt-2">
            {buttons}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent>
        <DrawerHeader className="text-center">
          <DrawerTitle>Generate Summary</DrawerTitle>
          <DrawerDescription className="sr-only">
            Confirm summary generation
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-2">{content}</div>
        <DrawerFooter className="flex-row gap-3 pb-safe">
          {buttons}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
