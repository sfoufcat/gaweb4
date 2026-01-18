'use client';

import { useCallback, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Phone, Calendar, Check, Clock, Loader2 } from 'lucide-react';
import { useStreamVideoClient } from '@/contexts/StreamVideoContext';
import { useUpcomingCall } from '@/hooks/useUpcomingCall';
import type { Channel } from 'stream-chat';
import type { UnifiedEvent } from '@/types';

interface CallButtonsProps {
  channel: Channel | undefined;
  className?: string;
  onSquadCallClick?: () => void;
  onScheduleClick?: () => void;
}

type ChannelCallType = 'dm' | 'squad' | 'none';

/**
 * Get the call type for a channel
 *
 * Returns:
 * - 'dm' for direct message channels (1-on-1 calls)
 * - 'squad' for squad channels (external meeting links)
 * - 'none' for channels that don't support calls
 */
export function getChannelCallType(channel: Channel | undefined): ChannelCallType {
  if (!channel) return 'none';

  const channelId = channel.id;
  const channelData = channel.data as Record<string, unknown> | undefined;

  // Check for squad channel first
  if (channelData?.isSquadChannel === true || channelId?.startsWith('squad-')) {
    return 'squad';
  }

  // Check for DM channel
  if (channelData?.isDirectMessage === true) return 'dm';
  if (channelId?.startsWith('dm-')) {
    const memberCount = Object.keys(channel.state?.members || {}).length;
    if (memberCount === 2) return 'dm';
  }

  // Check for coaching channel
  if (channelId?.startsWith('coaching-')) {
    return 'dm';
  }

  // Explicitly disallow special channels
  const specialChannelIds = ['announcements', 'social-corner', 'share-wins'];
  if (channelId && specialChannelIds.includes(channelId)) {
    return 'none';
  }

  // For any other channel, check if it looks like a DM
  if (channel.type === 'messaging') {
    const memberCount = Object.keys(channel.state?.members || {}).length;
    if (memberCount === 2 && !channelData?.name) {
      return 'dm';
    }
  }

  return 'none';
}

/**
 * Check if a user can schedule/join calls with another user in a DM
 *
 * Rules:
 * - Coaches can schedule with anyone
 * - Clients can schedule with coaches (not other clients)
 */
export function canMakeDirectCall(
  currentUserRole: string | undefined,
  otherUserRole: string | undefined
): boolean {
  // Coaches and super coaches can call anyone
  if (currentUserRole === 'coach' || currentUserRole === 'super_coach' ||
      currentUserRole === 'admin' || currentUserRole === 'super_admin') {
    return true;
  }

  // Members/clients can only call coaches
  if (currentUserRole === 'member' || currentUserRole === 'user' || !currentUserRole) {
    return otherUserRole === 'coach' || otherUserRole === 'super_coach' ||
           otherUserRole === 'admin' || otherUserRole === 'super_admin';
  }

  return false;
}

// Legacy function for backward compatibility
export function canCallChannel(channel: Channel | undefined): boolean {
  return getChannelCallType(channel) !== 'none';
}

/**
 * Format relative time for scheduled call display
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMins < 60) {
    return `in ${diffMins}m`;
  } else if (diffHours < 24) {
    return `in ${diffHours}h`;
  } else if (diffDays === 1) {
    return 'tomorrow';
  } else {
    return `in ${diffDays}d`;
  }
}

/**
 * CallButtons Component
 *
 * Renders call-related buttons based on channel type and call state:
 *
 * For DM/Coaching channels:
 * - No upcoming call → "Schedule" button
 * - Call scheduled (>1h away) → "Call Scheduled" badge
 * - Call within 1 hour → "Join Call" button
 * - Currently in call → "Return to Call" button
 *
 * For Squad channels:
 * - Calendar icon to view scheduled calls (unchanged)
 *
 * Call permissions:
 * - Coaches can schedule with anyone
 * - Clients can only schedule with coaches (not other clients)
 */
export function CallButtons({ channel, className = '', onSquadCallClick, onScheduleClick }: CallButtonsProps) {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const { videoClient, activeCall, setActiveCall } = useStreamVideoClient();
  const [isJoiningCall, setIsJoiningCall] = useState(false);

  // Determine channel call type
  const callType = getChannelCallType(channel);

  // Get other user ID for upcoming call lookup
  const otherUserId = useMemo(() => {
    if (!channel || !clerkUser || callType !== 'dm') return undefined;
    const members = Object.values(channel.state?.members || {});
    const otherMember = members.find(m => m.user?.id !== clerkUser.id);
    return otherMember?.user?.id;
  }, [channel, clerkUser, callType]);

  // Fetch upcoming call for DM channels
  const { upcomingCall, callState, isLoading: isLoadingCall } = useUpcomingCall(
    otherUserId,
    callType === 'dm'
  );

  // For DMs, check if the current user can call the other user
  const canCall = useMemo(() => {
    if (callType === 'none') return false;
    if (callType === 'squad') return true; // Squad shows schedule UI

    // For DMs, check role-based permissions
    if (callType === 'dm' && clerkUser) {
      const members = Object.values(channel?.state?.members || {});
      const otherMember = members.find(m => m.user?.id !== clerkUser.id);
      const currentUserRole = (clerkUser.publicMetadata as Record<string, unknown>)?.orgRole as string;
      const otherUserRole = (otherMember?.user as Record<string, unknown> | undefined)?.role as string;
      return canMakeDirectCall(currentUserRole, otherUserRole);
    }

    return false;
  }, [callType, clerkUser, channel]);

  // Join a scheduled call with eventId for summary linking
  const joinCall = useCallback(async (event: UnifiedEvent) => {
    if (!videoClient || !channel || !clerkUser) return;

    try {
      setIsJoiningCall(true);

      // Create call ID using event ID for tracking
      const callId = `event-${event.id}-${Date.now()}`;
      const call = videoClient.call('default', callId);

      // Get ring members (all members except current user)
      const members = Object.values(channel.state?.members || {});
      const otherMembers = members.filter(m => m.user?.id && m.user.id !== clerkUser.id);
      const memberIds = otherMembers.map(m => m.user!.id);

      // Get channel metadata
      const channelData = channel.data as Record<string, unknown> | undefined;
      const channelName = (channelData?.name as string) || 'Chat';
      const channelImage = (channelData?.image as string) || undefined;

      // IMPORTANT: Audio-first - disable camera BEFORE joining
      await call.camera.disable();

      // Join the call with eventId for summary linking
      await call.join({
        create: true,
        ring: memberIds.length > 0,
        data: {
          custom: {
            channelId: channel.id,
            channelName,
            channelImage,
            isSquadChannel: false,
            isVideoCall: false,
            callType: 'coaching_1on1',
            // Event linking for summary → program connection
            eventId: event.id,
            organizationId: event.organizationId,
            clientUserId: event.attendeeIds?.[0],
            // Program instance linking (passed through from event)
            instanceId: event.instanceId,
            weekIndex: event.weekIndex,
            dayIndex: event.dayIndex,
          },
          members: memberIds.map(id => ({ user_id: id })),
          settings_override: {
            recording: {
              mode: 'auto-on',
              audio_only: true,
            },
          },
        },
      });

      // Enable microphone
      await call.microphone.enable();

      // Set as active call
      setActiveCall(call);

      // Navigate to call page
      router.push(`/call/${callId}`);
    } catch (error) {
      console.error('Error joining call:', error);
    } finally {
      setIsJoiningCall(false);
    }
  }, [videoClient, channel, router, setActiveCall, clerkUser]);

  // If there's an active call, show "Return to call" button
  if (activeCall) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <button
          onClick={() => router.push(`/call/${activeCall.id}`)}
          className="px-3 py-1.5 bg-green-500 text-white rounded-full text-xs font-albert font-medium hover:bg-green-600 transition-colors flex items-center gap-1.5"
        >
          <Phone className="w-3.5 h-3.5" />
          Return to call
        </button>
      </div>
    );
  }

  // Don't render if calling is not allowed
  if (!canCall) return null;

  // Squad channels: Calendar icon to view scheduled calls (unchanged behavior)
  if (callType === 'squad') {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        {onSquadCallClick && (
          <button
            onClick={onSquadCallClick}
            className="w-10 h-10 flex items-center justify-center text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-full transition-colors flex-shrink-0"
            aria-label="View scheduled calls"
          >
            <Calendar className="w-5 h-5" />
          </button>
        )}
      </div>
    );
  }

  // DM channels: Schedule → Scheduled → Join flow
  if (callType === 'dm') {
    // Loading state
    if (isLoadingCall) {
      return (
        <div className={`flex items-center gap-1 ${className}`}>
          <div className="w-10 h-10 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2] animate-spin" />
          </div>
        </div>
      );
    }

    // No upcoming call → Schedule button
    if (callState === 'none') {
      return (
        <div className={`flex items-center gap-1 ${className}`}>
          {onScheduleClick && (
            <button
              onClick={onScheduleClick}
              className="px-3 py-1.5 text-sm font-albert font-medium text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-full transition-colors flex items-center gap-1.5"
              aria-label="Schedule a call"
            >
              <Calendar className="w-4 h-4" />
              Schedule
            </button>
          )}
        </div>
      );
    }

    // Call scheduled (>1h away) → Call Scheduled badge
    if (callState === 'scheduled' && upcomingCall) {
      return (
        <div className={`flex items-center gap-1 ${className}`}>
          <button
            onClick={onScheduleClick}
            className="px-3 py-1.5 text-sm font-albert font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-full transition-colors flex items-center gap-1.5"
            aria-label="View scheduled call"
          >
            <Check className="w-4 h-4" />
            <span>Call Scheduled</span>
            <span className="text-xs opacity-70">{formatRelativeTime(upcomingCall.startDateTime)}</span>
          </button>
        </div>
      );
    }

    // Call within 1 hour → Join Call button
    if (callState === 'joinable' && upcomingCall) {
      const startTime = new Date(upcomingCall.startDateTime);
      const now = new Date();
      const hasStarted = startTime <= now;

      return (
        <div className={`flex items-center gap-1 ${className}`}>
          <button
            onClick={() => joinCall(upcomingCall)}
            disabled={isJoiningCall || !videoClient}
            className="px-3 py-1.5 text-sm font-albert font-medium text-white bg-green-500 hover:bg-green-600 rounded-full transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Join scheduled call"
          >
            {isJoiningCall ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Phone className="w-4 h-4" />
            )}
            <span>Join Call</span>
            {!hasStarted && (
              <span className="flex items-center gap-0.5 text-xs opacity-80">
                <Clock className="w-3 h-3" />
                {formatRelativeTime(upcomingCall.startDateTime)}
              </span>
            )}
          </button>
        </div>
      );
    }
  }

  return null;
}
