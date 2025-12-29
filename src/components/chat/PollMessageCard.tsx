'use client';

import { useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { isPast, differenceInMinutes, differenceInHours, differenceInDays } from 'date-fns';
import type { ChatPollState, ChatPollOption } from '@/types/poll';

/**
 * PollMessageCard Component
 * 
 * Renders a poll inside a chat message bubble.
 * Matches Figma designs: node-id=821-3621, 821-3651, 821-3681
 * 
 * States:
 * - Not voted: Shows radio/checkbox options + Vote button
 * - Voted: Shows results with progress bars
 * - Closed: Shows final results
 */

interface PollMessageCardProps {
  poll: ChatPollState;
  currentUserId: string;
  onVote: (pollId: string, optionIds: string[]) => Promise<void>;
  onAddOption?: (pollId: string, optionText: string) => Promise<void>;
  onViewResults: (poll: ChatPollState) => void;
  timestamp: string;
  senderName: string;
  isOwnMessage?: boolean; // true = brown bubble (outgoing), false = light bubble (incoming)
}

// Check icon for voted option
function CheckCircleIcon({ fill = '#a07855', stroke = '#faf8f6' }: { fill?: string; stroke?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="7" fill={fill} stroke={stroke} strokeWidth="2"/>
      <path d="M5.5 8L7 9.5L10.5 6" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function PollMessageCard({
  poll,
  currentUserId: _currentUserId,
  onVote,
  onAddOption,
  onViewResults,
  timestamp,
  senderName: _senderName,
  isOwnMessage = false,
}: PollMessageCardProps) {
  // Color scheme based on message ownership
  // Own message (brown bubble): light text
  // Other's message (light bubble): dark text
  const colors = {
    primary: isOwnMessage ? 'text-[#faf8f6]' : 'text-[#1a1a1a]',
    secondary: isOwnMessage ? 'text-[#d4c8bb]' : 'text-[#5f5a55]',
    muted: isOwnMessage ? 'text-[#b8a999]' : 'text-[#a7a39e]',
    accent: isOwnMessage ? 'text-[#f5e6d3]' : 'text-brand-accent',
    border: isOwnMessage ? 'border-[#b8a999]' : 'border-[#e1ddd8]',
    bgHover: isOwnMessage ? 'hover:bg-[#8a6c4a]/30' : 'hover:bg-[#f3f1ef]/50',
    bgOption: isOwnMessage ? 'bg-[#8a6c4a]/40' : 'bg-[#f3f1ef]',
    progressBg: isOwnMessage ? 'bg-[#b8a999]/40' : 'bg-[#e1ddd8]',
    progressFill: isOwnMessage ? 'bg-[#f5e6d3]' : 'bg-brand-accent',
    checkFill: isOwnMessage ? '#f5e6d3' : '#a07855',
    checkStroke: isOwnMessage ? '#7d5c3e' : '#faf8f6',
  };
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isVoting, setIsVoting] = useState(false);
  const [showAddOptionInput, setShowAddOptionInput] = useState(false);
  const [newOptionText, setNewOptionText] = useState('');
  const [isAddingOption, setIsAddingOption] = useState(false);

  // Check if poll is closed
  const isClosed = useMemo(() => {
    if (poll.closedAt) return true;
    if (poll.settings.activeTill) {
      return isPast(new Date(poll.settings.activeTill));
    }
    return false;
  }, [poll.closedAt, poll.settings.activeTill]);

  // Check if current user has voted
  const hasVoted = useMemo(() => {
    return poll.userVotes && poll.userVotes.length > 0;
  }, [poll.userVotes]);

  // Calculate time remaining with compact format (e.g., "24 hrs left", "12 min left")
  const timeRemaining = useMemo(() => {
    if (isClosed) return 'Closed';
    if (poll.settings.activeTill) {
      const endDate = new Date(poll.settings.activeTill);
      const now = new Date();
      
      const days = differenceInDays(endDate, now);
      if (days >= 1) {
        return `${days} day${days > 1 ? 's' : ''} left`;
      }
      
      const hours = differenceInHours(endDate, now);
      if (hours >= 1) {
        return `${hours} hr${hours > 1 ? 's' : ''} left`;
      }
      
      const minutes = differenceInMinutes(endDate, now);
      if (minutes >= 1) {
        return `${minutes} min left`;
      }
      
      return 'Ending soon';
    }
    return '';
  }, [isClosed, poll.settings.activeTill]);

  // Handle option selection (for voting)
  const handleOptionSelect = useCallback((optionId: string) => {
    if (hasVoted || isClosed) return;

    if (poll.settings.multipleAnswers) {
      // Toggle selection for multiple answers
      setSelectedOptions(prev => 
        prev.includes(optionId)
          ? prev.filter(id => id !== optionId)
          : [...prev, optionId]
      );
    } else {
      // Single selection
      setSelectedOptions([optionId]);
    }
  }, [hasVoted, isClosed, poll.settings.multipleAnswers]);

  // Handle vote submission
  const handleVote = useCallback(async () => {
    if (selectedOptions.length === 0 || isVoting) return;

    setIsVoting(true);
    try {
      await onVote(poll.id, selectedOptions);
      setSelectedOptions([]);
    } catch (error) {
      console.error('Failed to vote:', error);
    } finally {
      setIsVoting(false);
    }
  }, [poll.id, selectedOptions, onVote, isVoting]);

  // Handle adding new option
  const handleAddOption = useCallback(async () => {
    if (!newOptionText.trim() || isAddingOption || !onAddOption) return;

    setIsAddingOption(true);
    try {
      await onAddOption(poll.id, newOptionText.trim());
      setNewOptionText('');
      setShowAddOptionInput(false);
    } catch (error) {
      console.error('Failed to add option:', error);
    } finally {
      setIsAddingOption(false);
    }
  }, [poll.id, newOptionText, onAddOption, isAddingOption]);

  // Calculate percentage for an option
  const getPercentage = useCallback((optionId: string) => {
    if (poll.totalVotes === 0) return 0;
    const votes = poll.votesByOption[optionId] || 0;
    return Math.round((votes / poll.totalVotes) * 100);
  }, [poll.totalVotes, poll.votesByOption]);

  // Build poll type label
  const getPollTypeLabel = () => {
    const parts: string[] = [];
    if (poll.settings.anonymous) {
      parts.push('Anonymous Poll');
    } else {
      parts.push('Poll');
    }
    if (poll.settings.multipleAnswers) {
      parts.push('Multiple Choice');
    }
    return parts.join(' • ');
  };

  // Render single option based on state
  const renderOption = (option: ChatPollOption) => {
    const isSelected = selectedOptions.includes(option.id);
    const isUserVote = poll.userVotes?.includes(option.id);
    const percentage = getPercentage(option.id);

    // Results view (already voted or closed)
    if (hasVoted || isClosed) {
      return (
        <div key={option.id} className="flex items-center gap-2 py-1 w-full">
          {/* Percentage/Check indicator */}
          <div className="flex flex-col items-end justify-center w-8 flex-shrink-0">
            <span className={`font-geist text-[12px] leading-[1.2] ${colors.secondary}`}>
              {percentage}%
            </span>
            {isUserVote && <CheckCircleIcon fill={colors.checkFill} stroke={colors.checkStroke} />}
          </div>
          
          {/* Option text and bar */}
          <div className="flex-1 flex flex-col gap-0.5">
            <span className={`font-geist text-[16px] tracking-[-0.3px] leading-[1.2] ${colors.primary}`}>
              {option.text}
            </span>
            {/* Progress bar */}
            <div className={`w-full h-1 rounded-full overflow-hidden ${colors.progressBg}`}>
              <div
                className={`h-full rounded-full transition-all duration-300 ${colors.progressFill}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        </div>
      );
    }

    // Voting view
    return (
      <button
        key={option.id}
        onClick={() => handleOptionSelect(option.id)}
        className={`flex items-center gap-2 py-1 w-full rounded-sm transition-colors ${colors.bgHover}`}
      >
        {/* Selection indicator */}
        <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
          <div className={`w-6 h-6 flex items-center justify-center ${colors.border} border ${
            poll.settings.multipleAnswers ? 'rounded-[6px]' : 'rounded-full'
          }`}>
            {isSelected && (
              <div className={`w-3.5 h-3.5 ${colors.progressFill} ${
                poll.settings.multipleAnswers ? 'rounded-[4px]' : 'rounded-full'
              }`} />
            )}
          </div>
        </div>
        
        {/* Option text */}
        <span className={`flex-1 font-geist text-[16px] tracking-[-0.3px] leading-[1.2] text-left ${colors.primary}`}>
          {option.text}
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-2 w-full min-w-[280px]">
      {/* Poll Question */}
      <h3 className={`font-albert font-semibold text-[18px] tracking-[-1px] leading-[1.3] ${colors.primary}`}>
        {poll.question}
      </h3>

      {/* Poll Type Label + Voter Avatars */}
      <div className="flex items-center gap-1 py-1">
        <span className={`font-geist text-[12px] leading-[1.2] ${colors.muted}`}>
          {getPollTypeLabel()}
        </span>
        
        {/* Show voter avatars if not anonymous and has votes */}
        {!poll.settings.anonymous && poll.votes && poll.votes.length > 0 && (
          <>
            <span className={`font-geist text-[12px] ${colors.muted}`}>・</span>
            <div className="flex items-center -space-x-1">
              {poll.votes.slice(0, 3).map((vote, idx) => (
                <div
                  key={idx}
                  className="w-3.5 h-3.5 rounded-full overflow-hidden border border-white"
                >
                  {vote.userImage ? (
                    <Image src={vote.userImage} alt="" width={14} height={14} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-brand-accent to-[#7d5c3e]" />
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Poll Options */}
      <div className="flex flex-col gap-1">
        {poll.options.map(renderOption)}

        {/* Add option button (if enabled and not voted/closed) */}
        {poll.settings.participantsCanAddOptions && !hasVoted && !isClosed && (
          showAddOptionInput ? (
            <div className={`flex items-center gap-2 mt-1 rounded-[12px] px-3 py-2 ${colors.bgOption}`}>
              <input
                type="text"
                value={newOptionText}
                onChange={(e) => setNewOptionText(e.target.value)}
                placeholder="Option title"
                autoFocus
                className={`flex-1 font-geist text-[16px] bg-transparent border-none outline-none ${colors.primary} ${isOwnMessage ? 'placeholder-[#b8a999]' : 'placeholder-[#a7a39e]'}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddOption();
                  if (e.key === 'Escape') {
                    setShowAddOptionInput(false);
                    setNewOptionText('');
                  }
                }}
              />
              <button
                onClick={handleAddOption}
                disabled={!newOptionText.trim() || isAddingOption}
                className={`font-geist text-[14px] font-medium ${colors.accent} disabled:opacity-50`}
              >
                {isAddingOption ? '...' : 'Add'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddOptionInput(true)}
              className={`flex items-center gap-2 py-2 pl-9 rounded-[12px] ${colors.bgOption}`}
            >
              <span className={`font-albert font-semibold text-[16px] tracking-[-1px] ${colors.muted}`}>
                Add an option
              </span>
            </button>
          )
        )}
      </div>

      {/* Vote Button or View Results */}
      {!hasVoted && !isClosed ? (
        <button
          onClick={handleVote}
          disabled={selectedOptions.length === 0 || isVoting}
          className="py-2 w-full text-center"
        >
          <span className={`font-geist text-[14px] leading-[1.2] ${
            selectedOptions.length > 0 
              ? `${colors.accent} font-medium` 
              : colors.secondary
          }`}>
            {isVoting ? 'Voting...' : 'Vote'}
          </span>
        </button>
      ) : (
        <button
          onClick={() => onViewResults(poll)}
          className="py-2 w-full text-center"
        >
          <span className={`font-geist text-[14px] leading-[1.2] ${colors.secondary}`}>
            View Results
          </span>
        </button>
      )}

      {/* Footer: Votes count + Time remaining + Timestamp */}
      <div className={`flex items-center justify-between gap-4 text-[12px] ${colors.muted}`}>
        <div className="flex items-center gap-1 font-geist flex-shrink-0">
          <span>{poll.totalVotes} vote{poll.totalVotes !== 1 ? 's' : ''}</span>
          <span>・</span>
          <span>{timeRemaining}</span>
        </div>
        <span className="font-geist flex-shrink-0">{timestamp}</span>
      </div>
    </div>
  );
}

export default PollMessageCard;

