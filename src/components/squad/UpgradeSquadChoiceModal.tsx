'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star, Users, ArrowRight, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';
import type { Squad } from '@/types';

/**
 * UpgradeSquadChoiceModal
 * 
 * Shown to users who upgrade to premium while already in a standard squad.
 * Gives them the choice to:
 * 1. Keep their standard squad AND join a premium squad (dual membership)
 * 2. Leave their standard squad and only join a premium squad
 * 
 * This modal is shown immediately after successful premium upgrade payment.
 */

interface UpgradeSquadChoiceModalProps {
  open: boolean;
  onClose: () => void;
  currentSquad: Squad;
  onChoiceMade?: (choice: 'keep_both' | 'premium_only') => void;
}

export function UpgradeSquadChoiceModal({
  open,
  onClose,
  currentSquad,
  onChoiceMade,
}: UpgradeSquadChoiceModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [choice, setChoice] = useState<'keep_both' | 'premium_only' | null>(null);

  const handleKeepBoth = async () => {
    setIsLoading(true);
    setChoice('keep_both');
    
    try {
      // User wants to keep their standard squad AND join a premium squad
      // Just redirect them to discover premium squads
      onChoiceMade?.('keep_both');
      onClose();
      
      // Navigate to squad discovery with premium filter
      router.push('/squad?discover=premium');
    } catch (error) {
      console.error('Error handling choice:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePremiumOnly = async () => {
    setIsLoading(true);
    setChoice('premium_only');
    
    try {
      // User wants to leave their standard squad and only join premium
      const response = await fetch('/api/squad/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'standard' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to leave squad');
      }

      onChoiceMade?.('premium_only');
      onClose();
      
      // Navigate to squad discovery with premium filter
      router.push('/squad?discover=premium');
    } catch (error) {
      console.error('Error leaving squad:', error);
      alert(error instanceof Error ? error.message : 'Failed to leave squad');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && !isLoading && onClose()}>
      <AlertDialogContent className="max-w-md p-0 overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-[#FFF8F0] to-[#FFF3E8] dark:from-[#2d2520] dark:to-[#251d18] p-6 border-b border-[#FFE4CC] dark:border-[#4a3d35]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF8A65] to-[#FF6B6B] flex items-center justify-center shadow-md">
              <Star className="w-6 h-6 text-white fill-white" />
            </div>
            <div>
              <AlertDialogTitle className="font-albert text-[22px] font-bold tracking-[-1px] text-text-primary dark:text-[#f5f5f8]">
                Welcome to Premium!
              </AlertDialogTitle>
              <p className="font-albert text-[12px] font-semibold bg-gradient-to-r from-[#FF8A65] to-[#FF6B6B] bg-clip-text text-transparent">
                Your upgrade was successful
              </p>
            </div>
          </div>
          <AlertDialogDescription className="font-albert text-[15px] text-text-secondary dark:text-[#b2b6c2] leading-[1.5]">
            You're already in <span className="font-semibold text-text-primary dark:text-[#f5f5f8]">{currentSquad.name}</span>. 
            As a premium member, you can now also join a premium squad with coaching!
          </AlertDialogDescription>
        </div>

        {/* Options */}
        <div className="p-6 space-y-4">
          {/* Option 1: Keep both squads */}
          <button
            onClick={handleKeepBoth}
            disabled={isLoading}
            className="w-full p-4 rounded-[16px] border-2 border-[#FF8A65]/30 bg-gradient-to-br from-[#FFF8F0]/50 to-white dark:from-[#2d2520]/30 dark:to-[#171b22] hover:border-[#FF8A65]/60 hover:shadow-md transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF8A65]/20 to-[#FF6B6B]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Users className="w-5 h-5 text-[#FF6B6B]" />
                <Star className="w-3 h-3 text-[#FF8A65] absolute translate-x-2 -translate-y-2" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-albert text-[16px] font-semibold text-text-primary dark:text-[#f5f5f8] mb-1">
                  Stay in {currentSquad.name} AND join a premium squad
                </p>
                <p className="font-albert text-[13px] text-text-secondary dark:text-[#b2b6c2] leading-[1.4]">
                  Keep your existing community and add coaching support with a premium squad.
                </p>
              </div>
              {isLoading && choice === 'keep_both' ? (
                <Loader2 className="w-5 h-5 text-[#FF8A65] animate-spin flex-shrink-0" />
              ) : (
                <ArrowRight className="w-5 h-5 text-[#FF8A65] flex-shrink-0" />
              )}
            </div>
          </button>

          {/* Option 2: Premium only */}
          <button
            onClick={handlePremiumOnly}
            disabled={isLoading}
            className="w-full p-4 rounded-[16px] border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22] hover:border-[#c5c0ba] dark:hover:border-[#3a4250] hover:shadow-sm transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#f3f1ef] dark:bg-[#262b35] flex items-center justify-center flex-shrink-0 mt-0.5">
                <Star className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-albert text-[16px] font-semibold text-text-primary dark:text-[#f5f5f8] mb-1">
                  Leave {currentSquad.name} and only join a premium squad
                </p>
                <p className="font-albert text-[13px] text-text-secondary dark:text-[#b2b6c2] leading-[1.4]">
                  Focus solely on your premium squad experience with coaching.
                </p>
              </div>
              {isLoading && choice === 'premium_only' ? (
                <Loader2 className="w-5 h-5 text-text-secondary animate-spin flex-shrink-0" />
              ) : (
                <ArrowRight className="w-5 h-5 text-text-secondary flex-shrink-0" />
              )}
            </div>
          </button>

          {/* Skip for now */}
          <button
            onClick={onClose}
            disabled={isLoading}
            className="w-full py-2 text-center font-albert text-[14px] text-text-secondary dark:text-[#7d8190] hover:text-text-primary dark:hover:text-[#f5f5f8] transition-colors disabled:opacity-50"
          >
            I'll decide later
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

