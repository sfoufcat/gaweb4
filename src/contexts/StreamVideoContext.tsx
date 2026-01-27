'use client';

import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useUser } from '@clerk/nextjs';
import type { StreamVideoClient, Call } from '@stream-io/video-react-sdk';

// Metadata for incoming calls (extracted from ring event)
export interface IncomingCallData {
  callId: string;
  callType: string;
  callerName: string;
  callerImage?: string;
  isVideo: boolean;
  // Squad call info
  isSquadCall: boolean;
  channelName?: string;
  channelImage?: string;
}

interface StreamVideoContextValue {
  videoClient: StreamVideoClient | null;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  activeCall: Call | null;
  setActiveCall: (call: Call | null) => void;
  incomingCallData: IncomingCallData | null;
  setIncomingCallData: (data: IncomingCallData | null) => void;
}

const StreamVideoContext = createContext<StreamVideoContextValue>({
  videoClient: null,
  isConnecting: false,
  isConnected: false,
  error: null,
  activeCall: null,
  setActiveCall: () => {},
  incomingCallData: null,
  setIncomingCallData: () => {},
});

// Global singleton to persist across re-renders and navigation
let globalVideoClient: StreamVideoClient | null = null;
let globalConnectionPromise: Promise<StreamVideoClient | null> | null = null;
let globalConnectedUserId: string | null = null;

// Track call start times for calculating duration
const callStartTimes = new Map<string, number>();

/**
 * Record when a call starts
 */
export function recordCallStart(callId: string) {
  callStartTimes.set(callId, Date.now());
}

/**
 * Get the call start time and remove it from tracking
 */
export function getCallStartTime(callId: string): number | undefined {
  const startTime = callStartTimes.get(callId);
  callStartTimes.delete(callId);
  return startTime;
}

interface StreamVideoProviderProps {
  children: ReactNode;
}

/**
 * Global Stream Video Provider
 * 
 * Initializes Stream Video connection once at app level and shares it across all consumers.
 * Uses the same API key as Stream Chat (unified Stream SDK).
 */
export function StreamVideoProvider({ children }: StreamVideoProviderProps) {
  const { user, isLoaded } = useUser();
  const [videoClient, setVideoClient] = useState<StreamVideoClient | null>(globalVideoClient);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(!!globalVideoClient);
  const [error, setError] = useState<string | null>(null);
  const [activeCall, setActiveCallState] = useState<Call | null>(null);
  const [incomingCallData, setIncomingCallData] = useState<IncomingCallData | null>(null);
  const initializingRef = useRef(false);

  // Wrapper to handle activeCall state and listen for call end events
  const setActiveCall = useCallback((call: Call | null) => {
    setActiveCallState(call);
  }, []);

  const initializeClient = useCallback(async (userId: string, userData: { firstName?: string | null; lastName?: string | null; imageUrl?: string }) => {
    // If already connected with this user, return existing client
    if (globalVideoClient && globalConnectedUserId === userId) {
      return globalVideoClient;
    }

    // If there's an ongoing connection for this user, wait for it
    if (globalConnectionPromise && globalConnectedUserId === userId) {
      return globalConnectionPromise;
    }

    // Start new connection
    globalConnectedUserId = userId;
    globalConnectionPromise = (async () => {
      try {
        // Dynamic import to reduce initial bundle size
        const { StreamVideoClient: VideoClient } = await import('@stream-io/video-react-sdk');
        
        // Get API key and token
        const response = await fetch('/api/stream-video-token');
        if (!response.ok) {
          throw new Error('Failed to fetch Stream Video token');
        }

        const data = await response.json();

        // Token may be null during auth transitions - return null instead of throwing
        if (!data.token || !data.apiKey) {
          globalConnectionPromise = null;
          globalConnectedUserId = null;
          return null;
        }

        // Create video client
        const client = new VideoClient({
          apiKey: data.apiKey,
          user: {
            id: userId,
            name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'User',
            image: userData.imageUrl,
          },
          token: data.token,
        });

        globalVideoClient = client;
        return client;
      } catch (err) {
        console.error('[StreamVideoContext] Connection error:', err);
        globalVideoClient = null;
        globalConnectionPromise = null;
        globalConnectedUserId = null;
        throw err;
      }
    })();

    return globalConnectionPromise;
  }, []);

  useEffect(() => {
    // Don't initialize until Clerk is loaded
    if (!isLoaded) return;

    // No user = no connection needed
    if (!user) {
      // If there was a client, disconnect it
      if (globalVideoClient) {
        globalVideoClient.disconnectUser().catch(console.error);
        globalVideoClient = null;
        globalConnectionPromise = null;
        globalConnectedUserId = null;
      }
      setVideoClient(null);
      setIsConnected(false);
      return;
    }

    // Prevent duplicate initialization
    if (initializingRef.current) return;
    
    // If already connected with this user, just update state
    if (globalVideoClient && globalConnectedUserId === user.id) {
      setVideoClient(globalVideoClient);
      setIsConnected(true);
      return;
    }

    initializingRef.current = true;
    setIsConnecting(true);
    setError(null);

    initializeClient(user.id, {
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl,
    })
      .then((connectedClient) => {
        if (connectedClient) {
          setVideoClient(connectedClient);
          setIsConnected(true);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Connection failed');
        setIsConnected(false);
      })
      .finally(() => {
        setIsConnecting(false);
        initializingRef.current = false;
      });
  }, [user, isLoaded, initializeClient]);

  // Listen for incoming calls
  useEffect(() => {
    if (!videoClient) return;

    // The call.ring event provides a CallRingEvent with a CallResponse (not a full Call instance)
    const handleIncomingCall = (event: { call: { id: string; type: string; created_by?: { id?: string; name?: string; image?: string }; custom?: Record<string, unknown> } }) => {
      // Only show incoming call if not already in a call
      if (!activeCall) {
        try {
          const callResponse = event.call;
          const customData = callResponse.custom || {};
          
          // Extract caller info from the call response
          const createdBy = callResponse.created_by;
          const callerName = createdBy?.name || createdBy?.id || 'Someone';
          const callerImage = createdBy?.image;
          
          // Check if it's a video call from custom data
          const isVideo = customData.isVideoCall === true;
          
          // Check if it's a squad call
          const isSquadCall = customData.isSquadChannel === true;
          const channelName = customData.channelName as string | undefined;
          const channelImage = customData.channelImage as string | undefined;
          
          // Store the metadata, not the call object itself
          setIncomingCallData({
            callId: callResponse.id,
            callType: callResponse.type,
            callerName,
            callerImage,
            isVideo,
            isSquadCall,
            channelName,
            channelImage,
          });
        } catch (error) {
          console.error('Error extracting incoming call info:', error);
        }
      }
    };

    // Subscribe to ring events - use type assertion since the SDK types are more specific
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unsubscribe = videoClient.on('call.ring', handleIncomingCall as any);

    return () => {
      unsubscribe?.();
    };
  }, [videoClient, activeCall]);

  // Listen for call end events to clear activeCall
  useEffect(() => {
    if (!activeCall) return;

    const handleCallEnded = () => {
      console.log('[StreamVideoContext] Call ended, clearing activeCall');
      setActiveCallState(null);
    };

    // Listen for various call end events
    const unsubscribeEnded = activeCall.on('call.ended', handleCallEnded);
    const unsubscribeSessionEnded = activeCall.on('call.session_ended', handleCallEnded);
    
    // Also subscribe to calling state changes via the call's state observable
    const stateSubscription = activeCall.state.callingState$.subscribe((state) => {
      // Import CallingState dynamically to check the state
      import('@stream-io/video-react-sdk').then(({ CallingState }) => {
        if (state === CallingState.LEFT || state === CallingState.IDLE) {
          console.log('[StreamVideoContext] CallingState changed to:', state);
          setActiveCallState(null);
        }
      });
    });

    return () => {
      unsubscribeEnded?.();
      unsubscribeSessionEnded?.();
      stateSubscription?.unsubscribe();
    };
  }, [activeCall]);

  return (
    <StreamVideoContext.Provider value={{ 
      videoClient, 
      isConnecting, 
      isConnected, 
      error,
      activeCall,
      setActiveCall,
      incomingCallData,
      setIncomingCallData,
    }}>
      {children}
    </StreamVideoContext.Provider>
  );
}

/**
 * Hook to access the shared Stream Video client
 */
export function useStreamVideoClient() {
  const context = useContext(StreamVideoContext);
  if (context === undefined) {
    throw new Error('useStreamVideoClient must be used within a StreamVideoProvider');
  }
  return context;
}

/**
 * Get the global video client directly (for use outside of React components)
 * Warning: This may return null if not yet connected
 */
export function getGlobalStreamVideoClient() {
  return globalVideoClient;
}

