'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import type { Channel as StreamChannel, Event as StreamEvent } from 'stream-chat';
import { useStreamChatClient } from '@/contexts/StreamChatContext';
import { useSquad } from '@/hooks/useSquad';
import {
  ANNOUNCEMENTS_CHANNEL_ID,
  SOCIAL_CORNER_CHANNEL_ID,
  SHARE_WINS_CHANNEL_ID,
} from '@/lib/chat-constants';

/**
 * Channel preview data for display in the chat list.
 * This interface mirrors the one in ChatSheet but is owned by this context.
 */
export interface ChannelPreview {
  id: string;
  name: string;
  image?: string;
  lastMessage?: string;
  lastMessageTime?: Date;
  unread: number;
  type: 'dm' | 'squad' | 'global' | 'coaching';
  channel: StreamChannel;
}

interface ChatChannelsContextValue {
  /** Pre-fetched channel previews */
  channels: ChannelPreview[];
  /** Set of org channel IDs for multi-tenancy filtering */
  orgChannelIds: Set<string>;
  /** Whether user is in platform mode (shows all org channels) */
  isPlatformMode: boolean;
  /** Whether initial fetch is in progress */
  isLoading: boolean;
  /** Whether the first fetch has completed (channels are ready) */
  isInitialized: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Manually trigger a refresh of channel data */
  refresh: () => Promise<void>;
  /** Update a single channel's preview data (for real-time updates) */
  updateChannelPreview: (channelId: string, updates: Partial<ChannelPreview>) => void;
}

const ChatChannelsContext = createContext<ChatChannelsContextValue | undefined>(undefined);

interface ChatChannelsProviderProps {
  children: ReactNode;
}

/**
 * ChatChannelsProvider
 *
 * Pre-fetches chat channel data after Stream Chat connects, making the
 * ChatSheet open instantly instead of waiting for data to load.
 *
 * This provider:
 * 1. Listens for Stream Chat connection
 * 2. Pre-fetches org channels + queries Stream channels after connection
 * 3. Stores processed ChannelPreview data
 * 4. Listens to Stream events to keep data fresh
 * 5. Exposes data to ChatSheet and other consumers
 */
export function ChatChannelsProvider({ children }: ChatChannelsProviderProps) {
  const { client, isConnected } = useStreamChatClient();
  const { squads, isLoading: isSquadLoading } = useSquad();

  // State
  const [channels, setChannels] = useState<ChannelPreview[]>([]);
  const [orgChannelIds, setOrgChannelIds] = useState<Set<string>>(new Set());
  const [isPlatformMode, setIsPlatformMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if we've already started fetching to avoid duplicate fetches
  const fetchingRef = useRef(false);
  const lastFetchTimeRef = useRef<number>(0);

  // Compute user's squad channel IDs for filtering
  const userSquadChannelIds = useMemo(() => {
    const ids = new Set<string>();
    for (const squad of squads) {
      if (squad.chatChannelId) {
        ids.add(squad.chatChannelId);
      }
    }
    return ids;
  }, [squads]);

  // Whether squad data has loaded (needed to avoid race condition in filtering)
  const squadChannelsLoaded = !isSquadLoading && squads.length >= 0;

  /**
   * Process a Stream channel into a ChannelPreview
   */
  const processChannel = useCallback(
    (
      channel: StreamChannel,
      orgIds: Set<string>,
      squadIds: Set<string>,
      platformMode: boolean,
      squadDataLoaded: boolean,
      clientUserId: string
    ): ChannelPreview | null => {
      const channelData = channel.data as Record<string, unknown>;
      const channelId = channel.id || '';

      // Determine channel type and name
      let type: ChannelPreview['type'] = 'dm';
      let name = (channelData?.name as string) || '';
      let image = channelData?.image as string | undefined;

      if (
        channelId === ANNOUNCEMENTS_CHANNEL_ID ||
        channelId.includes('-announcements')
      ) {
        type = 'global';
        name = name || 'Announcements';
      } else if (
        channelId === SOCIAL_CORNER_CHANNEL_ID ||
        channelId.includes('-social')
      ) {
        type = 'global';
        name = name || 'Social Corner';
      } else if (
        channelId === SHARE_WINS_CHANNEL_ID ||
        channelId.includes('-wins')
      ) {
        type = 'global';
        name = name || 'Share Wins';
      } else if (channelId.startsWith('org-')) {
        type = 'global';
        // Use the channel name from data
      } else if (channelId.startsWith('squad-')) {
        type = 'squad';
        name = name || 'Squad Chat';
      } else if (
        channelId.startsWith('coaching-') ||
        (name && name.toLowerCase().includes('coaching'))
      ) {
        type = 'coaching';
        // For coaching channels, show the OTHER member's name
        const members = Object.values(channel.state.members).filter((m) => m.user);
        const otherMember = members.find((m) => m.user?.id !== clientUserId);
        if (otherMember?.user) {
          name = otherMember.user.name || 'Coach';
          image = otherMember.user.image;
        } else {
          name = name || 'Coaching';
        }
      } else {
        // DM - get other member's info
        const members = Object.values(channel.state.members).filter((m) => m.user);
        const otherMember = members.find((m) => m.user?.id !== clientUserId);
        if (otherMember?.user) {
          name = otherMember.user.name || 'Chat';
          image = otherMember.user.image;

          // Fallback: Check if this is a coaching chat that was created as a DM
          if (
            name.toLowerCase().includes('coach') ||
            (channelData?.name as string)?.toLowerCase().includes('coaching')
          ) {
            type = 'coaching';
          }
        }
      }

      // MULTI-TENANCY: Filter out channels from other organizations
      if (!platformMode) {
        // Filter squad channels - only show ones in user's current org
        if (type === 'squad') {
          if (squadDataLoaded && !squadIds.has(channelId)) {
            return null; // Skip squad channels from other orgs
          }
        }

        // Filter org channels - only show current org
        if (channelId.startsWith('org-')) {
          if (!orgIds.has(channelId)) {
            return null; // Skip org channels from other orgs
          }
        }

        // Legacy global channel IDs
        if (
          channelId === ANNOUNCEMENTS_CHANNEL_ID ||
          channelId === SOCIAL_CORNER_CHANNEL_ID ||
          channelId === SHARE_WINS_CHANNEL_ID
        ) {
          if (orgIds.size > 0 && !orgIds.has(channelId)) {
            return null;
          }
        }
      }

      // Get last message
      const messages = channel.state.messages;
      const lastMsg = messages[messages.length - 1];

      return {
        id: channelId,
        name,
        image,
        lastMessage: lastMsg?.text,
        lastMessageTime: lastMsg?.created_at ? new Date(lastMsg.created_at) : undefined,
        unread: channel.countUnread(),
        type,
        channel,
      };
    },
    []
  );

  /**
   * Fetch org channel IDs for multi-tenancy filtering
   */
  const fetchOrgChannels = useCallback(async (): Promise<{
    channelIds: Set<string>;
    platformMode: boolean;
  }> => {
    try {
      const res = await fetch('/api/user/org-channels');
      if (!res.ok) {
        return { channelIds: new Set(), platformMode: false };
      }
      const data = await res.json();
      const channelIds = new Set<string>();
      if (data.channels) {
        for (const ch of data.channels) {
          if (ch.streamChannelId) {
            channelIds.add(ch.streamChannelId);
          }
        }
      }
      return {
        channelIds,
        platformMode: data.isPlatformMode || false,
      };
    } catch {
      return { channelIds: new Set(), platformMode: false };
    }
  }, []);

  /**
   * Main fetch function - queries channels and processes them
   */
  const fetchChannels = useCallback(async () => {
    if (!client || !client.user) {
      return;
    }

    // Prevent duplicate fetches within 1 second
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 1000) {
      return;
    }
    lastFetchTimeRef.current = now;

    if (fetchingRef.current) {
      return;
    }

    fetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // Fetch org channels and Stream channels in parallel
      const [orgData, channelResponse] = await Promise.all([
        fetchOrgChannels(),
        client.queryChannels(
          { members: { $in: [client.userID!] } },
          { last_message_at: -1 },
          { limit: 50, watch: true }
        ),
      ]);

      // Store org channel data
      setOrgChannelIds(orgData.channelIds);
      setIsPlatformMode(orgData.platformMode);

      // Process channels
      const previews: ChannelPreview[] = [];
      for (const channel of channelResponse) {
        const preview = processChannel(
          channel,
          orgData.channelIds,
          userSquadChannelIds,
          orgData.platformMode,
          squadChannelsLoaded,
          client.userID!
        );
        if (preview) {
          previews.push(preview);
        }
      }

      setChannels(previews);
      setIsInitialized(true);
    } catch (err) {
      console.error('[ChatChannelsContext] Failed to fetch channels:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch channels');
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [client, fetchOrgChannels, processChannel, userSquadChannelIds, squadChannelsLoaded]);

  /**
   * Update a single channel's preview (for real-time updates)
   */
  const updateChannelPreview = useCallback(
    (channelId: string, updates: Partial<ChannelPreview>) => {
      setChannels((prev) =>
        prev.map((ch) => (ch.id === channelId ? { ...ch, ...updates } : ch))
      );
    },
    []
  );

  /**
   * Handle real-time Stream events to keep channel data fresh
   */
  const handleChannelEvent = useCallback(
    (event: StreamEvent) => {
      if (!client?.userID) return;

      const channel = event.channel as StreamChannel | undefined;
      if (!channel?.id) return;

      // Find and update the affected channel
      setChannels((prev) => {
        const existingIndex = prev.findIndex((ch) => ch.id === channel.id);

        if (existingIndex === -1) {
          // New channel - reprocess if we have it
          const streamChannel = client.activeChannels[channel.cid!];
          if (streamChannel) {
            const preview = processChannel(
              streamChannel,
              orgChannelIds,
              userSquadChannelIds,
              isPlatformMode,
              squadChannelsLoaded,
              client.userID!
            );
            if (preview) {
              return [preview, ...prev];
            }
          }
          return prev;
        }

        // Update existing channel
        const existing = prev[existingIndex];
        const streamChannel = existing.channel;
        const messages = streamChannel.state.messages;
        const lastMsg = messages[messages.length - 1];

        const updated: ChannelPreview = {
          ...existing,
          lastMessage: lastMsg?.text,
          lastMessageTime: lastMsg?.created_at
            ? new Date(lastMsg.created_at)
            : existing.lastMessageTime,
          unread: streamChannel.countUnread(),
        };

        // Move to top if new message
        if (event.type === 'message.new') {
          const newChannels = [...prev];
          newChannels.splice(existingIndex, 1);
          return [updated, ...newChannels];
        }

        // Just update in place
        const newChannels = [...prev];
        newChannels[existingIndex] = updated;
        return newChannels;
      });
    },
    [
      client,
      orgChannelIds,
      userSquadChannelIds,
      isPlatformMode,
      squadChannelsLoaded,
      processChannel,
    ]
  );

  // Pre-fetch channels after Stream Chat connects
  useEffect(() => {
    // Need client to be connected and squad data loaded for proper filtering
    const actuallyConnected = !!(client?.user) || isConnected;
    if (!actuallyConnected || !client || !squadChannelsLoaded) {
      return;
    }

    // Fetch channels
    fetchChannels();
  }, [client, isConnected, squadChannelsLoaded, fetchChannels]);

  // Listen to Stream events for real-time updates
  useEffect(() => {
    if (!client) return;

    const eventTypes = [
      'message.new',
      'message.read',
      'message.updated',
      'message.deleted',
      'channel.updated',
      'notification.message_new',
      'notification.mark_read',
    ];

    const unsubscribe = client.on((event: StreamEvent) => {
      if (eventTypes.includes(event.type!)) {
        handleChannelEvent(event);
      }
    });

    return () => {
      unsubscribe.unsubscribe();
    };
  }, [client, handleChannelEvent]);

  // Re-fetch when squad data changes (user might have joined/left squads)
  useEffect(() => {
    if (isInitialized && squadChannelsLoaded && client?.user) {
      // Debounce to avoid excessive refetches
      const timer = setTimeout(() => {
        fetchChannels();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [userSquadChannelIds, isInitialized, squadChannelsLoaded, client, fetchChannels]);

  const value = useMemo(
    () => ({
      channels,
      orgChannelIds,
      isPlatformMode,
      isLoading,
      isInitialized,
      error,
      refresh: fetchChannels,
      updateChannelPreview,
    }),
    [
      channels,
      orgChannelIds,
      isPlatformMode,
      isLoading,
      isInitialized,
      error,
      fetchChannels,
      updateChannelPreview,
    ]
  );

  return (
    <ChatChannelsContext.Provider value={value}>
      {children}
    </ChatChannelsContext.Provider>
  );
}

/**
 * Hook to access pre-fetched chat channel data
 */
export function useChatChannels() {
  const context = useContext(ChatChannelsContext);
  if (context === undefined) {
    throw new Error('useChatChannels must be used within a ChatChannelsProvider');
  }
  return context;
}
