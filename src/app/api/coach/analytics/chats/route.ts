/**
 * Coach API: Chat Analytics
 * 
 * GET /api/coach/analytics/chats
 * 
 * Returns chat statistics for the coach's organization:
 * - Total channels, message counts
 * - Channels sorted by activity
 * - Message volume over time
 * 
 * Query params:
 *   - days: number of days to look back (default: 30, max: 90)
 * 
 * NOTE: Uses Stream Chat API to fetch channel and message statistics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { getStreamServerClient } from '@/lib/stream-server';
import type { Squad } from '@/types';

interface ChannelStats {
  channelId: string;
  channelType: string;
  name: string;
  squadId?: string;
  squadName?: string;
  memberCount: number;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string | null;
}

interface DailyChatStats {
  date: string;
  messageCount: number;
  activeChannels: number;
}

export async function GET(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { searchParams } = new URL(request.url);
    
    const days = Math.min(parseInt(searchParams.get('days') || '30', 10), 90);

    // Get all squads for this organization to map channels to squads
    const squadsSnapshot = await adminDb
      .collection('squads')
      .where('organizationId', '==', organizationId)
      .get();
    
    const squadMap = new Map<string, { name: string; chatChannelId?: string }>();
    const channelToSquadMap = new Map<string, { squadId: string; squadName: string }>();
    
    for (const doc of squadsSnapshot.docs) {
      const squad = { id: doc.id, ...doc.data() } as Squad;
      squadMap.set(doc.id, {
        name: squad.name,
        chatChannelId: squad.chatChannelId ?? undefined,
      });
      
      if (squad.chatChannelId) {
        channelToSquadMap.set(squad.chatChannelId, {
          squadId: doc.id,
          squadName: squad.name,
        });
      }
    }

    // Query Stream Chat for channels belonging to this organization
    let channels: ChannelStats[] = [];
    let totalMessages = 0;
    let hasError = false;
    let errorMessage = '';
    
    try {
      const streamClient = await getStreamServerClient();
      
      // Query channels that belong to this organization
      // Stream Chat stores organization info in channel custom data
      const orgIdClean = organizationId.replace('org_', '');
      
      // Query squad/group channels
      const channelsResponse = await streamClient.queryChannels(
        {
          $or: [
            // Squad chat channels
            { type: 'messaging', id: { $in: Array.from(channelToSquadMap.keys()).slice(0, 30) } },
            // Organization channels (use convention: org-{orgId}-*)
            { type: 'messaging', id: { $regex: `^org-${orgIdClean}` } },
          ],
        },
        { last_message_at: -1 },
        { limit: 50, state: true, watch: false }
      );

      // Process channels
      for (const channel of channelsResponse) {
        const channelId = channel.id || '';
        const squadInfo = channelToSquadMap.get(channelId);
        
        // Get message count from channel state
        const state = channel.state;
        const messageCount = state?.messages?.length || 0;
        
        channels.push({
          channelId,
          channelType: channel.type || 'messaging',
          name: (channel.data?.name as string) || squadInfo?.squadName || channelId,
          squadId: squadInfo?.squadId,
          squadName: squadInfo?.squadName,
          memberCount: Object.keys(state?.members || {}).length,
          messageCount,
          lastMessageAt: state?.last_message_at?.toISOString() || null,
          createdAt: channel.data?.created_at as string || null,
        });
        
        totalMessages += messageCount;
      }
    } catch (streamError) {
      console.warn('[CHAT_ANALYTICS] Stream Chat query error:', streamError);
      hasError = true;
      errorMessage = 'Could not fetch chat statistics from Stream. Some data may be unavailable.';
      
      // Fall back to using squad data for basic stats
      for (const [squadId, squad] of squadMap) {
        if (squad.chatChannelId) {
          channels.push({
            channelId: squad.chatChannelId,
            channelType: 'messaging',
            name: squad.name,
            squadId,
            squadName: squad.name,
            memberCount: 0,
            messageCount: 0,
            lastMessageAt: null,
            createdAt: null,
          });
        }
      }
    }

    // Sort channels by message count (most active first)
    channels.sort((a, b) => b.messageCount - a.messageCount);

    // Calculate date range stats
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    
    // Generate daily stats placeholder (would require more detailed Stream queries)
    const dailyStats: DailyChatStats[] = [];
    const today = new Date();
    
    for (let i = 0; i < Math.min(days, 30); i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Count channels with activity on this date
      const activeChannels = channels.filter(ch => {
        if (!ch.lastMessageAt) return false;
        return ch.lastMessageAt.split('T')[0] === dateStr;
      }).length;
      
      dailyStats.push({
        date: dateStr,
        messageCount: 0, // Would need detailed Stream query to get accurate count
        activeChannels,
      });
    }

    // Calculate summary statistics
    const activeChannels = channels.filter(ch => ch.messageCount > 0).length;
    const squadChannels = channels.filter(ch => ch.squadId).length;
    const avgMessagesPerChannel = channels.length > 0
      ? Math.round(totalMessages / channels.length)
      : 0;

    return NextResponse.json({
      summary: {
        totalChannels: channels.length,
        activeChannels,
        squadChannels,
        totalMessages,
        avgMessagesPerChannel,
      },
      channels: channels.slice(0, 30), // Top 30 channels
      dailyStats,
      period: {
        days,
        startDate: sinceDate.toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
      },
      ...(hasError && { warning: errorMessage }),
    });
  } catch (error) {
    console.error('[COACH_ANALYTICS_CHATS] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch chat analytics' }, { status: 500 });
  }
}

