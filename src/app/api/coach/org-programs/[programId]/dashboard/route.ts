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
import type { Program, ProgramEnrollment, ContentProgress, ProgramInstance, WeekResourceAssignment } from '@/types';

interface MemberStats {
  userId: string;
  name: string;
  avatarUrl?: string;
  currentWeek: number;
  taskCompletionPercent: number;
  streak: number;
  lastActiveAt?: string;
  daysIdle: number;
  enrollmentId: string;
  tasksCompleted: number;
  totalTasks: number;
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
    avgTaskCompletion: number;
    taskCompletionRange: { min: number; max: number };
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
    tasksCompleted: number;
    totalTasks: number;
    contentCompleted: number;
    totalContent: number;
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
    const instanceIdParam = searchParams.get('instanceId'); // Optional: directly pass instanceId

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

    // Look up instance for filtering content progress and getting assigned resources
    // This ensures we only show progress for THIS program, not other programs
    let instanceId: string | null = instanceIdParam;
    let instance: (ProgramInstance & { id: string }) | null = null;

    if (!instanceId && cohortId) {
      // Look up instance by cohortId
      const instanceSnap = await adminDb
        .collection('program_instances')
        .where('cohortId', '==', cohortId)
        .where('programId', '==', programId)
        .limit(1)
        .get();

      if (!instanceSnap.empty) {
        instanceId = instanceSnap.docs[0].id;
        instance = { id: instanceSnap.docs[0].id, ...instanceSnap.docs[0].data() } as ProgramInstance & { id: string };
      }
    } else if (!instanceId && enrollments.length === 1) {
      // For individual programs, look up by enrollment
      const instanceSnap = await adminDb
        .collection('program_instances')
        .where('enrollmentId', '==', enrollments[0].id)
        .limit(1)
        .get();

      if (!instanceSnap.empty) {
        instanceId = instanceSnap.docs[0].id;
        instance = { id: instanceSnap.docs[0].id, ...instanceSnap.docs[0].data() } as ProgramInstance & { id: string };
      }
    } else if (instanceIdParam) {
      // If instanceId was passed directly, fetch it
      const instanceDoc = await adminDb.collection('program_instances').doc(instanceIdParam).get();
      if (instanceDoc.exists) {
        instance = { id: instanceDoc.id, ...instanceDoc.data() } as ProgramInstance & { id: string };
      }
    }

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
      // Fetch content progress - filter by instanceId if available for accurate program scoping
      const batchSize = 30;
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);

        // Build query with instanceId filter when available
        const progressQuery = adminDb
          .collection('content_progress')
          .where('userId', 'in', batch)
          .where('organizationId', '==', organizationId);

        // Note: content scoping happens later via uniqueResources (from instance weeks)
        // which filters by contentId during completion calculation

        const progressSnapshot = await progressQuery.get();

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

    // Calculate total program tasks from instance or program weeks
    // ProgramInstanceWeek has days[].tasks[], ProgramWeek has weeklyTasks[]
    let totalProgramTasks = 0;
    if (instance?.weeks) {
      instance.weeks.forEach((week) => {
        // Count tasks from days
        week.days?.forEach((day) => {
          totalProgramTasks += day.tasks?.length || 0;
        });
        // Also count weekly tasks
        totalProgramTasks += week.weeklyTasks?.length || 0;
      });
    } else if (program.weeks) {
      program.weeks.forEach((week) => {
        totalProgramTasks += week.weeklyTasks?.length || 0;
      });
    }
    const programWeekSource = instance?.weeks || program.weeks || [];

    // Calculate total assigned content from uniqueResources (calculated later, but we need it now)
    // Collect all assigned resources from instance or program weeks
    const allAssignedResourcesForTotals: WeekResourceAssignment[] = [];
    programWeekSource.forEach((week) => {
      const resources = week.resourceAssignments || [];
      const legacyCourses = week.courseAssignments || [];
      resources.forEach((r) => {
        if (r.resourceType === 'course' || r.resourceType === 'article') {
          allAssignedResourcesForTotals.push(r);
        }
      });
      legacyCourses.forEach((ca: { courseId?: string; title?: string }) => {
        if (ca.courseId) {
          allAssignedResourcesForTotals.push({
            id: ca.courseId,
            resourceType: 'course',
            resourceId: ca.courseId,
            title: ca.title,
            dayTag: 'week',
            order: 0,
          } as WeekResourceAssignment);
        }
      });
    });
    const uniqueResourcesForTotals = new Map<string, WeekResourceAssignment>();
    allAssignedResourcesForTotals.forEach((r) => {
      if (!uniqueResourcesForTotals.has(r.resourceId)) {
        uniqueResourcesForTotals.set(r.resourceId, r);
      }
    });
    const totalAssignedContent = uniqueResourcesForTotals.size;

    // Get task completions per user from tasks collection
    const userTaskCompletionsMap = new Map<string, number>();
    if (userIds.length > 0 && instanceId) {
      const batchSize = 30;
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        const tasksSnapshot = await adminDb
          .collection('tasks')
          .where('userId', 'in', batch)
          .where('instanceId', '==', instanceId)
          .where('completed', '==', true)
          .get();

        tasksSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          const userId = data.userId;
          const current = userTaskCompletionsMap.get(userId) || 0;
          userTaskCompletionsMap.set(userId, current + 1);
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

      // Calculate task completion percentage
      const tasksCompleted = userTaskCompletionsMap.get(enrollment.userId) || 0;
      const totalTasks = totalProgramTasks;
      const taskCompletionPercent = totalTasks > 0
        ? Math.round((tasksCompleted / totalTasks) * 100)
        : 0;

      // Get streak from alignment summary
      const streak = streakMap.get(enrollment.userId) || 0;

      return {
        userId: enrollment.userId,
        name: user.name,
        avatarUrl: user.avatarUrl,
        currentWeek,
        taskCompletionPercent,
        streak,
        lastActiveAt,
        daysIdle,
        enrollmentId: enrollment.id,
        tasksCompleted,
        totalTasks,
      };
    });

    // Calculate aggregate stats
    const activeClients = memberStats.length;
    const newThisWeek = enrollments.filter((e) => {
      const createdAt = e.createdAt;
      return createdAt && new Date(createdAt) >= oneWeekAgo;
    }).length;

    const taskCompletionValues = memberStats.map((m) => m.taskCompletionPercent);
    const avgTaskCompletion = taskCompletionValues.length > 0
      ? Math.round(taskCompletionValues.reduce((a, b) => a + b, 0) / taskCompletionValues.length)
      : 0;
    const taskCompletionRange = {
      min: taskCompletionValues.length > 0 ? Math.min(...taskCompletionValues) : 0,
      max: taskCompletionValues.length > 0 ? Math.max(...taskCompletionValues) : 0,
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

    // Identify members needing attention (< 50% task completion OR idle > 2 days)
    const needsAttention = memberStats
      .filter((m) => m.taskCompletionPercent < 50 || m.daysIdle > 2)
      .map((m) => {
        const reason = (m.taskCompletionPercent < 50 && m.daysIdle > 2
          ? 'both'
          : m.taskCompletionPercent < 50
          ? 'low_progress'
          : 'idle') as 'low_progress' | 'idle' | 'both';

        // Generate metric string based on reason
        let metric = '';
        if (reason === 'both') {
          metric = `${m.taskCompletionPercent}% tasks, ${m.daysIdle} days idle`;
        } else if (reason === 'low_progress') {
          metric = `${m.taskCompletionPercent}% tasks`;
        } else {
          metric = `${m.daysIdle} days idle`;
        }

        return {
          userId: m.userId,
          name: m.name,
          avatarUrl: m.avatarUrl,
          currentWeek: m.currentWeek,
          progress: m.taskCompletionPercent,
          daysInactive: m.daysIdle,
          lastActive: m.lastActiveAt,
          reason,
          metric,
          enrollmentId: m.enrollmentId,
        };
      })
      .sort((a, b) => a.progress - b.progress)
      .slice(0, 5);

    // Top performers (sorted by combined progress, then streak)
    // First, calculate combined progress for each member
    const membersWithCombinedProgress = memberStats.map((m) => {
      const userProgress = contentProgressMap.get(m.userId) || [];
      const contentCompleted = userProgress.filter(p => p.status === 'completed').length;
      const contentPercent = totalAssignedContent > 0
        ? Math.round((contentCompleted / totalAssignedContent) * 100)
        : 0;
      const combinedProgress = Math.round((m.taskCompletionPercent + contentPercent) / 2);

      return {
        ...m,
        contentCompleted,
        contentPercent,
        combinedProgress,
      };
    });

    const topPerformers = membersWithCombinedProgress
      .sort((a, b) => {
        if (b.combinedProgress !== a.combinedProgress) {
          return b.combinedProgress - a.combinedProgress;
        }
        return b.streak - a.streak;
      })
      .slice(0, 3)
      .map((m, index) => ({
        userId: m.userId,
        name: m.name,
        avatarUrl: m.avatarUrl,
        progress: m.combinedProgress,
        streak: m.streak,
        rank: index + 1,
        tasksCompleted: m.tasksCompleted,
        totalTasks: m.totalTasks,
        contentCompleted: m.contentCompleted,
        totalContent: totalAssignedContent,
        enrollmentId: m.enrollmentId,
      }));

    // Content completion by item - build from ASSIGNED resources, not just tracked progress
    // This shows completion for all content the coach assigned, even if no one started it yet
    const contentCompletionByItem = new Map<string, ContentCompletionItem>();

    // Collect all assigned resources from instance or program weeks
    const allAssignedResources: WeekResourceAssignment[] = [];

    console.log('[DASHBOARD] Content completion debug:', {
      hasInstance: !!instance,
      instanceId: instance?.id,
      instanceWeeksCount: instance?.weeks?.length,
      programWeeksCount: program.weeks?.length,
      programWeekSourceCount: programWeekSource.length,
      programWeekSourceSample: programWeekSource[0] ? {
        weekNumber: programWeekSource[0].weekNumber,
        resourceAssignmentsCount: programWeekSource[0].resourceAssignments?.length || 0,
        courseAssignmentsCount: programWeekSource[0].courseAssignments?.length || 0,
      } : null,
    });

    programWeekSource.forEach((week) => {
      // Get resources from both new and legacy formats
      const resources = week.resourceAssignments || [];
      const legacyCourses = week.courseAssignments || [];

      resources.forEach((r) => {
        if (r.resourceType === 'course' || r.resourceType === 'article') {
          allAssignedResources.push(r);
        }
      });

      // Also include legacy course assignments
      legacyCourses.forEach((ca: { courseId?: string; title?: string }) => {
        if (ca.courseId) {
          allAssignedResources.push({
            id: ca.courseId,
            resourceType: 'course',
            resourceId: ca.courseId,
            title: ca.title,
            dayTag: 'week',
            order: 0,
          } as WeekResourceAssignment);
        }
      });
    });

    // Deduplicate by resourceId
    const uniqueResources = new Map<string, WeekResourceAssignment>();
    allAssignedResources.forEach((r) => {
      if (!uniqueResources.has(r.resourceId)) {
        uniqueResources.set(r.resourceId, r);
      }
    });

    // Fetch metadata for all assigned content
    const assignedCourseIds = Array.from(uniqueResources.values())
      .filter((r) => r.resourceType === 'course')
      .map((r) => r.resourceId);
    const assignedArticleIds = Array.from(uniqueResources.values())
      .filter((r) => r.resourceType === 'article')
      .map((r) => r.resourceId);

    const assignedContentTitleMap = new Map<string, string>();

    // Fetch course titles (check both 'courses' and 'discover_courses' collections for compatibility)
    if (assignedCourseIds.length > 0) {
      const batchSize = 30;
      for (let i = 0; i < assignedCourseIds.length; i += batchSize) {
        const batch = assignedCourseIds.slice(i, i + batchSize);

        // First try the main 'courses' collection (where coach courses are stored)
        const courseDocs = await adminDb
          .collection('courses')
          .where('__name__', 'in', batch)
          .get();

        courseDocs.docs.forEach((doc) => {
          const data = doc.data();
          assignedContentTitleMap.set(doc.id, data.title || `Course ${doc.id.slice(0, 8)}`);
        });

        // Also check 'discover_courses' for any IDs not found (legacy/admin courses)
        const foundIds = new Set(courseDocs.docs.map(d => d.id));
        const missingIds = batch.filter(id => !foundIds.has(id));

        if (missingIds.length > 0) {
          const discoverCourseDocs = await adminDb
            .collection('discover_courses')
            .where('__name__', 'in', missingIds)
            .get();

          discoverCourseDocs.docs.forEach((doc) => {
            const data = doc.data();
            assignedContentTitleMap.set(doc.id, data.title || `Course ${doc.id.slice(0, 8)}`);
          });
        }
      }
    }

    // Fetch article titles (check both 'articles' and 'discover_articles' collections for compatibility)
    if (assignedArticleIds.length > 0) {
      const batchSize = 30;
      for (let i = 0; i < assignedArticleIds.length; i += batchSize) {
        const batch = assignedArticleIds.slice(i, i + batchSize);

        // First try the main 'articles' collection (where coach articles are stored)
        const articleDocs = await adminDb
          .collection('articles')
          .where('__name__', 'in', batch)
          .get();

        articleDocs.docs.forEach((doc) => {
          const data = doc.data();
          assignedContentTitleMap.set(doc.id, data.title || `Article ${doc.id.slice(0, 8)}`);
        });

        // Also check 'discover_articles' for any IDs not found (legacy/admin articles)
        const foundIds = new Set(articleDocs.docs.map(d => d.id));
        const missingIds = batch.filter(id => !foundIds.has(id));

        if (missingIds.length > 0) {
          const discoverArticleDocs = await adminDb
            .collection('discover_articles')
            .where('__name__', 'in', missingIds)
            .get();

          discoverArticleDocs.docs.forEach((doc) => {
            const data = doc.data();
            assignedContentTitleMap.set(doc.id, data.title || `Article ${doc.id.slice(0, 8)}`);
          });
        }
      }
    }

    // Build completion list from ASSIGNED content (shows all assigned, even if not started)
    const totalMembers = memberStats.length;

    uniqueResources.forEach((resource) => {
      // Count how many members completed this content
      let completedCount = 0;
      memberStats.forEach((member) => {
        const memberProgress = contentProgressMap.get(member.userId) || [];
        const hasCompleted = memberProgress.some(
          (p) => p.contentId === resource.resourceId && p.status === 'completed'
        );
        if (hasCompleted) completedCount++;
      });

      const contentType = resource.resourceType === 'course' ? 'course' : 'article';
      const title = assignedContentTitleMap.get(resource.resourceId) ||
        resource.title ||
        (contentType === 'article' ? `Article ${resource.resourceId.slice(0, 8)}` : `Course ${resource.resourceId.slice(0, 8)}`);

      contentCompletionByItem.set(resource.resourceId, {
        contentType,
        contentId: resource.resourceId,
        title,
        completedCount,
        totalCount: totalMembers,
        completionPercent: totalMembers > 0 ? Math.round((completedCount / totalMembers) * 100) : 0,
      });
    });

    // If no assigned resources found, fall back to tracked progress (for backwards compatibility)
    if (contentCompletionByItem.size === 0) {
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
    }

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
        avgTaskCompletion,
        taskCompletionRange,
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
