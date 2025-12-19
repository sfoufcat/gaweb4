'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStreamVideoClient } from '@/contexts/StreamVideoContext';
import { Phone, PhoneOff, Video, Users } from 'lucide-react';

/**
 * Global component to handle incoming call notifications.
 * Shows a modal when a call is incoming, allowing user to accept or reject.
 */
export function IncomingCallHandler() {
  const { videoClient, incomingCallData, setIncomingCallData, activeCall, setActiveCall } = useStreamVideoClient();
  const router = useRouter();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  // Handle accepting the call
  const handleAccept = async () => {
    if (!incomingCallData || !videoClient || isAccepting) return;

    try {
      setIsAccepting(true);
      
      // Create a real Call instance from the video client
      const call = videoClient.call(incomingCallData.callType, incomingCallData.callId);
      
      // IMPORTANT: For audio-only calls, disable camera BEFORE joining
      // This prevents the SDK from auto-enabling the camera
      if (!incomingCallData.isVideo) {
        await call.camera.disable();
      }
      
      // Join the call
      await call.join();
      
      // Enable camera only for video calls, ensure it's disabled for audio calls
      if (incomingCallData.isVideo) {
        await call.camera.enable();
      } else {
        // Double-ensure camera is disabled for audio calls
        await call.camera.disable();
      }
      await call.microphone.enable();
      
      // Set as active call
      setActiveCall(call);
      setIncomingCallData(null);
      
      // Navigate to call page
      router.push(`/call/${incomingCallData.callId}`);
    } catch (error) {
      console.error('Error accepting call:', error);
      setIncomingCallData(null);
    } finally {
      setIsAccepting(false);
    }
  };

  // Handle rejecting the call
  const handleReject = async () => {
    if (!incomingCallData || !videoClient || isRejecting) return;

    try {
      setIsRejecting(true);
      
      // Create a Call instance to reject it
      const call = videoClient.call(incomingCallData.callType, incomingCallData.callId);
      
      // Reject the call
      await call.leave({ reject: true });
    } catch (error) {
      console.error('Error rejecting call:', error);
    } finally {
      setIncomingCallData(null);
      setIsRejecting(false);
    }
  };

  // Don't show if already in a call or no incoming call
  if (activeCall || !incomingCallData) {
    return null;
  }

  // Determine display info based on whether it's a squad call or DM
  const isSquadCall = incomingCallData.isSquadCall;
  const displayName = isSquadCall 
    ? (incomingCallData.channelName || 'Your Squad')
    : incomingCallData.callerName;
  const displayImage = isSquadCall 
    ? incomingCallData.channelImage 
    : incomingCallData.callerImage;
  const callMessage = isSquadCall
    ? `${displayName} is calling`
    : `${displayName} is calling you`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 animate-in fade-in zoom-in duration-200">
        {/* Caller/Squad avatar or call type indicator */}
        <div className="flex justify-center mb-6">
          {displayImage ? (
            <img 
              src={displayImage} 
              alt={displayName}
              className="w-20 h-20 rounded-full object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[#a07855]/10 flex items-center justify-center">
              {isSquadCall ? (
                <Users className="w-10 h-10 text-[#a07855]" />
              ) : incomingCallData.isVideo ? (
                <Video className="w-10 h-10 text-[#a07855]" />
              ) : (
                <Phone className="w-10 h-10 text-[#a07855]" />
              )}
            </div>
          )}
        </div>

        {/* Caller/Squad info */}
        <div className="text-center mb-8">
          <h2 className="font-albert text-xl font-semibold text-[#1a1a1a] mb-2">
            Incoming {incomingCallData.isVideo ? 'Video' : 'Audio'} Call
          </h2>
          <p className="font-albert text-[#5f5a55]">
            {callMessage}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex justify-center gap-6">
          {/* Reject button */}
          <button
            onClick={handleReject}
            disabled={isAccepting || isRejecting}
            className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors shadow-lg disabled:opacity-50"
            aria-label="Reject call"
          >
            <PhoneOff className="w-6 h-6 text-white" />
          </button>

          {/* Accept button */}
          <button
            onClick={handleAccept}
            disabled={isAccepting || isRejecting}
            className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-colors shadow-lg disabled:opacity-50"
            aria-label="Accept call"
          >
            <Phone className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
