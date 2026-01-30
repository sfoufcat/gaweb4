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

interface EngagementItem {
  contentId: string;
  title: string;
  count: number;
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
  engagement: {
    reWatched: EngagementItem[];
    reRead: EngagementItem[];
    mostActiveDays: string[];
    mostActiveHours: string;
    pattern?: string;
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
    const totalWeeks = Math.ceil(lengthDays / 7);

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

    // Calculate engagement insights
    const reWatched: EngagementItem[] = contentProgress
      .filter((p) => p.contentType === 'course_lesson' && (p.completionCount || 0) > 1)
      .map((p) => ({
        contentId: p.contentId,
        title: `Lesson ${p.lessonId?.slice(0, 8) || ''}`,
        count: p.completionCount || 1,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    const reRead: EngagementItem[] = contentProgress
      .filter((p) => p.contentType === 'article' && (p.completionCount || 0) > 1)
      .map((p) => ({
        contentId: p.contentId,
        title: `Article ${p.contentId.slice(0, 8)}`,
        count: p.completionCount || 1,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // Analyze activity patterns from progress timestamps
    const activityDays = new Map<string, number>();
    const activityHours = new Map<number, number>();

    contentProgress.forEach((p) => {
      if (p.lastAccessedAt) {
        const date = new Date(p.lastAccessedAt);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        const hour = date.getHours();

        activityDays.set(dayName, (activityDays.get(dayName) || 0) + 1);
        activityHours.set(hour, (activityHours.get(hour) || 0) + 1);
      }
    });

    const mostActiveDays = Array.from(activityDays.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([day]) => day);

    const mostActiveHourEntry = Array.from(activityHours.entries()).sort(
      (a, b) => b[1] - a[1]
    )[0];
    const mostActiveHours = mostActiveHourEntry
      ? `${mostActiveHourEntry[0]}:00-${mostActiveHourEntry[0] + 1}:00`
      : 'N/A';

    // Generate pattern insight
    let pattern: string | undefined;
    if (reWatched.length > 0) {
      pattern = 'Revisits foundational content before assessments';
    } else if (mostActiveDays.length > 0) {
      pattern = `Most active on ${mostActiveDays.join(' and ')}`;
    }

    // Get streak from userAlignmentSummary
    let currentStreak = 0;
    try {
      const summaryDocId = `${organizationId}_${clientId}`;
      const summaryDoc = await adminDb.collection('userAlignmentSummary').doc(summaryDocId).get();
      if (summaryDoc.exists) {
        const summaryData = summaryDoc.data();
        currentStreak = summaryData?.currentStreak ?? 0;
      }
    } catch (err) {
      console.warn('[CLIENT_DASHBOARD] Failed to fetch streak:', err);
    }
    const bestStreak = currentStreak; // Best streak would need historical tracking

    // Get calls (simplified - would need to query events)
    const callsCompleted = 0; // Placeholder
    const totalCalls = 0;

    // Get upcoming items (simplified)
    const upcoming: UpcomingItem[] = [];

    // Add week unlock if not at last week
    if (currentWeek < totalWeeks) {
      const nextWeekStart = new Date(startedAt);
      nextWeekStart.setDate(nextWeekStart.getDate() + currentWeek * 7);

      upcoming.push({
        type: 'week_unlock',
        title: `Week ${currentWeek + 1} unlocks`,
        date: nextWeekStart.toISOString(),
      });
    }

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

      for (const doc of allDocs) {
        if (seenIds.has(doc.id)) continue;
        seenIds.add(doc.id);

        const data = doc.data();
        // Filter to only include events related to this program (coaching calls)
        if (data.eventType === 'coaching_1on1' || data.programId === programId || (data.programIds && data.programIds.includes(programId))) {
          pastSessions.push({
            id: doc.id,
            title: data.title || 'Coaching Call',
            date: data.startDateTime,
            coverImageUrl: data.coverImageUrl,
            hasRecording: !!data.recordingUrl,
            hasSummary: !!data.callSummaryId,
            eventId: doc.id,
            eventType: data.eventType || 'coaching_1on1',
          });
        }
      }

      // Sort by date descending
      pastSessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (err) {
      console.warn('[CLIENT_DASHBOARD] Failed to fetch past sessions:', err);
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
      engagement: {
        reWatched,
        reRead,
        mostActiveDays,
        mostActiveHours,
        pattern,
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
