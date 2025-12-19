'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { StreamChat, Channel as StreamChannel } from 'stream-chat';
import { Chat, Channel, ChannelHeader, MessageInput, MessageList, Thread, Window } from 'stream-chat-react';
import 'stream-chat-react/dist/css/v2/index.css';

interface StreamChatProviderProps {
  children?: React.ReactNode;
}

export function StreamChatProvider({ children }: StreamChatProviderProps) {
  const { user, isLoaded } = useUser();
  const [client, setClient] = useState<StreamChat | null>(null);
  const [channel, setChannel] = useState<StreamChannel | null>(null);
  const clientRef = useRef<StreamChat | null>(null);

  useEffect(() => {
    if (!isLoaded || !user) return;

    let isMounted = true;

    const initChat = async () => {
      try {
        const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
        if (!apiKey) {
          console.error('Stream API key not found');
          return;
        }

        const chatClient = StreamChat.getInstance(apiKey);

        // Get token from our API
        const response = await fetch('/api/stream-token');
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(`Failed to get Stream token: ${errorData.error || response.statusText}`);
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

  if (!client) return <div>Loading chat...</div>;

  return (
    <Chat client={client}>
      {children}
    </Chat>
  );
}

