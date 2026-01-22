/**
 * Coach API: Feed Analytics
 *
 * GET /api/coach/analytics/feed
 *
 * Returns feed statistics for the coach's organization:
 * - Total posts, engagement metrics
 * - Posts grouped by date
 * - Active posters with their contribution counts
 *
 * Query params:
 *   - days: number of days to look back (default: 30, max: 90, 0 = all time)
 *   - limit: max posts to analyze (default: 100, max: 500)
 *
 * NOTE: Admins (coaches, super_coaches) are ALWAYS excluded from statistics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { withDemoMode } from '@/lib/demo-api';
import type { OrgMembership } from '@/types';

interface FeedPost {
  id: string;
  authorId: string;
  organizationId: string;
  text?: string;
  images?: string[];
  videoUrl?: string;
  createdAt: string;
  likeCount?: number;
  commentCount?: number;
  bookmarkCount?: number;
  repostCount?: number;
}

interface PosterStats {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  postCount: number;
  lastPostAt: string | null;
  totalEngagement: number;
}

interface DailyStats {
  date: string;
  postCount: number;
  engagementCount: number;
}

export async function GET(request: NextRequest) {
  try {
    // Demo mode: return demo data
    const demoData = await withDemoMode('analytics-feed');
    if (demoData) return demoData;

    const { organizationId } = await requireCoachWithOrg();
    const { searchParams } = new URL(request.url);

    const days = Math.min(parseInt(searchParams.get('days') || '30', 10), 90);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);

    // Get admin user IDs to exclude from statistics
    const membershipsSnapshot = await adminDb
      .collection('org_memberships')
      .where('organizationId', '==', organizationId)
      .where('isActive', '==', true)
      .get();

    const adminUserIds = new Set<string>();
    const userMap = new Map<string, { name: string; email: string; avatarUrl?: string }>();

    for (const doc of membershipsSnapshot.docs) {
      const membership = doc.data() as OrgMembership;

      if (membership.orgRole === 'super_coach' || membership.orgRole === 'coach') {
        adminUserIds.add(membership.userId);
      }

      // Build user map for display names later
      const displayName = [membership.firstName, membership.lastName].filter(Boolean).join(' ');
      if (displayName || membership.imageUrl) {
        userMap.set(membership.userId, {
          name: displayName || 'Unknown',
          email: '', // Email not stored on OrgMembership - will be enriched from users collection
          avatarUrl: membership.imageUrl,
        });
      }
    }

    // Calculate date range
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - (days || 365 * 10)); // 0 days = all time (use 10 years)
    const sinceDateStr = sinceDate.toISOString();

    // Get posts from Firestore feed_posts collection
    let query = adminDb
      .collection('feed_posts')
      .where('organizationId', '==', organizationId)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    // Only filter by date if days > 0
    if (days > 0) {
      query = query.where('createdAt', '>=', sinceDateStr);
    }

    const postsSnapshot = await query.get();
    const posts: FeedPost[] = postsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as FeedPost));

    // Filter out admin posts
    const filteredPosts = posts.filter(post => !adminUserIds.has(post.authorId));

    // Calculate statistics
    const posterStatsMap = new Map<string, PosterStats>();
    const dailyStatsMap = new Map<string, DailyStats>();
    let totalEngagement = 0;
    let totalLikes = 0;
    let totalComments = 0;

    for (const post of filteredPosts) {
      const userId = post.authorId;
      const postDate = post.createdAt ? post.createdAt.split('T')[0] : new Date().toISOString().split('T')[0];

      // Calculate engagement for this post
      const likes = post.likeCount || 0;
      const comments = post.commentCount || 0;
      const postEngagement = likes + comments;

      totalLikes += likes;
      totalComments += comments;
      totalEngagement += postEngagement;

      // Update poster stats
      if (!posterStatsMap.has(userId)) {
        const userInfo = userMap.get(userId) || { name: 'Unknown', email: '', avatarUrl: undefined };
        posterStatsMap.set(userId, {
          userId,
          name: userInfo.name,
          email: userInfo.email,
          avatarUrl: userInfo.avatarUrl,
          postCount: 0,
          lastPostAt: null,
          totalEngagement: 0,
        });
      }

      const posterStats = posterStatsMap.get(userId)!;
      posterStats.postCount++;
      posterStats.totalEngagement += postEngagement;

      if (!posterStats.lastPostAt || (post.createdAt && post.createdAt > posterStats.lastPostAt)) {
        posterStats.lastPostAt = post.createdAt || null;
      }

      // Update daily stats
      if (!dailyStatsMap.has(postDate)) {
        dailyStatsMap.set(postDate, {
          date: postDate,
          postCount: 0,
          engagementCount: 0,
        });
      }

      const dailyStats = dailyStatsMap.get(postDate)!;
      dailyStats.postCount++;
      dailyStats.engagementCount += postEngagement;
    }

    // Convert maps to arrays and sort
    const posters = Array.from(posterStatsMap.values())
      .sort((a, b) => b.postCount - a.postCount);

    const dailyStats = Array.from(dailyStatsMap.values())
      .sort((a, b) => b.date.localeCompare(a.date)); // Most recent first

    // Fetch user details for posters we don't have info for (name unknown OR email missing)
    const unknownUserIds = posters
      .filter(p => p.name === 'Unknown' || !p.email)
      .map(p => p.userId)
      .slice(0, 50);

    if (unknownUserIds.length > 0) {
      const userDocs = await Promise.all(
        unknownUserIds.map(id => adminDb.collection('users').doc(id).get())
      );

      for (const doc of userDocs) {
        if (doc.exists) {
          const data = doc.data();
          const poster = posters.find(p => p.userId === doc.id);
          if (poster) {
            poster.name = data?.name || `${data?.firstName || ''} ${data?.lastName || ''}`.trim() || 'Unknown';
            poster.email = data?.email || '';
            poster.avatarUrl = data?.avatarUrl || data?.imageUrl;
          }
        }
      }
    }

    return NextResponse.json({
      summary: {
        totalPosts: filteredPosts.length,
        totalEngagement,
        totalLikes,
        totalComments,
        activePosters: posters.length,
        avgEngagementPerPost: filteredPosts.length > 0
          ? Math.round(totalEngagement / filteredPosts.length * 10) / 10
          : 0,
      },
      posters: posters.slice(0, 50), // Top 50 posters
      dailyStats: dailyStats.slice(0, days || 365), // Up to requested days
      period: {
        days,
        startDate: days > 0 ? sinceDateStr.split('T')[0] : 'all',
        endDate: new Date().toISOString().split('T')[0],
      },
    });
  } catch (error) {
    console.error('[COACH_ANALYTICS_FEED] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch feed analytics' }, { status: 500 });
  }
}
