'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { StreamChat } from 'stream-chat';

export function useStreamChat() {
  const { user, isLoaded } = useUser();
  const [client, setClient] = useState<StreamChat | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const clientRef = useRef<StreamChat | null>(null);

  useEffect(() => {
    if (!isLoaded || !user) return;

    let isMounted = true;

    const initChat = async () => {
      setIsConnecting(true);
      try {
        const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
        if (!apiKey) {
          throw new Error('Stream API key not found');
        }

        const chatClient = StreamChat.getInstance(apiKey);

        // Get token from our API
        const response = await fetch('/api/stream-token');
        if (!response.ok) {
          throw new Error('Failed to get Stream token');
        }
        
        const data = await response.json();
        const { token } = data;
        
        // Validate token exists
        if (!token) {
          throw new Error('No token received from API');
        }

        // Connect user
        await chatClient.connectUser(
          {
            id: user.id,
            name: `${user.firstName} ${user.lastName}`.trim() || user.id,
            image: user.imageUrl,
          },
          token
        );

        // Only update state if component is still mounted
        if (isMounted) {
          clientRef.current = chatClient;
          setClient(chatClient);
        } else {
          // Component unmounted during connection, cleanup immediately
          chatClient.disconnectUser().catch(console.error);
        }
      } catch (error) {
        console.error('Error initializing Stream Chat:', error);
      } finally {
        if (isMounted) {
          setIsConnecting(false);
        }
      }
    };

    initChat();

    return () => {
      isMounted = false;
      // Use ref to get the current client instance
      if (clientRef.current) {
        clientRef.current.disconnectUser().catch(console.error);
        clientRef.current = null;
        setClient(null);
      }
    };
  }, [user, isLoaded]);

  return { client, isConnecting };
}

