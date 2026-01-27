'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useUser } from '@clerk/nextjs';
import { connect, StreamClient } from 'getstream';

interface StreamFeedsContextValue {
  client: StreamClient | null;
  userToken: string | null;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
}

const StreamFeedsContext = createContext<StreamFeedsContextValue>({
  client: null,
  userToken: null,
  isConnecting: false,
  isConnected: false,
  error: null,
});

// Global singleton to persist across re-renders and navigation
let globalFeedsClient: StreamClient | null = null;
let globalFeedsToken: string | null = null;
let globalFeedsConnectionPromise: Promise<{ client: StreamClient; token: string } | null> | null = null;
let globalFeedsConnectedUserId: string | null = null;

interface StreamFeedsProviderProps {
  children: ReactNode;
}

/**
 * Global Stream Feeds Provider
 * 
 * Initializes Stream Activity Feeds connection once at app level and shares it across all consumers.
 * Works alongside StreamChatContext - they share the same API credentials but are separate clients.
 */
export function StreamFeedsProvider({ children }: StreamFeedsProviderProps) {
  const { user, isLoaded } = useUser();
  const [client, setClient] = useState<StreamClient | null>(globalFeedsClient);
  const [userToken, setUserToken] = useState<string | null>(globalFeedsToken);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(!!globalFeedsClient);
  const [error, setError] = useState<string | null>(null);

  const initializeClient = useCallback(async (userId: string) => {
    // If already connected with this user, return existing client
    if (globalFeedsClient && globalFeedsConnectedUserId === userId) {
      return { client: globalFeedsClient, token: globalFeedsToken! };
    }

    // If there's an ongoing connection for this user, wait for it
    if (globalFeedsConnectionPromise && globalFeedsConnectedUserId === userId) {
      return globalFeedsConnectionPromise;
    }

    // Start new connection
    globalFeedsConnectedUserId = userId;
    globalFeedsConnectionPromise = (async () => {
      try {
        // Fetch token from API
        const response = await fetch('/api/feed/token');
        if (!response.ok) {
          throw new Error('Failed to fetch Stream Feeds token');
        }

        const data = await response.json();

        // Token may be null during auth transitions - return null instead of throwing
        if (!data.token) {
          globalFeedsConnectionPromise = null;
          globalFeedsConnectedUserId = null;
          return null;
        }

        // Get API key
        const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
        if (!apiKey) {
          throw new Error('Stream API key not found');
        }

        // Create client with user token (client-side auth)
        const feedsClient = connect(apiKey, data.token, data.appId || undefined);

        globalFeedsClient = feedsClient;
        globalFeedsToken = data.token;
        
        return { client: feedsClient, token: data.token };
      } catch (err) {
        console.error('[StreamFeedsContext] Connection error:', err);
        globalFeedsClient = null;
        globalFeedsToken = null;
        globalFeedsConnectionPromise = null;
        globalFeedsConnectedUserId = null;
        throw err;
      }
    })();

    return globalFeedsConnectionPromise;
  }, []);

  useEffect(() => {
    // Don't initialize until Clerk is loaded
    if (!isLoaded) return;

    // No user = no connection needed
    if (!user) {
      globalFeedsClient = null;
      globalFeedsToken = null;
      globalFeedsConnectionPromise = null;
      globalFeedsConnectedUserId = null;
      setClient(null);
      setUserToken(null);
      setIsConnected(false);
      return;
    }

    // If already connected with this user, just update state
    if (globalFeedsClient && globalFeedsConnectedUserId === user.id) {
      setClient(globalFeedsClient);
      setUserToken(globalFeedsToken);
      setIsConnected(true);
      return;
    }

    setIsConnecting(true);
    setError(null);

    initializeClient(user.id)
      .then((result) => {
        if (result) {
          setClient(result.client);
          setUserToken(result.token);
          setIsConnected(true);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Connection failed');
        setIsConnected(false);
      })
      .finally(() => {
        setIsConnecting(false);
      });
  }, [user, isLoaded, initializeClient]);

  return (
    <StreamFeedsContext.Provider value={{ client, userToken, isConnecting, isConnected, error }}>
      {children}
    </StreamFeedsContext.Provider>
  );
}

/**
 * Hook to access the shared Stream Feeds client
 * 
 * Returns the globally shared client that was initialized at app level.
 */
export function useStreamFeeds() {
  const context = useContext(StreamFeedsContext);
  if (context === undefined) {
    throw new Error('useStreamFeeds must be used within a StreamFeedsProvider');
  }
  return context;
}

/**
 * Get the global feeds client directly (for use outside of React components)
 * Warning: This may return null if not yet connected
 */
export function getGlobalFeedsClient() {
  return globalFeedsClient;
}

