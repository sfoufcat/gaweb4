'use client';

import { FileText, Sparkles } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useOrgCredits } from '@/hooks/useOrgCredits';
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
}

export function SummaryConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
}: SummaryConfirmationModalProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const { data: creditsData } = useOrgCredits(isOpen);
  const creditBalance = creditsData?.remainingCredits ?? 0;

  const buttons = (
    <div className="flex gap-3 w-full">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 py-3 rounded-full bg-[#f3f1ef] dark:bg-[#1d222b] text-text-primary dark:text-[#f5f5f8] font-sans font-medium text-[14px] hover:bg-[#e8e4e0] dark:hover:bg-[#262b35] transition-colors"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onConfirm}
        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full bg-brand-accent text-white font-sans font-medium text-[14px] hover:bg-brand-accent/90 transition-colors"
      >
        <Sparkles className="w-4 h-4" />
        Get Summary
      </button>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-[400px] p-0">
          <DialogHeader className="px-6 pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#f3f1ef] dark:bg-[#1d222b] flex items-center justify-center">
                <FileText className="w-5 h-5 text-brand-accent" />
              </div>
              <div>
                <DialogTitle className="font-albert text-[20px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-1px]">
                  Get Summary
                </DialogTitle>
                <DialogDescription className="font-sans text-[12px] text-text-muted dark:text-[#7d8190]">
                  Your balance: <span className="font-semibold text-brand-accent">{creditBalance} credits</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <p className="px-6 pb-4 font-sans text-[14px] text-text-secondary dark:text-[#a0a4b0]">
            Generate a summary for this call using 1 credit from your account. You can then fill the week automatically.
          </p>
          <DialogFooter className="px-6 pb-5">
            {buttons}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-w-[500px] mx-auto">
        <DrawerHeader className="px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#f3f1ef] dark:bg-[#1d222b] flex items-center justify-center">
              <FileText className="w-5 h-5 text-brand-accent" />
            </div>
            <div>
              <DrawerTitle className="font-albert text-[20px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-1px] text-left">
                Get Summary
              </DrawerTitle>
              <DrawerDescription className="font-sans text-[12px] text-text-muted dark:text-[#7d8190] text-left">
                Your balance: <span className="font-semibold text-brand-accent">{creditBalance} credits</span>
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>
        <p className="px-6 pb-4 font-sans text-[14px] text-text-secondary dark:text-[#a0a4b0]">
          Generate a summary for this call using 1 credit from your account. You can then fill the week automatically.
        </p>
        <DrawerFooter>
          {buttons}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
