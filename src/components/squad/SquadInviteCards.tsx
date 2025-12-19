'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LogOut, Copy, Check, Star, ArrowRight } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
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
import type { SquadType } from '@/types';

type InviteSquadType = 'private' | 'public' | 'premium';

interface SquadInviteCardsProps {
  isPremium?: boolean;
  inviteCode?: string;
  squadName?: string;
  visibility?: 'public' | 'private';
  memberCount?: number;
  onLeaveSquad?: () => void;
  // New props for dual squad support
  hasPremiumSquad?: boolean;
  hasStandardSquad?: boolean;
}

/**
 * SquadInviteCards Component
 * 
 * Cards at bottom of Squad tab:
 * 1. "Invite friends to your squad"
 * 2. "Upgrade to a Premium Squad" (for standard users, hidden if squad is already premium)
 * 3. "Join a Premium Squad" (for premium users viewing standard squad who don't have a premium squad yet)
 * 
 * Plus invite code (if private) on bottom left and "Leave squad" on bottom right.
 */

export function SquadInviteCards({ 
  isPremium = false, 
  inviteCode, 
  squadName = 'Your Squad',
  visibility = 'public',
  memberCount = 0,
  onLeaveSquad,
  hasPremiumSquad = false,
  hasStandardSquad = false,
}: SquadInviteCardsProps) {
  const { sessionClaims } = useAuth();
  
  // Check if user is a premium member
  const publicMetadata = sessionClaims?.publicMetadata as { tier?: string } | undefined;
  const isPremiumUser = publicMetadata?.tier === 'premium';
  
  // Check if squad is at capacity
  const isAtCapacity = memberCount >= MAX_SQUAD_MEMBERS;
  const [isLeaving, setIsLeaving] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  
  // Show "Join Premium Squad" card if:
  // - User is a premium member
  // - Currently viewing a standard squad (!isPremium)
  // - User doesn't already have a premium squad
  const showJoinPremiumSquadCard = isPremiumUser && !isPremium && !hasPremiumSquad;
  
  // Determine squad type for invite dialog
  const getSquadType = (): InviteSquadType => {
    if (isPremium) return 'premium';
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
      
      // Pass the squad type to the leave API
      const response = await fetch('/api/squad/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: isPremium ? 'premium' : 'standard' }),
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
              Invite friends to your squad
            </h3>
            <p className="font-sans text-[16px] text-text-secondary dark:text-[#b2b6c2] leading-[1.2] tracking-[-0.3px]">
              Grow together with the people you trust — stay motivated, support each other, and keep a strong squad streak side by side. Add friends to your current squad or start a new one together.
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

      {/* Card 2: Join Premium Squad - for premium users viewing standard squad without a premium squad */}
      {showJoinPremiumSquadCard && (
        <Link
          href="/squad?discover=premium"
          className="group block bg-gradient-to-br from-[#FFF8F0] to-[#FFF3E8] dark:from-[#2d2520] dark:to-[#251d18] border border-[#FFE4CC] dark:border-[#4a3d35] rounded-[20px] p-5 hover:shadow-lg hover:border-[#FF8A65]/40 dark:hover:border-[#FF8A65]/40 transition-all duration-300"
        >
          <div className="flex items-start gap-4">
            {/* Premium Icon */}
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#FF8A65] to-[#FF6B6B] flex items-center justify-center flex-shrink-0 shadow-md">
              <Star className="w-7 h-7 text-white fill-white" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Premium Badge */}
              <div className="flex items-center gap-2 mb-1">
                <span className="font-albert text-[12px] font-semibold bg-gradient-to-r from-[#FF8A65] to-[#FF6B6B] bg-clip-text text-transparent">
                  Premium Member Benefit
                </span>
              </div>
              
              <h3 className="font-albert font-semibold text-[18px] text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] mb-1">
                Join a premium squad with coaching
              </h3>
              
              <p className="font-albert text-[14px] text-text-secondary dark:text-[#b2b6c2] leading-[1.4] mb-3">
                As a premium member, you can also join a premium squad with weekly coaching calls and expert guidance. Find one now!
              </p>

              {/* CTA */}
              <div className="flex items-center gap-2 text-[#FF6B6B] font-albert font-semibold text-[14px] group-hover:gap-3 transition-all">
                <span>Find premium squads</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* Card 3: Upgrade to Premium - only show if not already premium AND user is not a premium member */}
      {!isPremium && !isPremiumUser && (
        <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-4">
          <div className="p-4 space-y-3">
            {/* Premium badge */}
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#FF6B6B]" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="font-albert text-[12px] font-semibold bg-gradient-to-r from-[#FF8A65] to-[#FF6B6B] bg-clip-text text-transparent">
                Premium
              </span>
            </div>
            <h3 className="font-albert text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] leading-[1.3] tracking-[-1px]">
              Upgrade to a Premium Squad
            </h3>
            <p className="font-sans text-[16px] text-text-secondary dark:text-[#b2b6c2] leading-[1.2] tracking-[-0.3px]">
              Get a dedicated mentor who joins your group chat, supports your squad, and leads weekly calls to keep everyone on track and progressing together.
            </p>
            <Link
              href="/upgrade-premium"
              className="block w-full bg-white dark:bg-[#11141b] border-[0.3px] border-[rgba(215,210,204,0.5)] dark:border-[#262b35] text-[#2c2520] dark:text-[#f5f5f8] rounded-[32px] px-6 py-4 font-bold text-[16px] leading-[1.4] tracking-[-0.5px] hover:bg-[#f3f1ef] dark:hover:bg-[#1d222b] transition-colors text-center"
            >
              Upgrade to Premium Squad
            </Link>
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
            <span>Squad invite code: <span className="font-mono">{inviteCode}</span></span>
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
          <span>{isLeaving ? 'Leaving...' : 'Leave squad'}</span>
        </button>
      </div>

      {/* Leave Squad Confirmation Dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-albert text-[20px] tracking-[-0.5px]">
              Leave this squad?
            </AlertDialogTitle>
            <AlertDialogDescription className="font-albert text-[15px] text-text-secondary">
              You can rejoin later or find a new squad to join.
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
              {isLeaving ? 'Leaving...' : 'Leave squad'}
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
