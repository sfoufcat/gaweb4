/**
 * Chat Channel Cache Utility
 *
 * Provides localStorage-based caching for chat channels to enable instant loading.
 * Channels are cached per user with a 24-hour TTL.
 */

// Cacheable version of ChannelPreview (without StreamChannel object)
export interface CachedChannelPreview {
  id: string;
  name: string;
  image?: string;
  icon?: string;
  lastMessage?: string;
  lastMessageTime?: string; // ISO string instead of Date
  unread: number;
  type: 'dm' | 'squad' | 'global' | 'coaching';
}

interface CachedChatData {
  channels: CachedChannelPreview[];
  timestamp: number;
  userId: string;
}

const CACHE_KEY_PREFIX = 'chat-channels-';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get cached channels for a user.
 * Returns null if no cache exists, cache is expired, or cache is for different user.
 */
export function getCachedChannels(userId: string): CachedChannelPreview[] | null {
  if (typeof window === 'undefined') return null;

  try {
    const key = `${CACHE_KEY_PREFIX}${userId}`;
    const cached = localStorage.getItem(key);

    if (!cached) return null;

    const data: CachedChatData = JSON.parse(cached);

    // Validate user ID matches
    if (data.userId !== userId) {
      localStorage.removeItem(key);
      return null;
    }

    // Check TTL
    if (Date.now() - data.timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }

    return data.channels;
  } catch (error) {
    console.error('[chat-cache] Failed to read cache:', error);
    return null;
  }
}

/**
 * Cache channels for a user.
 * Converts ChannelPreview to cacheable format (removes StreamChannel object).
 */
export function setCachedChannels(
  userId: string,
  channels: Array<{
    id: string;
    name: string;
    image?: string;
    icon?: string;
    lastMessage?: string;
    lastMessageTime?: Date;
    unread: number;
    type: 'dm' | 'squad' | 'global' | 'coaching';
  }>
): void {
  if (typeof window === 'undefined') return;

  try {
    const cacheableChannels: CachedChannelPreview[] = channels.map(ch => ({
      id: ch.id,
      name: ch.name,
      image: ch.image,
      icon: ch.icon,
      lastMessage: ch.lastMessage,
      lastMessageTime: ch.lastMessageTime?.toISOString(),
      unread: ch.unread,
      type: ch.type,
    }));

    const data: CachedChatData = {
      channels: cacheableChannels,
      timestamp: Date.now(),
      userId,
    };

    const key = `${CACHE_KEY_PREFIX}${userId}`;
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    // localStorage might be full or unavailable
    console.error('[chat-cache] Failed to write cache:', error);
  }
}

/**
 * Clear all channel caches.
 */
export function clearChannelCache(): void {
  if (typeof window === 'undefined') return;

  try {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.error('[chat-cache] Failed to clear cache:', error);
  }
}

/**
 * Clear channel cache for a specific user.
 */
export function clearUserChannelCache(userId: string): void {
  if (typeof window === 'undefined') return;

  try {
    const key = `${CACHE_KEY_PREFIX}${userId}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.error('[chat-cache] Failed to clear user cache:', error);
  }
}
