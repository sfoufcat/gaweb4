/**
 * Chat utilities for client-side operations
 */

interface DMChannelResponse {
  channelId: string;
  channelType: string;
  cid: string;
}

/**
 * Opens or creates a direct message channel with another user.
 * 
 * @param otherUserId - The ID of the user to start a DM with
 * @returns The channel ID to navigate to
 * @throws Error if the request fails
 */
export async function openOrCreateDirectChat(otherUserId: string): Promise<string> {
  const response = await fetch('/api/chat/dm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ otherUserId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || 'Failed to create DM channel');
  }

  const data: DMChannelResponse = await response.json();
  return data.channelId;
}

