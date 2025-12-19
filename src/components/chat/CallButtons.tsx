'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Phone, Video } from 'lucide-react';
import { useStreamVideoClient } from '@/contexts/StreamVideoContext';
import type { Channel } from 'stream-chat';

interface CallButtonsProps {
  channel: Channel | undefined;
  className?: string;
}

/**
 * Check if a channel supports calling
 * 
 * Only DM channels and Squad channels are allowed to have calls.
 * - DMs are identified by having exactly 2 members and NOT being a special channel
 * - Squad channels are identified by isSquadChannel flag or ID starting with 'squad-'
 */
export function canCallChannel(channel: Channel | undefined): boolean {
  if (!channel) return false;

  const channelId = channel.id;
  const channelData = channel.data as Record<string, unknown> | undefined;
  
  // Check for explicit flags first
  if (channelData?.isDirectMessage === true) return true;
  if (channelData?.isSquadChannel === true) return true;
  
  // Check for squad channel by ID pattern
  if (channelId?.startsWith('squad-')) return true;
  
  // Check for DM channel by ID pattern and member count
  if (channelId?.startsWith('dm-')) {
    // Verify it's a 2-member DM
    const memberCount = Object.keys(channel.state?.members || {}).length;
    return memberCount === 2;
  }
  
  // Explicitly disallow special channels
  const specialChannelIds = ['announcements', 'social-corner', 'share-wins'];
  if (channelId && specialChannelIds.includes(channelId)) {
    return false;
  }
  
  // For any other channel, check if it looks like a DM (2 members, messaging type)
  if (channel.type === 'messaging') {
    const memberCount = Object.keys(channel.state?.members || {}).length;
    // If exactly 2 members and no special name, it's likely a DM
    if (memberCount === 2 && !channelData?.name) {
      return true;
    }
  }
  
  return false;
}

/**
 * CallButtons Component
 * 
 * Renders audio and video call buttons for channels that support calling.
 * Only appears for DM and Squad channels.
 */
export function CallButtons({ channel, className = '' }: CallButtonsProps) {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const { videoClient, activeCall, setActiveCall } = useStreamVideoClient();
  const [isStartingCall, setIsStartingCall] = useState(false);
  const [showAlreadyInCallPopup, setShowAlreadyInCallPopup] = useState(false);

  // Check if calling is allowed for this channel
  const canCall = canCallChannel(channel);

  // Start an audio or video call
  const startCall = useCallback(async (withVideo: boolean) => {
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

      // Determine if this is a squad channel
      const channelData = channel.data as Record<string, unknown> | undefined;
      const isSquadChannel = channelData?.isSquadChannel === true || channel.id?.startsWith('squad-');
      const channelName = (channelData?.name as string) || 'Chat';
      const channelImage = (channelData?.image as string) || undefined;

      // IMPORTANT: For audio-only calls, disable camera BEFORE joining
      // This prevents the SDK from auto-enabling the camera during join
      if (!withVideo) {
        await call.camera.disable();
      }

      // Join the call - this will create it if it doesn't exist
      await call.join({
        create: true,
        ring: memberIds.length > 0,
        data: {
          custom: {
            channelId: channel.id,
            channelName,
            channelImage,
            isSquadChannel,
            isVideoCall: withVideo,
          },
          members: memberIds.map(id => ({ user_id: id })),
        },
      });

      // Enable camera only for video calls (audio calls already have it disabled)
      if (withVideo) {
        await call.camera.enable();
      }
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
        {/* Audio call button */}
        <button
          onClick={() => startCall(false)}
          disabled={isStartingCall || !videoClient}
          className="w-10 h-10 flex items-center justify-center text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-full transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Start audio call"
        >
          <Phone className="w-5 h-5" />
        </button>

        {/* Video call button */}
        <button
          onClick={() => startCall(true)}
          disabled={isStartingCall || !videoClient}
          className="w-10 h-10 flex items-center justify-center text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-full transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Start video call"
        >
          <Video className="w-5 h-5" />
        </button>
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

