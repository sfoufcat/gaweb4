'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Phone, Calendar } from 'lucide-react';
import { useStreamVideoClient } from '@/contexts/StreamVideoContext';
import type { Channel } from 'stream-chat';

interface CallButtonsProps {
  channel: Channel | undefined;
  className?: string;
  onSquadCallClick?: () => void;
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
 * Check if a user can call another user in a DM
 *
 * Rules:
 * - Coaches can call anyone
 * - Clients can only call coaches (not other clients)
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
 * CallButtons Component
 *
 * Renders call buttons based on channel type:
 * - DM channels: Single phone icon for audio-first 1-on-1 calls
 * - Squad channels: Calendar icon to view scheduled calls
 *
 * Call permissions:
 * - Coaches can call anyone
 * - Clients can only call coaches (not other clients)
 */
export function CallButtons({ channel, className = '', onSquadCallClick }: CallButtonsProps) {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const { videoClient, activeCall, setActiveCall } = useStreamVideoClient();
  const [isStartingCall, setIsStartingCall] = useState(false);
  const [showAlreadyInCallPopup, setShowAlreadyInCallPopup] = useState(false);

  // Determine channel call type
  const callType = getChannelCallType(channel);

  // For DMs, check if the current user can call the other user
  const canCall = (() => {
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
  })();

  // Start an audio call (video can be enabled during the call)
  const startCall = useCallback(async () => {
    if (!videoClient || !channel || !clerkUser) return;

    // Check if already in a call
    if (activeCall) {
      setShowAlreadyInCallPopup(true);
      setTimeout(() => setShowAlreadyInCallPopup(false), 3000);
      return;
    }

    try {
      setIsStartingCall(true);

      // Create a unique call ID using channel ID and timestamp to avoid conflicts
      const callId = `${channel.id}-${Date.now()}`;
      const call = videoClient.call('default', callId);

      // Get ring members (all members except current user)
      const memberIds = Object.values(channel.state?.members || {})
        .filter(m => m.user?.id && m.user.id !== clerkUser.id)
        .map(m => m.user!.id);

      // Get channel metadata
      const channelData = channel.data as Record<string, unknown> | undefined;
      const channelName = (channelData?.name as string) || 'Chat';
      const channelImage = (channelData?.image as string) || undefined;

      // IMPORTANT: Audio-first - disable camera BEFORE joining
      await call.camera.disable();

      // Join the call with audio-only recording enabled
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
          },
          members: memberIds.map(id => ({ user_id: id })),
          settings_override: {
            recording: {
              mode: 'available',
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
      console.error('Error starting call:', error);
    } finally {
      setIsStartingCall(false);
    }
  }, [videoClient, channel, activeCall, router, setActiveCall, clerkUser]);

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

  return (
    <>
      <div className={`flex items-center gap-1 ${className}`}>
        {/* DM channels: Single phone icon for audio call */}
        {callType === 'dm' && (
          <button
            onClick={startCall}
            disabled={isStartingCall || !videoClient}
            className="w-10 h-10 flex items-center justify-center text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-full transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Start call"
          >
            <Phone className="w-5 h-5" />
          </button>
        )}

        {/* Squad channels: Calendar icon to view scheduled calls */}
        {callType === 'squad' && onSquadCallClick && (
          <button
            onClick={onSquadCallClick}
            className="w-10 h-10 flex items-center justify-center text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-full transition-colors flex-shrink-0"
            aria-label="View scheduled calls"
          >
            <Calendar className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Already in call popup */}
      {showAlreadyInCallPopup && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#1a1a1a] text-white px-4 py-3 rounded-lg shadow-lg animate-in fade-in slide-in-from-top duration-200">
          <p className="font-albert text-sm">You are already in a call.</p>
        </div>
      )}
    </>
  );
}

