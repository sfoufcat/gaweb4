'use client';

import { useEffect, useMemo } from 'react';
import Image from 'next/image';
import type { ChatPollState } from '@/types/poll';
import { useDragToDismiss } from '@/hooks/useDragToDismiss';

/**
 * PollResultsSheet Component
 * 
 * Bottom sheet (mobile) / Modal (desktop) showing detailed poll results.
 * Matches Figma design: node-id=802-7407
 * 
 * Shows:
 * - Poll question
 * - Each option with percentage, vote count
 * - Voter list (if not anonymous)
 */

interface PollResultsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  poll: ChatPollState | null;
}

// Close icon
function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 6L6 18M6 6L18 18" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function PollResultsSheet({ isOpen, onClose, poll }: PollResultsSheetProps) {
  const { sheetRef, handleProps } = useDragToDismiss({ onClose });

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (isOpen && sheetRef.current) {
      sheetRef.current.focus();
    }
  }, [isOpen]);

  // Group votes by option
  const votesByOption = useMemo(() => {
    if (!poll) return {};
    
    const grouped: Record<string, { userName?: string; userImage?: string }[]> = {};
    
    // Initialize all options
    poll.options.forEach(opt => {
      grouped[opt.id] = [];
    });
    
    // Group votes
    poll.votes?.forEach(vote => {
      if (grouped[vote.optionId]) {
        grouped[vote.optionId].push({
          userName: vote.userName,
          userImage: vote.userImage,
        });
      }
    });
    
    return grouped;
  }, [poll]);

  // Calculate percentage
  const getPercentage = (optionId: string) => {
    if (!poll || poll.totalVotes === 0) return 0;
    const votes = poll.votesByOption[optionId] || 0;
    return Math.round((votes / poll.totalVotes) * 100);
  };

  // Get vote count for option
  const getVoteCount = (optionId: string) => {
    if (!poll) return 0;
    return poll.votesByOption[optionId] || 0;
  };

  if (!isOpen || !poll) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        ref={sheetRef}
        tabIndex={-1}
        className="relative w-full lg:max-w-[500px] max-h-[90dvh] bg-[#faf8f6] rounded-t-[24px] lg:rounded-[24px] shadow-2xl animate-in slide-in-from-bottom lg:zoom-in-95 duration-300 flex flex-col overflow-hidden outline-none"
      >
        {/* Grabber - Mobile only (drag handle) */}
        <div {...handleProps} className="flex justify-center pt-3 pb-2 lg:hidden cursor-grab active:cursor-grabbing touch-none">
          <div className="w-9 h-1 bg-gray-300 rounded-full" />
        </div>
        
        {/* Header */}
        <div className="px-4 pt-2 lg:pt-5 pb-6 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-[#1a1a1a] hover:opacity-70 transition-opacity"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
          <h1 className="font-albert text-[36px] font-normal text-[#1a1a1a] tracking-[-2px] leading-[1.2] mt-3">
            Poll results
          </h1>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-8">
          {/* Question */}
          <h2 className="font-albert font-medium text-[24px] text-[#1a1a1a] tracking-[-1.5px] leading-[1.3] mb-4">
            {poll.question}
          </h2>

          {/* Options with Results */}
          <div className="flex flex-col gap-4">
            {poll.options.map((option) => {
              const percentage = getPercentage(option.id);
              const voteCount = getVoteCount(option.id);
              const voters = votesByOption[option.id] || [];

              return (
                <div key={option.id} className="flex flex-col gap-1">
                  {/* Option Header */}
                  <div className="flex items-center justify-between">
                    <span className="font-geist text-[16px] text-[#5f5a55] tracking-[-0.3px] leading-[1.2]">
                      {option.text}
                    </span>
                    <div className="flex items-center gap-1 font-geist text-[12px] text-[#5f5a55]">
                      <span>{percentage}%</span>
                      <span>・</span>
                      <span>{voteCount} vote{voteCount !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  {/* Voter List (if not anonymous) */}
                  {!poll.settings.anonymous && voters.length > 0 && (
                    <div className="flex flex-col gap-1">
                      {voters.map((voter, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 bg-[#f3f1ef] rounded-[20px] px-2 py-1.5"
                        >
                          {/* Avatar */}
                          <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
                            {voter.userImage ? (
                              <Image
                                src={voter.userImage}
                                alt=""
                                width={24}
                                height={24}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-brand-accent to-[#7d5c3e] flex items-center justify-center text-white text-[10px] font-semibold">
                                {(voter.userName || '?').charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          {/* Name */}
                          <span className="font-geist text-[16px] text-[#1a1a1a] tracking-[-0.3px] leading-[1.2]">
                            {voter.userName || 'Unknown'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Anonymous placeholder */}
                  {poll.settings.anonymous && voteCount > 0 && (
                    <div className="flex items-center gap-2 bg-[#f3f1ef] rounded-[20px] px-3 py-2">
                      <span className="font-geist text-[14px] text-[#a7a39e] tracking-[-0.3px]">
                        {voteCount} anonymous vote{voteCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Total */}
          <div className="mt-6 pt-4 border-t border-[#e1ddd8]">
            <span className="font-geist text-[14px] text-[#a7a39e]">
              Total: {poll.totalVotes} vote{poll.totalVotes !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Home Indicator - Mobile */}
        <div className="h-8 w-full flex justify-center lg:hidden flex-shrink-0">
          <div className="w-36 h-[5px] bg-[#1a1a1a] rounded-[100px] opacity-20" />
        </div>
      </div>
    </div>
  );
}

export default PollResultsSheet;

