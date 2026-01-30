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

interface OrgFilterData {
  orgChannelIds: Set<string>;
  userSquadChannelIds: Set<string>;
  isPlatformMode: boolean;
  currentOrgId: string | null;
}

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
  
  // Org-specific channel filtering data
  const [orgFilterData, setOrgFilterData] = useState<OrgFilterData>({
    orgChannelIds: new Set(),
    userSquadChannelIds: new Set(),
    isPlatformMode: false,
    currentOrgId: null,
  });
  const orgFilterFetched = useRef(false);
  
  // Fetch org-specific channel filter data
  useEffect(() => {
    if (orgFilterFetched.current) return;
    orgFilterFetched.current = true;
    
    const fetchOrgFilterData = async () => {
      try {
        // Fetch org channels
        const orgRes = await fetch('/api/user/org-channels');
        const orgData = orgRes.ok ? await orgRes.json() : null;
        
        // Fetch user squads
        const squadRes = await fetch('/api/squad/me');
        const squadData = squadRes.ok ? await squadRes.json() : null;
        
        const orgChannelIds = new Set<string>();
        const userSquadChannelIds = new Set<string>();
        
        if (orgData?.channels) {
          for (const ch of orgData.channels) {
            if (ch.streamChannelId) {
              orgChannelIds.add(ch.streamChannelId);
            }
          }
        }
        
        if (squadData) {
          if (squadData.premiumSquad?.chatChannelId) {
            userSquadChannelIds.add(squadData.premiumSquad.chatChannelId);
          }
          if (squadData.standardSquad?.chatChannelId) {
            userSquadChannelIds.add(squadData.standardSquad.chatChannelId);
          }
          if (squadData.squads) {
            for (const s of squadData.squads) {
              if (s.chatChannelId) {
                userSquadChannelIds.add(s.chatChannelId);
              }
            }
          }
        }
        
        setOrgFilterData({
          orgChannelIds,
          userSquadChannelIds,
          isPlatformMode: orgData?.isPlatformMode || false,
          currentOrgId: orgData?.organizationId || null,
        });
      } catch (err) {
        console.warn('Failed to fetch org filter data:', err);
      }
    };
    
    fetchOrgFilterData();
  }, []);

  // Calculate unread counts from channels
  const calculateCounts = useCallback(() => {
    if (!client?.user) return;

    let totalUnread = 0;
    let mainUnread = 0;
    let directUnread = 0;

    const { orgChannelIds, userSquadChannelIds, isPlatformMode, currentOrgId } = orgFilterData;

    // Get all channels the user is a member of
    const channels = Object.values(client.activeChannels);
    
    for (const channel of channels) {
      const channelId = channel.id;
      
      // MULTI-TENANCY: Filter out channels from other organizations
      if (!isPlatformMode && channelId) {
        // Filter squad channels - only count ones in user's current org
        if (channelId.startsWith('squad-')) {
          if (!userSquadChannelIds.has(channelId)) {
            continue; // Skip squad channels from other orgs
          }
        }

        // Filter org channels - only count current org
        if (channelId.startsWith('org-')) {
          if (!orgChannelIds.has(channelId)) {
            continue; // Skip org channels from other orgs
          }
        }

        // Legacy global channel IDs
        if (channelId === ANNOUNCEMENTS_CHANNEL_ID ||
            channelId === SOCIAL_CORNER_CHANNEL_ID ||
            channelId === SHARE_WINS_CHANNEL_ID) {
          if (!orgChannelIds.has(channelId)) {
            continue;
          }
        }

        // Filter coaching channels - check organizationId in Stream channel data
        if (channelId.startsWith('coaching-')) {
          const channelOrgId = (channel.data as { organizationId?: string })?.organizationId;
          if (currentOrgId && channelOrgId && channelOrgId !== currentOrgId) {
            continue; // Skip coaching channels from other orgs
          }
        }
      }
      
      const unread = channel.countUnread();
      if (unread > 0) {
        totalUnread += unread;
        
        // Check if it's a "main" channel (squad, coaching, announcements, social corner, share wins)
        if (
          channelId === ANNOUNCEMENTS_CHANNEL_ID ||
          channelId === SOCIAL_CORNER_CHANNEL_ID ||
          channelId === SHARE_WINS_CHANNEL_ID ||
          channelId?.startsWith('squad-') ||
          channelId?.startsWith('coaching-') ||
          channelId?.startsWith('org-')
        ) {
          mainUnread += unread;
        } else {
          // It's a direct message channel
          directUnread += unread;
        }
      }
    }

    setCounts({ totalUnread, mainUnread, directUnread });
  }, [client, orgFilterData]);

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
        // Only watch if not already initialized
        if (!client.activeChannels[cid]?.initialized) {
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
        const cid = `${event.channel_type}:${event.channel_id}`;
        // Only watch if not already in activeChannels
        if (!client.activeChannels[cid]?.initialized) {
          try {
            const channel = client.channel(event.channel_type, event.channel_id);
            await channel.watch();
          } catch (err) {
            console.warn('Failed to watch new channel:', err);
          }
        }
      }
      setTimeout(() => calculateCounts(), 100);
    };

    const handleChannelUpdated = () => {
      // When a channel is updated, recalculate
      calculateCounts();
    };

    const handleRemovedFromChannel = (event: Event) => {
      // When user is removed from a channel, remove it from activeChannels and recalculate
      if (event.channel_id && event.channel_type) {
        const cid = `${event.channel_type}:${event.channel_id}`;
        // The channel should be automatically removed from activeChannels by Stream SDK
        // but we force a recalculation to update the UI immediately
        setTimeout(() => calculateCounts(), 100);
        console.log(`[useChatUnreadCounts] Removed from channel: ${cid}`);
      }
    };

    // Subscribe to events
    client.on('message.new', handleNewMessage);
    client.on('message.read', handleMessageRead);
    client.on('notification.mark_read', handleNotificationMarkRead);
    client.on('notification.message_new', handleNewMessage);
    client.on('channel.visible', handleChannelVisible);
    client.on('notification.added_to_channel', handleAddedToChannel);
    client.on('notification.removed_from_channel', handleRemovedFromChannel);
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
      client.off('notification.removed_from_channel', handleRemovedFromChannel);
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
