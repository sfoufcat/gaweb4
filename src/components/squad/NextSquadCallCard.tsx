'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Calendar, MessageCircle, Download, Pencil } from 'lucide-react';
import type { Squad } from '@/types';
import { SquadCallEditForm } from './SquadCallEditForm';

/**
 * NextSquadCallCard Component
 * 
 * Displays the next scheduled squad call for premium squads.
 * Shows:
 * - Date & time in squad timezone and user's local timezone
 * - Location (e.g., "Squad chat", "Zoom")
 * - Guided by: Coach name + profile picture (premium only)
 * - "Add to calendar" button (downloads .ics file)
 * - "Go to chat" button
 * - Edit button (for coaches only)
 * 
 * Only renders for premium squads with isPremium === true.
 */

export interface CoachInfo {
  firstName: string;
  lastName: string;
  imageUrl: string;
}

interface NextSquadCallCardProps {
  squad: Squad;
  isCoach?: boolean; // If true, shows edit button
  onCallUpdated?: () => void; // Callback when call is updated/created
  coachInfo?: CoachInfo; // Coach details for "Guided by" display
}

/**
 * Formats a date in a specific timezone
 */
function formatDateInTimezone(date: Date, timezone: string): { date: string; time: string; tzAbbrev: string } {
  try {
    // Format date parts
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
    
    // Get timezone abbreviation
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
    // Fallback if timezone is invalid
    return {
      date: date.toLocaleDateString('en-US', { day: 'numeric', month: 'long' }),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      tzAbbrev: 'UTC',
    };
  }
}

/**
 * Get user's local timezone
 */
function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

export function NextSquadCallCard({ squad, isCoach = false, onCallUpdated, coachInfo }: NextSquadCallCardProps) {
  const router = useRouter();
  const [showEditModal, setShowEditModal] = useState(false);
  
  const hasScheduledCall = squad.nextCallDateTime != null;
  const callTimezone = squad.nextCallTimezone || squad.timezone || 'UTC';
  const userTimezone = getUserTimezone();
  const sameTimezone = callTimezone === userTimezone;
  
  // Parse and format the call time - must be called before any early returns
  const callTimeInfo = useMemo(() => {
    if (!squad.nextCallDateTime) return null;
    
    const callDate = new Date(squad.nextCallDateTime);
    
    // Format in squad/coach timezone
    const squadTime = formatDateInTimezone(callDate, callTimezone);
    
    // Format in user's local timezone
    const userTime = formatDateInTimezone(callDate, userTimezone);
    
    return {
      squadTime,
      userTime,
      sameTimezone,
    };
  }, [squad.nextCallDateTime, callTimezone, userTimezone, sameTimezone]);
  
  // Only show for premium squads - must be after all hooks
  if (!squad.isPremium) {
    return null;
  }
  
  const handleAddToCalendar = async () => {
    if (!hasScheduledCall) return;
    
    // Trigger ICS download
    const link = document.createElement('a');
    link.href = `/api/squad/${squad.id}/next-call.ics`;
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
  
  const handleEditSuccess = () => {
    setShowEditModal(false);
    if (onCallUpdated) {
      onCallUpdated();
    } else {
      // Refresh page if no callback provided
      window.location.reload();
    }
  };
  
  return (
    <>
    <div className="bg-white/80 dark:bg-[#171b22]/80 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-5 shadow-sm mb-6">
      {/* Card Title */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
          <h3 className="font-albert text-[16px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px]">
            Next squad call
          </h3>
        </div>
        
        {/* Edit button for coaches */}
        {isCoach && (
          <button
            onClick={() => setShowEditModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#a07855] dark:text-[#b8896a] hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] rounded-full transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            {hasScheduledCall ? 'Edit' : 'Schedule'}
          </button>
        )}
      </div>
      
      {hasScheduledCall && callTimeInfo ? (
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
            {squad.nextCallLocation && (
              <p className="font-albert text-[14px] text-text-secondary">
                <span className="font-medium text-text-primary">Location:</span>{' '}
                {squad.nextCallLocation.startsWith('http') ? (
                  <a
                    href={squad.nextCallLocation}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#a07855] hover:underline"
                  >
                    {squad.nextCallLocation}
                  </a>
                ) : (
                  squad.nextCallLocation
                )}
              </p>
            )}
            
            {/* Guided by (Coach info) */}
            {coachInfo && (
              <div className="flex items-center gap-1.5 font-albert text-[14px] text-text-secondary">
                <span className="font-medium text-text-primary">Guided by:</span>
                <span>{coachInfo.firstName} {coachInfo.lastName}</span>
                {coachInfo.imageUrl ? (
                  <Image
                    src={coachInfo.imageUrl}
                    alt=""
                    width={20}
                    height={20}
                    className="rounded-full object-cover shrink-0"
                    unoptimized
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-[#a07855] flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-medium text-white">
                      {coachInfo.firstName.charAt(0)}
                    </span>
                  </div>
                )}
              </div>
            )}
            
            {/* Optional Title */}
            {squad.nextCallTitle && squad.nextCallTitle !== 'Squad coaching call' && (
              <p className="font-albert text-[13px] text-text-secondary italic">
                {squad.nextCallTitle}
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
      ) : (
        /* Empty State */
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="font-albert text-[14px] text-text-secondary">
            No upcoming squad call scheduled yet.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 shrink-0">
            <button
              disabled
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#f3f1ef] dark:bg-[#11141b] rounded-full font-albert text-[14px] font-medium text-text-secondary/60 dark:text-[#7d8190]/60 cursor-not-allowed"
              title="No call scheduled"
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
      )}
    </div>
    
    {/* Edit Modal */}
    {isCoach && (
      <SquadCallEditForm
        squad={squad}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={handleEditSuccess}
      />
    )}
    </>
  );
}

