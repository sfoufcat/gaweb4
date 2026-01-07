/**
 * Server-side Chat Filter Data
 *
 * Provides SSR-fetched org channel IDs and squad channel IDs for instant
 * chat filtering without client-side fetches. This eliminates the delay
 * when opening the chat slideup.
 *
 * Used by: ChatChannelsContext (via layout.tsx SSR props)
 */

import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { getOrgChannels } from '@/lib/org-channels';

// ============================================================================
// TYPES
// ============================================================================

export interface ChatFilterData {
  orgChannelIds: string[];
  squadChannelIds: string[];
  isPlatformMode: boolean;
}

// ============================================================================
// MAIN SSR FUNCTION
// ============================================================================

/**
 * Server-side fetch of all chat filter data.
 *
 * This runs during SSR so the client has correct filter data on first render.
 * - Zero flash of wrong channels
 * - No client-side fetch delay
 * - Filtering works immediately
 *
 * @returns Filter data for org channels and squad channels
 */
export async function getServerChatFilterData(): Promise<ChatFilterData> {
  try {
    const { userId } = await auth();

    // Not authenticated - return empty
    if (!userId) {
      return { orgChannelIds: [], squadChannelIds: [], isPlatformMode: false };
    }

    // Get effective org ID from tenant context
    const effectiveOrgId = await getEffectiveOrgId();

    // Platform mode (no org context) - return empty with flag
    if (!effectiveOrgId) {
      return { orgChannelIds: [], squadChannelIds: [], isPlatformMode: true };
    }

    // Parallel fetch: org channels + user's squad channel IDs
    const [orgChannels, squadChannelIds] = await Promise.all([
      getOrgChannels(effectiveOrgId),
      fetchUserSquadChannelIds(userId, effectiveOrgId),
    ]);

    // Extract Stream channel IDs from org channels
    const orgChannelIds = orgChannels
      .map((ch) => ch.streamChannelId)
      .filter(Boolean);

    return {
      orgChannelIds,
      squadChannelIds,
      isPlatformMode: false,
    };
  } catch (error) {
    // Log error but don't crash SSR - client will fetch as fallback
    console.error('[chat-server] SSR fetch failed:', error);
    return { orgChannelIds: [], squadChannelIds: [], isPlatformMode: false };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Fetch chat channel IDs for all squads the user is a member of.
 *
 * Filters by organization to ensure multi-tenancy compliance.
 *
 * @param userId - Clerk user ID
 * @param orgId - Current organization ID (for filtering)
 * @returns Array of Stream chat channel IDs for user's squads
 */
async function fetchUserSquadChannelIds(
  userId: string,
  orgId: string
): Promise<string[]> {
  try {
    // Get user's squad memberships
    const membershipsSnap = await adminDb
      .collection('squadMembers')
      .where('userId', '==', userId)
      .get();

    if (membershipsSnap.empty) {
      return [];
    }

    // Extract squad IDs
    const squadIds = membershipsSnap.docs.map((doc) => doc.data().squadId);

    if (squadIds.length === 0) {
      return [];
    }

    // Firestore 'in' queries are limited to 10 items
    // For users in more than 10 squads, we batch the queries
    const channelIds: string[] = [];
    const batchSize = 10;

    for (let i = 0; i < squadIds.length; i += batchSize) {
      const batch = squadIds.slice(i, i + batchSize);

      const squadsSnap = await adminDb
        .collection('squads')
        .where('__name__', 'in', batch)
        .get();

      for (const doc of squadsSnap.docs) {
        const squad = doc.data();

        // Filter by organization (multi-tenancy)
        if (squad.organizationId !== orgId) {
          continue;
        }

        // Extract chat channel ID if exists
        if (squad.chatChannelId) {
          channelIds.push(squad.chatChannelId);
        }
      }
    }

    return channelIds;
  } catch (error) {
    console.error('[chat-server] Failed to fetch squad channel IDs:', error);
    return [];
  }
}
