'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStreamVideoClient, recordCallStart, getCallStartTime } from '@/contexts/StreamVideoContext';
import { useStreamChatClient } from '@/contexts/StreamChatContext';
import { useUser } from '@clerk/nextjs';
import {
  StreamVideo,
  StreamCall,
  CallControls,
  SpeakerLayout,
  StreamTheme,
  CallingState,
  useCallStateHooks,
  Call,
} from '@stream-io/video-react-sdk';
import '@stream-io/video-react-sdk/dist/css/styles.css';
import { ArrowLeft, Loader2, Users } from 'lucide-react';

// Module-level storage for active media streams
let activeMediaStreams: MediaStream[] = [];

/**
 * Stop all tracked media streams properly.
 * Does NOT acquire new streams - only stops what we've tracked.
 */
function stopTrackedMediaStreams() {
  console.log('[stopTrackedMediaStreams] Stopping', activeMediaStreams.length, 'tracked streams...');
  
  activeMediaStreams.forEach(stream => {
    if (stream) {
      stream.getTracks().forEach(track => {
        if (track.readyState === 'live') {
          console.log('[stopTrackedMediaStreams] Stopping track:', track.kind, track.label);
          track.stop();
        }
      });
    }
  });
  activeMediaStreams = [];
  
  console.log('[stopTrackedMediaStreams] All tracked streams stopped');
}

/**
 * Stop all local participant tracks from the call's state.
 * This catches streams that may not be tracked in our module-level array.
 */
function stopAllLocalTracks(call: Call | null) {
  if (!call) return;
  
  console.log('[stopAllLocalTracks] Stopping local participant tracks...');
  
  try {
    // Get tracks from call's local participant state
    const localParticipant = call.state?.localParticipant;
    if (localParticipant) {
      // Stop audio stream tracks
      if (localParticipant.audioStream) {
        localParticipant.audioStream.getTracks().forEach(track => {
          if (track.readyState === 'live') {
            console.log('[stopAllLocalTracks] Stopping audio track:', track.label);
            track.stop();
          }
        });
      }
      // Stop video stream tracks
      if (localParticipant.videoStream) {
        localParticipant.videoStream.getTracks().forEach(track => {
          if (track.readyState === 'live') {
            console.log('[stopAllLocalTracks] Stopping video track:', track.label);
            track.stop();
          }
        });
      }
    }
  } catch (e) {
    console.log('[stopAllLocalTracks] Error stopping local tracks:', e);
  }
  
  // Also try to stop any tracks from the publisher state (internal SDK state)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const publisher = (call as any).publisher;
    if (publisher?.mediaStream) {
      publisher.mediaStream.getTracks().forEach((track: MediaStreamTrack) => {
        if (track.readyState === 'live') {
          console.log('[stopAllLocalTracks] Stopping publisher track:', track.kind, track.label);
          track.stop();
        }
      });
    }
  } catch (_e) { /* ignore - publisher may not be accessible */ }
  
  console.log('[stopAllLocalTracks] Local tracks cleanup complete');
}

/**
 * Comprehensive cleanup of a call's media resources.
 * Uses SDK methods properly and stops all tracked streams.
 */
async function cleanupCallMedia(call: Call | null): Promise<void> {
  console.log('[cleanupCallMedia] Starting cleanup...');
  
  if (call) {
    // 1. First, stop publishing to immediately release media (this is the key step!)
    try {
      console.log('[cleanupCallMedia] Stopping publish...');
      await call.stopPublish();
    } catch (e) {
      console.log('[cleanupCallMedia] stopPublish error (may not be publishing):', e);
    }
    
    // 2. Disable camera and microphone through SDK
    try {
      console.log('[cleanupCallMedia] Disabling camera...');
      await call.camera.disable();
    } catch (e) {
      console.log('[cleanupCallMedia] Camera disable error (may already be disabled):', e);
    }
    
    try {
      console.log('[cleanupCallMedia] Disabling microphone...');
      await call.microphone.disable();
    } catch (e) {
      console.log('[cleanupCallMedia] Microphone disable error (may already be disabled):', e);
    }
    
    // 3. Stop all local participant tracks (catches SDK internal streams)
    stopAllLocalTracks(call);
    
    // 4. Stop any streams from the SDK's camera/microphone state
    try {
      const cameraStream = call.camera?.state?.mediaStream;
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => {
          if (track.readyState === 'live') {
            console.log('[cleanupCallMedia] Stopping SDK camera track:', track.kind);
            track.stop();
          }
        });
      }
    } catch (_e) { /* ignore */ }
    
    try {
      const micStream = call.microphone?.state?.mediaStream;
      if (micStream) {
        micStream.getTracks().forEach(track => {
          if (track.readyState === 'live') {
            console.log('[cleanupCallMedia] Stopping SDK mic track:', track.kind);
            track.stop();
          }
        });
      }
    } catch (_e) { /* ignore */ }
    
    // 5. Leave the call
    try {
      console.log('[cleanupCallMedia] Leaving call...');
      await call.leave();
    } catch (e) {
      console.log('[cleanupCallMedia] Leave error (may have already left):', e);
    }
  }
  
  // 6. Stop any additional tracked streams (belt and suspenders)
  stopTrackedMediaStreams();
  
  console.log('[cleanupCallMedia] Cleanup complete');
}

/**
 * Track a media stream for later cleanup
 */
function trackMediaStream(stream: MediaStream | null | undefined) {
  if (stream && !activeMediaStreams.includes(stream)) {
    activeMediaStreams.push(stream);
    console.log('[trackMediaStream] Tracking stream with', stream.getTracks().length, 'tracks');
  }
}

/**
 * Call UI Component - Rendered inside StreamCall
 */
function CallUI({ onLeave }: { onLeave: () => void }) {
  const { useCallCallingState, useParticipantCount } = useCallStateHooks();
  const callingState = useCallCallingState();
  const participantCount = useParticipantCount();

  // Handle different calling states
  if (callingState === CallingState.LEFT) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1a1a1a]">
        <div className="text-center">
          <p className="font-albert text-white text-lg mb-4">Call ended</p>
          <button
            onClick={onLeave}
            className="px-6 py-3 bg-[#a07855] text-white rounded-full font-albert font-medium hover:bg-[#8a6847] transition-colors"
          >
            Return to chat
          </button>
        </div>
      </div>
    );
  }

  if (callingState === CallingState.JOINING || callingState === CallingState.RECONNECTING) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1a1a1a]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#a07855] animate-spin mx-auto mb-4" />
          <p className="font-albert text-white text-lg">
            {callingState === CallingState.RECONNECTING ? 'Reconnecting...' : 'Joining call...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#1a1a1a]">
      {/* Top bar with participant count */}
      <div className="absolute top-4 left-4 z-20">
        <div className="px-3 py-1 bg-black/50 rounded-full">
          <span className="font-albert text-white text-sm flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            {participantCount}
          </span>
        </div>
      </div>

      {/* Main video layout */}
      <div className="flex-1 min-h-0">
        <SpeakerLayout participantsBarPosition="bottom" />
      </div>

      {/* Call controls at bottom */}
      <div className="flex-shrink-0 p-4 flex justify-center">
        <CallControls onLeave={onLeave} />
      </div>
    </div>
  );
}

/**
 * Call Page Component
 */
export default function CallPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { videoClient, setActiveCall, activeCall } = useStreamVideoClient();
  const { client: chatClient } = useStreamChatClient();
  const [call, setCall] = useState<Call | null>(null);
  const [isJoining, setIsJoining] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const hasPostedCallMessage = useRef(false);
  const hasCleanedUp = useRef(false);

  const callId = params.callId as string;

  // Send call message to chat channel
  const sendCallMessage = useCallback(async () => {
    if (!chatClient || !call || hasPostedCallMessage.current) return;
    hasPostedCallMessage.current = true;
    
    try {
      const channelId = call.state.custom?.channelId as string | undefined;
      if (!channelId) return;

      const callStartTime = getCallStartTime(callId);
      const callTimestamp = callStartTime ? new Date(callStartTime) : new Date();

      const channel = chatClient.channel('messaging', channelId);
      await channel.watch();

      // Check for existing call message
      const { messages } = await channel.query({ messages: { limit: 20 } });
      const exists = messages?.find((msg) => (msg as { call_id?: string }).call_id === callId);
      if (exists) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await channel.sendMessage({
        text: '',
        call_ended: true,
        call_id: callId,
        call_timestamp: callTimestamp.toISOString(),
      } as Parameters<typeof channel.sendMessage>[0]);
    } catch (err) {
      console.error('[CallPage] Error sending call message:', err);
    }
  }, [chatClient, call, callId]);

  // Comprehensive cleanup function
  const cleanupCall = useCallback(async () => {
    if (hasCleanedUp.current) return;
    hasCleanedUp.current = true;

    console.log('[CallPage] Starting comprehensive cleanup...');

    // Use proper SDK-based cleanup
    await cleanupCallMedia(call);

    // Clear state
    setActiveCall(null);
    
    console.log('[CallPage] Cleanup complete');
  }, [call, setActiveCall]);

  // Handle leaving the call - IMPORTANT: unmount StreamCall before navigating
  const handleLeave = useCallback(async () => {
    if (isLeaving) return;
    setIsLeaving(true);

    console.log('[CallPage] handleLeave called');

    try {
      // Send the call message first (non-blocking)
      sendCallMessage().catch(console.error);

      // Use proper SDK-based cleanup (includes stopPublish, disable, and leave)
      await cleanupCallMedia(call);

      // Mark as cleaned up before clearing state
      hasCleanedUp.current = true;

      // Clear call state - this unmounts StreamCall component
      setCall(null);
      setActiveCall(null);

      // Wait for React to process the state update and unmount components
      // Using 750ms to ensure SDK has fully released media resources
      await new Promise(resolve => setTimeout(resolve, 750));

      // Final verification - stop any remaining tracks that might still be active
      stopTrackedMediaStreams();
      if (call) {
        stopAllLocalTracks(call);
      }

      // Now navigate
      router.push('/chat');
    } catch (err) {
      console.error('[CallPage] Error during leave:', err);
      // Even on error, perform aggressive cleanup and navigate away
      hasCleanedUp.current = true;
      stopTrackedMediaStreams();
      if (call) {
        stopAllLocalTracks(call);
      }
      setCall(null);
      setActiveCall(null);
      router.push('/chat');
    }
  }, [call, sendCallMessage, router, setActiveCall, isLeaving]);

  // Initialize and join the call
  useEffect(() => {
    if (!videoClient || !callId || !isUserLoaded || !user) return;

    let mounted = true;

    const initCall = async () => {
      try {
        setIsJoining(true);
        setError(null);

        const newCall = videoClient.call('default', callId);
        
        if (activeCall?.id === callId) {
          setCall(activeCall);
          setIsJoining(false);
          return;
        }

        await newCall.join({ create: true });
        recordCallStart(callId);

        // Check if this is a video call from custom data
        // If not explicitly a video call, disable camera (default to audio-only)
        const isVideoCall = newCall.state.custom?.isVideoCall === true;
        
        if (isVideoCall) {
          await newCall.camera.enable();
        } else {
          // Disable camera for audio-only calls
          await newCall.camera.disable();
        }
        await newCall.microphone.enable();

        // Track media streams after joining
        trackMediaStream(newCall.camera?.state?.mediaStream);
        trackMediaStream(newCall.microphone?.state?.mediaStream);

        if (mounted) {
          setCall(newCall);
          setActiveCall(newCall);
          setIsJoining(false);
        }
      } catch (err) {
        console.error('Error joining call:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to join call');
          setIsJoining(false);
        }
      }
    };

    initCall();

    return () => {
      mounted = false;
    };
  }, [videoClient, callId, isUserLoaded, user, setActiveCall, activeCall]);

  // Track new media streams when they become available
  useEffect(() => {
    if (!call) return;

    // Subscribe to camera state changes
    const cameraSubscription = call.camera.state.mediaStream$?.subscribe((stream) => {
      trackMediaStream(stream);
    });

    // Subscribe to microphone state changes
    const micSubscription = call.microphone.state.mediaStream$?.subscribe((stream) => {
      trackMediaStream(stream);
    });

    return () => {
      cameraSubscription?.unsubscribe();
      micSubscription?.unsubscribe();
    };
  }, [call]);

  // Cleanup on component unmount
  useEffect(() => {
    // Capture call reference for cleanup
    const callRef = call;
    
    return () => {
      if (!hasCleanedUp.current) {
        console.log('[CallPage] Unmount cleanup...');
        hasCleanedUp.current = true;
        
        // Stop all local participant tracks first (most thorough)
        stopAllLocalTracks(callRef);
        
        // Stop tracked streams synchronously
        stopTrackedMediaStreams();

        // SDK cleanup (async but we don't wait)
        if (callRef) {
          // Stop publishing first to release media immediately
          callRef.stopPublish().catch(() => {});
          callRef.camera.disable().catch(() => {});
          callRef.microphone.disable().catch(() => {});
          callRef.leave().catch(() => {});
        }
      }
    };
  }, [call]);

  // Cleanup when callingState becomes LEFT
  useEffect(() => {
    if (!call) return;

    const subscription = call.state.callingState$.subscribe((state) => {
      if (state === CallingState.LEFT || state === CallingState.IDLE) {
        cleanupCall();
      }
    });

    return () => subscription.unsubscribe();
  }, [call, cleanupCall]);

  // Cleanup on browser close/navigation
  useEffect(() => {
    const handleBeforeUnload = () => {
      console.log('[CallPage] beforeunload cleanup...');
      // Stop all local participant tracks first (most thorough)
      stopAllLocalTracks(call);
      
      // Synchronous cleanup for beforeunload
      stopTrackedMediaStreams();
      
      if (call) {
        // Stop publishing first to release media immediately
        call.stopPublish().catch(() => {});
        call.camera.disable().catch(() => {});
        call.microphone.disable().catch(() => {});
        call.leave().catch(() => {});
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [call]);

  const fullScreenStyle = {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw',
    height: '100vh',
    zIndex: 9999,
  };

  if (!isUserLoaded || !videoClient) {
    return (
      <div className="bg-[#1a1a1a] flex items-center justify-center" style={fullScreenStyle}>
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#a07855] animate-spin mx-auto mb-4" />
          <p className="font-albert text-white text-lg">Initializing...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#1a1a1a] flex items-center justify-center" style={fullScreenStyle}>
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h1 className="font-albert text-white text-xl font-semibold mb-2">Unable to join call</h1>
          <p className="font-albert text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/chat')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#a07855] text-white rounded-full font-albert font-medium hover:bg-[#8a6847] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to chat
          </button>
        </div>
      </div>
    );
  }

  if (isJoining) {
    return (
      <div className="bg-[#1a1a1a] flex items-center justify-center" style={fullScreenStyle}>
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#a07855] animate-spin mx-auto mb-4" />
          <p className="font-albert text-white text-lg">Joining call...</p>
        </div>
      </div>
    );
  }

  // If leaving or no call, show a transition screen
  if (isLeaving || !call) {
    return (
      <div className="bg-[#1a1a1a] flex items-center justify-center" style={fullScreenStyle}>
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#a07855] animate-spin mx-auto mb-4" />
          <p className="font-albert text-white text-lg">Leaving call...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a1a]" style={fullScreenStyle}>
      <StreamVideo client={videoClient}>
        <StreamTheme>
          <StreamCall call={call}>
            <CallUI onLeave={handleLeave} />
          </StreamCall>
        </StreamTheme>
      </StreamVideo>
    </div>
  );
}
