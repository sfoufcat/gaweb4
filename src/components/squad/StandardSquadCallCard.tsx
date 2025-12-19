'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, MessageCircle, Download, Pencil, Check, X, Users } from 'lucide-react';
import type { Squad, StandardSquadCall } from '@/types';
import { CallSuggestionModal } from './CallSuggestionModal';

/**
 * StandardSquadCallCard Component
 * 
 * Displays the squad call card for standard (non-premium) squads.
 * Supports voting-based call confirmation:
 * - State A: No call - "Suggest a call" prompt
 * - State B: Pending call - Voting UI with yes/no buttons
 * - State C: Confirmed call - Similar to premium with ICS download
 * 
 * Only renders for non-premium squads.
 */

interface StandardSquadCallCardProps {
  squad: Squad;
  onCallUpdated?: () => void;
}

interface CallState {
  call: StandardSquadCall | null;
  userVote: 'yes' | 'no' | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Formats a date in a specific timezone
 */
function formatDateInTimezone(date: Date, timezone: string): { date: string; time: string; tzAbbrev: string } {
  try {
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      day: 'numeric',
      month: 'long',
    });
    
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    
    const tzFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    });
    const tzParts = tzFormatter.formatToParts(date);
    const tzAbbrev = tzParts.find(p => p.type === 'timeZoneName')?.value || timezone;
    
    return {
      date: dateFormatter.format(date),
      time: timeFormatter.format(date),
      tzAbbrev,
    };
  } catch {
    return {
      date: date.toLocaleDateString('en-US', { day: 'numeric', month: 'long' }),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      tzAbbrev: 'UTC',
    };
  }
}

function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

export function StandardSquadCallCard({ squad, onCallUpdated }: StandardSquadCallCardProps) {
  const router = useRouter();
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [callState, setCallState] = useState<CallState>({
    call: null,
    userVote: null,
    isLoading: true,
    error: null,
  });

  const userTimezone = getUserTimezone();

  // Fetch call data
  const fetchCallData = useCallback(async () => {
    try {
      setCallState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await fetch(`/api/squad/${squad.id}/standard-call`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch call data');
      }

      const data = await response.json();
      setCallState({
        call: data.call,
        userVote: data.userVote,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.error('Error fetching call data:', err);
      setCallState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load call data',
      }));
    }
  }, [squad.id]);

  useEffect(() => {
    fetchCallData();
  }, [fetchCallData]);

  // Vote handler
  const handleVote = async (vote: 'yes' | 'no') => {
    if (isVoting || !callState.call) return;

    try {
      setIsVoting(true);

      const response = await fetch(`/api/squad/${squad.id}/standard-call`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId: callState.call.id,
          vote,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to vote');
      }

      const data = await response.json();
      setCallState(prev => ({
        ...prev,
        call: data.call,
        userVote: data.userVote,
      }));

      if (onCallUpdated) {
        onCallUpdated();
      }
    } catch (err) {
      console.error('Error voting:', err);
    } finally {
      setIsVoting(false);
    }
  };

  // Call time info for confirmed/pending calls
  const callTimeInfo = useMemo(() => {
    if (!callState.call?.startDateTimeUtc) return null;
    
    const callDate = new Date(callState.call.startDateTimeUtc);
    const callTimezone = callState.call.timezone || 'UTC';
    const squadTime = formatDateInTimezone(callDate, callTimezone);
    const userTime = formatDateInTimezone(callDate, userTimezone);
    const sameTimezone = callTimezone === userTimezone;
    
    return {
      squadTime,
      userTime,
      sameTimezone,
      callTimezone,
    };
  }, [callState.call, userTimezone]);

  // Download ICS handler
  const handleAddToCalendar = async () => {
    if (!callState.call || callState.call.status !== 'confirmed') return;
    
    const link = document.createElement('a');
    link.href = `/api/squad/${squad.id}/next-call.ics?type=standard`;
    link.download = 'squad-call.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGoToChat = () => {
    if (squad.chatChannelId) {
      router.push(`/chat?channel=${squad.chatChannelId}`);
    }
  };

  const handleModalSuccess = () => {
    setShowSuggestModal(false);
    fetchCallData();
    if (onCallUpdated) {
      onCallUpdated();
    }
  };

  // Don't render for premium squads
  if (squad.isPremium) {
    return null;
  }

  // Loading state
  if (callState.isLoading) {
    return (
      <div className="bg-white/80 dark:bg-[#171b22]/80 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-5 shadow-sm mb-6">
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-10 h-10 bg-[#f3f1ef] dark:bg-[#262b35] rounded-full" />
          <div className="flex-1">
            <div className="h-4 bg-[#f3f1ef] dark:bg-[#262b35] rounded w-1/3 mb-2" />
            <div className="h-3 bg-[#f3f1ef] dark:bg-[#262b35] rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  const { call, userVote } = callState;

  // State A: No active call
  if (!call || call.status === 'canceled') {
    return (
      <>
        <div className="bg-white/80 dark:bg-[#171b22]/80 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-5 shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-[#f3f1ef] dark:bg-[#11141b] rounded-full shrink-0">
                <Calendar className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
              </div>
              <div>
                <h3 className="font-albert text-[15px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.3px]">
                  Get more accountability
                </h3>
                <p className="font-albert text-[14px] text-text-secondary dark:text-[#b2b6c2] mt-0.5">
                  Schedule a call so your squad can plan together.
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setShowSuggestModal(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#a07855] hover:bg-[#8c6245] rounded-full font-albert text-[14px] font-medium text-white transition-colors shrink-0"
            >
              <Calendar className="w-4 h-4" />
              Suggest a call
            </button>
          </div>
        </div>

        <CallSuggestionModal
          squad={squad}
          isOpen={showSuggestModal}
          onClose={() => setShowSuggestModal(false)}
          onSuccess={handleModalSuccess}
        />
      </>
    );
  }

  // State B: Pending call (voting)
  if (call.status === 'pending') {
    const votesNeeded = call.requiredVotes - call.yesCount;
    const isDeleteProposal = call.proposalType === 'delete';

    return (
      <>
        <div className="bg-white/80 dark:bg-[#171b22]/80 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-5 shadow-sm mb-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
              <h3 className="font-albert text-[16px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px]">
                {isDeleteProposal 
                  ? 'Proposed: Cancel call'
                  : call.proposalType === 'edit'
                    ? 'Proposed: Update call time'
                    : 'Suggested squad call'
                }
              </h3>
            </div>
            
            {/* Edit button */}
            <button
              onClick={() => setShowSuggestModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#a07855] dark:text-[#b8896a] hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] rounded-full transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Propose change
            </button>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            {/* Left: Call Details */}
            <div className="space-y-2 flex-1">
              {!isDeleteProposal && callTimeInfo && (
                <>
                  {/* Date & Time */}
                  <p className="font-albert text-[15px] text-text-primary">
                    <span className="font-medium">{callTimeInfo.squadTime.date}</span>
                    {' · '}
                    <span>{callTimeInfo.squadTime.time} {callTimeInfo.squadTime.tzAbbrev}</span>
                    {!callTimeInfo.sameTimezone && (
                      <span className="text-text-secondary">
                        {' '}({callTimeInfo.userTime.time} your time)
                      </span>
                    )}
                  </p>
                  
                  {/* Location */}
                  <p className="font-albert text-[14px] text-text-secondary">
                    <span className="font-medium text-text-primary">Location:</span>{' '}
                    {call.location.startsWith('http') ? (
                      <a
                        href={call.location}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#a07855] hover:underline"
                      >
                        {call.location}
                      </a>
                    ) : (
                      call.location
                    )}
                  </p>
                </>
              )}

              {/* Voting Status */}
              <div className="flex items-center gap-2 pt-1">
                <Users className="w-4 h-4 text-text-secondary" />
                <p className="font-albert text-[14px] text-text-secondary">
                  <span className="font-medium text-text-primary">{call.yesCount} of {call.totalMembers}</span> members confirmed
                  {votesNeeded > 0 && (
                    <span className="text-[#a07855]"> · {votesNeeded} more needed</span>
                  )}
                </p>
              </div>
            </div>

            {/* Right: Voting Buttons */}
            <div className="flex gap-3 shrink-0">
              <button
                onClick={() => handleVote('yes')}
                disabled={isVoting}
                className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-albert text-[14px] font-medium transition-all ${
                  userVote === 'yes'
                    ? 'bg-emerald-500 text-white shadow-md'
                    : 'bg-[#f3f1ef] dark:bg-[#11141b] text-text-primary dark:text-[#f5f5f8] hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-400'
                } disabled:opacity-50`}
              >
                <Check className="w-4 h-4" />
                {isDeleteProposal ? 'Yes, cancel' : "I'm in"}
              </button>
              
              <button
                onClick={() => handleVote('no')}
                disabled={isVoting}
                className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-albert text-[14px] font-medium transition-all ${
                  userVote === 'no'
                    ? 'bg-red-500 text-white shadow-md'
                    : 'bg-[#f3f1ef] dark:bg-[#11141b] text-text-primary dark:text-[#f5f5f8] hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-400'
                } disabled:opacity-50`}
              >
                <X className="w-4 h-4" />
                {isDeleteProposal ? 'Keep it' : "Can't make it"}
              </button>
            </div>
          </div>
        </div>

        <CallSuggestionModal
          squad={squad}
          isOpen={showSuggestModal}
          onClose={() => setShowSuggestModal(false)}
          onSuccess={handleModalSuccess}
          existingCall={call}
        />
      </>
    );
  }

  // State C: Confirmed call
  if (call.status === 'confirmed' && callTimeInfo) {
    return (
      <>
        <div className="bg-white/80 dark:bg-[#171b22]/80 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-5 shadow-sm mb-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
              <h3 className="font-albert text-[16px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px]">
                Next squad call
              </h3>
            </div>
            
            {/* Edit button */}
            <button
              onClick={() => setShowSuggestModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#a07855] dark:text-[#b8896a] hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] rounded-full transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            {/* Left: Call Details */}
            <div className="space-y-2">
              {/* Date & Time */}
              <p className="font-albert text-[15px] text-text-primary">
                <span className="font-medium">{callTimeInfo.squadTime.date}</span>
                {' · '}
                <span>{callTimeInfo.squadTime.time} {callTimeInfo.squadTime.tzAbbrev}</span>
                {!callTimeInfo.sameTimezone && (
                  <span className="text-text-secondary">
                    {' '}({callTimeInfo.userTime.time} your time)
                  </span>
                )}
                {callTimeInfo.sameTimezone && (
                  <span className="text-text-secondary text-[13px]">
                    {' '}(same as your time)
                  </span>
                )}
              </p>
              
              {/* Location */}
              <p className="font-albert text-[14px] text-text-secondary">
                <span className="font-medium text-text-primary">Location:</span>{' '}
                {call.location.startsWith('http') ? (
                  <a
                    href={call.location}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#a07855] hover:underline"
                  >
                    {call.location}
                  </a>
                ) : (
                  call.location
                )}
              </p>
              
              {/* Title if custom */}
              {call.title && call.title !== 'Squad accountability call' && (
                <p className="font-albert text-[13px] text-text-secondary italic">
                  {call.title}
                </p>
              )}
            </div>

            {/* Right: Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 shrink-0">
              <button
                onClick={handleAddToCalendar}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#f3f1ef] dark:bg-[#11141b] hover:bg-[#e9e5e0] dark:hover:bg-[#171b22] rounded-full font-albert text-[14px] font-medium text-text-primary dark:text-[#f5f5f8] transition-colors"
              >
                <Download className="w-4 h-4" />
                Add to calendar
              </button>
              
              {squad.chatChannelId && (
                <button
                  onClick={handleGoToChat}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#a07855] hover:bg-[#8c6245] rounded-full font-albert text-[14px] font-medium text-white transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Go to chat
                </button>
              )}
            </div>
          </div>
        </div>

        <CallSuggestionModal
          squad={squad}
          isOpen={showSuggestModal}
          onClose={() => setShowSuggestModal(false)}
          onSuccess={handleModalSuccess}
          existingCall={call}
        />
      </>
    );
  }

  return null;
}


