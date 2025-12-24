'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LogOut, Copy, Check } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SquadInviteDialog } from './SquadInviteDialog';
import { MAX_SQUAD_MEMBERS } from '@/lib/squad-constants';
import { useMenuTitles } from '@/contexts/BrandingContext';

type InviteSquadType = 'private' | 'public' | 'premium';

interface SquadInviteCardsProps {
  hasCoach?: boolean;
  /** @deprecated Use hasCoach instead */
  isPremium?: boolean;
  inviteCode?: string;
  squadName?: string;
  visibility?: 'public' | 'private';
  memberCount?: number;
  onLeaveSquad?: () => void;
  // Squad ID for leave functionality
  squadId?: string;
}

/**
 * SquadInviteCards Component
 * 
 * Cards at bottom of Squad tab:
 * 1. "Invite friends to your squad"
 * 2. "Upgrade to a Coached Squad" (for users in non-coached squads)
 * 
 * Plus invite code (if private) on bottom left and "Leave squad" on bottom right.
 */

export function SquadInviteCards({ 
  hasCoach,
  isPremium,
  inviteCode, 
  squadName = 'Your Squad',
  visibility = 'public',
  memberCount = 0,
  onLeaveSquad,
  squadId,
}: SquadInviteCardsProps) {
  const { squad: squadTitle, squadLower } = useMenuTitles();
  
  // Support both new hasCoach and legacy isPremium
  const squadHasCoach = hasCoach ?? isPremium ?? false;
  
  // Check if squad is at capacity
  const isAtCapacity = memberCount >= MAX_SQUAD_MEMBERS;
  const [isLeaving, setIsLeaving] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  
  // Determine squad type for invite dialog
  const getSquadType = (): InviteSquadType => {
    if (squadHasCoach) return 'premium';
    if (visibility === 'private') return 'private';
    return 'public';
  };

  const handleCopyInviteCode = async () => {
    if (!inviteCode || codeCopied) return;
    
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // Fallback for browsers that don't support clipboard API
      const input = document.createElement('input');
      input.value = inviteCode;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const handleInviteFriends = () => {
    setShowInviteDialog(true);
  };

  const handleLeaveSquad = async () => {
    if (isLeaving) return;

    try {
      setIsLeaving(true);
      
      // Pass the squad ID to the leave API
      const response = await fetch('/api/squad/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ squadId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to leave squad');
      }

      setShowLeaveDialog(false);

      // Callback to refresh page/context
      if (onLeaveSquad) {
        onLeaveSquad();
      } else {
        // Fallback: refresh page
        window.location.href = '/squad';
      }
    } catch (err) {
      console.error('Error leaving squad:', err);
      alert(err instanceof Error ? err.message : 'Failed to leave squad');
    } finally {
      setIsLeaving(false);
    }
  };

  return (
    <div className="space-y-4 mt-6">
      {/* Card 1: Invite Friends - hide when squad is at capacity */}
      {!isAtCapacity && (
        <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-4">
          <div className="p-4 space-y-3">
            <h3 className="font-albert text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] leading-[1.3] tracking-[-1px]">
              Invite friends to your {squadLower}
            </h3>
            <p className="font-sans text-[16px] text-text-secondary dark:text-[#b2b6c2] leading-[1.2] tracking-[-0.3px]">
              Grow together with the people you trust — stay motivated, support each other, and keep a strong {squadLower} streak side by side. Add friends to your current {squadLower} or start a new one together.
            </p>
            <button
              onClick={handleInviteFriends}
              className="w-full bg-[#2c2520] dark:bg-[#f5f5f8] text-white dark:text-[#05070b] rounded-[32px] px-6 py-4 font-bold text-[16px] leading-[1.4] tracking-[-0.5px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Invite friends
            </button>
          </div>
        </div>
      )}

      {/* Footer: Invite Code (left) & Leave Squad (right) */}
      <div className="flex justify-between items-center pt-2">
        {/* Invite Code - only show for private squads */}
        {inviteCode ? (
          <button
            onClick={handleCopyInviteCode}
            className="flex items-center gap-1.5 text-text-secondary/70 dark:text-[#7d8190] hover:text-text-primary dark:hover:text-[#f5f5f8] transition-colors font-albert text-[13px]"
          >
            {codeCopied ? (
              <Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{squadTitle} invite code: <span className="font-mono">{inviteCode}</span></span>
            {codeCopied && <span className="text-green-500 ml-1">Copied!</span>}
          </button>
        ) : (
          <div /> /* Empty div to maintain flex spacing */
        )}

        {/* Leave Squad */}
        <button
          onClick={() => setShowLeaveDialog(true)}
          disabled={isLeaving}
          className="flex items-center gap-1.5 text-text-secondary/70 dark:text-[#7d8190] hover:text-red-500 dark:hover:text-red-400 transition-colors font-albert text-[13px] disabled:opacity-50"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{isLeaving ? 'Leaving...' : `Leave ${squadLower}`}</span>
        </button>
      </div>

      {/* Leave Squad Confirmation Dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-albert text-[20px] tracking-[-0.5px]">
              Leave this {squadLower}?
            </AlertDialogTitle>
            <AlertDialogDescription className="font-albert text-[15px] text-text-secondary">
              You can rejoin later or find a new {squadLower} to join.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel 
              disabled={isLeaving}
              className="font-albert rounded-full border-[#e1ddd8]"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveSquad}
              disabled={isLeaving}
              className="font-albert rounded-full bg-red-500 hover:bg-red-600 text-white"
            >
              {isLeaving ? 'Leaving...' : `Leave ${squadLower}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invite Dialog */}
      <SquadInviteDialog
        open={showInviteDialog}
        onClose={() => setShowInviteDialog(false)}
        squadName={squadName}
        squadType={getSquadType()}
        inviteCode={inviteCode}
      />
    </div>
  );
}
