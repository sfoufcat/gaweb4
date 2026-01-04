// Server-side Stream Chat utilities
// Using dynamic imports to reduce server bundle size
import type { StreamChat } from 'stream-chat';

let streamClient: StreamChat | null = null;

// System bot user ID - used for automated messages
export const SYSTEM_BOT_USER_ID = 'coachful-bot';

// Initialize Stream Chat client (server-side)
export const getStreamServerClient = async () => {
  if (!streamClient) {
    // Dynamically import only when needed
    const { StreamChat } = await import('stream-chat');
    
    const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new Error('Stream API key and secret must be defined');
    }

    streamClient = StreamChat.getInstance(apiKey, apiSecret);
  }

  return streamClient;
};

// Generate Stream user token (server-side only)
export const generateStreamToken = async (userId: string) => {
  const client = await getStreamServerClient();
  return client.createToken(userId);
};

/**
 * Sync a user's profile to Stream Chat.
 * This ensures their name and avatar are up-to-date across all channels.
 * 
 * @param userId - The user's ID
 * @param profile - Profile data to sync
 */
export const syncUserToStream = async (
  userId: string,
  profile: {
    name?: string;
    firstName?: string;
    lastName?: string;
    imageUrl?: string;
    avatarUrl?: string;
  }
) => {
  try {
    const client = await getStreamServerClient();
    
    // Build display name: prefer explicit name, fallback to firstName + lastName
    const displayName = profile.name 
      || `${profile.firstName || ''} ${profile.lastName || ''}`.trim() 
      || 'User';
    
    // Prefer avatarUrl (Firebase), fallback to imageUrl (Clerk)
    const imageUrl = profile.avatarUrl || profile.imageUrl || undefined;
    
    await client.upsertUser({
      id: userId,
      name: displayName,
      image: imageUrl,
    });
    
    console.log('[STREAM] Synced user profile:', userId, { name: displayName, hasImage: !!imageUrl });
    return true;
  } catch (error) {
    console.error('[STREAM] Failed to sync user profile:', userId, error);
    return false;
  }
};

/**
 * Ensures the Coachful system bot user exists in Stream.
 * This user is used for sending automated notifications like
 * morning check-in updates.
 */
export const ensureSystemBotUser = async (client: StreamChat) => {
  try {
    // Check if user already exists
    const { users } = await client.queryUsers({ id: SYSTEM_BOT_USER_ID });
    
    if (users.length === 0) {
      // Create the bot user - use type assertion for custom fields
      await client.upsertUser({
        id: SYSTEM_BOT_USER_ID,
        name: 'Coachful Bot',
        // Use a placeholder image - you can replace with your logo URL
        image: 'https://api.dicebear.com/7.x/bottts/svg?seed=coachful&backgroundColor=a07855',
        role: 'admin', // Bots should have admin role to post anywhere
        is_bot: true,
      } as Parameters<typeof client.upsertUser>[0]);
      console.log('[STREAM] Created system bot user:', SYSTEM_BOT_USER_ID);
    }
  } catch (error) {
    console.error('[STREAM] Error ensuring bot user exists:', error);
    // Try to upsert anyway - might just be a query issue
    await client.upsertUser({
      id: SYSTEM_BOT_USER_ID,
      name: 'Coachful Bot',
      image: 'https://api.dicebear.com/7.x/bottts/svg?seed=coachful&backgroundColor=a07855',
      role: 'admin',
      is_bot: true,
    } as Parameters<typeof client.upsertUser>[0]);
  }
};
