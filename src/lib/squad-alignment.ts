/**
 * Squad Alignment Service
 * 
 * Computes squad-level alignment stats based on individual user alignment data.
 * All squad stats are derived from per-user UserAlignment docs - no parallel system.
 * 
 * IMPORTANT: The coach is EXCLUDED from all alignment/streak calculations.
 * Only regular squad members are counted.
 */

import { adminDb } from './firebase-admin';
import { getTodayDate, getYesterdayDate } from './alignment';
import type { 
  UserAlignment, 
  UserAlignmentSummary, 
  SquadAlignmentDay, 
  SquadAlignmentSummary, 
  ContributionDay 
} from '@/types';

/**
 * Get the coachId for a squad
 */
async function getSquadCoachId(squadId: string): Promise<string | null> {
  const squadDoc = await adminDb.collection('squads').doc(squadId).get();
  if (!squadDoc.exists) return null;
  return squadDoc.data()?.coachId || null;
}

/**
 * Get all member IDs for a squad (EXCLUDING the coach)
 * Only regular members are used for alignment calculations
 */
async function getSquadMemberIds(squadId: string, coachId?: string | null): Promise<string[]> {
  const membersSnapshot = await adminDb.collection('squadMembers')
    .where('squadId', '==', squadId)
    .get();
  
  // Get coachId if not provided
  const actualCoachId = coachId !== undefined ? coachId : await getSquadCoachId(squadId);
  
  // Filter out the coach - only return regular members
  return membersSnapshot.docs
    .map(doc => doc.data().userId)
    .filter(userId => userId !== actualCoachId);
}

/**
 * Get all member IDs including coach (for display purposes only)
 */
async function getAllSquadUserIds(squadId: string): Promise<string[]> {
  const membersSnapshot = await adminDb.collection('squadMembers')
    .where('squadId', '==', squadId)
    .get();
  
  return membersSnapshot.docs.map(doc => doc.data().userId);
}

/**
 * Get alignment data for multiple users for a specific date
 */
async function getUserAlignmentsForDate(
  userIds: string[],
  date: string
): Promise<Map<string, UserAlignment | null>> {
  const alignments = new Map<string, UserAlignment | null>();
  
  if (userIds.length === 0) return alignments;
  
  // Batch fetch alignments (Firestore has 30 docs limit per batch)
  const docIds = userIds.map(userId => `${userId}_${date}`);
  
  // Firestore getAll with batch
  const chunks: string[][] = [];
  for (let i = 0; i < docIds.length; i += 30) {
    chunks.push(docIds.slice(i, i + 30));
  }
  
  for (const chunk of chunks) {
    const refs = chunk.map(id => adminDb.collection('userAlignment').doc(id));
    const docs = await adminDb.getAll(...refs);
    
    docs.forEach((doc, index) => {
      const userId = userIds[Math.floor(index + chunks.indexOf(chunk) * 30)];
      if (doc.exists) {
        alignments.set(userId, { id: doc.id, ...doc.data() } as UserAlignment);
      } else {
        alignments.set(userId, null);
      }
    });
  }
  
  return alignments;
}

/**
 * Get alignment summaries for multiple users (streaks)
 */
async function getUserAlignmentSummaries(
  userIds: string[]
): Promise<Map<string, UserAlignmentSummary | null>> {
  const summaries = new Map<string, UserAlignmentSummary | null>();
  
  if (userIds.length === 0) return summaries;
  
  // Batch fetch summaries
  const chunks: string[][] = [];
  for (let i = 0; i < userIds.length; i += 30) {
    chunks.push(userIds.slice(i, i + 30));
  }
  
  for (const chunk of chunks) {
    const refs = chunk.map(id => adminDb.collection('userAlignmentSummary').doc(id));
    const docs = await adminDb.getAll(...refs);
    
    docs.forEach((doc, index) => {
      const userId = chunk[index];
      if (doc.exists) {
        summaries.set(userId, doc.data() as UserAlignmentSummary);
      } else {
        summaries.set(userId, null);
      }
    });
  }
  
  return summaries;
}

/**
 * Compute squad stats for today (and change from yesterday)
 * EXCLUDES the coach from all calculations - only regular members count.
 * 
 * @param squadId - The squad ID
 * @param coachId - Optional coach ID to exclude (if already known)
 * @param allUserIds - Optional list of ALL squad user IDs (for returning member alignments including coach for display)
 */
export async function computeSquadDailyStats(
  squadId: string,
  coachId?: string | null,
  allUserIds?: string[]
): Promise<{
  avgAlignmentToday: number;
  avgAlignmentYesterday: number;
  alignmentChange: number;
  memberAlignments: Map<string, { alignmentScore: number; currentStreak: number }>;
}> {
  const today = getTodayDate();
  const yesterday = getYesterdayDate();
  
  // Get coach ID if not provided
  const actualCoachId = coachId !== undefined ? coachId : await getSquadCoachId(squadId);
  
  // Get squad member IDs (EXCLUDING coach)
  const memberIds = await getSquadMemberIds(squadId, actualCoachId);
  
  // For returning alignment data, include all users (coach needs display data too)
  const displayUserIds = allUserIds || await getAllSquadUserIds(squadId);
  
  if (memberIds.length === 0) {
    return {
      avgAlignmentToday: 0,
      avgAlignmentYesterday: 0,
      alignmentChange: 0,
      memberAlignments: new Map(),
    };
  }
  
  // Fetch alignments for today and yesterday for ALL users (for display)
  // But only count MEMBERS (not coach) for averages
  const [todayAlignments, yesterdayAlignments, summaries] = await Promise.all([
    getUserAlignmentsForDate(displayUserIds, today),
    getUserAlignmentsForDate(memberIds, yesterday), // Only members for yesterday (for avg calculation)
    getUserAlignmentSummaries(displayUserIds),
  ]);
  
  // Calculate averages (ONLY from members, not coach)
  let todaySum = 0;
  let yesterdaySum = 0;
  const memberAlignments = new Map<string, { alignmentScore: number; currentStreak: number }>();
  
  // First, populate memberAlignments for ALL users (including coach for display)
  for (const userId of displayUserIds) {
    const todayAlignment = todayAlignments.get(userId);
    const summary = summaries.get(userId);
    
    const alignmentScore = todayAlignment?.alignmentScore ?? 0;
    const currentStreak = summary?.currentStreak ?? 0;
    
    memberAlignments.set(userId, { alignmentScore, currentStreak });
  }
  
  // Then, calculate averages ONLY from members (not coach)
  for (const userId of memberIds) {
    const todayAlignment = todayAlignments.get(userId);
    const yesterdayAlignment = yesterdayAlignments.get(userId);
    
    todaySum += todayAlignment?.alignmentScore ?? 0;
    yesterdaySum += yesterdayAlignment?.alignmentScore ?? 0;
  }
  
  const avgAlignmentToday = Math.round(todaySum / memberIds.length);
  const avgAlignmentYesterday = Math.round(yesterdaySum / memberIds.length);
  const alignmentChange = avgAlignmentToday - avgAlignmentYesterday;
  
  return {
    avgAlignmentToday,
    avgAlignmentYesterday,
    alignmentChange,
    memberAlignments,
  };
}

/**
 * Compute squad percentile among all squads
 * EXCLUDES coaches from all calculations - only regular members count.
 * 
 * PERFORMANCE: This is expensive (queries all squads). Consider caching.
 */
export async function computeSquadPercentile(squadId: string): Promise<number> {
  const today = getTodayDate();
  
  // Get all squads
  const squadsSnapshot = await adminDb.collection('squads').get();
  
  if (squadsSnapshot.empty) return 100; // No squads = top 100%
  
  // Compute average alignment for each squad (excluding coaches)
  const squadAvgAlignments: { squadId: string; avgAlignment: number }[] = [];
  
  for (const squadDoc of squadsSnapshot.docs) {
    const sid = squadDoc.id;
    const squadCoachId = squadDoc.data()?.coachId || null;
    
    // Get only members (not coach)
    const memberIds = await getSquadMemberIds(sid, squadCoachId);
    
    if (memberIds.length === 0) {
      squadAvgAlignments.push({ squadId: sid, avgAlignment: 0 });
      continue;
    }
    
    const alignments = await getUserAlignmentsForDate(memberIds, today);
    let sum = 0;
    for (const alignment of alignments.values()) {
      sum += alignment?.alignmentScore ?? 0;
    }
    
    squadAvgAlignments.push({
      squadId: sid,
      avgAlignment: sum / memberIds.length,
    });
  }
  
  // Sort descending by avgAlignment
  squadAvgAlignments.sort((a, b) => b.avgAlignment - a.avgAlignment);
  
  // Find rank of this squad (1-based)
  const rank = squadAvgAlignments.findIndex(s => s.squadId === squadId) + 1;
  const totalSquads = squadAvgAlignments.length;
  
  if (rank === 0 || totalSquads === 0) return 100;
  
  // Percentile: top X%
  // If rank 1 out of 100 squads = top 1%
  // If rank 50 out of 100 squads = top 50%
  const percentile = Math.ceil((rank / totalSquads) * 100);
  
  return Math.max(1, percentile); // At least top 1%
}

/**
 * Get or compute squad alignment for a specific day
 * EXCLUDES the coach from calculations - only regular members count.
 * 
 * @param squadId - The squad ID
 * @param date - The date in YYYY-MM-DD format
 * @param coachId - Optional coach ID to exclude (for performance if already known)
 */
async function getOrComputeSquadAlignmentDay(
  squadId: string,
  date: string,
  coachId?: string | null
): Promise<SquadAlignmentDay> {
  const docId = `${squadId}_${date}`;
  const docRef = adminDb.collection('squadAlignmentDays').doc(docId);
  const now = new Date().toISOString();
  const today = getTodayDate();
  
  // Check if we have cached data for this day (only use cache for past days)
  if (date !== today) {
    const existingDoc = await docRef.get();
    if (existingDoc.exists) {
      return { ...existingDoc.data() } as SquadAlignmentDay;
    }
  }
  
  // Get coach ID if not provided
  const actualCoachId = coachId !== undefined ? coachId : await getSquadCoachId(squadId);
  
  // Compute for this day - ONLY count members, not coach
  const memberIds = await getSquadMemberIds(squadId, actualCoachId);
  const totalMembers = memberIds.length;
  
  if (totalMembers === 0) {
    const dayData: SquadAlignmentDay = {
      squadId,
      date,
      fractionFullyAligned: 0,
      numFullyAligned: 0,
      totalMembers: 0,
      kept: false,
      createdAt: now,
      updatedAt: now,
    };
    // Cache empty result for past days
    if (date !== today) {
      await docRef.set(dayData);
    }
    return dayData;
  }
  
  const alignments = await getUserAlignmentsForDate(memberIds, date);
  
  let numFullyAligned = 0;
  for (const alignment of alignments.values()) {
    if (alignment?.fullyAligned) {
      numFullyAligned++;
    }
  }
  
  const fractionFullyAligned = numFullyAligned / totalMembers;
  const kept = fractionFullyAligned >= 0.5;
  
  const dayData: SquadAlignmentDay = {
    squadId,
    date,
    fractionFullyAligned,
    numFullyAligned,
    totalMembers,
    kept,
    createdAt: now,
    updatedAt: now,
  };
  
  // Only cache for past days (not today, as it can change)
  if (date !== today) {
    await docRef.set(dayData);
  }
  
  return dayData;
}

/**
 * Compute contribution history for the last N days
 * EXCLUDES the coach from calculations - only regular members count.
 * 
 * @param squadId - The squad ID
 * @param days - Number of days to fetch (default: 30)
 * @param coachId - Optional coach ID (for performance if already known)
 * @param offset - Number of days to skip from today (for pagination, default: 0)
 * @param squadCreatedAt - Optional squad creation date to limit history
 * 
 * PERFORMANCE: Fetches coachId once and reuses for all days.
 */
export async function computeContributionHistory(
  squadId: string,
  days: number = 30,
  coachId?: string | null,
  offset: number = 0,
  squadCreatedAt?: string | null
): Promise<ContributionDay[]> {
  // Get coach ID once for all day calculations
  const actualCoachId = coachId !== undefined ? coachId : await getSquadCoachId(squadId);
  
  const history: ContributionDay[] = [];
  const today = new Date();
  
  // Parse squad creation date if provided
  const creationDate = squadCreatedAt ? new Date(squadCreatedAt).toISOString().split('T')[0] : null;
  
  // Batch process days for better performance
  const datePromises: Promise<SquadAlignmentDay>[] = [];
  const dates: string[] = [];
  
  for (let i = offset; i < offset + days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    // Stop if we've reached before squad creation date
    if (creationDate && dateStr < creationDate) {
      break;
    }
    
    dates.push(dateStr);
    datePromises.push(getOrComputeSquadAlignmentDay(squadId, dateStr, actualCoachId));
  }
  
  // If no dates to process, return empty
  if (dates.length === 0) {
    return [];
  }
  
  // Process in batches of 10 for better performance
  const BATCH_SIZE = 10;
  for (let i = 0; i < datePromises.length; i += BATCH_SIZE) {
    const batch = datePromises.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch);
    
    for (let j = 0; j < results.length; j++) {
      history.push({
        date: dates[i + j],
        completionRate: Math.round(results[j].fractionFullyAligned * 100),
      });
    }
  }
  
  // Return in chronological order (oldest first)
  return history.reverse();
}

/**
 * Get or update squad streak
 * EXCLUDES the coach from calculations - only regular members count.
 * 
 * @param squadId - The squad ID
 * @param coachId - Optional coach ID to exclude (for performance if already known)
 */
export async function getSquadStreak(
  squadId: string,
  coachId?: string | null
): Promise<SquadAlignmentSummary> {
  const summaryRef = adminDb.collection('squadAlignmentSummary').doc(squadId);
  const today = getTodayDate();
  const yesterday = getYesterdayDate();
  const now = new Date().toISOString();
  
  // Get existing summary
  const existingDoc = await summaryRef.get();
  let summary: SquadAlignmentSummary;
  
  if (existingDoc.exists) {
    summary = existingDoc.data() as SquadAlignmentSummary;
  } else {
    summary = {
      squadId,
      currentStreak: 0,
      updatedAt: now,
    };
  }
  
  // Check if we need to update (once per day)
  if (summary.lastKeptDate === today) {
    // Already computed today
    return summary;
  }
  
  // Get coach ID if not provided
  const actualCoachId = coachId !== undefined ? coachId : await getSquadCoachId(squadId);
  
  // Compute today's status (excluding coach)
  const todayData = await getOrComputeSquadAlignmentDay(squadId, today, actualCoachId);
  
  if (todayData.kept) {
    // Day is kept - update streak
    if (summary.lastKeptDate === yesterday) {
      // Continuing streak
      summary.currentStreak += 1;
    } else {
      // Starting new streak
      summary.currentStreak = 1;
    }
    summary.lastKeptDate = today;
  } else {
    // Day not kept - streak broken for display purposes
    // We don't reset to 0 until tomorrow, so user sees the last streak today
    // Check if yesterday was kept - if not, streak is broken
    if (summary.lastKeptDate !== yesterday && summary.lastKeptDate !== today) {
      summary.currentStreak = 0;
    }
  }
  
  summary.updatedAt = now;
  await summaryRef.set(summary, { merge: true });
  
  return summary;
}

/**
 * Get basic squad stats (fast) - for initial page load
 * Returns member alignments and basic stats without expensive percentile calculation
 */
export async function getBasicSquadStats(squadId: string, coachId?: string | null): Promise<{
  avgAlignment: number;
  alignmentChange: number;
  squadStreak: number;
  memberAlignments: Map<string, { alignmentScore: number; currentStreak: number }>;
}> {
  // Get coach ID once for all calculations
  const actualCoachId = coachId !== undefined ? coachId : await getSquadCoachId(squadId);
  
  // Get all user IDs for display purposes
  const allUserIds = await getAllSquadUserIds(squadId);
  
  // Compute daily stats and streak in parallel
  const [dailyStats, streakSummary] = await Promise.all([
    computeSquadDailyStats(squadId, actualCoachId, allUserIds),
    getSquadStreak(squadId, actualCoachId),
  ]);
  
  return {
    avgAlignment: dailyStats.avgAlignmentToday,
    alignmentChange: dailyStats.alignmentChange,
    squadStreak: streakSummary.currentStreak,
    memberAlignments: dailyStats.memberAlignments,
  };
}

/**
 * Get full squad stats for the squad page
 * EXCLUDES the coach from all calculations - only regular members count.
 * 
 * PERFORMANCE: This is expensive. For initial page load, use getBasicSquadStats instead
 * and lazy-load the percentile and contribution history.
 */
export async function getFullSquadStats(squadId: string): Promise<{
  avgAlignment: number;
  alignmentChange: number;
  topPercentile: number;
  squadStreak: number;
  contributionHistory: ContributionDay[];
  memberAlignments: Map<string, { alignmentScore: number; currentStreak: number }>;
}> {
  // Get coach ID once for all calculations
  const coachId = await getSquadCoachId(squadId);
  
  // Get all user IDs for display purposes
  const allUserIds = await getAllSquadUserIds(squadId);
  
  // Compute all stats - daily stats and streak are fast, percentile and history are slower
  // Run daily stats and streak first (needed immediately), then the rest
  const [dailyStats, streakSummary] = await Promise.all([
    computeSquadDailyStats(squadId, coachId, allUserIds),
    getSquadStreak(squadId, coachId),
  ]);
  
  // These are slower - run them in parallel
  const [percentile, contributionHistory] = await Promise.all([
    computeSquadPercentile(squadId),
    computeContributionHistory(squadId, 30, coachId),
  ]);
  
  return {
    avgAlignment: dailyStats.avgAlignmentToday,
    alignmentChange: dailyStats.alignmentChange,
    topPercentile: percentile,
    squadStreak: streakSummary.currentStreak,
    contributionHistory,
    memberAlignments: dailyStats.memberAlignments,
  };
}

/**
 * Get stats tab data (expensive operations) - for lazy loading
 * 
 * @param squadId - The squad ID
 * @param squadCreatedAt - Optional squad creation date to limit contribution history
 */
export async function getStatsTabData(
  squadId: string,
  squadCreatedAt?: string | null
): Promise<{
  topPercentile: number;
  contributionHistory: ContributionDay[];
}> {
  const coachId = await getSquadCoachId(squadId);
  
  const [percentile, contributionHistory] = await Promise.all([
    computeSquadPercentile(squadId),
    computeContributionHistory(squadId, 30, coachId, 0, squadCreatedAt),
  ]);
  
  return {
    topPercentile: percentile,
    contributionHistory,
  };
}

/**
 * Cache TTL in milliseconds (5 minutes)
 * This is the backup freshness check - primary invalidation happens on alignment change
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Invalidate squad stats cache
 * Called when any squad member's alignment changes to ensure instant updates
 */
export async function invalidateSquadCache(squadId: string): Promise<void> {
  try {
    await adminDb.collection('squads').doc(squadId).update({
      cachedAt: null,
      cachedAtTimestamp: null,
    });
  } catch (error) {
    // Log but don't throw - cache will refresh via TTL anyway
    console.error('[SQUAD_CACHE] Failed to invalidate cache:', error);
  }
}

/**
 * Get cached squad stats from the squad document
 * Returns null if cache is stale or doesn't exist
 * 
 * Cache is considered stale if:
 * 1. cachedAt is not today (day changed)
 * 2. cachedAtTimestamp is older than 5 minutes (TTL backup)
 */
export async function getCachedSquadStats(
  squadId: string
): Promise<{
  avgAlignment: number;
  alignmentChange: number;
  squadStreak: number;
  memberAlignments: Record<string, { alignmentScore: number; currentStreak: number }>;
} | null> {
  const today = getTodayDate();
  const squadDoc = await adminDb.collection('squads').doc(squadId).get();
  
  if (!squadDoc.exists) return null;
  
  const squadData = squadDoc.data();
  
  // Check if cache is from today
  if (squadData?.cachedAt !== today) {
    return null; // Cache is stale (different day)
  }
  
  // Check 5-minute TTL as backup freshness check
  if (squadData?.cachedAtTimestamp) {
    const cacheTime = new Date(squadData.cachedAtTimestamp).getTime();
    const now = Date.now();
    if (now - cacheTime > CACHE_TTL_MS) {
      return null; // Cache is stale (older than 5 minutes)
    }
  } else {
    // No timestamp means old cache format - treat as stale
    return null;
  }
  
  // Cache exists and is fresh
  if (
    squadData?.cachedAvgAlignment !== undefined &&
    squadData?.cachedAlignmentChange !== undefined &&
    squadData?.cachedMemberAlignments
  ) {
    // Get streak from squad alignment summary
    const streakDoc = await adminDb.collection('squadAlignmentSummary').doc(squadId).get();
    const squadStreak = streakDoc.exists ? (streakDoc.data()?.currentStreak ?? 0) : 0;
    
    return {
      avgAlignment: squadData.cachedAvgAlignment,
      alignmentChange: squadData.cachedAlignmentChange,
      squadStreak,
      memberAlignments: squadData.cachedMemberAlignments,
    };
  }
  
  return null;
}

/**
 * Update the cached squad stats on the squad document
 * Called after computing fresh stats
 */
export async function updateSquadStatsCache(
  squadId: string,
  stats: {
    avgAlignment: number;
    alignmentChange: number;
    memberAlignments: Map<string, { alignmentScore: number; currentStreak: number }>;
  }
): Promise<void> {
  const today = getTodayDate();
  const now = new Date().toISOString();
  
  // Convert Map to plain object for Firestore
  const memberAlignmentsObj: Record<string, { alignmentScore: number; currentStreak: number }> = {};
  stats.memberAlignments.forEach((value, key) => {
    memberAlignmentsObj[key] = value;
  });
  
  await adminDb.collection('squads').doc(squadId).update({
    cachedAvgAlignment: stats.avgAlignment,
    cachedAlignmentChange: stats.alignmentChange,
    cachedMemberAlignments: memberAlignmentsObj,
    cachedAt: today,
    cachedAtTimestamp: now, // ISO timestamp for TTL checking
  });
}

/**
 * Get squad stats with caching - for fast page loads
 * Uses cached data if available and fresh, otherwise computes and caches
 */
export async function getSquadStatsWithCache(
  squadId: string,
  coachId: string | null
): Promise<{
  avgAlignment: number;
  alignmentChange: number;
  squadStreak: number;
  memberAlignments: Map<string, { alignmentScore: number; currentStreak: number }>;
}> {
  // Try to get cached stats first
  const cached = await getCachedSquadStats(squadId);
  
  if (cached) {
    // Convert Record back to Map
    const memberAlignments = new Map<string, { alignmentScore: number; currentStreak: number }>();
    Object.entries(cached.memberAlignments).forEach(([key, value]) => {
      memberAlignments.set(key, value);
    });
    
    return {
      avgAlignment: cached.avgAlignment,
      alignmentChange: cached.alignmentChange,
      squadStreak: cached.squadStreak,
      memberAlignments,
    };
  }
  
  // Cache miss - compute fresh stats
  const freshStats = await getBasicSquadStats(squadId, coachId);
  
  // Update cache in background (don't await)
  updateSquadStatsCache(squadId, {
    avgAlignment: freshStats.avgAlignment,
    alignmentChange: freshStats.alignmentChange,
    memberAlignments: freshStats.memberAlignments,
  }).catch(err => {
    console.error('[SQUAD_CACHE] Failed to update cache:', err);
  });
  
  return freshStats;
}

