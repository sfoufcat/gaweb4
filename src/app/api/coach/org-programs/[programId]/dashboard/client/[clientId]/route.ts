/**
 * Client Dashboard API
 *
 * GET /api/coach/org-programs/[programId]/dashboard/client/[clientId]
 * Returns individual client progress data for the dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { Program, ProgramEnrollment, ContentProgress, ProgramInstance } from '@/types';

interface WeekProgressItem {
  weekNumber: number;
  progressPercent: number;
  status: 'completed' | 'current' | 'future';
}

interface LessonProgress {
  lessonId: string;
  title: string;
  completed: boolean;
  completedAt?: string;
}

interface ModuleProgress {
  moduleId: string;
  title: string;
  lessons: LessonProgress[];
}

interface ArticleProgress {
  articleId: string;
  title: string;
  completed: boolean;
  completedAt?: string;
}

// New engagement metrics interfaces
interface TaskVelocity {
  completed: number;
  total: number;
  rate: number;
  trend: 'up' | 'down' | 'stable';
}

interface ResponseTimeMetric {
  avgHours: number | null;
  sameDayPercent: number;
  bucket: 'same_day' | 'next_day' | 'delayed' | 'no_data';
}

interface ConsistencyMetric {
  currentStreak: number;
  lastActiveDate: string | null;
  daysSinceActive: number;
  level: 'high' | 'moderate' | 'low' | 'inactive';
}

interface EngagementTrend {
  direction: 'improving' | 'stable' | 'declining';
  percentChange: number;
  warning: boolean;
}

interface UpcomingItem {
  type: 'call' | 'form' | 'week_unlock';
  title: string;
  date?: string;
  actionType?: 'reschedule' | 'send_reminder';
}

interface PastSessionItem {
  id: string;
  title: string;
  date: string;
  coverImageUrl?: string;
  hasRecording: boolean;
  hasSummary?: boolean;
  summaryId?: string;
  hasFilledFromSummary?: boolean;
  eventId: string;
  eventType?: 'coaching_1on1' | 'cohort_call' | 'squad_call' | 'intake_call' | 'community_event';
}

interface ClientDashboardData {
  userId: string;
  name: string;
  avatarUrl?: string;
  enrollmentId: string;
  instanceId?: string;
  stats: {
    overallProgress: number;
    currentWeek: number;
    totalWeeks: number;
    currentStreak: number;
    bestStreak: number;
    contentCompletion: number;
    totalContentItems: number;
    completedContentItems: number;
    callsCompleted: number;
    totalCalls: number;
  };
  weekProgress: WeekProgressItem[];
  currentWeekContent: {
    modules: ModuleProgress[];
    articles: ArticleProgress[];
  };
  currentWeekProgramTasks?: {
    completed: number;
    total: number;
    tasks: Array<{ id: string; label: string; completed: boolean }>;
  };
  engagement: {
    taskVelocity: TaskVelocity;
    responseTime: ResponseTimeMetric;
    consistency: ConsistencyMetric;
    trend: EngagementTrend;
  };
  upcoming: UpcomingItem[];
  pastSessions: PastSessionItem[];
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
  return Math.min(Math.max(currentWeek, 1), totalWeeks);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; clientId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, clientId } = await params;

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
    // totalWeeks will be recalculated from instance if available
    let totalWeeks = Math.ceil(lengthDays / 7);

    // Get client's enrollment
    const enrollmentSnapshot = await adminDb
      .collection('program_enrollments')
      .where('programId', '==', programId)
      .where('userId', '==', clientId)
      .where('status', 'in', ['active', 'upcoming'])
      .limit(1)
      .get();

    if (enrollmentSnapshot.empty) {
      return NextResponse.json({ error: 'Client enrollment not found' }, { status: 404 });
    }

    const enrollmentDoc = enrollmentSnapshot.docs[0];
    const enrollment = {
      id: enrollmentDoc.id,
      ...enrollmentDoc.data(),
    } as ProgramEnrollment & { id: string };

    // Get user details
    const userDoc = await adminDb.collection('users').doc(clientId).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    const userName = `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() || 'Unknown';
    const userAvatarUrl = userData?.imageUrl || userData?.avatarUrl;

    // Calculate current week
    const startedAt = enrollment.startedAt || enrollment.createdAt || new Date().toISOString();
    const currentWeek = calculateCurrentWeek(startedAt, lengthDays);

    // Get program instance for this enrollment
    let instance: (ProgramInstance & { id: string }) | null = null;
    // Look up instance by enrollment ID
    const instanceSnapshot = await adminDb
      .collection('program_instances')
      .where('enrollmentId', '==', enrollment.id)
      .where('type', '==', 'individual')
      .limit(1)
      .get();

    if (!instanceSnapshot.empty) {
      const instanceDoc = instanceSnapshot.docs[0];
      instance = { id: instanceDoc.id, ...instanceDoc.data() } as ProgramInstance & { id: string };
      // Use instance weeks count if available (more accurate than lengthDays)
      if (instance.weeks && instance.weeks.length > 0) {
        // Filter out special weeks like onboarding (weekNumber 0 or -1)
        const regularWeeks = instance.weeks.filter(w => w.weekNumber > 0);
        totalWeeks = regularWeeks.length || totalWeeks;
      }
    }

    // Get content progress for this user
    const progressSnapshot = await adminDb
      .collection('content_progress')
      .where('userId', '==', clientId)
      .where('organizationId', '==', organizationId)
      .get();

    const contentProgress = progressSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ContentProgress[];

    // Calculate overall progress
    const completedContent = contentProgress.filter((p) => p.status === 'completed');
    const totalContentItems = contentProgress.length || 1;
    const completedContentItems = completedContent.length;
    const contentCompletion = Math.round((completedContentItems / totalContentItems) * 100) || 0;

    // Calculate week progress
    const weekProgress: WeekProgressItem[] = [];
    for (let week = 1; week <= totalWeeks; week++) {
      let status: 'completed' | 'current' | 'future';
      let progressPercent = 0;

      if (week < currentWeek) {
        status = 'completed';
        progressPercent = 100;
      } else if (week === currentWeek) {
        status = 'current';
        // Calculate progress for current week from content_progress
        const weekContent = contentProgress.filter((p) => p.weekIndex === week);
        const weekCompleted = weekContent.filter((p) => p.status === 'completed').length;
        progressPercent = weekContent.length > 0
          ? Math.round((weekCompleted / weekContent.length) * 100)
          : 50; // Default to 50% if no tracked content
      } else {
        status = 'future';
        progressPercent = 0;
      }

      weekProgress.push({ weekNumber: week, progressPercent, status });
    }

    // Calculate overall progress from week progress
    const overallProgress = Math.round(
      weekProgress.reduce((sum, w) => sum + w.progressPercent, 0) / totalWeeks
    );

    // Get current week content
    const currentWeekContent = {
      modules: [] as ModuleProgress[],
      articles: [] as ArticleProgress[],
    };

    // Get current week's assigned content from instance
    if (instance?.weeks && instance.weeks[currentWeek - 1]) {
      const weekData = instance.weeks[currentWeek - 1];

      // Get resource assignments for current week
      const resourceAssignments = weekData.resourceAssignments || [];

      // Group by content type
      const courses = resourceAssignments.filter((r) => r.resourceType === 'course');
      const articles = resourceAssignments.filter((r) => r.resourceType === 'article');

      // Fetch course metadata to get actual lesson counts (not just from progress)
      const courseIds = courses.map((c) => c.resourceId).filter(Boolean);
      const courseMetaMap = new Map<string, { title: string; lessons: { id: string; title: string; order: number }[] }>();

      if (courseIds.length > 0) {
        // Helper to process course doc data
        const processCourseDoc = (doc: FirebaseFirestore.DocumentSnapshot) => {
          const data = doc.data();
          if (!data) return;

          // Lessons can be in different structures depending on course format
          let lessons: { id: string; title: string; order: number }[] = [];

          if (data.lessons && Array.isArray(data.lessons)) {
            lessons = data.lessons.map((lesson: { id?: string; title?: string; order?: number }, idx: number) => ({
              id: lesson.id || `lesson-${idx}`,
              title: lesson.title || `Lesson ${idx + 1}`,
              order: lesson.order ?? idx,
            }));
          } else if (data.modules && Array.isArray(data.modules)) {
            // Flat list of lessons from all modules
            data.modules.forEach((mod: { lessons?: { id?: string; title?: string; order?: number }[] }, modIdx: number) => {
              if (mod.lessons && Array.isArray(mod.lessons)) {
                mod.lessons.forEach((lesson, lesIdx: number) => {
                  lessons.push({
                    id: lesson.id || `lesson-${modIdx}-${lesIdx}`,
                    title: lesson.title || `Lesson ${lessons.length + 1}`,
                    order: lessons.length,
                  });
                });
              }
            });
          }

          courseMetaMap.set(doc.id, {
            title: data.title || 'Course',
            lessons,
          });
        };

        // Firestore 'in' query limited to 30 items
        const batchSize = 30;
        for (let i = 0; i < courseIds.length; i += batchSize) {
          const batch = courseIds.slice(i, i + batchSize);

          // First try the main 'courses' collection (where coach courses are stored)
          const courseDocs = await adminDb
            .collection('courses')
            .where('__name__', 'in', batch)
            .get();

          courseDocs.forEach(processCourseDoc);

          // Also check 'discover_courses' for any IDs not found (legacy/admin courses)
          const foundIds = new Set(courseDocs.docs.map(d => d.id));
          const missingIds = batch.filter(id => !foundIds.has(id));

          if (missingIds.length > 0) {
            const discoverCourseDocs = await adminDb
              .collection('discover_courses')
              .where('__name__', 'in', missingIds)
              .get();

            discoverCourseDocs.forEach(processCourseDoc);
          }
        }
      }

      // Build modules with ACTUAL lesson counts from course metadata
      courses.forEach((course) => {
        const courseMeta = courseMetaMap.get(course.resourceId);
        const courseProgress = contentProgress.filter(
          (p) => p.contentId === course.resourceId && p.contentType === 'course_lesson'
        );

        // Build lessons from course metadata, overlay with progress
        const lessons: LessonProgress[] = (courseMeta?.lessons || []).map((lesson) => {
          const lessonProgress = courseProgress.find((p) => p.lessonId === lesson.id);
          return {
            lessonId: lesson.id,
            title: lesson.title,
            completed: lessonProgress?.status === 'completed',
            completedAt: lessonProgress?.completedAt,
          };
        });

        // If no metadata found but we have progress, fall back to progress-based lessons
        // (This handles edge cases where course metadata is missing)
        if (lessons.length === 0 && courseProgress.length > 0) {
          courseProgress.forEach((p) => {
            lessons.push({
              lessonId: p.lessonId || p.id,
              title: `Lesson ${p.lessonId?.slice(0, 8) || ''}`,
              completed: p.status === 'completed',
              completedAt: p.completedAt,
            });
          });
        }

        const moduleProgress: ModuleProgress = {
          moduleId: course.resourceId,
          title: courseMeta?.title || course.title || 'Course',
          lessons,
        };

        currentWeekContent.modules.push(moduleProgress);
      });

      // Fetch article metadata for proper titles
      const articleIds = articles.map((a) => a.resourceId).filter(Boolean);
      const articleMetaMap = new Map<string, { title: string }>();

      if (articleIds.length > 0) {
        const batchSize = 30;
        for (let i = 0; i < articleIds.length; i += batchSize) {
          const batch = articleIds.slice(i, i + batchSize);

          // First try the main 'articles' collection (where coach articles are stored)
          const articleDocs = await adminDb
            .collection('articles')
            .where('__name__', 'in', batch)
            .get();

          articleDocs.forEach((doc) => {
            const data = doc.data();
            articleMetaMap.set(doc.id, {
              title: data.title || 'Article',
            });
          });

          // Also check 'discover_articles' for any IDs not found (legacy/admin articles)
          const foundIds = new Set(articleDocs.docs.map(d => d.id));
          const missingIds = batch.filter(id => !foundIds.has(id));

          if (missingIds.length > 0) {
            const discoverArticleDocs = await adminDb
              .collection('discover_articles')
              .where('__name__', 'in', missingIds)
              .get();

            discoverArticleDocs.forEach((doc) => {
              const data = doc.data();
              articleMetaMap.set(doc.id, {
                title: data.title || 'Article',
              });
            });
          }
        }
      }

      // Articles with proper titles
      articles.forEach((article) => {
        const articleMeta = articleMetaMap.get(article.resourceId);
        const articleProgress = contentProgress.find(
          (p) => p.contentId === article.resourceId && p.contentType === 'article'
        );

        currentWeekContent.articles.push({
          articleId: article.resourceId,
          title: articleMeta?.title || article.title || 'Article',
          completed: articleProgress?.status === 'completed',
          completedAt: articleProgress?.completedAt,
        });
      });
    }

    // ========================================
    // NEW ENGAGEMENT METRICS (accurate, measurable)
    // ========================================

    // Fetch tasks for engagement metrics (last 14 days)
    // Filter by programId to only count tasks from THIS program
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const tasksSnapshot = await adminDb
      .collection('tasks')
      .where('userId', '==', clientId)
      .where('organizationId', '==', organizationId)
      .where('programId', '==', programId)
      .where('date', '>=', fourteenDaysAgo.toISOString().split('T')[0])
      .get();

    interface TaskData {
      id: string;
      date: string;
      status: string;
      createdAt?: string;
      completedAt?: string;
    }

    // Filter out deleted tasks
    const tasks: TaskData[] = tasksSnapshot.docs
      .map(d => ({ id: d.id, ...d.data() } as TaskData))
      .filter(t => t.status !== 'deleted');

    // Split into this week vs last week
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
    const thisWeekTasks = tasks.filter(t => t.date >= sevenDaysAgoStr);
    const lastWeekTasks = tasks.filter(t => t.date < sevenDaysAgoStr);

    // 1. Task Velocity - completed vs total this week
    const thisWeekCompleted = thisWeekTasks.filter(t => t.status === 'completed').length;
    const thisWeekTotal = thisWeekTasks.length;
    const velocityRate = thisWeekTotal > 0 ? Math.round((thisWeekCompleted / thisWeekTotal) * 100) : 0;

    const lastWeekCompleted = lastWeekTasks.filter(t => t.status === 'completed').length;
    const velocityTrend: 'up' | 'down' | 'stable' =
      thisWeekCompleted > lastWeekCompleted ? 'up' :
      thisWeekCompleted < lastWeekCompleted ? 'down' : 'stable';

    const taskVelocity: TaskVelocity = {
      completed: thisWeekCompleted,
      total: thisWeekTotal,
      rate: velocityRate,
      trend: velocityTrend,
    };

    // 2. Response Time - how quickly tasks are completed after creation
    const completedWithTimes = tasks.filter(t =>
      t.completedAt && t.createdAt && t.status === 'completed'
    );

    let avgResponseHours: number | null = null;
    let sameDayCount = 0;

    if (completedWithTimes.length > 0) {
      const responseTimes = completedWithTimes.map(t => {
        const created = new Date(t.createdAt!).getTime();
        const completed = new Date(t.completedAt!).getTime();
        const hours = (completed - created) / (1000 * 60 * 60);
        if (hours < 24) sameDayCount++;
        return hours;
      });
      avgResponseHours = Math.round(
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length * 10
      ) / 10;
    }

    const sameDayPercent = completedWithTimes.length > 0
      ? Math.round((sameDayCount / completedWithTimes.length) * 100)
      : 0;

    const responseTimeBucket: ResponseTimeMetric['bucket'] =
      avgResponseHours === null ? 'no_data' :
      avgResponseHours < 24 ? 'same_day' :
      avgResponseHours < 48 ? 'next_day' : 'delayed';

    const responseTime: ResponseTimeMetric = {
      avgHours: avgResponseHours,
      sameDayPercent,
      bucket: responseTimeBucket,
    };

    // 3. Engagement Trend - week over week comparison
    const lastWeekTotal = lastWeekTasks.length;
    let trendPercent = 0;
    if (lastWeekCompleted > 0) {
      trendPercent = Math.round(((thisWeekCompleted / lastWeekCompleted) - 1) * 100);
    } else if (thisWeekCompleted > 0) {
      trendPercent = 100; // Went from 0 to something
    }

    const trendDirection: EngagementTrend['direction'] =
      trendPercent > 10 ? 'improving' :
      trendPercent < -10 ? 'declining' : 'stable';

    const engagementTrend: EngagementTrend = {
      direction: trendDirection,
      percentChange: trendPercent,
      warning: trendPercent <= -30, // 30% decline triggers warning
    };

    // 4. Consistency - streak and last active date
    let currentStreak = 0;
    let lastAlignedDate: string | null = null;
    try {
      const summaryDocId = `${organizationId}_${clientId}`;
      const summaryDoc = await adminDb.collection('userAlignmentSummary').doc(summaryDocId).get();
      if (summaryDoc.exists) {
        const summaryData = summaryDoc.data();
        currentStreak = summaryData?.currentStreak ?? 0;
        lastAlignedDate = summaryData?.lastAlignedDate ?? null;
      }
    } catch (err) {
      console.warn('[CLIENT_DASHBOARD] Failed to fetch streak:', err);
    }

    // Calculate days since last active
    let daysSinceActive = -1;
    if (lastAlignedDate) {
      const lastActive = new Date(lastAlignedDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      lastActive.setHours(0, 0, 0, 0);
      daysSinceActive = Math.floor((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
    }

    const consistencyLevel: ConsistencyMetric['level'] =
      currentStreak >= 7 ? 'high' :
      currentStreak >= 3 ? 'moderate' :
      daysSinceActive > 7 ? 'inactive' : 'low';

    const consistency: ConsistencyMetric = {
      currentStreak,
      lastActiveDate: lastAlignedDate,
      daysSinceActive,
      level: consistencyLevel,
    };

    const bestStreak = currentStreak; // Best streak would need historical tracking

    // Get calls (simplified - would need to query events)
    const callsCompleted = 0; // Placeholder
    const totalCalls = 0;

    // Get upcoming items (simplified)
    const upcoming: UpcomingItem[] = [];

    // Get past sessions for this client
    const pastSessions: PastSessionItem[] = [];
    try {
      const now = new Date().toISOString();

      // Query 1: Events where client is in attendeeIds
      const attendeeEventsSnapshot = await adminDb
        .collection('events')
        .where('attendeeIds', 'array-contains', clientId)
        .where('startDateTime', '<', now)
        .orderBy('startDateTime', 'desc')
        .limit(50)
        .get();

      // Query 2: Coaching 1:1 events where client is the clientUserId
      const clientEventsSnapshot = await adminDb
        .collection('events')
        .where('clientUserId', '==', clientId)
        .where('startDateTime', '<', now)
        .orderBy('startDateTime', 'desc')
        .limit(50)
        .get();

      // Merge and dedupe results
      const seenIds = new Set<string>();
      const allDocs = [...attendeeEventsSnapshot.docs, ...clientEventsSnapshot.docs];

      // Collect events and their callSummaryIds
      const eventsToProcess: Array<{ doc: FirebaseFirestore.QueryDocumentSnapshot; data: FirebaseFirestore.DocumentData }> = [];
      const summaryIdsToCheck: string[] = [];

      for (const doc of allDocs) {
        if (seenIds.has(doc.id)) continue;
        seenIds.add(doc.id);

        const data = doc.data();
        // Filter to only include events related to this program (coaching calls)
        if (data.eventType === 'coaching_1on1' || data.programId === programId || (data.programIds && data.programIds.includes(programId))) {
          eventsToProcess.push({ doc, data });
          if (data.callSummaryId) {
            summaryIdsToCheck.push(data.callSummaryId);
          }
        }
      }

      // Batch verify which summaries actually exist (stored under organizations/{orgId}/call_summaries)
      const existingSummaryIds = new Set<string>();
      if (summaryIdsToCheck.length > 0) {
        const summaryRefs = summaryIdsToCheck.map(id =>
          adminDb.collection('organizations').doc(organizationId).collection('call_summaries').doc(id)
        );
        const summaryDocs = await adminDb.getAll(...summaryRefs);
        summaryDocs.forEach((docSnap, idx) => {
          if (docSnap.exists) {
            existingSummaryIds.add(summaryIdsToCheck[idx]);
          }
        });
      }

      // Build a set of summary IDs that have been used to fill weeks
      const filledFromSummaryIds = new Set<string>();
      if (instance?.weeks) {
        for (const week of instance.weeks) {
          if (week.fillSource?.type === 'call_summary' && week.fillSource.sourceId) {
            filledFromSummaryIds.add(week.fillSource.sourceId);
          }
        }
      }

      for (const { doc, data } of eventsToProcess) {
        const hasSummary = !!(data.callSummaryId && existingSummaryIds.has(data.callSummaryId));
        const hasFilledFromSummary = hasSummary && data.callSummaryId ? filledFromSummaryIds.has(data.callSummaryId) : false;
        pastSessions.push({
          id: doc.id,
          title: data.title || 'Coaching Call',
          date: data.startDateTime,
          coverImageUrl: data.coverImageUrl,
          hasRecording: !!data.recordingUrl,
          hasSummary,
          summaryId: hasSummary ? data.callSummaryId : undefined,
          hasFilledFromSummary,
          eventId: doc.id,
          eventType: data.eventType || 'coaching_1on1',
        });
      }

      // Sort by date descending
      pastSessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (err) {
      console.warn('[CLIENT_DASHBOARD] Failed to fetch past sessions:', err);
    }

    // Calculate current week program tasks from tasks collection (actual user tasks)
    let currentWeekProgramTasks: ClientDashboardData['currentWeekProgramTasks'];
    if (instance?.weeks) {
      // Find current week in instance - match based on calendar dates or weekNumber
      // WeekNumber 0 is onboarding, -1 is closing
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      // Find the week that contains today's date, or fall back to weekNumber matching
      let instanceWeek = instance.weeks.find(w => {
        if (w.calendarStartDate && w.calendarEndDate) {
          return todayStr >= w.calendarStartDate && todayStr <= w.calendarEndDate;
        }
        return false;
      });

      // Fallback: match by weekNumber (currentWeek is 1-indexed for display)
      if (!instanceWeek) {
        instanceWeek = instance.weeks.find(w => w.weekNumber === currentWeek - 1 || w.weekNumber === currentWeek);
      }

      // Final fallback: first week
      if (!instanceWeek) {
        instanceWeek = instance.weeks[0];
      }

      if (instanceWeek) {
        // Get the day index range for this week
        const startDayIndex = instanceWeek.startDayIndex || 1;
        const endDayIndex = instanceWeek.endDayIndex || startDayIndex + 4;

        // Query actual tasks from tasks collection for this instance
        // Filter by instanceId only to avoid needing composite index, then filter in code
        const weekTasksSnapshot = await adminDb
          .collection('tasks')
          .where('instanceId', '==', instance.id)
          .get();

        // Filter out deleted tasks and tasks outside the dayIndex range
        const allTasks: Array<{ id: string; label: string; completed: boolean }> = [];

        for (const doc of weekTasksSnapshot.docs) {
          const taskData = doc.data();
          // Skip deleted tasks
          if (taskData.status === 'deleted') continue;
          // Filter by dayIndex range for current week
          const taskDayIndex = taskData.dayIndex;
          if (taskDayIndex < startDayIndex || taskDayIndex > endDayIndex) continue;

          allTasks.push({
            id: doc.id,
            label: taskData.label || taskData.title || 'Task',
            completed: taskData.completed === true || taskData.status === 'completed',
          });
        }

        const completedCount = allTasks.filter(t => t.completed).length;
        currentWeekProgramTasks = {
          completed: completedCount,
          total: allTasks.length,
          tasks: allTasks,
        };
      }
    }

    // Build response
    const dashboardData: ClientDashboardData = {
      userId: clientId,
      name: userName,
      avatarUrl: userAvatarUrl,
      enrollmentId: enrollment.id,
      instanceId: instance?.id,
      stats: {
        overallProgress,
        currentWeek,
        totalWeeks,
        currentStreak,
        bestStreak,
        contentCompletion,
        totalContentItems,
        completedContentItems,
        callsCompleted,
        totalCalls,
      },
      weekProgress,
      currentWeekContent,
      currentWeekProgramTasks,
      engagement: {
        taskVelocity,
        responseTime,
        consistency,
        trend: engagementTrend,
      },
      upcoming,
      pastSessions,
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error('[CLIENT_DASHBOARD] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch client dashboard data' }, { status: 500 });
  }
}
