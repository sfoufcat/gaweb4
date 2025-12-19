import { useState, useEffect, useCallback, useRef } from 'react';
import { Event } from 'stream-chat';
import { useStreamChatClient } from '@/contexts/StreamChatContext';
import { ANNOUNCEMENTS_CHANNEL_ID, SOCIAL_CORNER_CHANNEL_ID, SHARE_WINS_CHANNEL_ID } from '@/lib/chat-constants';

interface UnreadCounts {
  totalUnread: number;
  mainUnread: number;  // Squad + Announcements + Social Corner + Share Wins
  directUnread: number; // All DM channels
}

// Global channels that should always be watched
const GLOBAL_CHANNEL_IDS = [ANNOUNCEMENTS_CHANNEL_ID, SOCIAL_CORNER_CHANNEL_ID, SHARE_WINS_CHANNEL_ID];

/**
 * Hook to track chat unread counts across different channel types
 * 
 * OPTIMIZED: Uses the shared Stream Chat client from global context.
 * No duplicate connections - uses the same client as the chat page.
 * 
 * Categorizes unread counts into:
 * - mainUnread: Squad channels, Announcements, Social Corner
 * - directUnread: Direct message channels
 * - totalUnread: All channels combined
 */
export function useChatUnreadCounts() {
  const { client, isConnected } = useStreamChatClient();
  const [counts, setCounts] = useState<UnreadCounts>({
    totalUnread: 0,
    mainUnread: 0,
    directUnread: 0,
  });
  const [hasInitialized, setHasInitialized] = useState(false);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate unread counts from channels
  const calculateCounts = useCallback(() => {
    if (!client?.user) return;

    let totalUnread = 0;
    let mainUnread = 0;
    let directUnread = 0;

    // Get all channels the user is a member of
    const channels = Object.values(client.activeChannels);
    
    for (const channel of channels) {
      const unread = channel.countUnread();
      if (unread > 0) {
        totalUnread += unread;
        
        const channelId = channel.id;
        // Check if it's a "main" channel (squad, coaching, announcements, social corner, share wins)
        if (
          channelId === ANNOUNCEMENTS_CHANNEL_ID ||
          channelId === SOCIAL_CORNER_CHANNEL_ID ||
          channelId === SHARE_WINS_CHANNEL_ID ||
          channelId?.startsWith('squad-') ||
          channelId?.startsWith('coaching-')
        ) {
          mainUnread += unread;
        } else {
          // It's a direct message channel
          directUnread += unread;
        }
      }
    }

    setCounts({ totalUnread, mainUnread, directUnread });
  }, [client]);

  // Initialize and query channels when client is connected
  useEffect(() => {
    if (!client || !isConnected || hasInitialized) return;

    const initializeChannels = async () => {
      try {
        // Query user's channels to populate activeChannels
        await client.queryChannels(
          { type: 'messaging', members: { $in: [client.user!.id] } },
          [{ last_message_at: -1 }],
          { limit: 30, state: true, watch: true }
        );
        
        // Explicitly watch global channels (Announcements, Social Corner)
        // These might not be in the user's member list initially
        for (const channelId of GLOBAL_CHANNEL_IDS) {
          try {
            const globalChannel = client.channel('messaging', channelId);
            await globalChannel.watch();
          } catch (err) {
            // Channel might not exist or user might not have access - that's ok
            console.debug(`Could not watch global channel ${channelId}:`, err);
          }
        }
        
        setHasInitialized(true);
        calculateCounts();
      } catch (error) {
        console.error('Failed to initialize chat channels:', error);
      }
    };

    initializeChannels();
  }, [client, isConnected, hasInitialized, calculateCounts]);

  // Listen for message events to update counts
  useEffect(() => {
    if (!client || !isConnected) return;

    const handleNewMessage = async (event: Event) => {
      // If we receive a notification for a channel we don't have locally, watch it
      if (event.channel_id && event.channel_type) {
        const cid = `${event.channel_type}:${event.channel_id}`;
        if (!client.activeChannels[cid]) {
          try {
            const channel = client.channel(event.channel_type, event.channel_id);
            await channel.watch();
          } catch (err) {
            console.warn('Failed to watch channel from notification:', err);
          }
        }
      }
      // Recalculate counts when a new message arrives
      calculateCounts();
    };

    const handleMessageRead = () => {
      // Recalculate counts when messages are marked as read
      calculateCounts();
    };

    const handleNotificationMarkRead = () => {
      calculateCounts();
    };

    const handleChannelVisible = () => {
      // When a channel becomes visible, recalculate
      setTimeout(() => calculateCounts(), 100);
    };

    const handleAddedToChannel = async (event: Event) => {
      // When user is added to a new channel, ensure we watch it then recalculate
      if (event.channel_id && event.channel_type) {
        try {
          const channel = client.channel(event.channel_type, event.channel_id);
          await channel.watch();
        } catch (err) {
          console.warn('Failed to watch new channel:', err);
        }
      }
      setTimeout(() => calculateCounts(), 100);
    };

    const handleChannelUpdated = () => {
      // When a channel is updated, recalculate
      calculateCounts();
    };

    // Subscribe to events
    client.on('message.new', handleNewMessage);
    client.on('message.read', handleMessageRead);
    client.on('notification.mark_read', handleNotificationMarkRead);
    client.on('notification.message_new', handleNewMessage);
    client.on('channel.visible', handleChannelVisible);
    client.on('notification.added_to_channel', handleAddedToChannel);
    client.on('channel.updated', handleChannelUpdated);

    // Periodic refresh as fallback (every 30 seconds)
    // This is lightweight - just reads from cached channel data
    refreshIntervalRef.current = setInterval(() => {
      calculateCounts();
    }, 30000);

    return () => {
      client.off('message.new', handleNewMessage);
      client.off('message.read', handleMessageRead);
      client.off('notification.mark_read', handleNotificationMarkRead);
      client.off('notification.message_new', handleNewMessage);
      client.off('channel.visible', handleChannelVisible);
      client.off('notification.added_to_channel', handleAddedToChannel);
      client.off('channel.updated', handleChannelUpdated);
      
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [client, isConnected, calculateCounts]);

  return {
    ...counts,
    isConnected,
    refresh: () => calculateCounts(),
  };
}
