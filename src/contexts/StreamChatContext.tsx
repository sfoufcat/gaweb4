'use client';

import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useUser } from '@clerk/nextjs';
import type { StreamChat as StreamChatType } from 'stream-chat';

interface StreamChatContextValue {
  client: StreamChatType | null;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
}

const StreamChatContext = createContext<StreamChatContextValue>({
  client: null,
  isConnecting: false,
  isConnected: false,
  error: null,
});

// Global singleton to persist across re-renders and navigation
let globalClient: StreamChatType | null = null;
let globalConnectionPromise: Promise<StreamChatType | null> | null = null;
let globalConnectedUserId: string | null = null;

// OPTIMIZATION: Preload stream-chat module immediately when this context loads
// This ensures the module is cached before we need it for connection
if (typeof window !== 'undefined') {
  import('stream-chat').catch(() => {
    // Silently ignore preload errors - we'll handle them during actual connection
  });
}

interface StreamChatProviderProps {
  children: ReactNode;
}

/**
 * Global Stream Chat Provider
 * 
 * Initializes Stream Chat connection once at app level and shares it across all consumers.
 * This eliminates the duplicate connections that were happening between:
 * - useChatUnreadCounts (Sidebar)
 * - Chat page
 * 
 * The connection starts immediately when user is authenticated, so when they
 * navigate to /chat, the client is already connected and ready.
 */
export function StreamChatProvider({ children }: StreamChatProviderProps) {
  const { user, isLoaded } = useUser();
  const [client, setClient] = useState<StreamChatType | null>(globalClient);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(!!globalClient?.user);
  const [error, setError] = useState<string | null>(null);
  const initializingRef = useRef(false);

  const initializeClient = useCallback(async (userId: string, userData: { firstName?: string | null; lastName?: string | null; imageUrl?: string }) => {
    const expectedName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'User';
    const expectedImage = userData.imageUrl;
    
    // If already connected with this user, check if profile needs update
    if (globalClient?.user && globalConnectedUserId === userId) {
      const currentUser = globalClient.user;
      
      // Check if Clerk profile data has changed since connection
      if (currentUser.name !== expectedName || currentUser.image !== expectedImage) {
        console.log('[StreamChatContext] Profile changed, updating Stream user...', {
          oldName: currentUser.name,
          newName: expectedName,
          oldImage: currentUser.image?.substring(0, 50),
          newImage: expectedImage?.substring(0, 50),
        });
        
        // Update the user profile in Stream
        try {
          await globalClient.upsertUser({
            id: userId,
            name: expectedName,
            image: expectedImage,
          });
          
          // Also update the local user object in the client
          await globalClient.partialUpdateUser({
            id: userId,
            set: {
              name: expectedName,
              image: expectedImage,
            },
          });
          console.log('[StreamChatContext] Profile updated successfully');
        } catch (err) {
          console.error('[StreamChatContext] Failed to update profile:', err);
        }
      }
      
      return globalClient;
    }

    // If there's an ongoing connection for this user, wait for it
    if (globalConnectionPromise && globalConnectedUserId === userId) {
      return globalConnectionPromise;
    }

    // Start new connection
    globalConnectedUserId = userId;
    globalConnectionPromise = (async () => {
      try {
        // Get API key early (sync)
        const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
        if (!apiKey) {
          throw new Error('Stream API key not found');
        }

        // OPTIMIZATION: Parallelize module import and token fetch
        // On fresh load, we need both - fetching in parallel saves ~100-300ms
        const tokenPromise = fetch('/api/stream-token').then(async (response) => {
          if (!response.ok) throw new Error('Failed to fetch Stream token');
          const data = await response.json();
          if (!data.token) throw new Error('Invalid token response');
          return data.token as string;
        });

        // Dynamic import runs in parallel with token fetch
        const { StreamChat } = await import('stream-chat');

        // Get or create client instance
        const chatClient = StreamChat.getInstance(apiKey);

        // If client is already connected with different user, disconnect first
        if (chatClient.user && chatClient.user.id !== userId) {
          await chatClient.disconnectUser();
        }

        // Check if connection is actually healthy (not just user exists)
        // The SDK singleton might have stale user data after page refresh
        const isConnectionHealthy = chatClient.user &&
          chatClient.wsConnection?.isHealthy === true;

        // If not connected or connection is unhealthy, connect now
        if (!chatClient.user || !isConnectionHealthy) {
          // Disconnect stale connection if it exists
          if (chatClient.user && !isConnectionHealthy) {
            try {
              await chatClient.disconnectUser();
            } catch {
              // Ignore disconnect errors for stale connections
            }
          }

          // Wait for token (already fetching in parallel)
          const token = await tokenPromise;

          // Connect user with profile data
          // The connectUser call sends our profile data to Stream
          await chatClient.connectUser(
            {
              id: userId,
              name: expectedName,
              image: expectedImage,
            },
            token
          );
          
          // Fire-and-forget: upsert user to ensure Stream's server-side
          // user record has the latest profile (doesn't block connection)
          chatClient.upsertUser({
            id: userId,
            name: expectedName,
            image: expectedImage,
          }).catch(() => {});
          
          // Fire-and-forget: Join global channels in background
          // This ensures user is a member of global channels without blocking
          fetch('/api/chat/join-global-channels', { method: 'POST' }).catch(() => {
            // Silently ignore - user might already be a member
          });
        } else {
          // Already connected - check if profile needs update
          const currentUser = chatClient.user;
          
          // Update Stream user if Clerk profile has changed
          if (currentUser && (currentUser.name !== expectedName || currentUser.image !== expectedImage)) {
            console.log('[StreamChatContext] Updating user profile in Stream...');
            await chatClient.upsertUser({
              id: userId,
              name: expectedName,
              image: expectedImage,
            });
          }
        }

        globalClient = chatClient;
        return chatClient;
      } catch (err) {
        console.error('[StreamChatContext] Connection error:', err);
        globalClient = null;
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
      if (globalClient) {
        globalClient.disconnectUser().catch(console.error);
        globalClient = null;
        globalConnectionPromise = null;
        globalConnectedUserId = null;
      }
      setClient(null);
      setIsConnected(false);
      return;
    }

    // Prevent duplicate initialization
    if (initializingRef.current) return;
    
    // If already connected with this user, just update state
    if (globalClient?.user && globalConnectedUserId === user.id) {
      setClient(globalClient);
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
          setClient(connectedClient);
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

  // Handle user logout - cleanup connection
  useEffect(() => {
    return () => {
      // Only disconnect if this was the last component using the context
      // In practice, the layout unmounting means the app is closing
    };
  }, []);

  return (
    <StreamChatContext.Provider value={{ client, isConnecting, isConnected, error }}>
      {children}
    </StreamChatContext.Provider>
  );
}

/**
 * Hook to access the shared Stream Chat client
 * 
 * Returns the globally shared client that was initialized at app level.
 * No duplicate connections - everyone gets the same client.
 */
export function useStreamChatClient() {
  const context = useContext(StreamChatContext);
  if (context === undefined) {
    throw new Error('useStreamChatClient must be used within a StreamChatProvider');
  }
  return context;
}

/**
 * Get the global client directly (for use outside of React components)
 * Warning: This may return null if not yet connected
 */
export function getGlobalStreamClient() {
  return globalClient;
}

