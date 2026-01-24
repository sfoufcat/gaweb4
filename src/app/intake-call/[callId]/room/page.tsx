'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  StreamVideoClient,
  StreamVideo,
  StreamCall,
  CallControls,
  SpeakerLayout,
  StreamTheme,
  CallingState,
  useCallStateHooks,
  Call,
  hasVideo,
  User,
} from '@stream-io/video-react-sdk';
import '@stream-io/video-react-sdk/dist/css/styles.css';
import { Loader2, Phone, Mic, MicOff, Video, VideoOff, PhoneOff, Users } from 'lucide-react';

interface GuestCallData {
  streamToken: string;
  guestUserId: string;
  guestName: string;
  apiKey: string;
  callId: string;
  callType: string;
  event: {
    title: string;
    hostName: string;
    hostUserId: string;
  };
  branding: {
    organizationName?: string;
    logoUrl?: string;
  };
}

/**
 * Format duration in seconds to MM:SS
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Waiting Room Component - Shown before coach joins
 */
function WaitingRoom({
  hostName,
  eventTitle,
  branding,
  onLeave,
}: {
  hostName: string;
  eventTitle: string;
  branding: { organizationName?: string; logoUrl?: string };
  onLeave: () => void;
}) {
  const [dots, setDots] = useState('');

  // Animate waiting dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => (d.length >= 3 ? '' : d + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-[#faf8f6] to-[#f3f1ef] dark:from-[#11141b] dark:to-[#1d222b]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        {branding.logoUrl ? (
          <Image
            src={branding.logoUrl}
            alt={branding.organizationName || 'Coach'}
            width={100}
            height={32}
            className="h-6 w-auto object-contain"
          />
        ) : branding.organizationName ? (
          <span className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {branding.organizationName}
          </span>
        ) : (
          <div />
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Animated loader */}
        <div className="relative mb-8">
          <div className="w-24 h-24 rounded-full bg-brand-accent/10 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-brand-accent/20 flex items-center justify-center animate-pulse">
              <Phone className="w-8 h-8 text-brand-accent" />
            </div>
          </div>
          {/* Ripple effect */}
          <div className="absolute inset-0 rounded-full border-2 border-brand-accent/30 animate-ping" />
        </div>

        <h1 className="text-2xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2 text-center">
          Waiting for {hostName}{dots}
        </h1>
        <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-center mb-2">
          {eventTitle}
        </p>
        <p className="text-sm text-[#5f5a55]/70 dark:text-[#b2b6c2]/70 font-albert text-center">
          You&apos;ll be connected once your coach joins
        </p>
      </div>

      {/* Leave button */}
      <div className="flex-shrink-0 p-6 flex justify-center">
        <button
          onClick={onLeave}
          className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full font-medium font-albert transition-colors"
        >
          <PhoneOff className="w-5 h-5" />
          Leave
        </button>
      </div>
    </div>
  );
}

/**
 * Audio Call Layout - Phone style UI when no video
 */
function AudioCallLayout({
  hostName,
  onLeave,
}: {
  hostName: string;
  onLeave: () => void;
}) {
  const { useParticipants, useLocalParticipant, useDominantSpeaker } = useCallStateHooks();
  const participants = useParticipants();
  const localParticipant = useLocalParticipant();
  const dominantSpeaker = useDominantSpeaker();
  const [duration, setDuration] = useState(0);

  // Call duration timer
  useEffect(() => {
    const interval = setInterval(() => {
      setDuration(d => d + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Get the remote participant (coach)
  const remoteParticipant = participants.find(p => p.userId !== localParticipant?.userId);
  const displayParticipant = remoteParticipant || localParticipant;

  // Speaking status
  const isSpeaking = dominantSpeaker?.isSpeaking || false;
  const speakingUserId = dominantSpeaker?.userId;

  // Get display name and avatar
  const displayName = displayParticipant?.name || hostName || 'Coach';
  const avatarUrl = displayParticipant?.image;
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2 text-white/60">
          <Phone className="w-4 h-4" />
          <span className="font-albert text-sm">Voice Call</span>
        </div>
        <div className="px-3 py-1 bg-white/10 rounded-full">
          <span className="font-albert text-white text-sm font-medium">
            {formatDuration(duration)}
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Avatar with speaking indicator */}
        <div className="relative mb-6">
          <div
            className={`absolute inset-0 rounded-full transition-all duration-300 ${
              isSpeaking && speakingUserId === displayParticipant?.userId
                ? 'ring-4 ring-green-500/50 animate-pulse'
                : ''
            }`}
            style={{ margin: '-8px' }}
          />

          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-brand-accent to-[#c9a07a] flex items-center justify-center overflow-hidden shadow-2xl">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <span className="font-albert text-4xl font-bold text-white">{initials}</span>
            )}
          </div>
        </div>

        <h2 className="font-albert text-2xl font-semibold text-white mb-2">{displayName}</h2>

        {/* Speaking indicator */}
        <div className="flex items-center gap-2 text-white/60">
          {isSpeaking && speakingUserId === displayParticipant?.userId ? (
            <>
              <div className="flex items-center gap-1">
                <span className="w-1 h-3 bg-green-500 rounded-full animate-pulse" />
                <span className="w-1 h-4 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-2 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                <span className="w-1 h-5 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '450ms' }} />
                <span className="w-1 h-3 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '600ms' }} />
              </div>
              <span className="font-albert text-sm text-green-400">Speaking</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              <span className="font-albert text-sm">Connected</span>
            </>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex-shrink-0 p-6 flex justify-center">
        <CallControls onLeave={onLeave} />
      </div>
    </div>
  );
}

/**
 * Call UI Component - Rendered inside StreamCall
 */
function GuestCallUI({
  hostName,
  hostUserId,
  branding,
  onLeave,
}: {
  hostName: string;
  hostUserId: string;
  branding: { organizationName?: string; logoUrl?: string };
  onLeave: () => void;
}) {
  const { useCallCallingState, useParticipants } = useCallStateHooks();
  const callingState = useCallCallingState();
  const participants = useParticipants();

  // Check if coach (host) has joined
  const hostJoined = participants.some(p => p.userId === hostUserId);

  // Check if anyone has video
  const anyoneHasVideo = participants.some(p => hasVideo(p));

  // Show waiting room if host hasn't joined yet
  if (!hostJoined && callingState !== CallingState.LEFT) {
    return (
      <WaitingRoom
        hostName={hostName}
        eventTitle="Your call"
        branding={branding}
        onLeave={onLeave}
      />
    );
  }

  // Call ended state
  if (callingState === CallingState.LEFT) {
    return (
      <div className="h-full flex items-center justify-center bg-[#faf8f6] dark:bg-[#11141b]">
        <div className="text-center p-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <Phone className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="font-albert text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
            Call Ended
          </h2>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] mb-6">
            Thank you for joining!
          </p>
          <button
            onClick={() => window.close()}
            className="px-6 py-3 bg-brand-accent text-white rounded-xl font-albert font-medium hover:opacity-90 transition-opacity"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  // Show video or audio layout
  if (anyoneHasVideo) {
    return (
      <div className="h-full flex flex-col bg-[#1a1a1a]">
        <div className="flex-1">
          <SpeakerLayout />
        </div>
        <div className="flex-shrink-0 p-4">
          <CallControls onLeave={onLeave} />
        </div>
      </div>
    );
  }

  return <AudioCallLayout hostName={hostName} onLeave={onLeave} />;
}

/**
 * Main Guest Room Page
 */
export default function GuestRoomPage() {
  const router = useRouter();
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [guestData, setGuestData] = useState<GuestCallData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const cleanupRef = useRef(false);

  // Load guest data from sessionStorage
  useEffect(() => {
    const storedData = sessionStorage.getItem('guestCallData');

    if (!storedData) {
      setError('Call data not found. Please use the join link from your email.');
      setIsLoading(false);
      return;
    }

    try {
      const data = JSON.parse(storedData) as GuestCallData;
      setGuestData(data);
    } catch (err) {
      console.error('Error parsing guest data:', err);
      setError('Invalid call data');
      setIsLoading(false);
    }
  }, []);

  // Initialize Stream Video client and join call
  useEffect(() => {
    if (!guestData) return;

    const initializeCall = async () => {
      try {
        console.log('[GUEST_ROOM] Initializing guest video client...');

        // Create guest user
        const guestUser: User = {
          id: guestData.guestUserId,
          name: guestData.guestName,
          type: 'guest',
        };

        // Initialize client
        const videoClient = new StreamVideoClient({
          apiKey: guestData.apiKey,
          user: guestUser,
          token: guestData.streamToken,
        });

        setClient(videoClient);

        // Create call instance
        const videoCall = videoClient.call(guestData.callType, guestData.callId);

        // Join the call (should already exist from booking)
        console.log('[GUEST_ROOM] Joining call:', guestData.callId);
        await videoCall.join({ create: false });

        // Disable camera by default (audio-first)
        await videoCall.camera.disable();

        // Enable microphone
        await videoCall.microphone.enable();

        setCall(videoCall);
        setIsLoading(false);

        console.log('[GUEST_ROOM] Successfully joined call');
      } catch (err) {
        console.error('[GUEST_ROOM] Error joining call:', err);
        setError('Failed to join call. The call may have ended or not started yet.');
        setIsLoading(false);
      }
    };

    initializeCall();

    // Cleanup on unmount
    return () => {
      if (cleanupRef.current) return;
      cleanupRef.current = true;

      console.log('[GUEST_ROOM] Cleaning up...');

      if (call) {
        call.leave().catch(console.error);
      }

      if (client) {
        client.disconnectUser().catch(console.error);
      }

      // Clear session storage
      sessionStorage.removeItem('guestCallData');
    };
  }, [guestData]);

  // Handle leave call
  const handleLeave = useCallback(async () => {
    console.log('[GUEST_ROOM] Leaving call...');

    try {
      if (call) {
        await call.camera.disable();
        await call.microphone.disable();
        await call.leave();
      }

      if (client) {
        await client.disconnectUser();
      }
    } catch (err) {
      console.error('[GUEST_ROOM] Error during cleanup:', err);
    }

    // Clear session storage
    sessionStorage.removeItem('guestCallData');

    // Close window or go back
    if (window.opener) {
      window.close();
    } else {
      router.push('/');
    }
  }, [call, client, router]);

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

  // Error state
  if (error) {
    return (
      <div className="bg-[#faf8f6] dark:bg-[#11141b] flex items-center justify-center p-4" style={fullScreenStyle}>
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
            Unable to Join
          </h1>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] mb-6">{error}</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-brand-accent text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading || !client || !call || !guestData) {
    return (
      <div className="bg-[#faf8f6] dark:bg-[#11141b] flex items-center justify-center" style={fullScreenStyle}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-accent mx-auto mb-4" />
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            Connecting to call...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a1a]" style={fullScreenStyle}>
      <StreamVideo client={client}>
        <StreamTheme className="h-full w-full">
          <StreamCall call={call}>
            <div className="h-full w-full">
              <GuestCallUI
                hostName={guestData.event.hostName}
                hostUserId={guestData.event.hostUserId}
                branding={guestData.branding}
                onLeave={handleLeave}
              />
            </div>
          </StreamCall>
        </StreamTheme>
      </StreamVideo>
    </div>
  );
}
