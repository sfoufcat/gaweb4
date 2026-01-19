/**
 * Coach API: Course Analytics
 *
 * GET /api/coach/org-discover/courses/[courseId]/analytics - Get course analytics
 *
 * Returns analytics data including:
 * - Total watchers (users with access)
 * - Average completion percentage
 * - Per-lesson completion stats
 * - Watcher list with progress details
 * - Recent activity feed
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';

interface LessonStat {
  lessonId: string;
  lessonTitle: string;
  moduleId: string;
  moduleTitle: string;
  completionCount: number;
  completionPercent: number;
  avgWatchProgress: number;
}

interface Watcher {
  userId: string;
  firstName: string;
  lastName: string;
  imageUrl?: string;
  overallProgress: number;
  completedLessons: number;
  totalLessons: number;
  lastAccessedAt: string;
  lastLessonTitle?: string;
  lastLessonModuleTitle?: string;
  totalWatchTimeMinutes: number;
  accessType: 'purchase' | 'program';
  programName?: string;
}

interface RecentActivity {
  userId: string;
  userName: string;
  userImage?: string;
  action: 'started' | 'completed';
  lessonTitle: string;
  timestamp: string;
}

interface CourseModule {
  id: string;
  title: string;
  lessons?: CourseLesson[];
}

interface CourseLesson {
  id: string;
  title: string;
  durationMinutes?: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { courseId } = await params;

    // Get course and verify ownership
    const courseDoc = await adminDb.collection('courses').doc(courseId).get();
    if (!courseDoc.exists) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const courseData = courseDoc.data();
    if (courseData?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const modules: CourseModule[] = courseData?.modules || [];

    // Build lesson lookup map
    const lessonMap = new Map<string, { lesson: CourseLesson; module: CourseModule }>();
    let totalLessons = 0;
    let totalDuration = 0;

    modules.forEach(module => {
      (module.lessons || []).forEach(lesson => {
        lessonMap.set(lesson.id, { lesson, module });
        totalLessons++;
        totalDuration += lesson.durationMinutes || 0;
      });
    });

    // Get all users with direct course purchases
    const purchasesSnapshot = await adminDb.collection('user_content_purchases')
      .where('contentId', '==', courseId)
      .where('contentType', '==', 'course')
      .get();

    // Get users with access via program enrollments
    const programIds = courseData?.programIds || [];
    let programEnrollmentsSnapshot: FirebaseFirestore.QuerySnapshot | null = null;
    const programNameMap = new Map<string, string>();

    if (programIds.length > 0) {
      // Get program names
      const programDocs = await Promise.all(
        programIds.slice(0, 10).map((id: string) => adminDb.collection('programs').doc(id).get())
      );
      programDocs.forEach(doc => {
        if (doc.exists) {
          programNameMap.set(doc.id, doc.data()?.name || 'Unknown Program');
        }
      });

      // Get enrollments for these programs
      programEnrollmentsSnapshot = await adminDb.collection('program_enrollments')
        .where('programId', 'in', programIds.slice(0, 10))
        .where('status', '==', 'active')
        .get();
    }

    // Build map of userId -> access info
    const userAccessMap = new Map<string, { type: 'purchase' | 'program'; programName?: string }>();

    purchasesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      userAccessMap.set(data.userId, { type: 'purchase' });
    });

    if (programEnrollmentsSnapshot) {
      programEnrollmentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (!userAccessMap.has(data.userId)) {
          userAccessMap.set(data.userId, {
            type: 'program',
            programName: programNameMap.get(data.programId)
          });
        }
      });
    }

    const userIds = Array.from(userAccessMap.keys());

    // Get content progress for all these users for this course
    let progressDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    if (userIds.length > 0) {
      // Fetch progress in batches of 30 (Firestore 'in' limit)
      const batches = [];
      for (let i = 0; i < userIds.length; i += 30) {
        const batch = userIds.slice(i, i + 30);
        batches.push(
          adminDb.collection('content_progress')
            .where('userId', 'in', batch)
            .where('contentId', '==', courseId)
            .get()
        );
      }
      const results = await Promise.all(batches);
      progressDocs = results.flatMap(r => r.docs);
    }

    // Aggregate progress data per user and per lesson
    const userProgressMap = new Map<string, {
      completedLessons: Set<string>;
      lastAccessedAt: Date;
      lastLessonId?: string;
      totalWatchTimeMinutes: number;
    }>();

    const lessonStatsMap = new Map<string, {
      completionCount: number;
      totalWatchProgress: number;
      watchCount: number;
    }>();

    const recentActivityList: {
      userId: string;
      action: 'started' | 'completed';
      lessonId: string;
      timestamp: Date;
    }[] = [];

    progressDocs.forEach(doc => {
      const data = doc.data();
      const userId = data.userId;
      const lessonId = data.lessonId;

      // User-level aggregation
      if (!userProgressMap.has(userId)) {
        userProgressMap.set(userId, {
          completedLessons: new Set(),
          lastAccessedAt: new Date(0),
          totalWatchTimeMinutes: 0,
        });
      }
      const userProgress = userProgressMap.get(userId)!;

      if (data.status === 'completed' && lessonId) {
        userProgress.completedLessons.add(lessonId);
      }

      const lastAccessed = data.lastAccessedAt?.toDate?.() || new Date(data.lastAccessedAt || 0);
      if (lastAccessed > userProgress.lastAccessedAt) {
        userProgress.lastAccessedAt = lastAccessed;
        userProgress.lastLessonId = lessonId;
      }

      // Estimate watch time from progress (rough: progressPercent * lessonDuration)
      if (lessonId && data.watchProgress) {
        const lessonInfo = lessonMap.get(lessonId);
        if (lessonInfo) {
          const estimatedMinutes = (data.watchProgress / 100) * (lessonInfo.lesson.durationMinutes || 5);
          userProgress.totalWatchTimeMinutes += estimatedMinutes;
        }
      }

      // Lesson-level aggregation
      if (lessonId) {
        if (!lessonStatsMap.has(lessonId)) {
          lessonStatsMap.set(lessonId, {
            completionCount: 0,
            totalWatchProgress: 0,
            watchCount: 0,
          });
        }
        const lessonStats = lessonStatsMap.get(lessonId)!;

        if (data.status === 'completed') {
          lessonStats.completionCount++;
        }
        if (data.watchProgress) {
          lessonStats.totalWatchProgress += data.watchProgress;
          lessonStats.watchCount++;
        }

        // Track recent activity
        const completedAt = data.completedAt?.toDate?.() || (data.completedAt ? new Date(data.completedAt) : null);
        const startedAt = data.startedAt?.toDate?.() || (data.startedAt ? new Date(data.startedAt) : null);

        if (completedAt) {
          recentActivityList.push({
            userId,
            action: 'completed',
            lessonId,
            timestamp: completedAt,
          });
        } else if (startedAt) {
          recentActivityList.push({
            userId,
            action: 'started',
            lessonId,
            timestamp: startedAt,
          });
        }
      }
    });

    // Get user profiles for watchers
    const userProfiles = new Map<string, { firstName: string; lastName: string; imageUrl?: string }>();
    if (userIds.length > 0) {
      const batches = [];
      for (let i = 0; i < userIds.length; i += 30) {
        const batch = userIds.slice(i, i + 30);
        batches.push(
          adminDb.collection('users')
            .where('userId', 'in', batch)
            .get()
        );
      }
      const results = await Promise.all(batches);
      results.flatMap(r => r.docs).forEach(doc => {
        const data = doc.data();
        userProfiles.set(data.userId, {
          firstName: data.firstName || data.displayName?.split(' ')[0] || 'Unknown',
          lastName: data.lastName || data.displayName?.split(' ').slice(1).join(' ') || '',
          imageUrl: data.imageUrl || data.profileImageUrl,
        });
      });
    }

    // Build lesson stats array
    const lessonStats: LessonStat[] = [];
    modules.forEach(module => {
      (module.lessons || []).forEach(lesson => {
        const stats = lessonStatsMap.get(lesson.id);
        const totalWatchers = userIds.length || 1; // Avoid division by zero

        lessonStats.push({
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          moduleId: module.id,
          moduleTitle: module.title,
          completionCount: stats?.completionCount || 0,
          completionPercent: Math.round(((stats?.completionCount || 0) / totalWatchers) * 100),
          avgWatchProgress: stats?.watchCount ? Math.round(stats.totalWatchProgress / stats.watchCount) : 0,
        });
      });
    });

    // Build watchers array (sorted by completion progress descending)
    const watchers: Watcher[] = userIds.map(userId => {
      const profile = userProfiles.get(userId);
      const access = userAccessMap.get(userId)!;
      const progress = userProgressMap.get(userId);
      const lastLessonInfo = progress?.lastLessonId ? lessonMap.get(progress.lastLessonId) : null;

      const completedCount = progress?.completedLessons.size || 0;
      const overallProgress = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

      return {
        userId,
        firstName: profile?.firstName || 'Unknown',
        lastName: profile?.lastName || '',
        imageUrl: profile?.imageUrl,
        overallProgress,
        completedLessons: completedCount,
        totalLessons,
        lastAccessedAt: progress?.lastAccessedAt?.toISOString() || new Date().toISOString(),
        lastLessonTitle: lastLessonInfo?.lesson.title,
        lastLessonModuleTitle: lastLessonInfo?.module.title,
        totalWatchTimeMinutes: Math.round(progress?.totalWatchTimeMinutes || 0),
        accessType: access.type,
        programName: access.programName,
      };
    }).sort((a, b) => b.overallProgress - a.overallProgress);

    // Build recent activity (sorted by timestamp descending, limit 10)
    const recentActivity: RecentActivity[] = recentActivityList
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10)
      .map(activity => {
        const profile = userProfiles.get(activity.userId);
        const lessonInfo = lessonMap.get(activity.lessonId);

        return {
          userId: activity.userId,
          userName: `${profile?.firstName || 'Unknown'} ${profile?.lastName || ''}`.trim(),
          userImage: profile?.imageUrl,
          action: activity.action,
          lessonTitle: lessonInfo?.lesson.title || 'Unknown Lesson',
          timestamp: activity.timestamp.toISOString(),
        };
      });

    // Calculate averages
    const totalWatchers = watchers.length;
    const avgCompletionPercent = totalWatchers > 0
      ? Math.round(watchers.reduce((sum, w) => sum + w.overallProgress, 0) / totalWatchers)
      : 0;

    return NextResponse.json({
      totalWatchers,
      avgCompletionPercent,
      totalDuration,
      totalLessons,
      lessonStats,
      watchers,
      recentActivity,
    });
  } catch (error) {
    console.error('[COURSE_ANALYTICS] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
