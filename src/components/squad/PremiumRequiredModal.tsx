'use client';

import { Crown, Users } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PremiumRequiredModalProps {
  open: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  squadName: string;
  inviterName?: string;
}

/**
 * PremiumRequiredModal Component
 * 
 * Shown when a logged-in non-premium user tries to join a premium squad.
 * Offers option to upgrade to premium or cancel.
 */
export function PremiumRequiredModal({
  open,
  onClose,
  onUpgrade,
  squadName,
  inviterName = 'Your friend',
}: PremiumRequiredModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialogContent className="max-w-md p-0">
        <AlertDialogHeader className="p-6 pb-0 text-center">
          {/* Premium Badge */}
          <div className="w-16 h-16 bg-gradient-to-br from-[#f7c948] to-[#f5b820] rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Crown className="w-8 h-8 text-white" />
          </div>
          
          <AlertDialogTitle className="font-albert text-[24px] tracking-[-0.5px]">
            Join {inviterName}&apos;s Premium Squad
          </AlertDialogTitle>
        </AlertDialogHeader>

        <div className="p-6 pt-3 space-y-5">
          <p className="font-sans text-[15px] text-text-secondary text-center leading-relaxed">
            To join this squad, you need a Premium membership.
          </p>

          {/* Squad Card */}
          <div className="bg-[#faf8f6] rounded-[16px] p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-[#f7c948] to-[#f5b820] rounded-full flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-albert text-[16px] font-semibold text-text-primary">
                  {squadName}
                </h3>
                <p className="font-sans text-[13px] text-text-secondary">
                  Premium Squad with dedicated coach
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <button
              onClick={onUpgrade}
              className="w-full bg-gradient-to-r from-[#f7c948] to-[#f5b820] text-[#2c2520] font-sans font-bold text-[16px] py-4 px-6 rounded-[32px] shadow-[0px_8px_24px_0px_rgba(247,201,72,0.35)] hover:scale-[1.02] active:scale-[0.98] transition-transform"
            >
              Upgrade to Premium
            </button>
            <button
              onClick={onClose}
              className="w-full text-text-secondary font-sans font-medium text-[14px] py-3 hover:text-text-primary transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

