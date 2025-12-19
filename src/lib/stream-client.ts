'use client';

import { StreamChat } from 'stream-chat';

let clientInstance: StreamChat | null = null;

export const getStreamClient = () => {
  if (!clientInstance) {
    const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
    
    if (!apiKey) {
      throw new Error('Stream API key must be defined');
    }

    clientInstance = StreamChat.getInstance(apiKey);
  }

  return clientInstance;
};

export const disconnectStreamClient = async () => {
  if (clientInstance) {
    await clientInstance.disconnectUser();
    clientInstance = null;
  }
};

