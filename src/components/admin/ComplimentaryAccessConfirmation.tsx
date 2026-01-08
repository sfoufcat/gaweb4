'use client';

import { Gift, Loader2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface ProgramInfo {
  id: string;
  name: string;
  priceInCents: number;
  currency?: string;
  type: 'individual' | 'group';
}

interface ComplimentaryAccessConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  program: ProgramInfo | null;
  clientName?: string;
  isLoading?: boolean;
}

export function ComplimentaryAccessConfirmation({
  isOpen,
  onClose,
  onConfirm,
  program,
  clientName = 'this client',
  isLoading = false,
}: ComplimentaryAccessConfirmationProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  if (!program) return null;

  const formattedPrice = (program.priceInCents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: program.currency || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const content = (
    <div className="px-6 py-5 space-y-5">
      {/* Icon */}
      <div className="flex justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-accent/10">
          <Gift className="h-7 w-7 text-brand-accent" />
        </div>
      </div>

      {/* Message */}
      <div className="text-center space-y-2">
        <p className="font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed">
          You're about to enroll{' '}
          <span className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
            {clientName}
          </span>{' '}
          in{' '}
          <span className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
            "{program.name}"
          </span>{' '}
          ({formattedPrice}) for free.
        </p>
        <p className="font-albert text-xs text-[#8c8c8c] dark:text-[#7d8190]">
          They will receive full program access without payment.
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2.5 pt-1">
        <Button
          variant="outline"
          onClick={onClose}
          disabled={isLoading}
          className="w-full h-10 font-albert text-sm border-[#e1ddd8] dark:border-[#3a4150]"
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isLoading}
          className="w-full h-10 font-albert text-sm bg-brand-accent hover:bg-brand-accent/90 text-white"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Gift className="w-4 h-4 mr-2" />
              Grant Complimentary Access
            </>
          )}
        </Button>
      </div>
    </div>
  );

  // Desktop: Dialog
  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden rounded-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  Complimentary Access
                </DialogTitle>
                <DialogDescription className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
                  Grant free access to a paid program
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  // Mobile: Drawer (slide up)
  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="px-6 pt-2 pb-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
          <div className="mx-auto w-12 h-1.5 rounded-full bg-[#e1ddd8] dark:bg-[#3a4150] mb-4" />
          <div className="flex items-center justify-between">
            <div>
              <DrawerTitle className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Complimentary Access
              </DrawerTitle>
              <DrawerDescription className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
                Grant free access to a paid program
              </DrawerDescription>
            </div>
            <button
              onClick={onClose}
              className="p-2 -mr-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
            >
              <X className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
            </button>
          </div>
        </DrawerHeader>
        {content}
        {/* Safe area padding for mobile */}
        <div className="h-6" />
      </DrawerContent>
    </Drawer>
  );
}
