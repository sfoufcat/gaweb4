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
import {
  getCachedChannels,
  setCachedChannels,
  clearUserChannelCache,
  type CachedChannelPreview,
} from '@/lib/chat-cache';

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
  /** Stream channel object - may be null for cached previews */
  channel: StreamChannel | null;
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
  /** SSR-provided org channel IDs for instant filtering */
  initialOrgChannelIds?: string[];
  /** SSR-provided squad channel IDs for instant filtering */
  initialSquadChannelIds?: string[];
  /** SSR-provided platform mode flag */
  initialIsPlatformMode?: boolean;
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
export function ChatChannelsProvider({
  children,
  initialOrgChannelIds,
  initialSquadChannelIds,
  initialIsPlatformMode,
}: ChatChannelsProviderProps) {
  const { client, isConnected } = useStreamChatClient();
  const { squads, isLoading: isSquadLoading } = useSquad();

  // State - use SSR data for instant filtering (no flash of wrong channels)
  const [channels, setChannels] = useState<ChannelPreview[]>([]);
  const [orgChannelIds, setOrgChannelIds] = useState<Set<string>>(
    () => new Set(initialOrgChannelIds || [])
  );
  const [isPlatformMode, setIsPlatformMode] = useState(
    initialIsPlatformMode ?? false
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if we've already started fetching to avoid duplicate fetches
  const fetchingRef = useRef(false);
  const lastFetchTimeRef = useRef<number>(0);

  // Track if cache was loaded to prevent infinite loop
  const cacheLoadedRef = useRef(false);

  // Ref for fetchChannels to avoid circular dependency in effects
  const fetchChannelsRef = useRef<() => Promise<void>>(() => Promise.resolve());

  // SSR squad channel IDs - ready immediately for filtering
  const ssrSquadChannelIds = useMemo(
    () => new Set(initialSquadChannelIds || []),
    [initialSquadChannelIds]
  );

  // Merge SSR squad IDs with client-side squad hook (for real-time updates)
  const userSquadChannelIds = useMemo(() => {
    const ids = new Set(ssrSquadChannelIds); // Start with SSR data
    for (const squad of squads) {
      if (squad.chatChannelId) {
        ids.add(squad.chatChannelId);
      }
    }
    return ids;
  }, [squads, ssrSquadChannelIds]);

  // Whether squad data has loaded (for re-filtering after client data arrives)
  const squadChannelsLoaded = !isSquadLoading && squads.length >= 0;

  // Whether we have SSR filter data (for immediate filtering)
  const hasSSRFilterData = (initialOrgChannelIds?.length ?? 0) > 0 || (initialSquadChannelIds?.length ?? 0) > 0;

  // Track previous user ID to detect user changes
  const prevUserIdRef = useRef<string | null>(null);

  // Load cached channels immediately on mount for instant display
  // IMPORTANT: Do NOT include 'channels' or 'isInitialized' in deps to avoid infinite loop
  useEffect(() => {
    const userId = client?.userID;
    if (!userId) return;

    // Detect user change and reset cache tracking
    if (prevUserIdRef.current && prevUserIdRef.current !== userId) {
      clearUserChannelCache(prevUserIdRef.current);
      cacheLoadedRef.current = false;
      setChannels([]);
      setIsInitialized(false);
    }
    prevUserIdRef.current = userId;

    // Skip if we already loaded cache for this user
    if (cacheLoadedRef.current) return;

    // Load from cache for instant display
    const cached = getCachedChannels(userId);
    if (cached && cached.length > 0) {
      cacheLoadedRef.current = true; // Mark as loaded BEFORE setState
      // Convert cached previews to ChannelPreview (with null channel)
      const cachedPreviews: ChannelPreview[] = cached.map((c: CachedChannelPreview) => ({
        id: c.id,
        name: c.name,
        image: c.image,
        lastMessage: c.lastMessage,
        lastMessageTime: c.lastMessageTime ? new Date(c.lastMessageTime) : undefined,
        unread: c.unread,
        type: c.type,
        channel: null, // No channel object for cached data
      }));
      setChannels(cachedPreviews);
      setIsInitialized(true); // Show channels immediately!
    }
  }, [client?.userID]); // Removed isInitialized and channels to prevent infinite loop

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
      // Use SSR data if available, otherwise fetch org channels
      // This skips the client-side fetch when we have SSR data
      const orgDataPromise = hasSSRFilterData
        ? Promise.resolve({ channelIds: orgChannelIds, platformMode: isPlatformMode })
        : fetchOrgChannels();

      // Fetch org channels (or use SSR) and Stream channels in parallel
      // OPTIMIZATION: Reduced limit from 50 to 20, added state: false for faster query
      const [orgData, channelResponse] = await Promise.all([
        orgDataPromise,
        client.queryChannels(
          { members: { $in: [client.userID!] } },
          { last_message_at: -1 },
          { limit: 20, watch: true, state: false }
        ),
      ]);

      // Store org channel data (updates state if fetched fresh)
      if (!hasSSRFilterData) {
        setOrgChannelIds(orgData.channelIds);
        setIsPlatformMode(orgData.platformMode);
      }

      // Process channels using current filter data (SSR or fetched)
      const filterOrgIds = hasSSRFilterData ? orgChannelIds : orgData.channelIds;
      const filterPlatformMode = hasSSRFilterData ? isPlatformMode : orgData.platformMode;

      const previews: ChannelPreview[] = [];
      for (const channel of channelResponse) {
        const preview = processChannel(
          channel,
          filterOrgIds,
          userSquadChannelIds,
          filterPlatformMode,
          true, // With SSR data, we always have squad filter data ready
          client.userID!
        );
        if (preview) {
          previews.push(preview);
        }
      }

      setChannels(previews);
      setIsInitialized(true);

      // Update cache with fresh data for next load
      if (client?.userID) {
        setCachedChannels(client.userID, previews);
      }
    } catch (err) {
      console.error('[ChatChannelsContext] Failed to fetch channels:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch channels');
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [client, fetchOrgChannels, processChannel, userSquadChannelIds, hasSSRFilterData, orgChannelIds, isPlatformMode]);

  // Keep ref updated for use in effects that shouldn't re-run when fetchChannels changes
  fetchChannelsRef.current = fetchChannels;

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

      // Handle channel deletion - remove from list
      if (event.type === 'channel.deleted') {
        setChannels((prev) => prev.filter((ch) => ch.id !== channel.id));
        // Clear cache so it rebuilds on next fetch
        if (client.userID) {
          clearUserChannelCache(client.userID);
        }
        return;
      }

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
              true, // With SSR data, we always have filter data ready
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

        // Skip update if channel is null (cached preview)
        if (!streamChannel) {
          return prev;
        }

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
      processChannel,
    ]
  );

  // Pre-fetch channels after Stream Chat connects
  // With SSR filter data, we don't need to wait for squad data - it's already available
  useEffect(() => {
    const actuallyConnected = !!(client?.user) || isConnected;

    // With SSR data: only wait for Stream connection
    // Without SSR data: also wait for squad data to load
    const canFetch = hasSSRFilterData
      ? actuallyConnected && client
      : actuallyConnected && client && squadChannelsLoaded;

    if (!canFetch) {
      return;
    }

    // Fetch channels
    fetchChannels();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- client?.user?.id triggers re-run when user connects
  }, [client, client?.user?.id, isConnected, squadChannelsLoaded, hasSSRFilterData, fetchChannels]);

  // Listen to Stream events for real-time updates
  useEffect(() => {
    if (!client) return;

    const eventTypes = [
      'message.new',
      'message.read',
      'message.updated',
      'message.deleted',
      'channel.updated',
      'channel.deleted',
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
  // Use fetchChannelsRef to avoid circular dependency (fetchChannels updates state it depends on)
  useEffect(() => {
    if (isInitialized && squadChannelsLoaded && client?.user) {
      // Debounce to avoid excessive refetches
      const timer = setTimeout(() => {
        fetchChannelsRef.current();
      }, 500);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- client?.user?.id triggers re-run when user connects; fetchChannels via ref
  }, [userSquadChannelIds, isInitialized, squadChannelsLoaded, client, client?.user?.id]);

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
