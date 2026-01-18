/**
 * Program Dashboard API
 *
 * GET /api/coach/org-programs/[programId]/dashboard - Get aggregated program dashboard data
 *
 * Query params:
 * - cohortId?: string - Filter by specific cohort (for group programs)
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { Program, ProgramEnrollment, ContentProgress } from '@/types';

interface MemberStats {
  userId: string;
  name: string;
  avatarUrl?: string;
  currentWeek: number;
  progressPercent: number;
  streak: number;
  lastActiveAt?: string;
  daysIdle: number;
  enrollmentId: string;
}

interface ContentCompletionItem {
  contentType: 'course' | 'article' | 'questionnaire';
  contentId: string;
  title: string;
  completedCount: number;
  totalCount: number;
  completionPercent: number;
}

interface UpcomingItem {
  type: 'call' | 'form' | 'week_unlock';
  title: string;
  date?: string;
  count?: number;
  submitted?: number;
}

interface ProgramDashboardData {
  programId: string;
  programName: string;
  programType: 'individual' | 'cohort';
  totalWeeks: number;
  stats: {
    activeClients: number;
    newThisWeek: number;
    avgProgress: number;
    progressRange: { min: number; max: number };
    avgStreak: number;
    bestStreak: number;
    contentCompletion: number;
    totalContentItems: number;
    completedContentItems: number;
  };
  needsAttention: {
    userId: string;
    name: string;
    avatarUrl?: string;
    currentWeek: number;
    progress: number;
    daysInactive: number;
    lastActive?: string;
    reason: 'low_progress' | 'idle' | 'both';
    metric: string;
    enrollmentId: string;
  }[];
  topPerformers: {
    userId: string;
    name: string;
    avatarUrl?: string;
    progress: number;
    streak: number;
    rank: number;
    contentCompleted: number;
    enrollmentId: string;
  }[];
  contentCompletion: ContentCompletionItem[];
  upcoming: UpcomingItem[];
}

/**
 * Calculate days since last activity
 */
function calculateDaysIdle(lastActiveAt?: string): number {
  if (!lastActiveAt) return 999;
  const lastActive = new Date(lastActiveAt);
  const now = new Date();
  const diffMs = now.getTime() - lastActive.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculate current week from enrollment start date
 */
function calculateCurrentWeek(startedAt: string, lengthDays: number): number {
  const startDate = new Date(startedAt);
  const now = new Date();
  const diffMs = now.getTime() - startDate.getTime();
  const daysSinceStart = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const currentWeek = Math.floor(daysSinceStart / 7) + 1;
  const totalWeeks = Math.ceil(lengthDays / 7);
  return Math.min(currentWeek, totalWeeks);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId } = await params;

    const { searchParams } = new URL(request.url);
    const cohortId = searchParams.get('cohortId');

    // Get program details
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const programData = programDoc.data();
    if (programData?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    const program = { id: programDoc.id, ...programData } as Program;
    const lengthDays = program.lengthDays || 30;
    const totalWeeks = Math.ceil(lengthDays / 7);
    const programType = program.type === 'group' ? 'cohort' : 'individual';

    // Get enrollments (optionally filtered by cohort)
    let enrollmentsQuery = adminDb
      .collection('program_enrollments')
      .where('programId', '==', programId)
      .where('status', 'in', ['active', 'upcoming']);

    if (cohortId) {
      enrollmentsQuery = enrollmentsQuery.where('cohortId', '==', cohortId);
    }

    const enrollmentsSnapshot = await enrollmentsQuery.get();
    const enrollments = enrollmentsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as (ProgramEnrollment & { id: string })[];

    // Calculate one week ago for "new this week"
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Get user details for all enrolled users
    const userIds = enrollments.map((e) => e.userId);
    const userMap = new Map<string, { name: string; avatarUrl?: string }>();

    if (userIds.length > 0) {
      // Batch fetch user details (Firestore limits to 30 in 'in' queries)
      const batchSize = 30;
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        const usersSnapshot = await adminDb
          .collection('users')
          .where('__name__', 'in', batch)
          .get();

        usersSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          userMap.set(doc.id, {
            name: `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Unknown',
            avatarUrl: data.imageUrl || data.avatarUrl,
          });
        });
      }
    }

    // Get content progress for all users in this program
    const contentProgressMap = new Map<string, ContentProgress[]>();

    if (userIds.length > 0) {
      // Fetch content progress by organization and program
      // Content progress is linked to users and organization, not necessarily instances
      const batchSize = 30;
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        const progressSnapshot = await adminDb
          .collection('content_progress')
          .where('userId', 'in', batch)
          .where('organizationId', '==', organizationId)
          .get();

        progressSnapshot.docs.forEach((doc) => {
          const progress = { id: doc.id, ...doc.data() } as ContentProgress;
          const userProgress = contentProgressMap.get(progress.userId) || [];
          userProgress.push(progress);
          contentProgressMap.set(progress.userId, userProgress);
        });
      }
    }

    // Get streaks from userAlignmentSummary
    const streakMap = new Map<string, number>();
    if (userIds.length > 0) {
      // Batch fetch alignment summaries (document ID format: {organizationId}_{userId})
      const chunks: string[][] = [];
      for (let i = 0; i < userIds.length; i += 30) {
        chunks.push(userIds.slice(i, i + 30));
      }
      for (const chunk of chunks) {
        const refs = chunk.map(userId =>
          adminDb.collection('userAlignmentSummary').doc(`${organizationId}_${userId}`)
        );
        const docs = await adminDb.getAll(...refs);
        docs.forEach((doc, index) => {
          if (doc.exists) {
            const data = doc.data();
            streakMap.set(chunk[index], data?.currentStreak ?? 0);
          }
        });
      }
    }

    // Calculate member stats
    const memberStats: MemberStats[] = enrollments.map((enrollment) => {
      const user = userMap.get(enrollment.userId) || { name: 'Unknown' };
      const startedAt = enrollment.startedAt || enrollment.createdAt || new Date().toISOString();
      const currentWeek = calculateCurrentWeek(startedAt, lengthDays);
      // Use updatedAt as proxy for lastActiveAt (when enrollment was last updated)
      const lastActiveAt = enrollment.updatedAt || enrollment.createdAt;
      const daysIdle = calculateDaysIdle(lastActiveAt);

      // Calculate progress from content_progress
      const userProgress = contentProgressMap.get(enrollment.userId) || [];
      const completedItems = userProgress.filter((p) => p.status === 'completed').length;
      const totalItems = userProgress.length || 1;
      const progressPercent = Math.round((completedItems / totalItems) * 100) || 0;

      // Get streak from alignment summary
      const streak = streakMap.get(enrollment.userId) || 0;

      return {
        userId: enrollment.userId,
        name: user.name,
        avatarUrl: user.avatarUrl,
        currentWeek,
        progressPercent,
        streak,
        lastActiveAt,
        daysIdle,
        enrollmentId: enrollment.id,
      };
    });

    // Calculate aggregate stats
    const activeClients = memberStats.length;
    const newThisWeek = enrollments.filter((e) => {
      const createdAt = e.createdAt;
      return createdAt && new Date(createdAt) >= oneWeekAgo;
    }).length;

    const progressValues = memberStats.map((m) => m.progressPercent);
    const avgProgress = progressValues.length > 0
      ? Math.round(progressValues.reduce((a, b) => a + b, 0) / progressValues.length)
      : 0;
    const progressRange = {
      min: progressValues.length > 0 ? Math.min(...progressValues) : 0,
      max: progressValues.length > 0 ? Math.max(...progressValues) : 0,
    };

    const streakValues = memberStats.map((m) => m.streak);
    const avgStreak = streakValues.length > 0
      ? Math.round(streakValues.reduce((a, b) => a + b, 0) / streakValues.length)
      : 0;
    const bestStreak = streakValues.length > 0 ? Math.max(...streakValues) : 0;

    // Content completion aggregation
    const allProgress = Array.from(contentProgressMap.values()).flat();
    const completedContent = allProgress.filter((p) => p.status === 'completed').length;
    const totalContentItems = allProgress.length || 1;
    const contentCompletion = Math.round((completedContent / totalContentItems) * 100) || 0;

    // Fetch actual titles for content items
    const contentTitleMap = new Map<string, string>();
    const courseIds = new Set<string>();
    const articleIds = new Set<string>();

    allProgress.forEach((p) => {
      if (p.contentType === 'article') {
        articleIds.add(p.contentId);
      } else if (p.contentType === 'course' || p.contentType === 'course_lesson' || p.contentType === 'course_module') {
        courseIds.add(p.contentId);
      }
    });

    // Batch fetch course titles
    if (courseIds.size > 0) {
      const courseIdArray = Array.from(courseIds);
      const batchSize = 30;
      for (let i = 0; i < courseIdArray.length; i += batchSize) {
        const batch = courseIdArray.slice(i, i + batchSize);
        const courseDocs = await adminDb
          .collection('courses')
          .where('__name__', 'in', batch)
          .get();

        courseDocs.docs.forEach((doc) => {
          const data = doc.data();
          contentTitleMap.set(doc.id, data.title || `Course ${doc.id.slice(0, 8)}`);
        });
      }
    }

    // Batch fetch article titles
    if (articleIds.size > 0) {
      const articleIdArray = Array.from(articleIds);
      const batchSize = 30;
      for (let i = 0; i < articleIdArray.length; i += batchSize) {
        const batch = articleIdArray.slice(i, i + batchSize);
        const articleDocs = await adminDb
          .collection('articles')
          .where('__name__', 'in', batch)
          .get();

        articleDocs.docs.forEach((doc) => {
          const data = doc.data();
          contentTitleMap.set(doc.id, data.title || `Article ${doc.id.slice(0, 8)}`);
        });
      }
    }

    // Identify members needing attention (< 50% progress OR idle > 2 days)
    const needsAttention = memberStats
      .filter((m) => m.progressPercent < 50 || m.daysIdle > 2)
      .map((m) => {
        const reason = (m.progressPercent < 50 && m.daysIdle > 2
          ? 'both'
          : m.progressPercent < 50
          ? 'low_progress'
          : 'idle') as 'low_progress' | 'idle' | 'both';

        // Generate metric string based on reason
        let metric = '';
        if (reason === 'both') {
          metric = `${m.progressPercent}% progress, ${m.daysIdle} days idle`;
        } else if (reason === 'low_progress') {
          metric = `${m.progressPercent}% progress`;
        } else {
          metric = `${m.daysIdle} days idle`;
        }

        return {
          userId: m.userId,
          name: m.name,
          avatarUrl: m.avatarUrl,
          currentWeek: m.currentWeek,
          progress: m.progressPercent,
          daysInactive: m.daysIdle,
          lastActive: m.lastActiveAt,
          reason,
          metric,
          enrollmentId: m.enrollmentId,
        };
      })
      .sort((a, b) => a.progress - b.progress)
      .slice(0, 5);

    // Top performers (sorted by progress, then streak)
    const topPerformers = memberStats
      .sort((a, b) => {
        if (b.progressPercent !== a.progressPercent) {
          return b.progressPercent - a.progressPercent;
        }
        return b.streak - a.streak;
      })
      .slice(0, 3)
      .map((m, index) => {
        // Get content completed count for this user
        const userProgress = contentProgressMap.get(m.userId) || [];
        const contentCompleted = userProgress.filter(p => p.status === 'completed').length;

        return {
          userId: m.userId,
          name: m.name,
          avatarUrl: m.avatarUrl,
          progress: m.progressPercent,
          streak: m.streak,
          rank: index + 1,
          contentCompleted,
          enrollmentId: m.enrollmentId,
        };
      });

    // Content completion by item
    const contentCompletionByItem = new Map<string, ContentCompletionItem>();

    allProgress.forEach((p) => {
      const key = `${p.contentType}-${p.contentId}`;
      const existing = contentCompletionByItem.get(key);

      if (existing) {
        existing.totalCount++;
        if (p.status === 'completed') {
          existing.completedCount++;
        }
        existing.completionPercent = Math.round(
          (existing.completedCount / existing.totalCount) * 100
        );
      } else {
        // Look up actual title from fetched content
        const title = contentTitleMap.get(p.contentId) ||
          (p.contentType === 'article' ? `Article ${p.contentId.slice(0, 8)}` : `Course ${p.contentId.slice(0, 8)}`);

        contentCompletionByItem.set(key, {
          contentType: p.contentType === 'article' ? 'article' : 'course',
          contentId: p.contentId,
          title,
          completedCount: p.status === 'completed' ? 1 : 0,
          totalCount: 1,
          completionPercent: p.status === 'completed' ? 100 : 0,
        });
      }
    });

    const contentCompletionList = Array.from(contentCompletionByItem.values())
      .sort((a, b) => b.completionPercent - a.completionPercent);

    // Upcoming items (simplified - would need to query events)
    const upcoming: UpcomingItem[] = [];

    // Build response
    const dashboardData: ProgramDashboardData = {
      programId,
      programName: program.name || 'Program',
      programType,
      totalWeeks,
      stats: {
        activeClients,
        newThisWeek,
        avgProgress,
        progressRange,
        avgStreak,
        bestStreak,
        contentCompletion,
        totalContentItems,
        completedContentItems: completedContent,
      },
      needsAttention,
      topPerformers,
      contentCompletion: contentCompletionList,
      upcoming,
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error('[PROGRAM_DASHBOARD] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
