/**
 * Chat utilities for client-side operations
 */

interface DMChannelResponse {
  channelId: string;
  channelType: string;
  cid: string;
  isCoachingChannel?: boolean;
}

interface CoachingChannelResponse {
  channelId: string;
  channelType: string;
  cid: string;
  created: boolean;
}

interface CoachingChannelCheckResponse {
  exists: boolean;
  channelId: string | null;
}

/**
 * Opens or creates a direct message channel with another user.
 * 
 * IMPORTANT: If one of the users is a coach (org:admin), this will automatically
 * use or create a coaching channel instead of a regular DM. This ensures there's
 * only ONE consolidated chat between coach and client.
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

/**
 * Opens or creates a coaching chat channel with a client.
 * Use this when you KNOW this should be a coaching channel (e.g., from coach dashboard).
 * 
 * @param clientId - The client's user ID
 * @returns The coaching channel ID
 * @throws Error if the request fails
 */
export async function openOrCreateCoachingChat(clientId: string): Promise<string> {
  const response = await fetch('/api/chat/coaching', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || 'Failed to create coaching channel');
  }

  const data: CoachingChannelResponse = await response.json();
  return data.channelId;
}

/**
 * Checks if a coaching channel exists with a specific user.
 * 
 * @param clientId - The other user's ID (client if you're coach, coach if you're client)
 * @returns Object with exists flag and channelId if it exists
 */
export async function getExistingCoachingChannel(clientId: string): Promise<CoachingChannelCheckResponse> {
  const response = await fetch(`/api/chat/coaching?clientId=${encodeURIComponent(clientId)}`);

  if (!response.ok) {
    return { exists: false, channelId: null };
  }

  const data: CoachingChannelCheckResponse = await response.json();
  return data;
}

